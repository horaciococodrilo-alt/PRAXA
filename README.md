# PRAXA

Diagnóstico y plan de optimización para ecommerce, basado en evidencia.

PRAXA parte de los objetivos que declara el dueño, consulta sus sistemas por API, calcula
las métricas con código y devuelve un diagnóstico y un plan priorizado donde cada hallazgo
queda atado a la evidencia que lo sostiene. Analiza y recomienda: **no ejecuta cambios**
sobre los sistemas conectados.

## Estado

Esta entrega cubre las **fases 1 y 2**: base técnica, autenticación, aislamiento por
empresa, landing, registro con verificación de correo y onboarding guardable y retomable.

**No implementado todavía:** ningún conector de integración y ninguna generación de
reportes con IA. No hay ninguna llamada a un LLM en el código.

Ver [`docs/ROADMAP.md`](docs/ROADMAP.md) para el estado real de cada entrega.

## Requisitos

- Node.js 24 o superior (probado con 24.18.1) y npm 11.
- Una cuenta de Supabase (el plan gratuito alcanza).
- **No hace falta Docker.** Ni la aplicación, ni las migraciones, ni las pruebas de RLS
  usan contenedores.
- No hace falta instalar la CLI de Supabase: se usa vía `npx supabase`.

---

## Puesta en marcha

### 1. Crear el proyecto de Supabase

En <https://supabase.com/dashboard>, creá un proyecto. Elegí una contraseña de base de
datos y **guardala**: la vas a necesitar para migrar.

Recomendado: **dos** proyectos, uno de desarrollo y otro desechable para las pruebas
automatizadas, que crean y borran usuarios y empresas.

### 2. Configurar las URLs de autenticación

**Authentication → URL Configuration**:

| Campo | Valor |
|---|---|
| Site URL | `http://localhost:3000` |
| Redirect URLs | `http://localhost:3000/**` |

Por qué ese comodín: el código redirige a `/auth/callback` **con query string**
(`?next=/onboarding` al confirmar la cuenta, `?next=/reset-password` al recuperar el
acceso). Según la documentación de Supabase, `*` no cruza separadores y `**` sí, así que
`http://localhost:3000/**` es lo que cubre la ruta con sus parámetros. Alternativa más
ajustada si preferís: `http://localhost:3000/auth/callback**`.

En producción agregá el equivalente con tu dominio real; ahí conviene la forma ajustada.

En **Authentication → Sign In / Providers → Email**, dejá **Confirm email** activado: la
verificación de correo es parte del alcance de esta entrega.

### 3. Preparar `.env.local`

```bash
npm run env:prepare
```

Si `.env.local` no existe, lo crea. Si ya existe, **conserva todos tus valores** y agrega
al final solo las claves que falten. Nunca imprime un secreto: informa nombres de
variables y cuáles quedan vacías.

### 4. Completar las credenciales

Ocho variables en total, y **solo tres para abrir la aplicación**.

**Para abrir la aplicación** (`npm run dev`):

| Variable | Dónde |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → Data API → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → **publishable** (o `anon` si tu proyecto usa las heredadas) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` — ya viene puesto |

**Para migrar y para las pruebas de RLS** — una sola variable cubre las dos cosas:

| Variable | Dónde |
|---|---|
| `SUPABASE_DB_URL` | Connect → **Session pooler** → copiá la URI y reemplazá `[YOUR-PASSWORD]` |

Session pooler porque funciona sobre IPv4; la conexión directa es solo IPv6. Si la
contraseña tiene caracteres especiales (`@ : / ? #`), codificalos en porcentaje.

**No hace falta un token de acceso personal ni `supabase link`.** Las migraciones usan
`supabase db push --db-url`, que registra el historial igual. Un token personal de
Supabase es una credencial de alcance amplio sobre tu cuenta, y para esta tarea no
aporta nada: no vale la pena crearlo.

**Para las pruebas de aplicación** (`npm run test:app`) — del proyecto **desechable**:

