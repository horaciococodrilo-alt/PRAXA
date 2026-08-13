from uuid import UUID

import psycopg
import pytest
from psycopg.errors import InsufficientPrivilege
from sqlalchemy import text

from praxa.shared.db import build_engine, transactional_session
from tests.conftest import (
    PRINCIPAL_A,
    PRINCIPAL_INACTIVE,
    TENANT_A,
    TENANT_B,
)

pytestmark = pytest.mark.security


def test_tenant_a_cannot_read_tenant_b(app_dsn: str) -> None:
    engine = build_engine(app_dsn)
    try:
        with transactional_session(
            engine, tenant_id=TENANT_A, principal_id=PRINCIPAL_A
        ) as session:
            ids = (
                session.execute(text("SELECT id FROM tenants ORDER BY id"))
                .scalars()
                .all()
            )
        assert ids == [TENANT_A]
        assert TENANT_B not in ids
    finally:
        engine.dispose()


def test_without_context_fails_closed(app_dsn: str) -> None:
    with psycopg.connect(app_dsn) as connection:
        assert connection.execute("SELECT count(*) FROM tenants").fetchone() == (0,)
        assert connection.execute(
            "SELECT count(*) FROM tenant_memberships"
        ).fetchone() == (0,)


def test_invalid_uuid_fails_closed_without_aborting_transaction(app_dsn: str) -> None:
    with psycopg.connect(app_dsn) as connection:
        connection.execute("SELECT set_config('app.tenant_id', 'not-a-uuid', true)")
        connection.execute(
            "SELECT set_config('app.principal_id', 'also-invalid', true)"
        )
        assert connection.execute("SELECT count(*) FROM tenants").fetchone() == (0,)
        assert connection.execute("SELECT 1").fetchone() == (1,)


def test_inactive_principal_sees_only_own_membership_and_no_tenant(
    app_dsn: str,
) -> None:
    engine = build_engine(app_dsn)
    try:
        with transactional_session(
            engine, tenant_id=TENANT_A, principal_id=PRINCIPAL_INACTIVE
        ) as session:
            memberships = session.execute(
                text("SELECT principal_id, status FROM tenant_memberships")
            ).all()
            tenants = session.execute(text("SELECT id FROM tenants")).all()
        assert [(row[0], row[1]) for row in memberships] == [
            (PRINCIPAL_INACTIVE, "inactive")
        ]
        assert tenants == []
    finally:
        engine.dispose()


def test_app_cannot_insert_update_or_delete_cross_tenant(app_dsn: str) -> None:
    with psycopg.connect(app_dsn) as connection:
        connection.execute(
            "SELECT set_config('app.tenant_id', %s, true)", (str(TENANT_A),)
        )
        connection.execute(
            "SELECT set_config('app.principal_id', %s, true)", (str(PRINCIPAL_A),)
        )
        with pytest.raises(InsufficientPrivilege):
            connection.execute(
                "INSERT INTO tenants (id, slug, name, status) VALUES (%s, 'forbidden', 'x', 'active')",
                (UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),),
            )
        connection.rollback()
        with pytest.raises(InsufficientPrivilege):
            connection.execute(
                "UPDATE tenants SET name = 'x' WHERE id = %s", (TENANT_B,)
            )
        connection.rollback()
        with pytest.raises(InsufficientPrivilege):
            connection.execute("DELETE FROM tenants WHERE id = %s", (TENANT_B,))


def test_every_policy_is_explicitly_for_praxa_app(seed_dsn: str) -> None:
    with psycopg.connect(seed_dsn) as connection:
        rows = connection.execute(
            """
            SELECT policyname, roles::text[], coalesce(qual, ''), coalesce(with_check, '')
            FROM pg_policies WHERE schemaname = 'public'
            """
        ).fetchall()
    assert rows
    for _name, roles, using, check in rows:
        assert roles == ["praxa_app"]
        assert "app.role" not in using
        assert "app.role" not in check


def test_rls_is_enabled_and_forced(seed_dsn: str) -> None:
    with psycopg.connect(seed_dsn) as connection:
        rows = connection.execute(
            """
            SELECT relname, relrowsecurity, relforcerowsecurity
            FROM pg_class
            WHERE relname IN (
              'tenants', 'principals', 'tenant_memberships', 'roles',
              'permissions', 'membership_roles', 'role_permissions'
            )
            """
        ).fetchall()
    assert len(rows) == 7
    assert all(enabled and forced for _name, enabled, forced in rows)
