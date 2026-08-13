"""Policies que dependen de `tenant_membership`.

Van al final porque necesitan que la tabla exista. Son dos:

1. **`principal_visible_via_membership`** (permisiva, sobre `principal`). Un principal es visible
   si tiene una membership **activa** en el tenant del contexto. Abre la tabla que 0005 dejo
   deliberadamente cerrada.

2. **`tenant_requires_active_requester_membership`** (restrictiva, sobre `tenant`). Ademas de
   coincidir el tenant, quien consulta debe tener una membership activa en el. Cierra el caso
   "un principal sin membership afirma un tenant_id y lee la fila del tenant".

**Verificacion de no recursion.** Las dos estan sobre tablas distintas de `tenant_membership` y
su subconsulta toca `tenant_membership`, cuya unica policy (`membership_select_self`) referencia
solo las funciones `app_current_*` y ninguna tabla. Las cadenas
`principal -> tenant_membership -> nada` y `tenant -> tenant_membership -> nada` terminan; no hay
ciclo, y por lo tanto no puede producirse `42P17`.

**Por que no se aplica la restrictiva a `tenant_membership`.** Seria una subconsulta sobre la
misma tabla: recursion. No hace falta, ademas: `membership_select_self` ya exige que la fila del
solicitante exista, con lo que un principal sin membership no ve nada.

**Por que no se aplica a `principal`.** Seria redundante: la permisiva de arriba, evaluada bajo la
RLS de `tenant_membership`, ya exige que el solicitante tenga su propia membership activa.

Revision ID: 0007_membership_policies
Revises: 0006_tenant_membership
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0007_membership_policies"
down_revision: str | None = "0006_tenant_membership"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE POLICY principal_visible_via_membership ON principal
          FOR SELECT
          USING (
            EXISTS (
              SELECT 1 FROM tenant_membership m
              WHERE m.principal_id = principal.id
                AND m.tenant_id = app_current_tenant_id()
                AND m.status = 'active'
            )
          )
        """
    )

    op.execute(
        """
        CREATE POLICY tenant_requires_active_requester_membership ON tenant
          AS RESTRICTIVE
          FOR ALL
          USING (
            EXISTS (
              SELECT 1 FROM tenant_membership m
              WHERE m.principal_id = app_current_principal_id()
                AND m.tenant_id = app_current_tenant_id()
                AND m.status = 'active'
            )
          )
        """
    )


def downgrade() -> None:
    op.execute(
        "DROP POLICY IF EXISTS tenant_requires_active_requester_membership ON tenant"
    )
    op.execute("DROP POLICY IF EXISTS principal_visible_via_membership ON principal")
