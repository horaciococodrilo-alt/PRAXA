"""Inventario de postura de seguridad de **todas** las tablas de `public`.

No basta con recorrer las tablas que tienen `tenant_id`: ese criterio dejaria afuera a `tenant`
-cuya columna se llama `id`- y a `principal` -que no tiene columna de tenant por diseno-.

Cada tabla se declara aca como `business` o `catalog`, y para todas se exige `ENABLE` y `FORCE
ROW LEVEL SECURITY`, los grants exactos de `praxa_app` y que no sea de su propiedad. Una tabla
nueva que no figure en el inventario hace fallar el test: es lo que impide que una fase futura
agregue una tabla sin declarar su postura.
"""

from __future__ import annotations

import pytest
from sqlalchemy import Engine, text

from praxa.tenancy.models import BUSINESS_TABLES, CATALOG_TABLES

pytestmark = pytest.mark.integration

DECLARED_TABLES = {
    **{name: "business" for name in BUSINESS_TABLES},
    **{name: "catalog" for name in CATALOG_TABLES},
}

# Alembic administra esta tabla; no lleva datos de cliente y la aplicacion no la toca.
UNMANAGED_TABLES = {"alembic_version"}


def _tables(engine: Engine) -> list[str]:
    with engine.connect() as connection:
        return list(
            connection.execute(
                text(
                    "SELECT c.relname FROM pg_class c "
                    "JOIN pg_namespace n ON n.oid = c.relnamespace "
                    "WHERE n.nspname = 'public' AND c.relkind = 'r' "
                    "ORDER BY c.relname"
                )
            )
            .scalars()
            .all()
        )


def test_every_table_is_declared(owner_engine: Engine) -> None:
    found = set(_tables(owner_engine)) - UNMANAGED_TABLES

    assert found == set(DECLARED_TABLES), (
        "Hay tablas sin postura de seguridad declarada. Agregalas a BUSINESS_TABLES o a "
        "CATALOG_TABLES en praxa.tenancy.models y revisa sus policies y grants."
    )


@pytest.mark.parametrize("table", sorted(DECLARED_TABLES))
def test_rls_is_enabled_and_forced(owner_engine: Engine, table: str) -> None:
    with owner_engine.connect() as connection:
        row = connection.execute(
            text(
                "SELECT relrowsecurity, relforcerowsecurity FROM pg_class c "
                "JOIN pg_namespace n ON n.oid = c.relnamespace "
                "WHERE n.nspname = 'public' AND c.relname = :table"
            ),
            {"table": table},
        ).one()

    assert row.relrowsecurity is True, f"{table} no tiene ENABLE ROW LEVEL SECURITY"
    assert row.relforcerowsecurity is True, f"{table} no tiene FORCE ROW LEVEL SECURITY"


@pytest.mark.parametrize("table", sorted(DECLARED_TABLES))
def test_every_table_has_at_least_one_permissive_policy(
    owner_engine: Engine, table: str
) -> None:
    """Sin policy permisiva, una tabla con RLS activa no devuelve filas a nadie.

    Que exista es intencional en las seis; el estado deny-all de `principal` entre 0005 y 0007 es
    transitorio dentro de la cadena de migraciones, no el estado final.
    """
    with owner_engine.connect() as connection:
        permissive = connection.execute(
            text(
                "SELECT count(*) FROM pg_policies "
                "WHERE schemaname = 'public' AND tablename = :table AND permissive = 'PERMISSIVE'"
            ),
            {"table": table},
        ).scalar_one()

    assert permissive >= 1


def test_app_role_grants_are_exactly_select(app_engine: Engine) -> None:
    with app_engine.connect() as connection:
        grants = connection.execute(
            text(
                "SELECT table_name, privilege_type FROM information_schema.role_table_grants "
                "WHERE grantee = current_user AND table_schema = 'public'"
            )
        ).all()

    assert {(row.table_name, row.privilege_type) for row in grants} == {
        (table, "SELECT") for table in DECLARED_TABLES
    }


def test_app_role_owns_no_table(app_engine: Engine) -> None:
    with app_engine.connect() as connection:
        owned = (
            connection.execute(
                text(
                    "SELECT c.relname FROM pg_class c "
                    "JOIN pg_namespace n ON n.oid = c.relnamespace "
                    "WHERE n.nspname = 'public' AND pg_get_userbyid(c.relowner) = current_user"
                )
            )
            .scalars()
            .all()
        )

    assert owned == []
