"""Create the VS-01 tenancy and authorization foundation."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_vs01"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _enable_rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")


def upgrade() -> None:
    op.create_table(
        "tenants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("status IN ('active', 'suspended', 'deleted')"),
    )
    op.create_table(
        "principals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("kind IN ('human', 'service', 'agent')"),
        sa.CheckConstraint("status IN ('active', 'disabled')"),
    )
    op.create_table(
        "tenant_memberships",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("principal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("status IN ('active', 'inactive')"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["principal_id"], ["principals.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("tenant_id", "principal_id"),
    )
    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(50), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=False),
    )
    op.create_table(
        "permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=False),
    )
    op.create_table(
        "membership_roles",
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("principal_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id", "principal_id"],
            ["tenant_memberships.tenant_id", "tenant_memberships.principal_id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("tenant_id", "principal_id", "role_id"),
    )
    op.create_table(
        "role_permissions",
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["permission_id"], ["permissions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("role_id", "permission_id"),
    )

    op.execute(
        """
        INSERT INTO roles (id, key, description) VALUES
          ('10000000-0000-0000-0000-000000000001', 'owner', 'Tenant owner'),
          ('10000000-0000-0000-0000-000000000002', 'admin', 'Tenant administrator'),
          ('10000000-0000-0000-0000-000000000003', 'reviewer', 'Knowledge reviewer'),
          ('10000000-0000-0000-0000-000000000004', 'member', 'Tenant member'),
          ('10000000-0000-0000-0000-000000000005', 'service', 'Service principal')
        ON CONFLICT (key) DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO permissions (id, key, description) VALUES
          ('20000000-0000-0000-0000-000000000001', 'tenant.read', 'Read tenant metadata'),
          ('20000000-0000-0000-0000-000000000002', 'membership.read.self', 'Read own membership')
        ON CONFLICT (key) DO NOTHING
        """
    )

    op.execute(
        """
        CREATE FUNCTION praxa_current_tenant_id() RETURNS uuid
        LANGUAGE plpgsql STABLE
        AS $$
        DECLARE raw_value text;
        BEGIN
          raw_value := current_setting('app.tenant_id', true);
          IF raw_value IS NULL OR raw_value = '' THEN RETURN NULL; END IF;
          BEGIN RETURN raw_value::uuid;
          EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
          END;
        END;
        $$
        """
    )
    op.execute(
        """
        CREATE FUNCTION praxa_current_principal_id() RETURNS uuid
        LANGUAGE plpgsql STABLE
        AS $$
        DECLARE raw_value text;
        BEGIN
          raw_value := current_setting('app.principal_id', true);
          IF raw_value IS NULL OR raw_value = '' THEN RETURN NULL; END IF;
          BEGIN RETURN raw_value::uuid;
          EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
          END;
        END;
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION praxa_current_tenant_id() FROM PUBLIC")
    op.execute("REVOKE ALL ON FUNCTION praxa_current_principal_id() FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION praxa_current_tenant_id() TO praxa_app")
    op.execute("GRANT EXECUTE ON FUNCTION praxa_current_principal_id() TO praxa_app")

    for table in (
        "tenants",
        "principals",
        "tenant_memberships",
        "roles",
        "permissions",
        "membership_roles",
        "role_permissions",
    ):
        _enable_rls(table)

    op.execute(
        """
        CREATE POLICY memberships_self_select ON tenant_memberships
        FOR SELECT TO praxa_app
        USING (
          tenant_id = praxa_current_tenant_id()
          AND principal_id = praxa_current_principal_id()
        )
        """
    )
    op.execute(
        """
        CREATE POLICY tenants_active_member_select ON tenants
        FOR SELECT TO praxa_app
        USING (
          id = praxa_current_tenant_id()
          AND EXISTS (
            SELECT 1 FROM tenant_memberships membership
            WHERE membership.tenant_id = tenants.id
              AND membership.principal_id = praxa_current_principal_id()
              AND membership.status = 'active'
          )
        )
        """
    )
    op.execute(
        """
        CREATE POLICY principals_self_active_member_select ON principals
        FOR SELECT TO praxa_app
        USING (
          id = praxa_current_principal_id()
          AND EXISTS (
            SELECT 1 FROM tenant_memberships membership
            WHERE membership.tenant_id = praxa_current_tenant_id()
              AND membership.principal_id = principals.id
              AND membership.status = 'active'
          )
        )
        """
    )
    op.execute(
        """
        CREATE POLICY membership_roles_self_select ON membership_roles
        FOR SELECT TO praxa_app
        USING (
          tenant_id = praxa_current_tenant_id()
          AND principal_id = praxa_current_principal_id()
        )
        """
    )
    for table in ("roles", "permissions", "role_permissions"):
        op.execute(
            f"CREATE POLICY {table}_catalog_select ON {table} FOR SELECT TO praxa_app USING (true)"
        )

    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC")
    op.execute("GRANT USAGE ON SCHEMA public TO praxa_app")
    op.execute(
        "GRANT SELECT ON tenants, principals, tenant_memberships, roles, permissions, "
        "membership_roles, role_permissions TO praxa_app"
    )


def downgrade() -> None:
    for table in (
        "role_permissions",
        "membership_roles",
        "permissions",
        "roles",
        "tenant_memberships",
        "principals",
        "tenants",
    ):
        op.drop_table(table)
    op.execute("DROP FUNCTION praxa_current_principal_id()")
    op.execute("DROP FUNCTION praxa_current_tenant_id()")
