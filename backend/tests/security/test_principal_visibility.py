"""Visibilidad de `principal`: una, varias y ninguna membership.

Efecto declarado del diseno: como la subconsulta de `principal_visible_via_membership` esta
sujeta a la RLS de `tenant_membership` -que es self-only-, bajo el contexto `(A, P)` es visible
exactamente `P`, y solo si tiene una membership activa en A. Es mas estricto que
`id = app_current_principal_id()`, porque ademas exige la membership.

Que un miembro no vea a sus companeros es el comportamiento buscado en VS-01, no un defecto: el
padron requiere autorizacion de servicio con un rol verificado y llega en VS-05.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import DBAPIError

from praxa.shared.db.session import TenantContext, set_tenant_context
from tests.conftest import Fixtures

pytestmark = pytest.mark.security


def _visible_principals(
    app_engine: Engine, tenant_id: uuid.UUID, principal_id: uuid.UUID
) -> list[uuid.UUID]:
    context = TenantContext(
        tenant_id=tenant_id, principal_id=principal_id, role="member"
    )
    with app_engine.connect() as connection, connection.begin():
        set_tenant_context(connection, context)
        return list(
            connection.execute(text("SELECT id FROM principal")).scalars().all()
        )


def test_principal_with_one_membership(app_engine: Engine, fixtures: Fixtures) -> None:
    assert _visible_principals(app_engine, fixtures.tenant_a, fixtures.a_member) == [
        fixtures.a_member
    ]


def test_principal_with_one_membership_is_invisible_in_the_other_tenant(
    app_engine: Engine, fixtures: Fixtures
) -> None:
    visible = _visible_principals(app_engine, fixtures.tenant_b, fixtures.b_member)

    assert fixtures.a_member not in visible


def test_principal_with_memberships_in_several_tenants(
    app_engine: Engine, fixtures: Fixtures
) -> None:
    """Un unico principal.id, visible bajo los dos contextos."""
    assert _visible_principals(app_engine, fixtures.tenant_a, fixtures.multi) == [
        fixtures.multi
    ]
    assert _visible_principals(app_engine, fixtures.tenant_b, fixtures.multi) == [
        fixtures.multi
    ]


def test_principal_without_any_membership_is_invisible_everywhere(
    app_engine: Engine, fixtures: Fixtures
) -> None:
    assert _visible_principals(app_engine, fixtures.tenant_a, fixtures.orphan) == []
    assert _visible_principals(app_engine, fixtures.tenant_b, fixtures.orphan) == []


def test_principal_with_inactive_membership_is_invisible(
    app_engine: Engine, fixtures: Fixtures
) -> None:
    assert _visible_principals(app_engine, fixtures.tenant_a, fixtures.a_inactive) == []


def test_other_principals_of_the_same_tenant_are_not_visible(
    app_engine: Engine, fixtures: Fixtures
) -> None:
    """Limitacion declarada de VS-01, afirmada como comportamiento esperado."""
    visible = _visible_principals(app_engine, fixtures.tenant_a, fixtures.a_member)

    assert fixtures.a_other_member not in visible
    assert fixtures.a_owner not in visible


def test_principal_policy_is_not_recursive(
    app_engine: Engine, fixtures: Fixtures
) -> None:
    """Un SELECT sobre `principal` no puede levantar 42P17.

    La cadena `principal -> tenant_membership -> nada` termina. El test lo comprueba en vez de
    confiar en el argumento.
    """
    context = TenantContext(
        tenant_id=fixtures.tenant_a, principal_id=fixtures.a_member, role="member"
    )

    with app_engine.connect() as connection, connection.begin():
        set_tenant_context(connection, context)
        try:
            connection.execute(text("SELECT * FROM principal")).all()
        except DBAPIError as exc:  # pragma: no cover - solo si hay regresion
            sqlstate = getattr(exc.orig, "sqlstate", None)
            pytest.fail(f"SELECT sobre principal fallo con sqlstate {sqlstate}")