| Variable | Dónde |
|---|---|
| `SUPABASE_TEST_URL` | Project URL del proyecto de pruebas |
| `SUPABASE_TEST_PUBLISHABLE_KEY` | su clave publishable |
| `SUPABASE_TEST_SECRET_KEY` | su clave **secret** (`sb_secret_…`, o la `service_role` heredada) |
| `SUPABASE_TEST_DB_URL` | su cadena de conexión (Connect → Session pooler), para migrarlo |
| `SUPABASE_TEST_IS_DISPOSABLE` | exactamente `yes-this-project-is-disposable` |

El proyecto de pruebas necesita las mismas migraciones que el de la aplicación:

```bash
npm run db:push:test
```

Las claves funcionan tanto en formato actual (`sb_publishable_…` / `sb_secret_…`) como
heredado (JWT `eyJ…`). Verificado contra el SDK instalado en
`tests/unit/supabase-key-formats.test.ts`.

### 5. Aplicar las migraciones

**Un único procedimiento**, porque es el que conserva el historial:

```bash
npm run db:preview
```

```bash
npm run db:push
```

`db:preview` muestra qué se aplicaría sin tocar nada y **sin contenedores** (a diferencia
de `supabase db diff`, que sí los usa). Ambos verifican antes que la base a migrar sea la
del mismo proyecto al que apunta `NEXT_PUBLIC_SUPABASE_URL`; si no coinciden, abortan.

Por dentro usan `supabase db push --db-url`, que aplica las migraciones pendientes y las
registra en `supabase_migrations.schema_migrations`.

> **No apliques el SQL a mano desde el SQL Editor.** Funciona, pero deja vacío ese
> historial y el siguiente `db:push` intentará reaplicar todo. Si ya lo hiciste,
> reconciliá con `npx supabase migration repair --status applied <version>`.

### 6. Ejecutar la aplicación

```bash
npm install
```

```bash
npm run dev
```

<http://localhost:3000>

---

## Cómo se cargan las variables en cada comando

No todas las herramientas leen `.env.local`, y suponer lo contrario es una fuente típica
de confusión:

| Comando | Cómo obtiene las variables |
|---|---|
| `npm run dev`, `npm run build` | **Next.js** lee `.env.local` por su cuenta. |
| `npm run db:push`, `db:preview`, `db:check` | Un script de Node lee `.env.local` y se lo pasa a la CLI como entorno del proceso hijo. |
| `npm run test:policies` | El ejecutor de Node lee `.env.local`. |
| `npm run test:app` | Vitest lo carga en `tests/app/setup.ts` (dotenv). |
| `npx supabase ...` **a mano** | **No lee `.env.local`.** Tenés que exportar las variables vos. |

Para invocar la CLI directamente:

```bash
export SUPABASE_DB_URL=...
```

En todos los casos, una variable ya presente en el entorno gana sobre la del archivo: en
CI mandan las del runner.

---

## Pruebas

Se reportan por separado según lo que realmente pasó.

### Sin credenciales ni red

```bash
npm run verify
```

Encadena lint, typecheck, pruebas (unitarias y de componente) y build. **Esto no es evidencia de que
funcionen la autenticación, RLS ni el recorrido completo**: cubre el contrato del reporte,
los esquemas del onboarding, los formatos de clave, la guarda de credenciales y el
comportamiento del asistente en jsdom (qué se guarda, qué queda pendiente, cuándo se
puede confirmar).

### Contra el proyecto remoto

```bash
npm run test:policies
```

Ejecuta los archivos pgTAP de `supabase/tests/` **directamente contra PostgreSQL remoto,
sin contenedores**, con un ejecutor propio (`scripts/run-pgtap.mjs`) que conserva el
`begin; … rollback;` de cada archivo, interpreta la salida TAP y falla ante aserciones
fallidas, plan incompleto o errores SQL.

> `supabase test db` no sirve acá: corre `pg_prove` dentro de un contenedor, y `--linked`
> solo cambia la base de destino sin quitar esa dependencia.

```bash
npm run test:app
```

Requiere que el proyecto de pruebas ya esté migrado (`npm run db:push:test`).

Aislamiento entre empresas, idempotencia del alta y ciclo del onboarding, vía Supabase JS.
**Todas las aserciones corren con sesiones de usuarios normales**, sujetas a RLS. La clave
secreta se usa solo para crear los usuarios de prueba y borrar lo creado; el cliente
administrativo ni siquiera se exporta desde `tests/app/helpers.ts`.

