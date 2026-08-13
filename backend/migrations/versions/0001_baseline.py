"""Baseline: verifica precondiciones del cluster antes de crear la primera tabla.

Esta migracion no crea la extension `vector`. `CREATE EXTENSION` exige superusuario porque
`vector` no es una extension *trusted*, y el criterio de aceptacion de VS-01 exige que el rol de
migracion **no** sea superusuario. Las dos cosas son incompatibles, asi que la extension se
instala en `infra/db/bootstrap.sql` y aca solo se verifica que este.

Las tres verificaciones fallan con un mensaje que dice exactamente que correr.

Revision ID: 0001_baseline
Revises:
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0001_baseline"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

BOOTSTRAP_HINT = (
    "Ejecuta el bootstrap del cluster primero: `docker compose up -d postgres` en un volumen "
    "nuevo, o `uv run python scripts/bootstrap_db.py` desde backend/ sobre una base existente."
)


def upgrade() -> None:
    # 1. La extension vector debe existir. VS-01 no crea columnas vector todavia, pero la
    #    fundacion no se declara lista si la base no puede sostener VS-02.
    op.execute(
        f"""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
            RAISE EXCEPTION
              'Falta la extension "vector". {BOOTSTRAP_HINT}';
          END IF;
        END $$;
        """
    )

    # 2. El rol que corre las migraciones no puede ser superusuario ni tener BYPASSRLS.
    #    Si lo fuera, toda la suite de aislamiento pasaria sin probar nada.
    op.execute(
        """
        DO $$
        DECLARE r pg_roles%ROWTYPE;
        BEGIN
          SELECT * INTO r FROM pg_roles WHERE rolname = current_user;
          IF r.rolsuper THEN
            RAISE EXCEPTION
              'El rol de migracion (%) es superusuario. MIGRATION_DATABASE_URL debe apuntar a '
              'praxa_owner, no a postgres.', current_user;
          END IF;
          IF r.rolbypassrls THEN
            RAISE EXCEPTION
              'El rol de migracion (%) tiene BYPASSRLS. Las policies no se aplicarian.',
              current_user;
          END IF;
        END $$;
        """
    )

    # 3. El rol de aplicacion debe existir antes de que haya tablas que otorgarle.
    op.execute(
        f"""
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'praxa_app') THEN
            RAISE EXCEPTION 'Falta el rol praxa_app. {BOOTSTRAP_HINT}';
          END IF;
        END $$;
        """
    )

    # 4. Reafirmar el cierre de PUBLIC, por si la base se creo fuera del bootstrap.
    op.execute("REVOKE ALL ON SCHEMA public FROM PUBLIC")
    op.execute(
        "ALTER DEFAULT PRIVILEGES FOR ROLE praxa_owner IN SCHEMA public "
        "REVOKE ALL ON TABLES FROM PUBLIC"
    )


def downgrade() -> None:
    # Esta migracion solo verifica precondiciones y reafirma revokes. Revertir los revokes
    # volveria a abrir el esquema a PUBLIC, que es justamente lo que no se quiere.
    pass
