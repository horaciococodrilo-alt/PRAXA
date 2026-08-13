import os
from dataclasses import dataclass

from sqlalchemy.engine import URL, make_url


class ConfigurationError(RuntimeError):
    """Raised when required process configuration is missing or unsafe."""


def _required_psycopg_url(name: str) -> str:
    raw = os.environ.get(name)
    if not raw:
        raise ConfigurationError(f"{name} is required")
    try:
        parsed: URL = make_url(raw)
    except Exception as exc:
        raise ConfigurationError(f"{name} must be a valid database URL") from exc
    if parsed.drivername != "postgresql+psycopg":
        raise ConfigurationError(f"{name} must use postgresql+psycopg")
    if not parsed.username or not parsed.database:
        raise ConfigurationError(f"{name} must include username and database")
    return raw


@dataclass(frozen=True)
class AppSettings:
    database_url: str

    @classmethod
    def from_env(cls) -> "AppSettings":
        return cls(database_url=_required_psycopg_url("DATABASE_URL"))


def migration_database_url() -> str:
    return _required_psycopg_url("MIGRATION_DATABASE_URL")


def seed_database_url() -> str:
    return _required_psycopg_url("SEED_DATABASE_URL")
