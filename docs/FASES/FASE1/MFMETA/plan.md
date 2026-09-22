# Plan de ejecución — Ruta `meta_first`

Plan operativo de la [spec](spec.md). Un corte por sesión. Al terminar cada corte se corre la verificación, se registra evidencia y se para: no se encadena el siguiente sin pedido explícito.

## Precondiciones de toda la ruta

1. `M03a` aprobada en [acta-meta.md](../M03a/acta-meta.md).
2. Decisión **D1** aprobada. Sin eso no se empieza `M06.1a`.
3. `git status` limpio o con cambios ajenos preservados.
4. Para los cortes con base de datos: `npm run db:check:test` apuntando al proyecto desechable. Nunca producción.

## Intervenciones del usuario, y cuándo

| Cuándo | Qué tenés que hacer |
|---|---|
| Antes de `M16.1` | Crear la app en Meta, registrar el redirect URI, y cargar `META_APP_ID`, `META_APP_SECRET` y `META_REDIRECT_URI` en `.env.local` vos mismo |
| Antes de `M06.3a` | Generar `PRAXA_CREDENTIAL_KEY` con `openssl rand -base64 32` y cargarla en `.env.local` |
| Durante `M16.1` | Completar la autorización en Meta desde el navegador |
| Durante `M16.2` | Elegir la cuenta y confirmar moneda y zona |
| Antes de `M25a` | Crear el proyecto de API del modelo y guardar la clave en `.env.local` |
| En paralelo, desde ya | Monotributo, verificación del Business Manager y del dominio, App Review. Corte `M16d` |

Ninguna de esas claves se pega en el chat. Se cargan en `.env.local`, que está ignorado por git.

---

## Corte 1 — `M05.1.2`, `M05.1.3`, `M05.1.4`: contratos

Sin base de datos, sin red. Todo TypeScript y Zod, al estilo de `src/modules/reporting/contract/`.

| Paso | Acción | Archivos | Verificación |
|---:|---|---|---|
| 1 | Tests primero: fixtures inválidos de los tres contratos | `tests/unit/integration-contracts.test.ts` | Fallan en rojo por la razón esperada, no por errores de importación |
| 2 | Primitivas compartidas: proveedor, estados, allowlist de redirect, error redactado | `src/modules/integrations/contract/primitives.ts` | — |
| 3 | K02 `OAuthAttempt` | `src/modules/integrations/contract/oauth-attempt.ts` | CA-01 a CA-05 |
| 4 | K03 `IntegrationConnection` | `src/modules/integrations/contract/connection.ts` | CA-06 a CA-09 |
| 5 | K04 `SecretCredential` | `src/modules/integrations/contract/credential.ts` | CA-10 a CA-13 |
| 6 | Barrel de exportación | `src/modules/integrations/contract/index.ts` | — |

Cierre: `npm run verify`.

**Trampa conocida.** CA-06 exige probar que ningún campo de K03 acepte un token. La prueba tiene que inyectar algo con forma de token en cada campo de texto y verificar el rechazo. Un fixture que simplemente no incluya tokens no prueba nada.

---

## Corte 2 — `M06.1a` y `M06.2a`: migración y aislamiento

**Requiere D1 aprobada.**

| Paso | Acción | Archivos | Verificación |
|---:|---|---|---|
| 1 | Migración `0012`: tablas, enums, índices, unicidad | `supabase/migrations/0012_integration_connections.sql` | CA-14, CA-15, CA-18 |
| 2 | Encabezado con la matriz de privilegios, al estilo de `0004` | misma migración | CA-17 |
| 3 | `revoke all` y grants explícitos | misma migración | CA-16, CA-17 |
| 4 | Políticas RLS con `private.is_company_member()` | misma migración | CA-20 |
| 5 | Funciones `SECURITY DEFINER` de escritura y lectura de credencial | misma migración | CA-21 |
| 6 | pgTAP de aislamiento con dos empresas reales | `supabase/tests/08_integration_isolation.test.sql` | CA-19, CA-21 |
| 7 | pgTAP de privilegios de las tablas nuevas | `supabase/tests/09_integration_privileges.test.sql` | CA-16, CA-17 |

