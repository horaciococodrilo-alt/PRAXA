"""Extensiones instaladas: exactamente `vector`, y `pg_trgm` deliberadamente ausente."""

from __future__ import annotations

import pytest
from sqlalchemy import Engine, text

pytestmark = pytest.mark.integration


def test_vector_extension_is_installed(app_engine: Engine) -> None:
    with app_engine.connect() as connection:
        installed = connection.execute(
            text("SELECT count(*) FROM pg_extension WHERE extname = 'vector'")
        ).scalar_one()

    assert installed == 1


def test_pg_trgm_is_absent(app_engine: Engine) -> None:
    """La exclusion es deliberada, no un olvido.

    VS-01 no crea ninguna columna de texto buscable, asi que `pg_trgm` seria una extension sin
    consumidor. Se instala en la fase que introduzca matching difuso. Si alguien la agrega antes,
    este test lo obliga a justificarlo.
    """
    with app_engine.connect() as connection:
        installed = connection.execute(
            text("SELECT count(*) FROM pg_extension WHERE extname = 'pg_trgm'")
        ).scalar_one()

    assert installed == 0
