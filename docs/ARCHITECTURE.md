# Arquitectura de PRAXA

Documento breve. Describe lo que existe hoy y deja anotado lo que va a existir, sin
inventar estructura para módulos que todavía no se construyeron.

## Forma general

Monolito modular en un único proyecto Next.js 16 (App Router, TypeScript), con Supabase
(PostgreSQL + Auth) **alojado en la nube** como base de datos y proveedor de identidad.
No hay monorepo ni servicios separados: para el alcance actual serían costo sin beneficio.

No se usa el stack local de Supabase ni Docker. El proyecto remoto es el mismo motor que
correría en producción, así que las políticas RLS y los privilegios se prueban contra
PostgreSQL real y contra el mismo PostgREST, no contra una imitación. El costo es que
hace falta un proyecto en la nube para correr las pruebas de base de datos; a cambio, lo
que se verifica es lo que efectivamente se despliega.

Los módulos se separan por **dominio**, no por capa técnica:

```
src/
  app/                      rutas (landing, auth, onboarding, aplicación protegida)
  components/               UI compartida
  lib/
    env.ts                  configuración pública, validada de forma perezosa
    supabase/               clientes de servidor y de navegador
  modules/
    identity/               identidad verificada del usuario
    company/                empresa, pertenencia y alta idempotente
    onboarding/             contexto declarado: esquemas, persistencia, acciones
    reporting/contract/     contrato versionado del reporte (sin generación)
proxy.ts                    refresco de sesión y redirección (NO autorización)
supabase/
  migrations/               migraciones SQL versionadas
  tests/                    pruebas pgTAP de políticas y privilegios
tests/
  unit/                     contrato, esquemas y guarda de credenciales
  app/                      pruebas contra un proyecto remoto y desechable
```

### Módulos futuros

No se crearon carpetas vacías para ellos. Se documentan acá y se construirán cuando
llegue su fase:

- **`integrations/`** — conectores de solo lectura por API. Cada conector aporta
  extracción y normalización; ninguno modifica sistemas externos.
- **`data/`** — normalización y relaciones verificables entre entidades de distintos
  sistemas.
- **`analysis/`** — cálculo determinístico de métricas. Todo número que aparezca en un
  reporte sale de acá, nunca de un modelo de lenguaje.
- **`reporting/generation/`** — armado del ContextPacket y llamada al LLM para
  interpretar evidencia ya calculada.

## Decisiones y por qué

### Un solo proyecto, dominios separados

La alternativa (backend y frontend separados) agrega despliegue, contratos HTTP y
duplicación de tipos. Con Server Actions y RLS, el borde de seguridad está en la base de
datos, no en una capa HTTP intermedia.

### Dos esquemas: `public` y `private`

- `public` — tablas del producto. Expuesto por la Data API, protegido por RLS.
- `private` — helpers y trigger functions internas. **No** expuesto por la Data API
  (`db.schemas` en `supabase/config.toml` solo lista `public` y `graphql_public`).

`authenticated` recibe `USAGE` sobre `private` únicamente porque las expresiones de las
políticas RLS se evalúan con los privilegios del rol que consulta: sin eso, una política
no podría llamar a `private.is_company_member()`. Lo que impide invocar esas funciones
por HTTP es que el esquema no está expuesto, no el permiso.

### Las RPC del producto son `SECURITY INVOKER`

`create_company_for_current_user`, `start_context_draft`, `activate_context_draft`,
`replace_draft_objectives` y `replace_draft_systems` operan bajo RLS, sin privilegios
elevados. Una RPC `SECURITY DEFINER` en un esquema expuesto es una superficie de ataque:
cualquier error de lógica dentro se ejecuta con permisos del dueño de la función.

`SECURITY DEFINER` queda para dos casos donde es imprescindible:

- `private.is_company_member()` — consulta `company_members` desde las políticas de esa
  misma tabla; sin elevación habría recursión infinita.
- `private.handle_new_company()` — crea la membresía inicial en la misma transacción que
  la empresa, y `authenticated` no tiene (ni debe tener) INSERT sobre `company_members`.

Ambas usan `SET search_path = ''`, nombres totalmente calificados, rechazo de
`auth.uid()` nulo y permisos mínimos.

### El contexto es versionado e inmutable

```
draft  (version IS NULL, editable)
  │  activate_context_draft()
  ▼
active (version > 0, inmutable)
  │  activate_context_draft() de un borrador posterior
  ▼
superseded (version > 0, inmutable)
```

