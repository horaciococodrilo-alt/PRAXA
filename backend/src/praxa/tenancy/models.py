"""Tablas minimas de identidad y pertenencia.

Dos clases de tabla, y la distincion importa para las policies y para el inventario de postura
de seguridad:

  * **negocio** -`tenant`, `principal`, `tenant_membership`- contienen datos de cliente y se leen
    siempre bajo contexto de tenant;
  * **catalogo global** -`role`, `permission`, `role_permission`- son el enum de roles y permisos
    de v0, no llevan `tenant_id` y se leen sin contexto.

`principal` no lleva `tenant_id` a proposito (spec 10.2): una persona puede pertenecer a mas de
un tenant, y duplicar su identidad por cada uno rompe la trazabilidad. El aislamiento lo aporta
la policy de visibilidad por membership, no una columna.

En VS-01 el rol de aplicacion tiene `SELECT` y nada mas sobre las seis tablas.
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from praxa.shared.db.base import Base

BUSINESS_TABLES = ("tenant", "principal", "tenant_membership")
CATALOG_TABLES = ("role", "permission", "role_permission")

TENANT_STATUSES = ("active", "suspended", "deleted")
PRINCIPAL_KINDS = ("human", "service", "agent")
PRINCIPAL_STATUSES = ("active", "disabled")
MEMBERSHIP_STATUSES = ("active", "inactive")

V0_ROLES = ("owner", "admin", "reviewer", "member", "service")


def _in_list(column: str, values: tuple[str, ...]) -> str:
    rendered = ", ".join(f"'{value}'" for value in values)
    return f"{column} IN ({rendered})"


class Tenant(Base):
    __tablename__ = "tenant"
    __table_args__ = (
        CheckConstraint(_in_list("status", TENANT_STATUSES), name="status_valid"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    slug: Mapped[str] = mapped_column(String(64), unique=True)
    name: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), server_default=text("'active'"))
    settings: Mapped[dict[str, object]] = mapped_column(
        JSONB, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Principal(Base):
    __tablename__ = "principal"
    __table_args__ = (
        CheckConstraint(_in_list("kind", PRINCIPAL_KINDS), name="kind_valid"),
        CheckConstraint(_in_list("status", PRINCIPAL_STATUSES), name="status_valid"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    kind: Mapped[str] = mapped_column(String(16))
    external_subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_name: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), server_default=text("'active'"))
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Role(Base):
    __tablename__ = "role"

    key: Mapped[str] = mapped_column(String(32), primary_key=True)
    description: Mapped[str] = mapped_column(Text)


class Permission(Base):
    __tablename__ = "permission"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    description: Mapped[str] = mapped_column(Text)


class RolePermission(Base):
    __tablename__ = "role_permission"

    role_key: Mapped[str] = mapped_column(
        String(32), ForeignKey("role.key", ondelete="RESTRICT"), primary_key=True
    )
    permission_key: Mapped[str] = mapped_column(
        String(64), ForeignKey("permission.key", ondelete="RESTRICT"), primary_key=True
    )


class TenantMembership(Base):
    """Pertenencia de un principal a un tenant, con su rol efectivo.

    El backend resuelve el rol desde esta tabla; nunca desde `app.role`, que es una afirmacion
    de la aplicacion y no una verificacion.
    """

    __tablename__ = "tenant_membership"
    __table_args__ = (
        CheckConstraint(_in_list("status", MEMBERSHIP_STATUSES), name="status_valid"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tenant.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    principal_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("principal.id", ondelete="RESTRICT"),
        primary_key=True,
    )
    role_key: Mapped[str] = mapped_column(
        String(32), ForeignKey("role.key", ondelete="RESTRICT")
    )
    status: Mapped[str] = mapped_column(String(16), server_default=text("'active'"))
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
