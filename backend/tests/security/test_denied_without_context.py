"""Denegacion por defecto, y el alcance exacto de esa regla.

La regla aplica a las **tablas de negocio**. `role`, `permission` y `role_permission` son
catalogos globales declarados: no llevan `tenant_id`, no contienen datos de cliente y se leen sin
contexto. Eso esta afirmado aca por escrito para que el criterio no se lea como una fuga.
"""

from __future__ import annotations

import pytest
from sqlalchemy import Engine, text

from praxa.shared.db.session import TenantContext, set_tenant_context
from praxa.tenancy.models import BUSINESS_TABLES, CATALOG_TABLES
from tests.conftest import Fixtures

pytestmark = pytest.mark.security


@pytest.mark.parametrize("table", BUSINESS_TABLES)
def test_business_tables_return_nothing_without_context(
    app_engine: Engine, table: str
) -> None:
    with app_engine.connect() as connection:
        count = connection.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()

    assert count == 0


@pytest.mark.parametrize("table", CATALOG_TABLES)
def test_catalogs_are_readable_without_context(app_engine: Engine, table: str) -> None:
    """Postura declarada, no una fuga: son el enum de roles y permisos de v0."""
    with app_engine.connect() as connection:
        count = connection.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()

    assert count > 0


@pytest.mark.parametrize("table", BUSINESS_TABLES)
def test_partial_context_still_denies(
    app_engine: Engine, fixtures: Fixtures, table: str
) -> None:
    """Con tenant pero sin principal, la restrictiva de requester deja todo en cero filas."""
    with app_engine.connect() as connection, connection.begin():
        connection.execute(
            text("SELECT set_config('app.tenant_id', :tenant_id, true)"),
            {"tenant_id": str(fixtures.tenant_a)},
        )
        count = connection.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()

    assert count == 0


@pytest.mark.parametrize("table", BUSINESS_TABLES)
def test_requester_without_membership_is_denied(
    app_engine: Engine, fixtures: Fixtures, table: str
) -> None:
    """Un principal sin membership afirma el tenant A y no alcanza nada.

    Es el criterio "membership inexistente se deniega", verificado por PostgreSQL.
    """
    context = TenantContext(
        tenant_id=fixtures.tenant_a, principal_id=fixtures.orphan, role="member"
    )

    with app_engine.connect() as connection, connection.begin():
        set_tenant_context(connection, context)
        count = connection.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()

    assert count == 0


@pytest.mark.parametrize("table", ["tenant", "principal"])
def test_inactive_membership_unlocks_nothing(
    app_engine: Engine, fixtures: Fixtures, table: str
) -> None:
    """Una membership `inactive` no habilita el tenant ni el padron de principals.

    Es la clausula `status = 'active'` de las policies de 0007, verificada.
    """
    context = TenantContext(
        tenant_id=fixtures.tenant_a, principal_id=fixtures.a_inactive, role="member"
    )

    with app_engine.connect() as connection, connection.begin():
        set_tenant_context(connection, context)
        count = connection.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()

    assert count == 0


def test_inactive_member_can_still_read_only_their_own_membership_row(
    app_engine: Engine, fixtures: Fixtures
) -> None:
    """Comportamiento buscado, no un descuido.

    `membership_select_self` no filtra por `status`: un principal desactivado debe poder
    descubrir que su membership existe y esta inactiva. Lo que no puede es alcanzar el tenant,
    el padron, ni la fila de ningun otro principal.
    """
    context = TenantContext(
        tenant_id=fixtures.tenant_a, principal_id=fixtures.a_inactive, role="member"
    )

    with app_engine.connect() as connection, connection.begin():
        set_tenant_context(connection, context)
        rows = connection.execute(
            text("SELECT principal_id, status FROM tenant_membership")
        ).all()

    assert [(row.principal_id, row.status) for row in rows] == [
        (fixtures.a_inactive, "inactive")
    ]
