"""La validacion de tipo ocurre antes de que nada llegue a SQL.

Es la primera de las dos capas que sostienen el criterio de valor de contexto malicioso. La
segunda -la funcion SQL que devuelve NULL ante texto invalido- se prueba contra PostgreSQL real
en tests/security/test_malicious_context_values.py.
"""

from __future__ import annotations

from uuid import UUID

import pytest
from pydantic import ValidationError

from praxa.shared.db.session import TenantContext

TENANT = UUID("11111111-1111-1111-1111-111111111111")
PRINCIPAL = UUID("22222222-2222-2222-2222-222222222222")


@pytest.mark.parametrize(
    "payload",
    [
        "' OR 1=1 --",
        "00000000-0000-0000",
        "",
        "'; DROP TABLE tenant; --",
        "11111111-1111-1111-1111-11111111111g",
    ],
)
def test_non_uuid_tenant_is_rejected_before_sql(payload: str) -> None:
    with pytest.raises(ValidationError):
        TenantContext(tenant_id=payload, principal_id=PRINCIPAL, role="member")


@pytest.mark.parametrize(
    "payload",
    ["' OR 1=1 --", "not-a-uuid", ""],
)
def test_non_uuid_principal_is_rejected_before_sql(payload: str) -> None:
    with pytest.raises(ValidationError):
        TenantContext(tenant_id=TENANT, principal_id=payload, role="member")


@pytest.mark.parametrize(
    "role",
    ["", "OWNER", "member; --", "a" * 64, "role with spaces", "1member"],
)
def test_malformed_role_is_rejected(role: str) -> None:
    with pytest.raises(ValidationError):
        TenantContext(tenant_id=TENANT, principal_id=PRINCIPAL, role=role)


@pytest.mark.parametrize("role", ["owner", "admin", "reviewer", "member", "service"])
def test_v0_roles_are_accepted(role: str) -> None:
    context = TenantContext(tenant_id=TENANT, principal_id=PRINCIPAL, role=role)

    assert context.role == role


def test_context_is_frozen() -> None:
    context = TenantContext(tenant_id=TENANT, principal_id=PRINCIPAL, role="member")

    with pytest.raises(ValidationError):
        context.tenant_id = PRINCIPAL  # type: ignore[misc]
