"""Contexto transaccional de tenant.

Frontera de confianza, explicita: `app.tenant_id`, `app.principal_id` y `app.role` son
afirmaciones de la aplicacion, no credenciales verificadas por PostgreSQL. RLS con contexto de
sesion defiende contra errores del codigo de aplicacion -un WHERE olvidado, un join mal
alcanzado-, no contra alguien que ya controla el proceso y su credencial. La autenticacion que
respalda esas afirmaciones llega en VS-05 (spec 17.4, pasos 1 a 4).

De ahi se sigue una regla que las migraciones tambien sostienen: `app.tenant_id` y
`app.principal_id` se usan en las policies porque acotan **identidad**; `app.role` no aparece en
ninguna policy, porque afirma **privilegio**, y derivar privilegio de un dato que cualquier sesion
puede fijar simularia un control sin ejercerlo.

Este modulo es el unico punto del codigo de produccion autorizado a fijar esas variables.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from contextlib import contextmanager
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy import Connection, Engine, text
from sqlalchemy.orm import Session

# `Session` y `Connection` son las dos formas en que este proyecto ejecuta SQL. Se usa una union
# y no un Protocol porque sus firmas de `execute` estan sobrecargadas y un Protocol estructural
# no las capta.
Executor = Session | Connection

TENANT_GUC = "app.tenant_id"
PRINCIPAL_GUC = "app.principal_id"
ROLE_GUC = "app.role"

_ROLE_PATTERN = re.compile(r"^[a-z][a-z_]{1,31}$")

# is_local=true en los tres: mueren al terminar la transaccion.
_SET_CONTEXT = text(
    "SELECT set_config(:tenant_key, :tenant_id, true),"
    "       set_config(:principal_key, :principal_id, true),"
    "       set_config(:role_key, :role, true)"
)

_READ_CONTEXT = text(
    "SELECT current_setting(:tenant_key, true),"
    "       current_setting(:principal_key, true),"
    "       current_setting(:role_key, true)"
)


class TenantContextLeakError(RuntimeError):
    """Una conexion llego con contexto de tenant ya fijado.

    Convierte una fuga silenciosa entre tenants en un fallo ruidoso.
    """


class TenantContext(BaseModel):
    """Identidad ya autenticada de quien ejecuta la transaccion.

    Los UUID se validan aca, antes de tocar SQL: un valor como `' OR 1=1 --` falla con
    `ValidationError` y nunca llega a la base.
    """

    model_config = ConfigDict(frozen=True)

    tenant_id: UUID
    principal_id: UUID
    role: str

    @field_validator("role")
    @classmethod
    def _validate_role(cls, value: str) -> str:
        if not _ROLE_PATTERN.fullmatch(value):
            raise ValueError(
                "role debe ser un identificador en minusculas (por ejemplo 'member'); "
                f"se recibio {value!r}."
            )
        return value


def _read_raw_context(executor: Executor) -> tuple[str | None, str | None, str | None]:
    result = executor.execute(
        _READ_CONTEXT,
        {
            "tenant_key": TENANT_GUC,
            "principal_key": PRINCIPAL_GUC,
            "role_key": ROLE_GUC,
        },
    )
    tenant, principal, role = result.one()
    return tenant, principal, role


def assert_no_inherited_context(executor: Executor) -> None:
    """Capa 3: falla si la conexion trae contexto de otro uso."""
    tenant, principal, role = _read_raw_context(executor)
    leaked = {
        TENANT_GUC: tenant,
        PRINCIPAL_GUC: principal,
        ROLE_GUC: role,
    }
    dirty = sorted(key for key, value in leaked.items() if value)
    if dirty:
        raise TenantContextLeakError(
            "La conexion trae contexto de tenant heredado en: "
            f"{', '.join(dirty)}. Se aborta antes de fijar un contexto nuevo."
        )


def set_tenant_context(executor: Executor, context: TenantContext) -> None:
    """Fija las tres variables con `SET LOCAL`, siempre con parametros ligados."""
    executor.execute(
        _SET_CONTEXT,
        {
            "tenant_key": TENANT_GUC,
            "tenant_id": str(context.tenant_id),
            "principal_key": PRINCIPAL_GUC,
            "principal_id": str(context.principal_id),
            "role_key": ROLE_GUC,
            "role": context.role,
        },
    )


@contextmanager
def tenant_session(
    engine: Engine,
    context: TenantContext,
    *,
    assert_clean: bool = True,
) -> Iterator[Session]:
    """Sesion dentro de una transaccion, con el contexto de tenant ya fijado."""
    with Session(engine) as session, session.begin():
        if assert_clean:
            assert_no_inherited_context(session)
        set_tenant_context(session, context)
        yield session
