"""Entorno de Alembic.

Contexto de credenciales: este archivo lee `MIGRATION_DATABASE_URL` -el rol owner- directamente
del entorno, y **no** importa `praxa.config`. `AppSettings` es la configuracion del proceso de
aplicacion y solo conoce `DATABASE_URL`. Mantener los dos contextos separados es lo que impide
que la API tenga en memoria una credencial que no necesita.
"""

from __future__ import annotations

import os

from alembic import context
from sqlalchemy import create_engine, pool

from praxa.shared.db.base import metadata
from praxa.tenancy import models as _tenancy_models  # noqa: F401  registra las tablas

config = context.config
target_metadata = metadata

MIGRATION_URL_ENV = "MIGRATION_DATABASE_URL"


def _migration_url() -> str:
    url = os.environ.get(MIGRATION_URL_ENV, "").strip()
    if not url:
        raise RuntimeError(
            f"Falta {MIGRATION_URL_ENV} o esta vacia. Es la credencial del rol de migracion "
            "(praxa_owner), distinta de DATABASE_URL. Definila en el .env local o en CI."
        )
    return url


def run_migrations_offline() -> None:
    context.configure(
        url=_migration_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_migration_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
