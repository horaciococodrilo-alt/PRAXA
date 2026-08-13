"""Valor de contexto malicioso: rechazo seguro, sin inyeccion y sin romper la transaccion.

Corrige una afirmacion incorrecta: `nullif()` solo convierte la **cadena vacia** en NULL. Un
texto que no es UUID llega al cast y, sin la funcion de 0002, levantaria
`22P02 invalid_text_representation`. La defensa real son dos capas:

  1. `TenantContext` valida el tipo antes de que nada llegue a SQL
     (tests/unit/test_tenant_context_validation.py);
  2. `app_current_tenant_id()` captura `invalid_text_representation` y devuelve NULL.

Este archivo prueba la segunda, salteando el helper a proposito.
"""

from __future__ import annotations

import pytest
from sqlalchemy import Engine, text

from praxa.tenancy.models import BUSINESS_TABLES
from tests.conftest import Fixtures

pytestmark = pytest.mark.security

PAYLOADS = [
    "' OR 1=1 --",
    "'; DROP TABLE tenant; --",
    "00000000-0000-0000",
    "",
    "11111111-1111-1111-1111-11111111111g",
]


@pytest.mark.parametrize("payload", PAYLOADS)
def test_payload_is_stored_verbatim_and_never_interpolated(
    app_engine: Engine, payload: str
) -> None:
    """Que vuelva literal prueba que viajo como dato, no como SQL."""
    with app_engine.connect() as connection, connection.begin():
        connection.execute(
            text("SELECT set_config('app.tenant_id', :value, true)"), {"value": payload}
        )
        stored = connection.execute(
            text("SELECT current_setting('app.tenant_id', true)")
        ).scalar_one()

    assert stored == payload


@pytest.mark.parametrize("payload", PAYLOADS)
def test_invalid_value_resolves_to_null_without_raising(
    app_engine: Engine, payload: str
) -> None:
    with app_engine.connect() as connection, connection.begin():
        connection.execute(
            text("SELECT set_config('app.tenant_id', :value, true)"), {"value": payload}
        )
        resolved = connection.execute(
            text("SELECT app_current_tenant_id()")
        ).scalar_one()

    assert resolved is None


@pytest.mark.parametrize("payload", PAYLOADS)
@pytest.mark.parametrize("table", BUSINESS_TABLES)
def test_invalid_value_reaches_no_row(
    app_engine: Engine, payload: str, table: str
) -> None:
    with app_engine.connect() as connection, connection.begin():
        connection.execute(
            text("SELECT set_config('app.tenant_id', :value, true)"), {"value": payload}
        )
        count = connection.execute(text(f"SELECT count(*) FROM {table}")).scalar_one()

    assert count == 0


@pytest.mark.parametrize("payload", PAYLOADS)
def test_transaction_stays_usable(app_engine: Engine, payload: str) -> None:
    """Un cast fallido habria abortado la transaccion; la funcion lo evita."""
    with app_engine.connect() as connection, connection.begin():
        connection.execute(
            text("SELECT set_config('app.tenant_id', :value, true)"), {"value": payload}
        )
        connection.execute(text("SELECT app_current_tenant_id()")).scalar_one()

        still_alive = connection.execute(text("SELECT 1")).scalar_one()

    assert still_alive == 1


def test_valid_uuid_still_resolves(app_engine: Engine, fixtures: Fixtures) -> None:
    """Control positivo: la tolerancia a valores invalidos no rompe el camino normal."""
    with app_engine.connect() as connection, connection.begin():
        connection.execute(
            text("SELECT set_config('app.tenant_id', :value, true)"),
            {"value": str(fixtures.tenant_a)},
        )
        resolved = connection.execute(
            text("SELECT app_current_tenant_id()")
        ).scalar_one()

    assert resolved == fixtures.tenant_a
