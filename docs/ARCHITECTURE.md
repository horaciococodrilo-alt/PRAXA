# Arquitectura de PRAXA

Este documento responde: **cómo está construido PRAXA, cuáles son sus componentes y cómo
fluye una operación entre ellos.** Distingue lo que **existe** de lo que está **previsto**
(aprobado en la spec de la ruta, todavía no construido). No es un roadmap: el orden de
construcción está en `docs/FASES/FASE1/meta_first/plan.md` y el estado en
`docs/PROJECT_STATE.md`. Las propiedades de seguridad están en `docs/SECURITY.md`.

Cuándo se actualiza este documento: ver "Contrato documental" en `AGENTS.md`.

## Forma general

Monolito modular en un único proyecto Next.js 16 (App Router, TypeScript), con Supabase
(PostgreSQL + Auth) **alojado en la nube**. No hay monorepo, microservicios, colas ni
workers en segundo plano. Todo el código del servidor corre dentro de peticiones de Next
(páginas, Server Actions y Route Handlers).

No se usa el stack local de Supabase ni Docker. Las políticas RLS y los privilegios se
prueban contra PostgreSQL y PostgREST reales, en un proyecto remoto desechable.

Sistemas externos: Meta Graph API (fuente de datos, solo lectura) y un proveedor de modelo de
lenguaje (DeepInfra, DEC-16), ambos **previstos**. El despliegue previsto es Vercel con
dominio fijo (DEC-07).

## Estructura del código

Los módulos se separan por **dominio**, no por capa técnica. No se crean carpetas vacías
para lo previsto.

```
src/
  app/                      rutas (landing, auth, onboarding, aplicación protegida)
  components/               UI compartida
  lib/
    env.ts                  configuración pública, validada de forma perezosa
    supabase/               clientes de servidor y de navegador (clave publishable)
  modules/
    identity/               identidad verificada del usuario (getClaims)
    company/                empresa, pertenencia y alta idempotente
    tenant/                 K01 TenantContext: actor + empresa, solo en el servidor
    onboarding/             contexto declarado: esquemas, persistencia, acciones
    reporting/contract/     contrato versionado del reporte (sin generación)
    integrations/contract/  contratos K02–K04: intento OAuth, conexión, credencial
    integrations/crypto/    llavero y cifrado autenticado de credenciales
    integrations/db/        cliente PostgreSQL acotado a worker_api
    integrations/repository/ preparación, lectura y recifrado de credenciales
proxy.ts                    refresco de sesión y redirección (NO autorización)
supabase/
  migrations/               migraciones SQL versionadas
  tests/                    pruebas pgTAP de políticas, privilegios y ciclo de vida
scripts/                    guardas de destino, migración y ejecución de pgTAP
tests/
  unit/ component/          contratos, esquemas, guardas de credenciales y de destino
  app/                      pruebas contra el proyecto remoto desechable
```

Previsto dentro de `src/modules/`, con rutas sugeridas por el plan:

- `integrations/`: cliente de Meta (OAuth, cuentas, Insights, errores) y ciclo de vida.
- `chat/`: redacción, herramientas cerradas, adaptador del modelo, orquestador y guarda de
  afirmaciones numéricas.

## Módulos y responsabilidades

| Módulo | Responsabilidad | Estado |
|---|---|---|
| `identity` | Usuario verificado con `getClaims()`; nunca `getSession()` | Existe |
| `company` | Empresa del usuario y membresía, resueltas bajo RLS | Existe |
| `tenant` | Construye K01 (`user_id`, `company_id`, `role`, `request_id`) dentro del servidor. Es la única entrada de actor y empresa al camino privilegiado | Existe; todavía sin consumidores en `src/` |
| `onboarding` | Contexto declarado, versionado e inmutable una vez activo | Existe |
| `reporting/contract` | Esquema del reporte y su evidencia tipada por procedencia | Existe; sin generación |
| `integrations/contract` | Contratos Zod de intento OAuth, conexión (registro interno y DTO público separados) y credencial cifrada | Existe |
| `integrations/crypto` | Llavero versionado y cifrado AES-256-GCM con AAD de empresa, conexión y proveedor; material descifrado en envoltorio redactado | Existe |
| `integrations/db` | Cliente PostgreSQL `server-only` del rol `praxa_integrations`, limitado a `worker_api`, con TLS verificado y errores redactados | Existe |
| `integrations/repository` | Prepara operaciones reutilizables, valida K01 y respuestas, lee y recifra credenciales según versión y estado | Existe |
| `integrations` (resto) | OAuth con Meta, ciclo de vida y sincronización manual | Previsto |
| `chat` | Consulta en lenguaje natural sobre gasto e impresiones, con cifras verificadas | Previsto |

