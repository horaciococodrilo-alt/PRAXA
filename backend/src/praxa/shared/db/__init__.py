"""Frontera de persistencia: engine, sesion con contexto de tenant y base declarativa."""

from praxa.shared.db.base import Base, metadata
from praxa.shared.db.engine import create_app_engine, register_context_reset
from praxa.shared.db.session import (
    TenantContext,
    TenantContextLeakError,
    set_tenant_context,
    tenant_session,
)

__all__ = [
    "Base",
    "TenantContext",
    "TenantContextLeakError",
    "create_app_engine",
    "metadata",
    "register_context_reset",
    "set_tenant_context",
    "tenant_session",
]
