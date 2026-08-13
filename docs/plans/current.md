# Trabajo actual

**Última actualización:** 2026-08-11

**Fase:** VS-01 — Fundación de datos, seguridad y contratos

**Ticket autorizado:** VS-01

**Estado:** implementado en `feat/vs-01-data-security-foundation`, sin commit ni merge

**Siguiente gate:** revisión humana del diff antes de commit; VS-02 no queda autorizado

## Resultado esperado

Demostrar aislamiento de datos desde la primera tabla y fijar la frontera de persistencia antes
de que exista cualquier dato de negocio. `docker compose up -d postgres` más
`uv run alembic upgrade head` producen una base con rol de aplicación restringido, RLS forzada y
una suite adversarial que falla si alguien puede leer datos de otro tenant, operar sin contexto,
escribir desde la aplicación o heredar contexto de una conexión reciclada.

## Incluye

- Docker Compose con PostgreSQL 16 y la imagen pgvector fijada por digest inmutable.
- Bootstrap idempotente del cluster: roles, ownership, esquema, revokes y extensión `vector`.
- SQLAlchemy 2 síncrono con `psycopg` 3 y Alembic (ADR-014).
- Configuración separada por contexto: la aplicación recibe una sola credencial.
- Contexto transaccional con `SET LOCAL` y protección en tres capas contra fuga por pool.
- Seis tablas: `tenant`, `principal`, `tenant_membership`, `role`, `permission`, `role_permission`.
- `ENABLE` y `FORCE ROW LEVEL SECURITY` en las seis, con policies sólo de `SELECT`.
- Suite de 156 pruebas: unitarias, integración y seguridad sobre PostgreSQL real.
- Job `backend-integration` en CI con el mismo digest de imagen.

## No incluye

- `pg_trgm`: se instala en la fase que introduzca matching difuso. Hay un test que verifica su
  ausencia para que la exclusión sea deliberada.
- Esqueleto de contratos de evidencia y ContextPacket: se definen donde tengan consumidor, en
  VS-02 y VS-04.
- Cualquier escritura desde el rol de aplicación.
- Rol administrativo de retención (ADR-012), autenticación real, ACL por recurso.
- Ingesta, evidencia, entidades, retrieval, Context Compiler, API de dominio, agente, UI, colas.

## Decisiones tomadas en esta fase

1. **ADR-014**: SQLAlchemy 2 síncrono con `psycopg` 3. La disciplina de contexto transaccional de
   RLS es verificable por inspección en código síncrono; en async, una sesión compartida entre
   tareas rompe el invariante sin error visible.
2. **El rol de aplicación es de sólo lectura en toda la base.** Un `UPDATE` acotado a la propia
   membership permitía reactivar un `status` inactivo o rotar de rol, y VS-01 no tiene ninguna
   escritura de aplicación que justifique ese riesgo.
3. **`app.role` no aparece en ninguna policy.** Es una variable de sesión que cualquier sesión con
   la credencial de aplicación puede fijar; usarla en una policy simularía un control sin
   ejercerlo. La autorización por rol vive en la capa de servicio y llega con VS-05.
4. **`tenant_membership` se limita a la propia fila.** Mirar sólo `tenant_id` habría dejado que un
   principal sin membership afirmara un tenant y leyera el padrón completo. Verificar la membership
   del solicitante dentro de una policy sobre esa misma tabla es recursivo.
5. **Las extensiones se instalan en el bootstrap, no en Alembic.** `CREATE EXTENSION vector` exige
   superusuario y el criterio de aceptación exige que el rol de migración no lo sea.
6. **Imagen fijada por digest**: `pgvector/pgvector:0.8.6-pg16@sha256:a3625087…14c6b`, idéntica en
   local y en CI.

## Limitaciones conocidas que VS-01 deja abiertas

- **No se puede listar el padrón de un tenant.** `tenant_membership` sólo expone la fila del propio
  principal. El listado de miembros exige autorización de servicio con un rol verificado: VS-05.
- **La autorización por rol dentro del tenant no la verifica PostgreSQL.** Vive en la capa de
  servicio desde VS-05.
- **Los tres GUCs son afirmaciones de la aplicación.** RLS con contexto de sesión defiende contra
  errores del código, no contra alguien que ya controla el proceso y su credencial. La
  autenticación que los respalda llega en VS-05.
- **El criterio «rol restringido del mismo tenant no accede al recurso protegido» se trasladó a
  VS-02**, la primera fase que crea un recurso de negocio protegido por rol.

## Criterios de aceptación y evidencia

| Criterio | Evidencia |
|---|---|
| El rol de aplicación no es owner ni tiene `BYPASSRLS` | `test_role_privileges.py`, `test_security_posture_inventory.py` |
| Las pruebas de aislamiento pasan sobre PostgreSQL real | 111 pruebas con marker `integration` o `security` |
| SQLite no sustituye integración ni seguridad | `test_config.py`, `test_no_forbidden_patterns.py` |
| Configuración ausente falla con error claro, sin secretos | `test_config.py`, `test_config_separation.py` |
| Tenant A no lee ni escribe filas de B | `test_rls_cross_tenant.py`, `test_all_writes_denied.py` |
| Sin tenant/principal se deniega por defecto | `test_denied_without_context.py` |
| Membership inexistente se deniega | `test_denied_without_context.py`, `test_principal_visibility.py` |
| La suite afirma que usa el rol de aplicación | `tests/conftest.py`, aborta si `current_user` no coincide |
| Migración desde base vacía | `test_migrations.py` y pasos dedicados en CI |
| `ENABLE`/`FORCE ROW LEVEL SECURITY` | `test_security_posture_inventory.py` |
| Sin fuga de contexto al reutilizar conexiones | `test_pool_reuse_context_isolation.py`, con control negativo |

## Trabajo restante

1. Revisión humana del diff por alguien distinto del autor.
2. Registro de horas humanas reales.
3. Commit, push, PR y verificación de CI en runner limpio.
4. Merge sólo con autorización humana.

## Punto de parada

```text
ESTADO: VS-01 IMPLEMENTADO Y VERIFICADO EN LOCAL — COMMIT, PUSH Y VS-02 NO AUTORIZADOS
```