La ruta `meta_first` no construye Tiendanube, GA4, reportes publicados, métricas derivadas
ni base vectorial (spec, sección 2).

## Base de datos

### Esquemas

| Esquema | Contenido | Expuesto por la Data API |
|---|---|---|
| `public` | Tablas del producto, protegidas por `GRANT` + RLS; RPC del producto | Sí |
| `private` | Helpers, triggers, funciones de escritura con privilegio acotado y la tabla de credenciales | No |
| `worker_api` | Funciones del conector, ejecutables solo por `praxa_integrations` | No |

Los esquemas expuestos se declaran en `supabase/config.toml` (`public` y `graphql_public`).
`authenticated` recibe `USAGE` sobre `private` porque las políticas RLS se evalúan con los
privilegios de quien consulta y llaman a `private.is_company_member()`; lo que impide
invocar `private` por HTTP es que no está expuesto.

### Roles

| Rol | Quién lo usa | Qué puede |
|---|---|---|
| `anon` | Visitante sin sesión | Nada sobre las tablas del producto |
| `authenticated` | Usuario con JWT, por la Data API | Lo que conceden los grants, filtrado por RLS |
| `praxa_integrations` | Código `server-only` del conector, por conexión PostgreSQL al pooler en modo transacción | Solo `EXECUTE` sobre funciones de `worker_api`; ninguna tabla. `LOGIN`, `NOBYPASSRLS`, `NOINHERIT`, sin contraseña en el repositorio |
| Administrativos (`postgres`, `service_role`) | Migraciones, panel de Supabase y fixtures de prueba | Fuera del runtime de la aplicación |

La matriz exacta está en el encabezado de cada migración y se prueba en pgTAP.

### Funciones: invoker por defecto, definer acotado

- Las **RPC del producto en `public`** (`create_company_for_current_user`,
  `start_context_draft`, `activate_context_draft`, `replace_draft_objectives`,
  `replace_draft_systems`, `context_revision`) son `SECURITY INVOKER`: operan bajo RLS. Una
  función `SECURITY DEFINER` en un esquema expuesto sería superficie de ataque.
- `SECURITY DEFINER` vive solo en esquemas **no expuestos**:
  - en `private`, cuando no hay otra forma: la verificación de pertenencia que usan las
    propias políticas (evita la recursión), el alta de la membresía inicial, y la escritura
    de las listas del contexto y su clonado, que `authenticated` ya no puede escribir
    directamente. Cada una revalida la pertenencia con `auth.uid()`;
  - en `worker_api`, todas: el rol del conector no tiene privilegios sobre tablas y cada
    función verifica actor y empresa recibidos.
- Todas llevan `set search_path = ''`, nombres calificados y `revoke all` explícito antes de
  cada grant.

La lista vigente se obtiene de las migraciones
(`grep -n "security definer" supabase/migrations/*.sql`), no de este documento.

### Integridad entre empresas

Toda tabla de empresa tiene `company_id NOT NULL` y cascada desde `companies`. Las tablas
hijas referencian el par `(company_id, id_del_padre)`, así que una fila de la empresa A no
puede apuntar a un padre de la empresa B aunque alguien eluda las políticas.

## Los dos caminos de una operación

### A. Camino interactivo (existe)

