"""Privilegios del rol de aplicacion y alcance real de FORCE ROW LEVEL SECURITY."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import Engine, text

from praxa.shared.db.session import TenantContext, set_tenant_context
from tests.conftest import Fixtures

pytestmark = pytest.mark.security


def test_app_role_is_not_superuser_and_cannot_bypass_rls(app_engine: Engine) -> None:
    with app_engine.connect() as connection:
        row = connection.execute(
            text(
                "SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole "
                "FROM pg_roles WHERE rolname = current_user"
            )
        ).one()

    assert row.rolsuper is False
    assert row.rolbypassrls is False
    assert row.rolcreatedb is False
    assert row.rolcreaterole is False


def test_app_role_is_not_a_member_of_the_owner_role(app_engine: Engine) -> None:
    with app_engine.connect() as connection:
        is_member = connection.execute(
            text("SELECT pg_has_role(current_user, 'praxa_owner', 'member')")
        ).scalar_one()

    assert is_member is False


def test_app_role_owns_no_relation(app_engine: Engine) -> None:
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


def test_force_rls_applies_to_the_table_owner(
    owner_engine: Engine, fixtures: Fixtures
) -> None:
    """Sin FORCE, praxa_owner veria todo y media suite de aislamiento no probaria nada."""
    context = TenantContext(
        tenant_id=fixtures.tenant_a, principal_id=fixtures.a_member, role="member"
    )

    with owner_engine.connect() as connection, connection.begin():
        set_tenant_context(connection, context)
        visible = connection.execute(text("SELECT id FROM tenant")).scalars().all()

    assert visible == [fixtures.tenant_a]
    assert fixtures.tenant_b not in visible


def test_owner_write_is_denied_without_a_permissive_policy(
    owner_engine: Engine, fixtures: Fixtures
) -> None:
    """La ausencia de policy permisiva falla cerrado incluso para quien tiene todos los privilegios.

    `praxa_owner` posee la tabla, asi que la capa de grants no lo detiene. Lo que lo detiene es
    que VS-01 no define ninguna policy de INSERT sobre `tenant_membership`.
    """
    context = TenantContext(
        tenant_id=fixtures.tenant_a, principal_id=fixtures.a_owner, role="owner"
    )

    with owner_engine.connect() as connection, connection.begin():
        set_tenant_context(connection, context)
        with pytest.raises(Exception) as excinfo:
            connection.execute(
                text(
                    "INSERT INTO tenant_membership (tenant_id, principal_id, role_key) "
                    "VALUES (:tenant_id, :principal_id, 'member')"
                ),
                {"tenant_id": fixtures.tenant_a, "principal_id": uuid.uuid4()},
            )

    assert "row-level security" in str(excinfo.value).lower()
