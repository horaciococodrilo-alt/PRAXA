from __future__ import annotations

import os
import sys

import psycopg
from psycopg import sql
from sqlalchemy.engine import URL, make_url

ALLOWED_ENVIRONMENTS = frozenset({"development", "test", "ci"})


class BootstrapConfigurationError(RuntimeError):
    pass


def _required_url(name: str) -> URL:
    raw = os.environ.get(name)
    if not raw:
        raise BootstrapConfigurationError(f"{name} is required")
    try:
        url = make_url(raw)
    except Exception as exc:
        raise BootstrapConfigurationError(f"{name} must be a valid database URL") from exc
    if url.drivername != "postgresql+psycopg" or not url.username or not url.password or not url.database:
        raise BootstrapConfigurationError(
            f"{name} must use postgresql+psycopg and include username, password, and database"
        )
    return url


def _psycopg_dsn(url: URL) -> str:
    return url.set(drivername="postgresql").render_as_string(hide_password=False)


def _ensure_login_role(connection: psycopg.Connection[tuple[object, ...]], url: URL) -> None:
    assert url.username is not None
    assert url.password is not None
    exists = connection.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (url.username,)).fetchone()
    role = sql.Identifier(url.username)
    if exists is None:
        connection.execute(
            sql.SQL("CREATE ROLE {} LOGIN PASSWORD %s NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS").format(role),
            (url.password,),
        )
    else:
        connection.execute(
            sql.SQL("ALTER ROLE {} WITH LOGIN PASSWORD %s NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS").format(role),
            (url.password,),
        )


def bootstrap() -> None:
    app_env = os.environ.get("APP_ENV")
    if app_env not in ALLOWED_ENVIRONMENTS:
        raise BootstrapConfigurationError(
            "APP_ENV must be explicitly set to development, test, or ci"
        )

    seed = _required_url("SEED_DATABASE_URL")
    migration = _required_url("MIGRATION_DATABASE_URL")
    application = _required_url("DATABASE_URL")
    if migration.database != application.database:
        raise BootstrapConfigurationError("application and migration URLs must target the same database")
    if migration.username != "praxa_owner" or application.username != "praxa_app":
        raise BootstrapConfigurationError("expected praxa_owner and praxa_app process roles")

    with psycopg.connect(_psycopg_dsn(seed), autocommit=True) as connection:
        _ensure_login_role(connection, migration)
        _ensure_login_role(connection, application)
        assert migration.database is not None
        database = sql.Identifier(migration.database)
        owner = sql.Identifier("praxa_owner")
        app = sql.Identifier("praxa_app")
        connection.execute(sql.SQL("ALTER DATABASE {} OWNER TO {}").format(database, owner))
        connection.execute(sql.SQL("REVOKE ALL ON DATABASE {} FROM PUBLIC").format(database))
        connection.execute(sql.SQL("GRANT CONNECT ON DATABASE {} TO {}, {}").format(database, owner, app))

    print("Database roles and ownership are ready for the selected non-production environment.")


def main() -> int:
    try:
        bootstrap()
    except BootstrapConfigurationError as exc:
        print(f"bootstrap configuration error: {exc}", file=sys.stderr)
        return 2
    except psycopg.Error:
        print("bootstrap database operation failed; credentials were not displayed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
