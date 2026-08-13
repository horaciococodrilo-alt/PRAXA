"""Configuracion del proceso de aplicacion.

Frontera deliberada: `AppSettings` declara **unicamente** las variables que necesita la API.
No conoce `MIGRATION_DATABASE_URL` ni `SEED_DATABASE_URL`, no las lee y no las valida. Si
estan presentes en el entorno, las ignora.

Las otras dos credenciales viven en contextos separados:

  * `MIGRATION_DATABASE_URL` (rol owner) la lee `migrations/env.py`, directamente del entorno.
  * `SEED_DATABASE_URL` (superusuario) la leen `scripts/bootstrap_db.py` y `tests/conftest.py`,
    y solo existe en desarrollo y CI.

La URL se guarda en un `SecretStr` para que ningun `repr`, log ni traceback exponga la
contrasena embebida.
"""

from __future__ import annotations

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REQUIRED_DRIVER = "postgresql+psycopg://"

# Prefijos rechazados explicitamente, con el motivo que se le muestra a quien configura.
_REJECTED_SCHEMES = {
    "sqlite": (
        "SQLite no sustituye a PostgreSQL en Praxa: RLS, FORCE ROW LEVEL SECURITY y las "
        "pruebas de aislamiento por tenant no existen en SQLite."
    ),
    "postgresql+asyncpg": (
        "ADR-014 fija SQLAlchemy sincrono con psycopg 3. asyncpg no se usa en v0."
    ),
    "postgresql+psycopg2": "Praxa usa psycopg 3, no psycopg2.",
    "postgres://": "Usa el esquema explicito postgresql+psycopg://.",
}


class AppSettings(BaseSettings):
    """Variables del proceso de API y worker. Una sola credencial de base de datos."""

    model_config = SettingsConfigDict(
        # Se buscan los dos, porque los comandos se corren tanto desde backend/ como desde la raiz.
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        frozen=True,
    )

    app_env: str = "development"
    log_level: str = "INFO"

    database_url: SecretStr
    """Rol de aplicacion. En VS-01 es de solo lectura sobre todas las tablas."""

    db_pool_size: int = Field(default=5, ge=1)
    db_max_overflow: int = Field(default=5, ge=0)

    db_assert_clean_context: bool = True
    """Verifica que la conexion no traiga contexto de tenant heredado antes de fijar el propio."""

    @field_validator("database_url")
    @classmethod
    def _validate_driver(cls, value: SecretStr) -> SecretStr:
        raw = value.get_secret_value().strip()

        if not raw:
            raise ValueError("DATABASE_URL esta vacia.")

        lowered = raw.lower()
        for prefix, reason in _REJECTED_SCHEMES.items():
            if lowered.startswith(prefix):
                # El mensaje nombra la variable y el esquema, nunca la URL: contiene la contrasena.
                raise ValueError(
                    f"DATABASE_URL usa un driver no permitido ({prefix!r}). {reason}"
                )

        if not lowered.startswith(REQUIRED_DRIVER):
            raise ValueError(
                f"DATABASE_URL debe empezar con {REQUIRED_DRIVER!r} (ADR-014). "
                "El valor no se muestra porque contiene la contrasena."
            )

        return value

    @property
    def dsn(self) -> str:
        """URL en claro, para construir el engine. No usar en logs."""
        return self.database_url.get_secret_value()