```
Navegador ──► proxy.ts (refresca sesión, redirige) ──► página / Server Action / Route Handler
          ──► identity: getClaims() ──► company: membresía bajo RLS
          ──► cliente Supabase con clave publishable + JWT ──► Data API (PostgREST)
          ──► PostgreSQL: GRANT + RLS ──► filas de la empresa del usuario
```

Lo usan el onboarding, el contexto, las páginas de la aplicación y, previsto, la lectura de
conexiones y cobertura y las herramientas del chat. La base conoce al usuario por el JWT.

### B. Camino privilegiado de integraciones (base existe; cliente previsto)

```
Navegador ──► Route Handler / Server Action
          ──► identity + company ──► tenant: K01 TenantContext
          ──► módulo server-only del conector (cliente pg del rol)
          ──► PostgreSQL como praxa_integrations, sin JWT
          ──► worker_api.fn(p_actor_user_id, p_company_id, …)
                verifica pertenencia del actor y propiedad de la conexión
          ──► tablas de integraciones y private.integration_credentials
```

- Existen: el esquema `worker_api`, el rol, las tablas y funciones de `0012`, el cliente Node
  del rol, el llavero, el cifrado y el repositorio de credenciales. El cliente usa el pooler
  compartido en modo transacción con TLS verificado; el repositorio cifra antes de escribir
  y descifra después de leer. La base solo recibe material cifrado.
- Previstas: las rutas OAuth, el cliente de Meta y la orquestación del ciclo de vida.
- Toda escritura de integraciones pasa por este camino (DEC-04). `authenticated` solo lee
  por RLS las tablas de integraciones que lo permiten.
- El cifrado y descifrado de la credencial ocurren en Node; la base solo guarda y devuelve
  el texto cifrado.

Por qué un rol propio y no `service_role`: `service_role` omite RLS y tiene acceso a todo;
`praxa_integrations` solo puede ejecutar funciones concretas, cada una con su chequeo. La
motivación y las alternativas descartadas están en la spec, sección 7.

### C. Llamadas a Meta (previsto)

Desde el camino B, en el servidor: OAuth con Facebook Login for Business, listado de
cuentas delegadas, prueba de acceso, lectura de Insights y revocación. Versión de la Graph
API en una sola constante. Solo lectura.

## Contexto declarado

```
draft  (version IS NULL, editable)
  │  activate_context_draft()
  ▼
active (version > 0, inmutable)
  │  activate_context_draft() de un borrador posterior
  ▼
superseded (version > 0, inmutable)
```

Editar un contexto vigente lo **clona** a un borrador nuevo; solo el borrador es editable.
Un reporte guarda la versión con la que se generó. El borrador puede estar incompleto; la
integridad completa se valida en un solo lugar, `activate_context_draft()`. A lo sumo un
borrador y una versión activa por empresa, respaldado por índices únicos parciales.

## Concurrencia: reglas por subsistema

No hay una regla única de bloqueo para todo el sistema. La única invariante global es:
**una transacción que toma el cerrojo consultivo de empresa (`private.lock_company`) lo toma
antes que cualquier bloqueo de fila.** Así no hay ciclos entre las vías que usan ambos.

**Contexto y onboarding.**

- Toda escritura de objetivos, sistemas y activación pasa por funciones que toman el
  cerrojo de empresa antes de tocar filas y releen el estado. Un trigger no puede hacerlo:
  corre después de que la sentencia tomó el bloqueo de fila e invertiría el orden.
- Los `UPDATE` directos sobre campos del borrador no toman el cerrojo a propósito: operan
  sobre la misma fila que la activación y el bloqueo de fila ya los serializa.
- La activación exige la **revisión** que el usuario tenía a la vista (un resumen calculado
  de la fila y sus dos listas) y la compara dentro de la misma transacción, con el cerrojo
  tomado. Un conflicto se señala con `PT409`, no con la clase 40, que PostgREST reintenta
  en bucle. La revisión no autoriza (eso lo hace RLS) y no se exige en el reintento de una
  activación ya aplicada.

**Integraciones (`worker_api`).**

- Las funciones que escriben toman el cerrojo de empresa antes de tocar filas; las que
  modifican una conexión o credencial existente la bloquean después con `FOR UPDATE`.