Cierre: `npm run db:check:test`, `npm run db:push:test`, `npm run test:policies`, `npm run verify`.

**Trampa conocida.** `force row level security` no es opcional: sin él, el dueño de la tabla esquiva las políticas. Las siete migraciones existentes ya lo hacen; seguir el mismo patrón.

---

## Corte 3 — `M06.3a`: cifrado

| Paso | Acción | Archivos | Verificación |
|---:|---|---|---|
| 1 | Tests primero: ciclo completo, clave incorrecta, texto alterado, rotación | `tests/unit/credential-crypto.test.ts` | Rojo esperado |
| 2 | Lectura y validación de la clave de entorno | `src/modules/integrations/crypto/key.ts` | CA-25 |
| 3 | AES-256-GCM con `node:crypto`, IV aleatorio por operación | `src/modules/integrations/crypto/seal.ts` | CA-23, CA-24 |
| 4 | Repositorio de credenciales sobre las RPC del corte 2 | `src/modules/integrations/repository/credentials.ts` | CA-21 |
| 5 | Verificar que la prueba de credenciales privilegiadas siga pasando sin tocarla | — | CA-27 |

Cierre: `npm run verify`.

**Trampa conocida.** El IV no se deriva de nada ni se reutiliza entre operaciones: se genera aleatorio cada vez y se guarda junto al texto cifrado. Reutilizarlo en GCM rompe el cifrado por completo, no lo debilita un poco.

---

## Corte 4 — `M16.1`: OAuth

**Requiere las tres variables de Meta cargadas.**

| Paso | Acción | Archivos | Verificación |
|---:|---|---|---|
| 1 | Constante de versión de la Graph API y armado de URLs | `src/modules/integrations/meta/api.ts` | Versión en un solo lugar |
| 2 | Cliente HTTP con timeout, errores tipados y redacción de secretos | `src/modules/integrations/meta/client.ts` | CA-30 |
| 3 | Ruta de inicio: crea intento, hashea state, redirige | `src/app/api/integraciones/meta/iniciar/route.ts` | CA-28 |
| 4 | Ruta de callback: valida state, consume intento, canjea código | `src/app/api/integraciones/meta/callback/route.ts` | CA-29, CA-33, CA-34 |
| 5 | Canje por token de larga duración | `src/modules/integrations/meta/tokens.ts` | CA-31 |
| 6 | Inspección de permisos con `debug_token` | mismo archivo | CA-32 |
| 7 | UI: la página de integraciones deja de decir que no hay conectores | `src/app/(app)/app/integraciones/page.tsx` | — |
| 8 | Tests de las rutas con la API de Meta simulada | `tests/unit/meta-oauth.test.ts` | CA-28 a CA-34 |

Cierre: `npm run verify` y una autorización real completada por vos.

**Trampa conocida.** El `state` se compara por hash en tiempo constante y se consume atómicamente. Leer, validar y después marcar consumido en dos consultas separadas deja una ventana para reutilizarlo.

**Segunda trampa.** El callback es un Route Handler, no una Server Action: el proxy puede no cubrirlo. Verificar identidad y empresa dentro del handler, como hace el resto del código.

---

## Corte 5 — `M16.2`: cuenta y ciclo de vida

| Paso | Acción | Archivos | Verificación |
|---:|---|---|---|
| 1 | Listado de cuentas con moneda y zona | `src/modules/integrations/meta/accounts.ts` | CA-35 |
| 2 | Server Action de selección explícita | `src/modules/integrations/actions.ts` | CA-36 |
| 3 | Probe antes de activar | `src/modules/integrations/meta/probe.ts` | CA-37 |
| 4 | Desconexión con destrucción inmediata de la credencial | `src/modules/integrations/actions.ts` | CA-38 |
| 5 | Manejo de `403` y revocación hacia `needs_reauth` | `src/modules/integrations/meta/errors.ts` | CA-39 |
| 6 | UI de selección, estado y desconexión | `src/app/(app)/app/integraciones/` | CA-40 |
| 7 | Tests de ciclo de vida y de transiciones inválidas | `tests/unit/meta-lifecycle.test.ts` | CA-35 a CA-39 |

