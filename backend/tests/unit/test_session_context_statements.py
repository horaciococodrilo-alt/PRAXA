"""El contexto se fija con parametros ligados y con `SET LOCAL`, nunca por interpolacion."""

from __future__ import annotations

from typing import Any, cast
from unittest.mock import MagicMock
from uuid import UUID

import pytest

from praxa.shared.db.session import (
    PRINCIPAL_GUC,
    ROLE_GUC,
    TENANT_GUC,
    TenantContext,
    TenantContextLeakError,
    assert_no_inherited_context,
    set_tenant_context,
)

TENANT = UUID("11111111-1111-1111-1111-111111111111")
PRINCIPAL = UUID("22222222-2222-2222-2222-222222222222")
CONTEXT = TenantContext(tenant_id=TENANT, principal_id=PRINCIPAL, role="member")


def _executor() -> MagicMock:
    return MagicMock()


def test_context_is_set_with_bound_parameters() -> None:
    executor = _executor()

    set_tenant_context(cast(Any, executor), CONTEXT)

    statement, parameters = executor.execute.call_args.args
    sql_text = str(statement)

    # Los valores viajan como parametros, no incrustados en el SQL.
    assert ":tenant_id" in sql_text
    assert ":principal_id" in sql_text
    assert ":role" in sql_text
    assert str(TENANT) not in sql_text
    assert str(PRINCIPAL) not in sql_text

    assert parameters == {
        "tenant_key": TENANT_GUC,
        "tenant_id": str(TENANT),
        "principal_key": PRINCIPAL_GUC,
        "principal_id": str(PRINCIPAL),
        "role_key": ROLE_GUC,
        "role": "member",
    }


def test_context_is_transaction_local() -> None:
    """El tercer argumento de set_config debe ser true: la variable muere con la transaccion."""
    executor = _executor()

    set_tenant_context(cast(Any, executor), CONTEXT)

    sql_text = str(executor.execute.call_args.args[0])
    assert sql_text.count("true)") == 3
    assert "false)" not in sql_text


def test_clean_context_passes() -> None:
    executor = _executor()
    executor.execute.return_value.one.return_value = (None, None, None)

    assert_no_inherited_context(cast(Any, executor))


@pytest.mark.parametrize(
    ("row", "expected"),
    [
        (("11111111-1111-1111-1111-111111111111", None, None), TENANT_GUC),
        ((None, "22222222-2222-2222-2222-222222222222", None), PRINCIPAL_GUC),
        ((None, None, "owner"), ROLE_GUC),
    ],
)
def test_inherited_context_is_reported_with_the_offending_variable(
    row: tuple[str | None, str | None, str | None], expected: str
) -> None:
    executor = _executor()
    executor.execute.return_value.one.return_value = row

    with pytest.raises(TenantContextLeakError) as excinfo:
        assert_no_inherited_context(cast(Any, executor))

    assert expected in str(excinfo.value)
