"""Aplica el bootstrap estructural del cluster desde el host.

Es el camino canonico para reaplicar `infra/db/bootstrap.sql` sobre una base que ya existe:
los scripts de `/docker-entrypoint-initdb.d` solo corren en la inicializacion de un volumen
vacio. Tambien es el camino que usa CI, donde el service ya arranco y no hay initdb.

Usa la misma fuente de DDL que `01-bootstrap.sh`. Las contrasenas se fijan aparte, con
composicion segura de psycopg, para no versionarlas ni pasarlas como argumentos de proceso.

Uso, desde `backend/`:

    uv run python scripts/bootstrap_db.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg
from psycopg import sql

REPO_ROOT = Path(__file__).resolve().parents[2]
BOOTSTRAP_SQL = REPO_ROOT / "infra" / "db" / "bootstrap.sql"

ROLE_PASSWORD_ENV = {
    "praxa_owner": "PRAXA_OWNER_PASSWORD",
    "praxa_app": "PRAXA_APP_PASSWORD",
}


class BootstrapError(RuntimeError):
    """Falla de configuracion o de entorno, con un mensaje accionable y sin secretos."""


def _require_non_production() -> None:
    app_env = os.environ.get("APP_ENV", "development").strip().lower()
    if app_env == "production":
        raise BootstrapError(
            "bootstrap_db.py no debe ejecutarse con APP_ENV=production. "
            "Usa credenciales de superusuario y esta pensado para desarrollo y CI."
        )


def _require_env(name: str) -> str:
    value = os.environ.get(name, "")
    if not value.strip():
        raise BootstrapError(
            f"Falta la variable de entorno {name} o esta vacia. "
            f"Definila en el .env local o en el entorno de CI."
        )
    return value


def _seed_dsn() -> str:
    # El superusuario existe solo en desarrollo y CI. La aplicacion nunca lo recibe.
    dsn = _require_env("SEED_DATABASE_URL")
    # SQLAlchemy usa postgresql+psycopg://; psycopg espera postgresql://.
    return dsn.replace("postgresql+psycopg://", "postgresql://", 1)


def main() -> int:
    try:
        _require_non_production()
        dsn = _seed_dsn()
        passwords = {role: _require_env(env) for role, env in ROLE_PASSWORD_ENV.items()}

        if not BOOTSTRAP_SQL.is_file():
            raise BootstrapError(f"No se encontro {BOOTSTRAP_SQL}.")
        ddl = BOOTSTRAP_SQL.read_text(encoding="utf-8")
    except BootstrapError as exc:
        print(f"bootstrap_db.py: {exc}", file=sys.stderr)
        return 2

    with psycopg.connect(dsn, autocommit=True) as conn, conn.cursor() as cur:
        # Sin parametros, psycopg usa el protocolo simple y admite el script completo.
        # Partirlo por ';' romperia los bloques DO $$ ... $$.
        print(f"bootstrap_db.py: aplicando {BOOTSTRAP_SQL.relative_to(REPO_ROOT)}")
        cur.execute(ddl.encode())

        print("bootstrap_db.py: fijando contrasenas de praxa_owner y praxa_app")
        for role, password in passwords.items():
            cur.execute(
                sql.SQL("ALTER ROLE {role} WITH PASSWORD {password}").format(
                    role=sql.Identifier(role),
                    password=sql.Literal(password),
                )
            )

    print("bootstrap_db.py: bootstrap completo")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
