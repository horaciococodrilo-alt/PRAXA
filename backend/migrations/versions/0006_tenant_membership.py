"""Tabla `tenant_membership`, visible solo en la propia fila.

La policy es `tenant_id = app_current_tenant_id() AND principal_id = app_current_principal_id()`,
no solo el tenant. La razon:

Una policy que mirara unicamente `tenant_id` permitiria que un principal **sin membership**
afirmara un `tenant_id` y leyera el padron completo del tenant, lo que contradice el criterio
"membership inexistente se deniega". Verificar la membership del solicitante dentro de una policy
*sobre esta misma tabla* es recursivo y PostgreSQL lo rechaza con
`42P17 infinite recursion detected in policy for relation`. Y cualquier atajo para evitarlo
-una funcion `SECURITY DEFINER` que saltee RLS, un rol con `BYPASSRLS`- seria justamente el
bypass que no corresponde introducir en la fase que define el aislamiento.

Limitar la visibilidad a la fila `(tenant_id, principal_id)` del contexto es no recursivo y
fail-closed: si esa membership no existe, el resultado es cero filas.

Limitacion conocida y declarada: VS-01 no puede listar el padron de un tenant. El listado de
miembros exige autorizacion de servicio con un rol verificado y llega en VS-05.

Sin policies de escritura y sin grants de escritura: la provision de memberships es
administrativa y queda fuera de VS-01.

Revision ID: 0006_tenant_membership
Revises: 0005_principal
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_tenant_membership"
down_revision: str | None = "0005_principal"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tenant_membership",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("principal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role_key", sa.String(length=32), nullable=False),
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
        sa.CheckConstraint("status IN ('active', 'inactive')", name="status_valid"),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenant.id"],
            name="fk_tenant_membership_tenant_id_tenant",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["principal_id"],
            ["principal.id"],
            name="fk_tenant_membership_principal_id_principal",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["role_key"],
            ["role.key"],
            name="fk_tenant_membership_role_key_role",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint(
            "tenant_id", "principal_id", name="pk_tenant_membership"
        ),
    )

    op.execute("ALTER TABLE tenant_membership ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenant_membership FORCE ROW LEVEL SECURITY")

    # Unica policy, y solo de SELECT. No referencia app_current_role() ni consulta esta misma
    # tabla: sin recursion y sin derivar privilegio de una variable manipulable.
    op.execute(
        """
        CREATE POLICY membership_select_self ON tenant_membership
          FOR SELECT
          USING (
            tenant_id = app_current_tenant_id()
            AND principal_id = app_current_principal_id()
          )
        """
    )

    op.execute("GRANT SELECT ON TABLE tenant_membership TO praxa_app")


def downgrade() -> None:
    op.execute("REVOKE ALL ON TABLE tenant_membership FROM praxa_app")
    op.execute("DROP POLICY IF EXISTS membership_select_self ON tenant_membership")
    op.drop_table("tenant_membership")