Editar un contexto vigente no lo modifica: `start_context_draft()` lo **clona** a un
borrador nuevo con sus objetivos y sistemas, y solo el borrador es editable. Un reporte
guarda el identificador de la versión con la que se generó, así que siempre se puede
reconstruir sobre qué base se dijo lo que se dijo, aunque el contexto haya cambiado
después.

**El borrador puede estar incompleto**: guardar y retomar el onboarding es un requisito
del producto, y exigir integridad total en cada guardado lo rompería. La integridad
completa se valida en un solo lugar, `activate_context_draft()`:

- `has_defined_objective = true` ⇒ al menos un objetivo y **exactamente uno** principal.
- `has_defined_objective = false` ⇒ cero objetivos.

### Integridad referencial entre empresas

Las tablas hijas no referencian solo el identificador del padre, sino el par
`(company_id, context_version_id) → company_context_versions (company_id, id)`. Así, una
fila de la empresa A no puede apuntar a una versión de la empresa B ni siquiera si
alguien elude las políticas: lo impide la clave foránea. Todas las tablas tenant tienen
`company_id NOT NULL`.

### Tres versiones independientes

Se versionan por separado porque cambian por razones distintas:

| Versión | Cambia cuando… | Vive en |
|---|---|---|
| `CONTEXT_SCHEMA_VERSION` | cambia lo que le preguntamos al usuario | `src/modules/onboarding/schema.ts` |
| `REPORT_SCHEMA_VERSION` | cambia la forma del documento | `src/modules/reporting/contract/versions.ts` |
| `METHODOLOGY_VERSION` | cambian las etapas o los criterios | `src/modules/reporting/contract/versions.ts` |

## Contrato del reporte

Definido y validado; **la generación con IA no está implementada** y no hay ninguna
llamada a un LLM en el código.

Seis secciones siempre presentes: objetivos y contexto; situación actual con período y
cobertura; análisis y hallazgos con evidencia; mejoras priorizadas; plan por etapas;
medición y revisión.

La evidencia está tipada por **procedencia**, que es el núcleo del contrato:

| Tipo | Qué es |
|---|---|
| `user_statement` | lo que el dueño declaró — no es un hecho verificado |
| `calculated_metric` | número calculado por código, con período, cobertura y método |
| `system_fact` | hecho leído de un sistema, sin transformar |
| `inference` | interpretación, que **debe** declarar de qué evidencia se deriva |

Además de la forma, se valida la **integridad referencial** del documento: cada hallazgo
referencia evidencia existente, cada mejora referencia hallazgos y objetivos válidos, la
situación actual solo admite métricas calculadas, y una mejora no puede evaluarse si
ninguna etapa se comprometió a implementarla.

Sobre `knownOr`: **el esquema no impide que un modelo invente información.** Ninguna
validación estructural puede. Lo que hace es obligar a representar explícitamente lo
conocido y lo desconocido —"no lo sé" es un valor de primera clase con motivo declarado,
no un hueco que se rellena— y la integridad referencial convierte una afirmación sin
respaldo en un error detectable.

## Trabajos largos

La sincronización con sistemas externos y la generación de reportes **no pueden correr
dentro de una petición web**. Se incorporarán con Trigger.dev en sus fases. Trigger.dev
todavía no está instalado: agregarlo ahora sería estructura sin uso.

Cuando llegue, los workers deben cumplir lo mismo que la aplicación:

- **Verificar el contexto de empresa por su cuenta.** Un worker corre fuera de la sesión
  del usuario; si usa una credencial privilegiada, RLS deja de protegerlo y el
  aislamiento pasa a depender enteramente de su código. Cada tarea debe recibir un
  `company_id` explícito y filtrar por él en toda consulta.
- **Guardar los tokens de integración cifrados**, fuera del alcance de la Data API,
  accesibles solo desde el worker. Nunca en una tabla legible por `authenticated`.
- **Acotar lo que recibe el LLM.** El modelo recibe evidencia ya calculada y el contexto
  declarado, nada más: sin credenciales, sin acceso a los sistemas conectados y sin
  permisos de escritura en ningún lado.

## Limitación conocida del MVP

`companies.owner_id` tiene un índice único: **una cuenta administra una sola empresa**.
La plataforma aloja muchas empresas aisladas entre sí, pero en esta versión el dueño es
el único administrador y no puede tener más de una.

Reversión cuando haga falta: quitar `companies_owner_unique`, agregar políticas de
escritura sobre `company_members` con reglas de rol, y cambiar la resolución de empresa
—que hoy devuelve la única del usuario— por una selección explícita del espacio activo.
