"""VS-01 no crea ningun camino de escritura para la aplicacion.

`praxa_app` tiene `SELECT` y nada mas sobre las seis tablas. La denegacion ocurre en la capa de
**grants**, antes de llegar a RLS: falla con `42501 insufficient_privilege`.

Es una decision, no una omision. Un `UPDATE` acotado a la propia membership habria permitido
reactivar un `status` inactivo o rotar entre roles no privilegiados, y VS-01 no tiene ninguna
escritura de aplicacion que justifique ese riesgo. La provision de tenants, principals y
memberships es administrativa y queda fuera de esta fase.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import ProgrammingError

from praxa.shared.db.session import TenantContext, set_tenant_context
from praxa.tenancy.models import BUSINESS_TABLES, CATALOG_TABLES
from tests.conftest import Fixtures

pytestmark = pytest.mark.security

ALL_TABLES = BUSINESS_TABLES + CATALOG_TABLES

INSUFFICIENT_PRIVILEGE = "42501"


# El UPDATE debe ser valido salvo por los privilegios: PostgreSQL resuelve las columnas antes de
# chequear permisos, asi que una columna inexistente daria 42703 y el test no probaria nada.
_UPDATABLE_COLUMN = {
    "tenant": "created_at",
    "principal": "created_at",
    "tenant_membership": "created_at",
    "role": "description",
    "permission": "description",
    "role_permission": "role_key",
}


def _write_statements(table: str) -> dict[str, str]:
    column = _UPDATABLE_COLUMN[table]
    return {
        "INSERT": f"INSERT INTO {table} DEFAULT VALUES",
        "UPDATE": f"UPDATE {table} SET {column} = {column}",
        "DELETE": f"DELETE FROM {table}",
    }


@pytest.mark.parametrize("table", ALL_TABLES)
@pytest.mark.parametrize("command", ["INSERT", "UPDATE", "DELETE"])
def test_every_write_is_denied_by_grants(
    app_engine: Engine, fixtures: Fixtures, table: str, command: str
) -> None:
    context = TenantContext(
        tenant_id=fixtures.tenant_a, principal_id=fixtures.a_member, role="member"
    )
    statement = _write_statements(table)[command]

    with app_engine.connect() as connection, connection.begin():
        set_tenant_context(connection, context)
        with pytest.raises(ProgrammingError) as excinfo:
            connection.execute(text(statement))

    assert excinfo.value.orig is not None
    assert excinfo.value.orig.sqlstate == INSUFFICIENT_PRIVILEGE  # type: ignore[attr-defined]


def test_app_role_has_only_select_privileges(app_engine: Engine) -> None:
    with app_engine.connect() as connection:
        grants = connection.execute(
            text(
                "SELECT table_name, privilege_type FROM information_schema.role_table_grants "
                "WHERE grantee = current_user AND table_schema = 'public' "
                "ORDER BY table_name, privilege_type"
            )
        ).all()

    granted = {(row.table_name, row.privilege_type) for row in grants}
    assert granted == {(table, "SELECT") for table in ALL_TABLES}


def test_app_role_cannot_create_objects(app_engine: Engine) -> None:
    with (
        app_engine.connect() as connection,
        connection.begin(),
        pytest.raises(ProgrammingError) as excinfo,
    ):
        connection.execute(text(f"CREATE TABLE t_{uuid.uuid4().hex[:8]} (id int)"))

    assert excinfo.value.orig is not None
    assert excinfo.value.orig.sqlstate == INSUFFICIENT_PRIVILEGE  # type: ignore[attr-defined]