Cierre: `npm run verify` y una cuenta realmente conectada.

---

## Corte 6 — `M16c`: insights

| Paso | Acción | Archivos | Verificación |
|---:|---|---|---|
| 1 | Migración `0013`: crudo, observaciones diarias y cobertura | `supabase/migrations/0013_meta_observations.sql` | CA-42, CA-43 |
| 2 | pgTAP de aislamiento de las tablas nuevas | `supabase/tests/10_meta_observations.test.sql` | CA-19 extendido |
| 3 | Lectura de insights por ventana | `src/modules/integrations/meta/insights.ts` | CA-41 |
| 4 | Persistencia idempotente del crudo y derivación de observaciones | `src/modules/integrations/repository/observations.ts` | CA-45, CA-47 |
| 5 | Cálculo y consulta de cobertura | mismo archivo | CA-46 |
| 6 | Server Action de sincronización manual + UI | `src/modules/integrations/actions.ts` | D2 declarada en pantalla |
| 7 | Tests: día faltante, reintento, ventana con DST, moneda | `tests/unit/meta-insights.test.ts` | CA-41 a CA-47 |

Cierre: `npm run test:policies` y `npm run verify`.

**Trampa conocida.** Un día sin filas en la respuesta de Meta no es un día con gasto cero. La diferencia es la que hace que el chat pueda abstenerse en vez de afirmar algo falso, y es la razón de existir de CA-43.

---

## Corte 7 — `M25a`: chat

| Paso | Acción | Archivos | Verificación |
|---:|---|---|---|
| 1 | Catálogo cerrado de herramientas con Zod | `src/modules/chat/tools/schema.ts` | CA-48, CA-49 |
| 2 | Ejecución bajo sesión y RLS | `src/modules/chat/tools/execute.ts` | CA-49, CA-54 |
| 3 | Cliente del modelo con modelo y versión fijos | `src/modules/chat/llm.ts` | CA-53 |
| 4 | Orquestador: el modelo elige herramienta, no produce cifras | `src/modules/chat/orchestrator.ts` | CA-50 |
| 5 | Guarda numérica: toda cifra de la respuesta se verifica contra lo devuelto | `src/modules/chat/guard.ts` | CA-50, CA-51 |
| 6 | UI con cuenta y período declarados | `src/app/(app)/app/chat/page.tsx` | CA-52 |
| 7 | Suite adversaria: inyección, SQL, cruce de empresas, modelo caído | `tests/unit/chat-adversarial.test.ts` | CA-50, CA-53, CA-54 |

Cierre: `npm run verify` y transcripciones reproducibles como evidencia.

**Trampa conocida.** La guarda numérica es el corazón del corte y lo único que hace que esto no sea el RAG que el proyecto prohíbe. Si una cifra aparece en la respuesta y no coincide con una devuelta por una herramienta, la respuesta se rechaza. No se corrige, no se aproxima: se rechaza.

---

## Orden recomendado y qué se puede mostrar

| Al terminar | Lo que se ve funcionando |
|---|---|
| Corte 3 | Nada visible. Es cimiento |
| Corte 4 | El botón "Conectar Meta" lleva a Meta y vuelve con la conexión creada |
| Corte 5 | La cuenta elegida aparece conectada, con su moneda y su zona, y se puede desconectar |
| Corte 6 | Gasto e impresiones por día, reales, con los huecos marcados como huecos |
| Corte 7 | El chat |

Los cortes 4 y 5 son los que demuestran el conector. Si hay que elegir qué llega primero a una demostración, son esos dos.

## Recordatorio de las condiciones de parada

Frenar y reportar, sin improvisar, ante: contradicción entre spec, plan y código; necesidad de tocar un archivo fuera de la tabla del corte; necesidad de una intervención tuya; dependencia no cerrada; o dos iteraciones de corrección sin converger.
