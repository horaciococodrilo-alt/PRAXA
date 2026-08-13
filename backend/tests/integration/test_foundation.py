import psycopg
import pytest

pytestmark = pytest.mark.integration


def test_vector_extension_and_expected_tables_exist(seed_dsn: str) -> None:
    with psycopg.connect(seed_dsn) as connection:
        extension = connection.execute(
            "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
        ).fetchone()
        tables = connection.execute(
            """
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename IN (
                'tenants', 'principals', 'tenant_memberships', 'roles',
                'permissions', 'membership_roles', 'role_permissions'
              )
            """
        ).fetchall()

    assert extension is not None
    assert len(tables) == 7


def test_roles_are_separated_and_least_privileged(seed_dsn: str) -> None:
    with psycopg.connect(seed_dsn) as connection:
        roles = connection.execute(
            """
            SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolinherit, rolbypassrls
            FROM pg_roles WHERE rolname IN ('praxa_owner', 'praxa_app') ORDER BY rolname
            """
        ).fetchall()
        owners = connection.execute(
            """
            SELECT DISTINCT tableowner FROM pg_tables
            WHERE schemaname = 'public' AND tablename <> 'alembic_version'
            """
        ).fetchall()

    assert roles == [
        ("praxa_app", False, False, False, False, False),
        ("praxa_owner", False, False, False, False, False),
    ]
    assert owners == [("praxa_owner",)]
