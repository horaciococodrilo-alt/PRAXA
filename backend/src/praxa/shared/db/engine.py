"""Construccion del engine de aplicacion y limpieza de conexiones del pool.

Capa 2 de la proteccion contra fuga de contexto entre tenants.

`SET LOCAL` (capa 1) alcanza para el camino normal: PostgreSQL descarta la variable al terminar
la transaccion, tanto en COMMIT como en ROLLBACK. Lo que no cubre es que alguien fije la variable
a nivel de sesion salteandose `tenant_session` y confirme la transaccion: ese valor sobrevive al
fin de la transaccion y viaja con la conexion fisica al siguiente que la tome del pool.

`RESET ALL` en la devolucion cierra ese hueco. Se elige sobre `DISCARD ALL` para no invalidar el
cache de sentencias preparadas de psycopg 3.
"""

from __future__ import annotations

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.pool import ConnectionPoolEntry, PoolResetState

from praxa.config import AppSettings


def register_context_reset(engine: Engine) -> None:
    """Deja cada conexion sin variables de sesion y sin transaccion abierta al devolverla.

    El engine debe construirse con ``pool_reset_on_return=None``: este listener reemplaza
    el rollback por defecto en vez de sumarse a el.
    """

    @event.listens_for(engine, "reset")
    def _reset_connection(
        dbapi_connection: object,
        connection_record: ConnectionPoolEntry,
        reset_state: PoolResetState,
    ) -> None:
        if reset_state.terminate_only:
            # La conexion se esta cerrando; no tiene sentido (ni siempre es posible) hablarle.
            return

        # 1. Descartar la transaccion del usuario, haya terminado como haya terminado.
        dbapi_connection.rollback()  # type: ignore[attr-defined]

        # 2. Limpiar variables de sesion que hayan sobrevivido a la transaccion.
        with dbapi_connection.cursor() as cursor:  # type: ignore[attr-defined]
            cursor.execute("RESET ALL")

        # 3. Confirmar. Es obligatorio por dos razones independientes:
        #    - RESET ALL dentro de una transaccion que despues se revierte queda sin efecto;
        #    - la conexion debe volver al pool sin transaccion abierta.
        dbapi_connection.commit()  # type: ignore[attr-defined]


def create_app_engine(settings: AppSettings, **overrides: object) -> Engine:
    """Engine del rol de aplicacion, con la limpieza de contexto ya registrada."""
    kwargs: dict[str, object] = {
        "pool_size": settings.db_pool_size,
        "max_overflow": settings.db_max_overflow,
        # El listener toma el control del reset; no se acumula con el rollback por defecto.
        "pool_reset_on_return": None,
        "future": True,
    }
    kwargs.update(overrides)

    engine = create_engine(settings.dsn, **kwargs)
    register_context_reset(engine)
    return engine