Salvaguardas:

1. **Nombres propios** (`SUPABASE_TEST_*`): apuntar la suite al proyecto de la aplicación
   exige pegar esas credenciales adrede.
2. **Confirmación explícita**: sin `SUPABASE_TEST_IS_DISPOSABLE` con el valor exacto, no
   corre nada.
3. **Identificadores únicos por ejecución**: cada corrida etiqueta lo que crea.
4. **Limpieza acotada**: al terminar borra exactamente lo suyo — primero las empresas,
   después los usuarios.

`tests/app/concurrency.test.ts` abre **dos conexiones directas** a PostgreSQL y las
coordina con barreras para reproducir la intercalación entre editar y confirmar. Necesita
`SUPABASE_TEST_DB_URL` además de las credenciales REST.

Las pruebas de correo son opt-in porque consumen la cuota de envío del proyecto:

```bash
SUPABASE_TEST_EMAIL_FLOWS=true npm run test:app
```

### Verificar el destino antes de tocar nada

```bash
npm run db:check
```

```bash
npm run db:check:test
```

Imprimen solo referencias de proyecto (públicas), nunca claves.

---

## Verificar el recorrido a mano

Abrir el enlace del correo es lo único que la suite no puede cubrir:

1. **Registro** — `/signup` con un correo real tuyo.
2. **Verificación** — abrí el enlace: va a `/auth/callback` y de ahí al onboarding. Sin
   confirmar, `/login` tiene que rechazarte.
3. **Onboarding** — completá los pasos y probá **cerrar la pestaña a mitad de camino y
   volver**: el borrador tiene que estar donde lo dejaste.
4. **Guardar fuera de orden** — editá un objetivo sin guardarlo, saltá a Sistemas, guardá
   ese paso y andá a Revisión: tiene que seguir avisando que Objetivos está pendiente y el
   botón de confirmar tiene que estar bloqueado.
5. **Dos pestañas** — abrí el mismo borrador en dos pestañas, guardá algo en una (alcanza
   con marcar un sistema) y confirmá desde la otra: tiene que rechazarlo diciendo que el
   borrador cambió, sin activar nada.
6. **Objetivo sin definir** — marcá "todavía no tengo un objetivo definido" y confirmá.
7. **Aplicación** — `/app`: Inicio, Objetivos y contexto, Integraciones, Reportes. Las dos
   últimas deben decir que no están implementadas.
8. **Edición** — `/app/contexto` → "Editar contexto" clona la versión vigente; la vigente
   no cambia hasta confirmar.
9. **Logout y recuperación** — cerrá sesión y probá `/forgot-password`.

### Borrar los datos de prueba

Los automatizados se limpian solos. Los manuales: **Authentication → Users**. Si un
usuario no se deja borrar es porque su empresa existe todavía: borrala primero en
**Table Editor → companies** (la cascada se lleva contexto, objetivos, sistemas y
reportes).

---

## Estructura

```
src/app/          rutas (landing, auth, onboarding, aplicación protegida)
src/modules/      identity · company · onboarding · reporting/contract
src/lib/          configuración y clientes de Supabase
proxy.ts          refresco de sesión y redirección (no es la autorización final)
scripts/          preparación de entorno, verificación de destino, migración, pgTAP
supabase/         migraciones SQL versionadas y pruebas pgTAP
tests/            pruebas unitarias y de aplicación
docs/             arquitectura, seguridad y roadmap
```

## Documentación

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — módulos, decisiones y contrato del reporte.
- [`docs/SECURITY.md`](docs/SECURITY.md) — autorización, matriz de privilegios y reglas futuras.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — qué está implementado, verificado y pendiente.

## Nota sobre el historial

El commit `edfd504` borró el contenido anterior del repositorio, de otro producto. Este
proyecto se inicializó sobre ese árbol vacío; lo anterior sigue en el historial
(`git show 4cd3d4f --stat`). Los directorios `backend/` y `frontend/` que queden en disco
son cachés y se pueden borrar.
