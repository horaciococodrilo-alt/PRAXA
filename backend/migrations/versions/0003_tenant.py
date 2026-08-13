"""Tabla `tenant` con RLS habilitada y forzada en la misma migracion.

RLS se activa junto con la creacion de la tabla, no en una migracion posterior: asi no existe
nunca un estado intermedio en el que la tabla sea consultable sin policies.

`FORCE ROW LEVEL SECURITY` somete tambien al dueno de la tabla. Es deliberado: sin `FORCE`,
`praxa_owner` veria todo y la mitad de la suite de aislamiento no probaria nada.

Revision ID: 0003_tenant
Revises: 0002_session_context
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_tenant"
down_revision: str | None = "0002_session_context"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tenant",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default=sa.text("'active'"),
            nullable=False,
        ),
        sa.Column(
            "settings",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
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
        sa.CheckConstraint(
            "status IN ('active', 'suspended', 'deleted')", name="status_valid"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_tenant"),
        sa.UniqueConstraint("slug", name="uq_tenant_slug"),
    )

    op.execute("ALTER TABLE tenant ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenant FORCE ROW LEVEL SECURITY")

    # Permisiva: la fila del tenant del contexto. Sin contexto, app_current_tenant_id() devuelve
    # NULL, la comparacion es NULL y no se ve ninguna fila.
    op.execute(
        """
        CREATE POLICY tenant_select_current ON tenant
          FOR SELECT
          USING (id = app_current_tenant_id())
        """
    )

    # La policy restrictiva que ademas exige membership activa del solicitante vive en 0007:
    # depende de que `tenant_membership` exista. Hasta entonces basta la permisiva de arriba.

    # Solo lectura. Alta y baja de tenants son administrativas y quedan fuera de VS-01.
    op.execute("GRANT SELECT ON TABLE tenant TO praxa_app")


def downgrade() -> None:
    op.execute("REVOKE ALL ON TABLE tenant FROM praxa_app")
    op.execute("DROP POLICY IF EXISTS tenant_select_current ON tenant")
    op.drop_table("tenant")