- **Excepción deliberada:** el consumo del intento OAuth es una sola sentencia `UPDATE …
  RETURNING` que valida y marca a la vez, sin cerrojo de empresa. El bloqueo de la fila
  serializa dos consumos y el segundo no encuentra fila. Separarlo en dos consultas
  reabriría la ventana de reutilización.
- Previsto para la sincronización manual: una ejecución vigente por conexión, con
  arrendamiento vencible y token de posesión; solo la ejecución vigente publica (CA-58,
  CA-59). Es un mecanismo propio de ese dominio: no se reutiliza la revisión del contexto.

## Operaciones largas y ausencia de workers

La ruta no tiene workers, colas ni programación automática (spec, sección 2; D2). El nombre
`worker_api` es heredado. Consecuencias estructurales:

- La sincronización de Insights (prevista) es manual: una Server Action con límites de
  ventana, páginas y duración por debajo del máximo del hosting (CA-56, Q-04).
- La purga de conexiones pendientes o desconectadas (prevista) es perezosa y reanudable: se
  ejecuta cuando el dueño vuelve a la página de integraciones o inicia una conexión.
- Una ejecución colgada no bloquea para siempre porque su arrendamiento vence.

## Chat (previsto)

```
Server Action del chat ──► K01 ──► límites del turno ──► redacción de la pregunta
  ──► modelo: elige herramienta y argumentos (salida estricta)
  ──► servidor: ejecuta la herramienta con el JWT del usuario, bajo RLS; cálculos en SQL
  ──► modelo: redacta `text` + `claims`
  ──► guarda del servidor: valida cada cifra contra resultados del turno
  ──► respuesta con período, zona, cobertura y frescura, o abstención controlada
  ──► registro de la consulta por worker_api
```

Las herramientas leen por el camino A; el registro por consulta se escribe por el camino B.
Contrato completo en la spec, sección 12.

## Contrato del reporte (existe, sin generación)

Seis secciones siempre presentes: objetivos y contexto; situación actual con período y
cobertura; análisis y hallazgos con evidencia; mejoras priorizadas; plan por etapas;
medición y revisión. La evidencia está tipada por **procedencia**:

| Tipo | Qué es |
|---|---|
| `user_statement` | lo que el dueño declaró; no es un hecho verificado |
| `calculated_metric` | número calculado por código, con período, cobertura y método |
| `system_fact` | hecho leído de un sistema, sin transformar |
| `inference` | interpretación, que **debe** declarar de qué evidencia se deriva |

Se valida la integridad referencial del documento: cada hallazgo referencia evidencia
existente, cada mejora referencia hallazgos y objetivos válidos. `knownOr` obliga a
representar lo desconocido como valor explícito con motivo. Ninguna validación estructural
impide que un modelo invente; convierte una afirmación sin respaldo en un error detectable.

El chat reutiliza `periodSchema`, `knownOr` y la distinción de procedencia, pero no el tipo
numérico de `calculated_metric`: el gasto exige decimal exacto (CA-44b).

## Versiones independientes

| Versión | Cambia cuando… | Vive en |
|---|---|---|
| `CONTEXT_SCHEMA_VERSION` | cambia lo que le preguntamos al usuario | `src/modules/onboarding/schema.ts` |
| `REPORT_SCHEMA_VERSION` | cambia la forma del documento | `src/modules/reporting/contract/versions.ts` |
| `METHODOLOGY_VERSION` | cambian las etapas o los criterios | `src/modules/reporting/contract/versions.ts` |

## Limitación estructural: una cuenta, una empresa

`companies.owner_id` tiene un índice único: una cuenta administra una sola empresa. La
plataforma aloja muchas empresas aisladas, pero el dueño es el único administrador. Por eso
no existe ninguna vía de escritura sobre `company_members`.

Reversión cuando haga falta: quitar `companies_owner_unique`, agregar políticas de escritura
sobre `company_members` con reglas de rol, y cambiar la resolución de empresa por una
selección explícita del espacio activo. Es un cambio de frontera de seguridad: exige
actualizar `SECURITY.md`.
