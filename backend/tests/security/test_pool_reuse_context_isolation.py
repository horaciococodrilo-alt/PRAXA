"""El contexto de tenant no sobrevive a la reutilizacion de una conexion fisica.

Es el unico archivo autorizado a usar `set_config(..., false)`, y esta declarado como excepcion
en tests/unit/test_no_forbidden_patterns.py. Lo necesita para construir a proposito el escenario
que la capa 2 -RESET ALL al devolver la conexion- tiene que limpiar, y su control negativo.

Tres escenarios que no deben confundirse:

    set_local / commit     el GUC muere al terminar la transaccion   -> lo limpia PostgreSQL
    set_local / rollback   idem                                      -> lo limpia PostgreSQL
    session  / commit      el GUC sobrevive a la transaccion         -> SOLO lo limpia RESET ALL

El cuarto caso posible, `session / rollback`, no ejercita la capa 2: PostgreSQL revierte por si
mismo un cambio de GUC de sesion hecho dentro de una transaccion abortada. Se documenta aca para
que no se lo confunda con el tercero.

`pool_size=1, max_overflow=0` obliga fisicamente a reutilizar la misma conexion. El test
**verifica** que asi fue comparando `pg_backend_pid()`: sin esa asercion podria pasar por haber
recibido otra conexion, que es exactamente el falso positivo que hay que evitar.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Literal

import pytest
from sqlalchemy import Connection, Engine, create_engine, text
from sqlalchemy.pool import QueuePool

from praxa.config import AppSettings
from praxa.shared.db.engine import register_context_reset
from praxa.shared.db.session import (
    PRINCIPAL_GUC,
    ROLE_GUC,
    TENANT_GUC,
    TenantContext,
    set_tenant_context,
)
from tests.conftest import Fixtures

pytestmark = pytest.mark.security

Scope = Literal["set_local", "session"]
Ending = Literal["commit", "rollback"]

_SINGLE_CONNECTION_POOL = {
    "poolclass": QueuePool,
    "pool_size": 1,
    "max_overflow": 0,
    "pool_recycle": -1,
    "pool_pre_ping": False,
}


def _backend_pid(connection: Connection) -> int:
    return int(connection.execute(text("SELECT pg_backend_pid()")).scalar_one())


def _raw_context(connection: Connection) -> tuple[str | None, str | None, str | None]:
    row = connection.execute(
        text(
            "SELECT nullif(current_setting(:t, true), ''),"
            "       nullif(current_setting(:p, true), ''),"
            "       nullif(current_setting(:r, true), '')"
        ),
        {"t": TENANT_GUC, "p": PRINCIPAL_GUC, "r": ROLE_GUC},
    ).one()
    return (row[0], row[1], row[2])


def _apply_context(
    connection: Connection, context: TenantContext, scope: Scope
) -> None:
    if scope == "set_local":
        set_tenant_context(connection, context)
        return
    # Deliberadamente a nivel de sesion: simula a alguien que se saltea el helper.
    connection.execute(
        text(
            "SELECT set_config(:t, :tenant, false),"
            "       set_config(:p, :principal, false),"
            "       set_config(:r, :role, false)"
        ),
        {
            "t": TENANT_GUC,
            "tenant": str(context.tenant_id),
            "p": PRINCIPAL_GUC,
            "principal": str(context.principal_id),
            "r": ROLE_GUC,
            "role": context.role,
        },
    )


@pytest.fixture
def single_connection_engine(app_settings: AppSettings) -> Iterator[Engine]:
    """Engine dedicado, para que ninguna otra sesion pueda tomar la conexion."""
    engine = create_engine(
        app_settings.dsn, pool_reset_on_return=None, **_SINGLE_CONNECTION_POOL
    )
    register_context_reset(engine)
    yield engine
    engine.dispose()


@pytest.mark.parametrize(
    ("scope", "ending"),
    [("set_local", "commit"), ("set_local", "rollback"), ("session", "commit")],
)
def test_context_does_not_survive_pool_reuse(
    single_connection_engine: Engine,
    fixtures: Fixtures,
    scope: Scope,
    ending: Ending,
) -> None:
    engine = single_connection_engine
    context_a = TenantContext(
        tenant_id=fixtures.tenant_a, principal_id=fixtures.a_member, role="member"
    )
    context_b = TenantContext(
        tenant_id=fixtures.tenant_b, principal_id=fixtures.b_member, role="member"
    )

    # --- Fase 1: tenant A -------------------------------------------------------------
    with engine.connect() as connection:
        pid_first = _backend_pid(connection)
        # El SELECT de arriba abrio una transaccion implicita; hay que cerrarla antes de begin().
        connection.rollback()

        transaction = connection.begin()
        _apply_context(connection, context_a, scope)
        assert connection.execute(text("SELECT id FROM tenant")).scalars().all() == [
            fixtures.tenant_a
        ]
        if ending == "commit":
            transaction.commit()
        else:
            transaction.rollback()
    # La conexion vuelve al pool y dispara el listener de reset.

    # --- Fase 2: reutilizacion, antes de fijar contexto nuevo -------------------------
    with engine.connect() as connection:
        pid_second = _backend_pid(connection)
        assert pid_second == pid_first, (
            "prueba invalida: se obtuvo otra conexion fisica, asi que no se probo la "
            "reutilizacion"
        )
        pool = engine.pool
        assert isinstance(pool, QueuePool)
        assert pool.checkedout() == 1

        assert _raw_context(connection) == (None, None, None)
        assert (
            connection.execute(text("SELECT app_current_tenant_id()")).scalar_one()
            is None
        )

        for table in ("tenant", "principal", "tenant_membership"):
            assert (
                connection.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()
                == 0
            )

        assert (
            connection.execute(
                text("SELECT count(*) FROM tenant WHERE id = :tenant"),
                {"tenant": fixtures.tenant_a},
            ).scalar_one()
            == 0
        )

        # Cerrar la transaccion implicita de los SELECT anteriores antes de abrir otra.
        connection.rollback()

        # --- Fase 3: tenant B sobre la misma conexion fisica --------------------------
        with connection.begin():
            set_tenant_context(connection, context_b)
            assert _backend_pid(connection) == pid_first

            visible = connection.execute(text("SELECT id FROM tenant")).scalars().all()
            assert visible == [fixtures.tenant_b]
            assert fixtures.tenant_a not in visible


def test_reset_all_listener_is_load_bearing(
    app_settings: AppSettings, fixtures: Fixtures
) -> None:
    """Control negativo: sin el listener, el contexto de sesion confirmado **si** sobrevive.

    Demuestra que la capa 2 hace trabajo real. Si alguien la elimina y este test empieza a
    fallar, es la senal de que la proteccion desaparecio.
    """
    engine = create_engine(
        app_settings.dsn, pool_reset_on_return="rollback", **_SINGLE_CONNECTION_POOL
    )
    context_a = TenantContext(
        tenant_id=fixtures.tenant_a, principal_id=fixtures.a_member, role="member"
    )

    try:
        with engine.connect() as connection:
            pid_first = _backend_pid(connection)
            connection.rollback()
            with connection.begin():
                _apply_context(connection, context_a, "session")

        with engine.connect() as connection:
            assert _backend_pid(connection) == pid_first
            leaked_tenant, _, _ = _raw_context(connection)

            assert leaked_tenant == str(fixtures.tenant_a), (
                "Sin el listener de RESET ALL, un contexto de sesion confirmado deberia "
                "sobrevivir. Que no sobreviva significa que este control negativo dejo de "
                "probar lo que dice probar."
            )
    finally:
        engine.dispose()
