import pytest

from praxa.shared.config import AppSettings, ConfigurationError, migration_database_url


def test_app_settings_require_only_database_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://app:secret@db/praxa")
    monkeypatch.delenv("MIGRATION_DATABASE_URL", raising=False)
    monkeypatch.delenv("SEED_DATABASE_URL", raising=False)

    assert AppSettings.from_env().database_url.endswith("@db/praxa")


def test_app_settings_fail_closed_without_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ConfigurationError, match="DATABASE_URL is required"):
        AppSettings.from_env()


def test_migration_settings_do_not_fall_back_to_app_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://app:secret@db/praxa")
    monkeypatch.delenv("MIGRATION_DATABASE_URL", raising=False)
    with pytest.raises(ConfigurationError, match="MIGRATION_DATABASE_URL is required"):
        migration_database_url()


def test_async_driver_is_rejected_without_echoing_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://app:do-not-print@db/praxa")
    with pytest.raises(ConfigurationError) as error:
        AppSettings.from_env()
    assert "do-not-print" not in str(error.value)
