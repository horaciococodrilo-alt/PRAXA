"""Catalogos globales de roles y permisos.

El orden de las operaciones no es incidental: **primero se insertan las semillas y despues se
activa `FORCE ROW LEVEL SECURITY`**. `FORCE` somete tambien al dueno de la tabla, y estas tablas
solo tendran una policy de `SELECT`; si se activara antes, ni siquiera `praxa_owner` podria
insertar las filas.

Para modificar un catalogo en una fase posterior, el patron sancionado es, dentro de una
migracion y solo desde el rol de migracion:

    ALTER TABLE <t> NO FORCE ROW LEVEL SECURITY;
    -- mutar
    ALTER TABLE <t> FORCE ROW LEVEL SECURITY;

Nunca desde la aplicacion, que no tiene grants de escritura en ningun caso.

Son catalogos **globales**: sin `tenant_id`, sin datos de cliente, legibles sin contexto de
tenant. Se les habilita RLS igual para que el inventario de postura de seguridad pueda exigir una
declaracion explicita en toda tabla de `public`, sin excepciones talladas a mano.

Revision ID: 0004_role_permission_catalog
Revises: 0003_tenant
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_role_permission_catalog"
down_revision: str | None = "0003_tenant"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROLES = [
    ("owner", "Control total del tenant, incluida la gestion de miembros."),
    ("admin", "Administracion del tenant sin transferencia de propiedad."),
    ("reviewer", "Revisa propuestas y deja decisiones auditadas."),
    ("member", "Acceso operativo de lectura al contexto del tenant."),
    ("service", "Principal no humano de integracion."),
]

PERMISSIONS = [
    ("tenant.read", "Leer los datos del tenant del contexto."),
    ("membership.read", "Leer memberships del tenant."),
    ("membership.manage", "Alta, baja y cambio de rol de miembros."),
]

ROLE_PERMISSIONS = [
    ("owner", "tenant.read"),
    ("owner", "membership.read"),
    ("owner", "membership.manage"),
    ("admin", "tenant.read"),
    ("admin", "membership.read"),
    ("admin", "membership.manage"),
    ("reviewer", "tenant.read"),
    ("reviewer", "membership.read"),
    ("member", "tenant.read"),
    ("service", "tenant.read"),
]

CATALOG_TABLES = ("role", "permission", "role_permission")


def upgrade() -> None:
    role = op.create_table(
        "role",
        sa.Column("key", sa.String(length=32), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("key", name="pk_role"),
    )
    permission = op.create_table(
        "permission",
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("key", name="pk_permission"),
    )
    role_permission = op.create_table(
        "role_permission",
        sa.Column("role_key", sa.String(length=32), nullable=False),
        sa.Column("permission_key", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(
            ["role_key"],
            ["role.key"],
            name="fk_role_permission_role_key_role",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["permission_key"],
            ["permission.key"],
            name="fk_role_permission_permission_key_permission",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint(
            "role_key", "permission_key", name="pk_role_permission"
        ),
    )

    # Semillas ANTES de FORCE. Ver la nota del encabezado.
    op.bulk_insert(
        role, [{"key": key, "description": description} for key, description in ROLES]
    )
    op.bulk_insert(
        permission,
        [{"key": key, "description": description} for key, description in PERMISSIONS],
    )
    op.bulk_insert(
        role_permission,
        [{"role_key": r, "permission_key": p} for r, p in ROLE_PERMISSIONS],
    )

    for table in CATALOG_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY {table}_select_all ON {table} FOR SELECT USING (true)"
        )
        op.execute(f"GRANT SELECT ON TABLE {table} TO praxa_app")


def downgrade() -> None:
    for table in reversed(CATALOG_TABLES):
        op.execute(f"REVOKE ALL ON TABLE {table} FROM praxa_app")
        op.execute(f"DROP POLICY IF EXISTS {table}_select_all ON {table}")
    op.drop_table("role_permission")
    op.drop_table("permission")
    op.drop_table("role")
