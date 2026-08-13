"""Aislamiento entre dos tenants, en lectura."""

from __future__ import annotations

import pytest
from sqlalchemy import Engine, text

from praxa.shared.db.session import TenantContext, set_tenant_context
from tests.conftest import Fixtures

pytestmark = pytest.mark.security


def test_tenant_a_sees_only_its_own_tenant_row(
    app_engine: Engine, fixtures: Fixtures
) -> None:
    context = TenantContext(
        tenant_id=fixtures.tenant_a, principal_id=fixtures.a_member, role="member"
    )

    with app_engine.connect() as connection, connection.begin():
        set_tenant_context(connection, context)
        visible = connection.execute(text("SELECT id FROM tenant")).scalars().all()

    assert visible == [fixtures.tenant_a]


def test_tenant_b_row_is_unreachable_even_by_explicit_id(
    app_engine: Engine, fixtures: Fixtures
) -> None:
    """No alcanza con que no aparezca en un listado: tampoco se llega apuntando al UUID exacto."""
    context = TenantContext(
        tenant_id=fixtures.tenant_a, principal_id=fixtures.a_member, role="member"
    )

    with app_engine.connect() as connection, connection.begin():
        set_tenant_context(connection, context)
        count = connection.execute(
            text("SELECT count(*) FROM tenant WHERE id = :other"),
            {"other": fixtures.tenant_b},
        ).scalar_one()

    assert count == 0


def test_membership_of_another_tenant_is_invisible(
    app_engine: Engine, fixtures: Fixtures
) -> None:
    context = TenantContext(
        tenant_id=fixtures.tenant_a, principal_id=fixtures.a_member, role="member"
    )

    with app_engine.connect() as connection, connection.begin():
        set_tenant_context(connection, context)
        rows = connection.execute(
            text("SELECT tenant_id, principal_id FROM tenant_membership")
        ).all()

    assert [(row.tenant_id, row.principal_id) for row in rows] == [
        (fixtures.tenant_a, fixtures.a_member)
    ]


def test_membership_of_another_principal_in_the_same_tenant_is_invisible(
    app_engine: Engine, fixtures: Fixtures
) -> None:
    """`membership_select_self` limita a la propia fila, no al tenant entero."""
    context = TenantContext(
        tenant_id=fixtures.tenant_a, principal_id=fixtures.a_member, role="member"
    )

    with app_engine.connect() as connection, connection.begin():
        set_tenant_context(connection, context)
        count = connection.execute(
            text("SELECT count(*) FROM tenant_membership WHERE principal_id = :other"),
            {"other": fixtures.a_other_member},
        ).scalar_one()

    assert count == 0


def test_claiming_the_owner_role_in_the_guc_changes_nothing(
    app_engine: Engine, fixtures: Fixtures
) -> None:
    """`app.role` no gobierna ninguna policy: afirmar 'owner' no amplia lo que se ve.

    Es la contracara ejecutable de la frontera de confianza declarada en session.py.
    """
    as_member = TenantContext(
        tenant_id=fixtures.tenant_a, principal_id=fixtures.a_member, role="member"
    )
    as_claimed_owner = TenantContext(
        tenant_id=fixtures.tenant_a, principal_id=fixtures.a_member, role="owner"
    )

    def visible_membership_count(context: TenantContext) -> int:
        with app_engine.connect() as connection, connection.begin():
            set_tenant_context(connection, context)
            return int(
                connection.execute(
                    text("SELECT count(*) FROM tenant_membership")
                ).scalar_one()
            )

    assert visible_membership_count(as_member) == 1
    assert visible_membership_count(as_claimed_owner) == 1


def test_multi_tenant_principal_is_scoped_per_context(
    app_engine: Engine, fixtures: Fixtures
) -> None:
    """El mismo principal.id en dos tenants ve una cosa en cada contexto, nunca las dos."""
    for tenant_id, other_tenant_id in (
        (fixtures.tenant_a, fixtures.tenant_b),
        (fixtures.tenant_b, fixtures.tenant_a),
    ):
        context = TenantContext(
            tenant_id=tenant_id, principal_id=fixtures.multi, role="member"
        )
        with app_engine.connect() as connection, connection.begin():
            set_tenant_context(connection, context)
            tenants = connection.execute(text("SELECT id FROM tenant")).scalars().all()
            memberships = (
                connection.execute(text("SELECT tenant_id FROM tenant_membership"))
                .scalars()
                .all()
            )

        assert tenants == [tenant_id]
        assert memberships == [tenant_id]
        assert other_tenant_id not in memberships
