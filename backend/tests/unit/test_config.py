from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import SecretStr, ValidationError

from praxa.config import AppSettings

VALID_URL = "postgresql+psycopg://praxa_app:s3cr3t-not-real@127.0.0.1:5432/praxa"


@pytest.fixture(autouse=True)
def _isolated_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Aisla del .env del repositorio y de variables heredadas del shell."""
    for name in (
        "APP_ENV",
        "DATABASE_URL",
        "MIGRATION_DATABASE_URL",
        "SEED_DATABASE_URL",
        "DB_POOL_SIZE",
        "DB_ASSERT_CLEAN_CONTEXT",
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.chdir(tmp_path)


def test_missing_database_url_fails_naming_the_variable() -> None:
    with pytest.raises(ValidationError) as excinfo:
        # Sin DATABASE_URL en el entorno: pydantic-settings no puede completarla.
        AppSettings()

    message = str(excinfo.value)
    assert "database_url" in message.lower()


def test_error_message_never_reveals_credentials() -> None:
    secret = "una-password-que-no-debe-aparecer"
    with pytest.raises(ValidationError) as excinfo:
        AppSettings(
            database_url=SecretStr(
                f"postgresql+asyncpg://praxa_app:{secret}@localhost/praxa"
            )
        )

    assert secret not in str(excinfo.value)
    assert secret not in repr(excinfo.value)


def test_repr_and_str_never_reveal_credentials() -> None:
    secret = "otra-password-que-no-debe-aparecer"
    settings = AppSettings(
        database_url=SecretStr(
            f"postgresql+psycopg://praxa_app:{secret}@localhost/praxa"
        )
    )

    assert secret not in repr(settings)
    assert secret not in str(settings)
    assert secret not in repr(settings.database_url)
    # Pero sigue siendo recuperable de forma explicita para construir el engine.
    assert secret in settings.dsn


@pytest.mark.parametrize(
    "url",
    [
        "sqlite:///praxa.db",
        "sqlite+pysqlite:///:memory:",
        "postgresql+asyncpg://praxa_app:x@localhost/praxa",
        "postgresql+psycopg2://praxa_app:x@localhost/praxa",
        "postgres://praxa_app:x@localhost/praxa",
        "mysql://praxa_app:x@localhost/praxa",
    ],
)
def test_rejects_non_psycopg_drivers(url: str) -> None:
    """SQLite no sustituye pruebas de integracion o seguridad; asyncpg queda fuera por ADR-014."""
    with pytest.raises(ValidationError):
        AppSettings(database_url=SecretStr(url))


def test_accepts_psycopg_driver() -> None:
    settings = AppSettings(database_url=SecretStr(VALID_URL))

    assert settings.dsn == VALID_URL
    assert settings.app_env == "development"
    assert settings.db_assert_clean_context is True
