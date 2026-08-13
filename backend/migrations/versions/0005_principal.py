"""Tabla `principal`, deliberadamente cerrada hasta 0007.

Se crea con `ENABLE`/`FORCE ROW LEVEL SECURITY` y **sin ninguna policy**. En PostgreSQL, una
tabla con RLS activa y sin policy permisiva no devuelve filas a nadie que no sea superusuario:
el estado intermedio entre esta migracion y 0007 es cerrado, no abierto.

La policy de visibilidad depende de `tenant_membership`, que se crea en 0006.

`principal` no lleva `tenant_id` (spec 10.2): una persona puede pertenecer a varios tenants y
duplicar su identidad por cada uno romperia la trazabilidad. El aislamiento lo da la policy.

Revision ID: 0005_principal
Revises: 0004_role_permission_catalog
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_principal"
down_revision: str | None = "0004_role_permission_catalog"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "principal",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("external_subject", sa.Text(), nullable=True),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default=sa.text("'active'"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("kind IN ('human', 'service', 'agent')", name="kind_valid"),
        sa.CheckConstraint("status IN ('active', 'disabled')", name="status_valid"),
        sa.PrimaryKeyConstraint("id", name="pk_principal"),
    )

    op.execute("ALTER TABLE principal ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE principal FORCE ROW LEVEL SECURITY")

    # Sin policy: deny-all hasta 0007. Solo lectura, ademas, cuando se abra.
    op.execute("GRANT SELECT ON TABLE principal TO praxa_app")


def downgrade() -> None:
    op.execute("REVOKE ALL ON TABLE principal FROM praxa_app")
    op.drop_table("principal")
