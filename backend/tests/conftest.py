import os
from uuid import UUID

import psycopg
import pytest
from sqlalchemy.engine import make_url

TENANT_A = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
TENANT_B = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
PRINCIPAL_A = UUID("aaaaaaaa-0000-0000-0000-000000000001")
PRINCIPAL_B = UUID("bbbbbbbb-0000-0000-0000-000000000001")
PRINCIPAL_INACTIVE = UUID("aaaaaaaa-0000-0000-0000-000000000002")


def _dsn(name: str) -> str:
    value = os.environ[name]
    url = make_url(value).set(drivername="postgresql")
    if name == "SEED_DATABASE_URL":
        url = url.set(database=make_url(os.environ["DATABASE_URL"]).database)
    return url.render_as_string(hide_password=False)


@pytest.fixture(scope="session")
def seeded_foundation() -> None:
    with psycopg.connect(_dsn("SEED_DATABASE_URL"), autocommit=True) as connection:
        connection.execute(
            """
            INSERT INTO tenants (id, slug, name, status) VALUES
              (%s, 'tenant-a', 'Tenant A', 'active'),
              (%s, 'tenant-b', 'Tenant B', 'active')
            ON CONFLICT (id) DO NOTHING
            """,
            (TENANT_A, TENANT_B),
        )
        connection.execute(
            """
            INSERT INTO principals (id, kind, display_name, status) VALUES
              (%s, 'human', 'Principal A', 'active'),
              (%s, 'human', 'Principal B', 'active'),
              (%s, 'human', 'Principal inactive', 'active')
            ON CONFLICT (id) DO NOTHING
            """,
            (PRINCIPAL_A, PRINCIPAL_B, PRINCIPAL_INACTIVE),
        )
        connection.execute(
            """
            INSERT INTO tenant_memberships (tenant_id, principal_id, status) VALUES
              (%s, %s, 'active'),
              (%s, %s, 'active'),
              (%s, %s, 'inactive')
            ON CONFLICT (tenant_id, principal_id) DO UPDATE SET status = EXCLUDED.status
            """,
            (
                TENANT_A,
                PRINCIPAL_A,
                TENANT_B,
                PRINCIPAL_B,
                TENANT_A,
                PRINCIPAL_INACTIVE,
            ),
        )


@pytest.fixture
def app_dsn(seeded_foundation: None) -> str:
    return _dsn("DATABASE_URL")


@pytest.fixture
def seed_dsn(seeded_foundation: None) -> str:
    return _dsn("SEED_DATABASE_URL")
