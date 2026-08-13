"""Funciones de contexto de sesion usadas por las policies de RLS.

Dos decisiones de seguridad viven en este archivo.

**Fail-closed ante un valor invalido.** `nullif(current_setting(...), '')::uuid` no alcanza:
`nullif` solo convierte la cadena vacia en NULL, asi que un texto que no es UUID llega al cast y
levanta `22P02 invalid_text_representation`. Estas funciones capturan esa excepcion y devuelven
NULL, con lo que toda comparacion de policy evalua a falso. Un valor invalido deniega; no rompe
la consulta ni se filtra a SQL.

El costo declarado es que un valor mal escrito deniega en silencio. Se compensa con la
validacion de tipo en `TenantContext`, que rechaza un valor no-UUID antes de llegar a la base.

**`app_current_role()` existe pero no gobierna nada.** Se usa para auditoria y para las
verificaciones de la capa de servicio que llegan en VS-05. Ninguna policy la referencia: es una
variable que cualquier sesion con la credencial de aplicacion puede fijar, y derivar privilegio
de ella simularia un control sin ejercerlo. Hay un test que recorre `pg_policies` y falla si
aparece.

`SET search_path = pg_catalog` en las tres bloquea ataques de search_path. `SECURITY INVOKER`
es el default y se deja explicito: estas funciones no deben elevar privilegios.

Revision ID: 0002_session_context
Revises: 0001_baseline
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0002_session_context"
down_revision: str | None = "0001_baseline"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UUID_GETTER = """
CREATE OR REPLACE FUNCTION {name}() RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  raw text := nullif(current_setting('{guc}', true), '');
BEGIN
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN raw::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END $$;
"""

_FUNCTIONS = ("app_current_tenant_id", "app_current_principal_id", "app_current_role")


def upgrade() -> None:
    op.execute(_UUID_GETTER.format(name="app_current_tenant_id", guc="app.tenant_id"))
    op.execute(
        _UUID_GETTER.format(name="app_current_principal_id", guc="app.principal_id")
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION app_current_role() RETURNS text
        LANGUAGE sql
        STABLE
        SECURITY INVOKER
        SET search_path = pg_catalog
        AS $$
          SELECT nullif(current_setting('app.role', true), '')
        $$;
        """
    )

    for function in _FUNCTIONS:
        op.execute(f"REVOKE ALL ON FUNCTION {function}() FROM PUBLIC")
        op.execute(f"GRANT EXECUTE ON FUNCTION {function}() TO praxa_app")


def downgrade() -> None:
    for function in reversed(_FUNCTIONS):
        op.execute(f"DROP FUNCTION IF EXISTS {function}()")
