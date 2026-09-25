# Spec — Ruta `meta_first`: conector de Meta Ads y chat sobre sus datos

## Estado

`v1.0 — FINAL PARA EJECUCIÓN` — 2026-09-24. Incorpora:

- las decisiones DEC-01 a DEC-21;
- las correcciones T01 a T16 de la revisión externa;
- las correcciones técnicas de la revisión del repositorio.

No quedan decisiones abiertas. Q-04 es un parámetro que se fija con mediciones en `M16c`. La Enmienda 1 del ROADMAP se aprueba formalmente en `G-DOCS`, al cerrar `M04a`, que es la primera microfase ejecutable.

El roadmap de la ruta (Enmienda 1) y el plan de ejecución están en [plan.md](plan.md), versión 1.0.

Bloqueos de entrada, verificados contra `main` en `247cae8`. Los tres se resuelven dentro de la ruta: el primero en `M04a`, el segundo con `M05.1.1` y el tercero con `M03a`, antes del primer dato real. Ninguno impide empezar `M04a`.

- La Enmienda 1 no existe en `docs/ROADMAP.md` (v2.3), ni los IDs `M03a`, `M06.1a`, `M06.2a`, `M06.3a`, `M16c`, `M16d` y `M25a`. Según `AGENTS.md`, el ROADMAP prevalece sobre esta spec: hasta que la enmienda esté comiteada, cualquier agente que lo respete debe frenar.
- El ROADMAP vigente hace depender `M05.1.2` de `M05.1.1` (K01 `TenantContext`), que no empezó. **Corrección técnica:** K01 entra en esta ruta como primer contrato (sección 8). Define exactamente el actor y la empresa que la sección 7 pasa a `worker_api`, así que omitirlo obligaría a reinventarlo sin nombre.
- `M03a` (acta de datos reales y retención) no está en el repositorio y es condición para que datos reales entren en la base.

## 1. Alcance del piloto

Un usuario (el dueño), una empresa y una cuenta publicitaria conectada. El dueño conecta Meta, sincroniza manualmente y consulta sus datos mediante el chat.

**Criterio de salida (DEC-01).** El dueño real de la cuenta piloto, con rol de tester en la app de Meta, completa con su propio login el recorrido registro en PRAXA → conexión → sincronización → pregunta al chat, y queda evidencia redactada. Un acceso delegado a otra persona no cuenta.

## 2. Qué NO se construye

- Escrituras sobre Meta. El permiso objetivo es `ads_read`; que la app tenga otros permisos agregados no implica solicitarlos.
- Onboarding público. Los dueños sin rol en la app requieren App Review y Business Verification (`M16d`), fuera de esta ruta.
- Más de una cuenta conectada por empresa. Más de un proveedor.
- Workers, colas, reintentos en segundo plano, programación automática. El esquema `worker_api` es un nombre heredado del ROADMAP y no implica construir un worker.
- Tiendanube, GA4, reportes publicados (`reliability`, `catalog`).
- Métricas derivadas, ratios, benchmarks, recomendaciones de presupuesto, explicación causal del rendimiento y evaluación de rentabilidad.
- Base vectorial o RAG.

## 3. Registro de decisiones

| ID | Decisión | Estado |
|---|---|---|
| DEC-01 | Criterio de salida: el dueño como tester, con su propio login | Cerrada |
| DEC-02 | Token de *business integration system user* vía Facebook Login for Business (`config_id`, código de autorización canjeado en servidor) | Cerrada, condicionada a P-01…P-05. Si un prerrequisito falla, se presenta la alternativa de User Access Token con sus consecuencias **antes** de cambiarla |
| DEC-03 | Credenciales en `private`, accesibles solo mediante funciones de un esquema no expuesto `worker_api`, ejecutadas por un rol Postgres propio (opción C) | Cerrada |
| DEC-04 | Toda escritura de integraciones pasa por `worker_api`; `authenticated` solo lee, por RLS (opción ii) | Cerrada |
| DEC-05 | Snapshots inmutables; dato vigente = último snapshot completo; presencia y estado temporal como ejes separados; relectura inicial de 28 días, configurable | Cerrada |
| DEC-06 | Chat con herramientas cerradas y salida estructurada; cálculos determinísticos; sin base vectorial | Cerrada |
| DEC-07 | Entorno del piloto: Vercel, proyecto `app` de Supabase y dominio fijo. El proyecto de pruebas queda solo para datos sintéticos (sección 5b) | Cerrada |
| DEC-08 | Costos del piloto. Supabase: Free hasta que pase VR-01; Pro desde que el dueño usa el piloto sin acompañamiento. Vercel: Hobby, por decisión del usuario, con el riesgo de términos declarado en la sección 5b | Cerrada |
| DEC-09 | Retención: al desconectar se borran la credencial, los snapshots, las observaciones y las ejecuciones de esa conexión (CA-38, CA-38b) | Cerrada; `M03a` la ratifica |
| DEC-10 | Chat sin historial persistente. Por consulta se registra: la pregunta, los nombres de las herramientas llamadas, el resultado con motivo estructurado si no respondió, la fecha y la latencia (CA-62 a CA-65) | Cerrada |
| DEC-11 | La pregunta se guarda redactada con patrones inequívocos, y la misma redacción se aplica antes de enviarla al modelo (CA-66) | Cerrada |
| DEC-12 | Los registros por consulta no tienen plazo propio: se borran por DEC-09. Al finalizar el piloto, el dueño y toda su información se eliminan con el procedimiento de CA-67 (DEC-20) | Cerrada |
| DEC-13 | Cada respuesta del chat ofrece dos botones, "útil" y "no útil". El valor se guarda en el registro de esa consulta, sin texto libre (CA-69) | Cerrada |
| DEC-14 | Modelo del chat: DeepSeek V4.1 Flash (CA-53b) | Cerrada |
| DEC-15 | Acceso al modelo: pesos abiertos de V4.1 Flash en un host que no entrena con los datos y no los guarda en disco. Se acepta, y se declara, la excepción documentada de registros para depuración y seguridad. Se acepta un identificador de modelo fijo sin despliegue inmutable (P01). No se usa la API propia de DeepSeek. Se revisa antes de escalar | Cerrada |
| DEC-16 | Host: DeepInfra, modelo `deepseek-ai/DeepSeek-V4.1-Flash`. Fireworks queda como alternativa si VR-02 falla, usando chat completions y nunca la Responses API | Cerrada |
| DEC-17 | Una conexión en `pending_selection` vence a los 30 minutos. La purga sigue la secuencia de CA-38: bloqueo, intento de revocación en Meta y destrucción de la credencial (CA-37b) | Cerrada |
| DEC-18 | Registro del dueño con SMTP propio, sobre el dominio del piloto verificado con SPF y DKIM. El registro público queda abierto solo mientras el dueño se registra y después se cierra desde el dashboard. No requiere cambios de código | Cerrada |
| DEC-19 | Las respuestas del chat pueden incluir cifras en lenguaje natural. Cada afirmación numérica se vincula a un resultado de herramienta del turno actual y el servidor la verifica antes de mostrarla (CA-50). Reemplaza la prohibición de dígitos | Cerrada |
| DEC-20 | `M28.3a` se cierra al completar la demostración. CA-67 se ejecuta al finalizar el piloto, no al terminar la demo | Cerrada |
| DEC-21 | Los umbrales propuestos para VR-02 se adoptan como criterios iniciales de aprobación | Cerrada |

## 4. Prerrequisitos de Meta — pendientes de verificar

Estado de la app según la revisión del usuario del 2026-09-23 (no verificable desde el repositorio):

- Facebook Login for Business agregado.
- Caso de uso de rendimiento de anuncios agregado.
- `ads_read` "listo para la prueba".
- **Ninguna configuración de Login for Business.**
- **Lista de URI de redirección vacía.**
- **Solo el administrador en roles.**

Ninguno de los prerrequisitos siguientes está cumplido todavía:

| ID | Prerrequisito | Cómo se verifica |
|---|---|---|
| P-01 | Configuración de Login for Business de tipo system user, con `ads_read` y cuentas publicitarias como activo | Existe y produce un `config_id` |
| P-02 | URI de redirección registrada, idéntica a `META_REDIRECT_URI` sobre el dominio fijo del piloto (DEC-07) | Registrada en la configuración de Meta |
| P-03 | App asociada a un business portfolio propio, con control total y separado del portfolio del cliente | Captura redactada de la configuración |
| P-04 | Dueño con business portfolio propio, control total sobre él y rol de tester aceptado en la app | Invitación aceptada y control total confirmado por el dueño |
| P-05 | Validación del recorrido completo (VR-01, sección 6) | Evidencia redactada |
| P-06 | El dueño puede recibir los emails de Supabase Auth: confirmación de registro y recuperación de contraseña. Sin SMTP propio, Supabase solo envía a direcciones del equipo de la organización y limita a 2 mensajes por hora | Se resuelve con DEC-18 al configurar el SMTP propio |

Las llamadas a la API hechas en M00 no prueban este recorrido: usaron otro flujo y otro tipo de token.

## 5. Configuración

Graph API **v26.0** (publicada el 2026-07-29), declarada en una sola constante. Al implementar, verificar que siga vigente.

Variables del servidor. Ninguna es `NEXT_PUBLIC_`. En `.env.example` van sin valores, como exige la prueba existente.

| Variable | Contenido |
|---|---|
| `META_APP_ID` | Identificador de la app |
| `META_APP_SECRET` | Secreto de la app |
| `META_REDIRECT_URI` | Callback; coincide exactamente con el registrado |
| `META_CONFIG_ID` | Configuración de Login for Business |
| `PRAXA_CREDENTIAL_KEYS` | Llavero de claves AES-256: pares `versión:clave_base64` |
| `PRAXA_CREDENTIAL_KEY_CURRENT` | Versión con la que se cifra |
| `PRAXA_INTEGRATIONS_DB_URL` | Conexión del rol de C por el pooler (usuario `rol.project-ref`) |
| `DEEPINFRA_API_KEY` | Clave de la API de DeepInfra (DEC-16) |
| `PRAXA_INTEGRATIONS_TEST_DB_URL` | Conexión del rol de C al proyecto de pruebas. Solo en `.env.local`, nunca en Vercel |

- **Variables existentes que el despliegue también necesita:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `NEXT_PUBLIC_SITE_URL`. Esta última lleva el dominio del piloto, porque `getSiteUrl()` la usa para armar los enlaces de los emails de Auth. `SUPABASE_DB_URL` y las variables `SUPABASE_TEST_*` no van a Vercel: las usan los scripts y las pruebas.
- **Aislamiento de la conexión del rol de C en las pruebas.** Las pruebas usan solo `PRAXA_INTEGRATIONS_TEST_DB_URL`. `scripts/check-target.mjs` se extiende para verificar que apunte al mismo proyecto que `SUPABASE_TEST_DB_URL` y que `SUPABASE_TEST_IS_DISPOSABLE` esté activo. Si la variable falta o apunta a otro proyecto, las pruebas fallan. Nunca recurren a `PRAXA_INTEGRATIONS_DB_URL`.

## 5b. Entorno del piloto (DEC-07)

- **Hosting.** Vercel, con dominio fijo. Las guías de uso justo de Vercel limitan el plan Hobby a uso personal no comercial, y definen como comercial cualquier despliegue que genere beneficio económico para alguien involucrado en el proyecto. Decisión del usuario (DEC-08): Hobby, porque el piloto no cobra ni genera ingresos. **Riesgo declarado:** la definición de Vercel alcanza a cualquier involucrado en el proyecto. Además, en su foro, Vercel calificó como comercial un sitio sin beneficio monetario directo que promocionaba servicios. No encontré evidencia sobre cómo aplica esa regla en la práctica. La alternativa que cumple los términos sin costo inicial es la prueba de 14 días de Pro durante VR-01.
- **Base.** Proyecto `app` de Supabase. El proyecto de pruebas, marcado como desechable, recibe solo datos sintéticos (CB-04). Estado verificado el 2026-09-23: la organización de Supabase está en plan Free. Supabase pausa los proyectos Free con baja actividad durante 7 días; los proyectos pagos no se pausan. Por DEC-08, el proyecto pasa a Pro recién cuando el dueño empieza a usar el piloto sin acompañamiento: desde ese momento, una pausa rompería justo la experiencia que se valida. Mientras tanto, si el proyecto se pausa, se restaura a mano.
- **Datos reales.** Entran al proyecto `app` recién cuando exista `M03a`.
- **Configuración que depende del dominio.** Hay que dar de alta el dominio en tres lugares:
  - la URI de redirección en Meta (P-02);
  - `site_url` y las URLs de redirección de Supabase Auth en el proyecto remoto (en `supabase/config.toml` figuran solo las locales);
  - las variables de entorno del proyecto de Vercel.
- **Grants explícitos para la Data API.** Supabase deja de exponer por defecto las tablas nuevas de `public` a la Data API, con aplicación a todos los proyectos desde el 2026-10-30. La matriz de la sección 7 ya concede todo de forma explícita. Aun así, `test:app` debe verificar que `authenticated` realmente puede leer las tablas nuevas por la Data API, porque un grant faltante produce un error de permisos (`42501`) en lugar de datos. Lo que sí es silencioso es una política RLS que no deja pasar filas, y eso lo cubre pgTAP.
- **Tiempo máximo de ejecución.** En Vercel con fluid compute, 300 s por defecto; hasta 800 s en Pro. Los límites de CA-56 se fijan por debajo del valor configurado.

## 6. OAuth (M16.1)

- **CA-28** El inicio crea un intento K02 con su propósito (CA-02c) y redirige al diálogo de Meta con `config_id` y `response_type=code`. No envía `scope`. Una conexión inicial solo se puede iniciar si la empresa no tiene una conexión viva. Si la tiene, el único propósito admitido es reautorizar esa conexión.
- **CA-29** El callback rechaza el intento si el `state` falta, es desconocido, venció, ya fue consumido o pertenece a otro actor o a otra empresa. También lo rechaza si el hash del nonce de la cookie no coincide con el del intento. Todo eso se valida en la misma sentencia atómica que consume el intento (CA-03); no alcanza con comprobar que la cookie exista. El error que se muestra es comprensible y no tiene detalles internos.
- **CA-29b** El callback sigue el camino que indica el propósito del intento:
  - `initial` crea la conexión pendiente (CA-35);
  - `reauth` reemplaza la credencial de la conexión esperada (CA-37c).
- **CA-30** *(corregido)* El código de autorización pasa por el navegador, porque Meta lo entrega al callback en una redirección. Eso es parte del flujo elegido. Lo que se exige:
  - el token existe solo en el servidor: nunca llega al navegador, al HTML, a una cookie ni a una URL;
  - el código se canjea en el servidor con `META_APP_SECRET`, una sola vez, y no se persiste ni aparece en logs, errores o snapshots;
  - el callback termina con una redirección inmediata a una URL limpia, sin `code` ni `state`, y responde con `Referrer-Policy: no-referrer`.
- **CA-31** *(reemplaza el canje a token de larga duración)* El token se inspecciona con `debug_token` y se exige que sea válido, que haya sido emitido para esta app y que tenga `ads_read` concedido. Se guarda la expiración real informada. Si Meta no informa expiración, se guarda como ausente, sin inventar un plazo. La revocación se contempla aunque no haya vencimiento programado (CA-38, CA-39).
- **CA-32** Si falta `ads_read` o la app emisora no coincide, no se crea una conexión que aparente estar sana.
- **CA-33** Un callback repetido con el mismo código no crea una segunda conexión.
- **CA-34** Si el dueño cancela en Meta, llega a una pantalla que lo explica.
- **VR-01** Validación del recorrido, antes de dar OAuth por resuelto. El dueño, ya registrado y con su empresa creada, autoriza → callback seguro → token válido según CA-31 → acceso efectivo a la cuenta delegada → una respuesta real de Insights. Se ejecuta recién cuando ya existen la selección de cuenta, el vencimiento de pendientes y la desconexión (M16.2). Así, una credencial real nunca queda pendiente entre sesiones de implementación. Mientras no exista esa evidencia, OAuth está *elegido*, no *resuelto*.

Hipótesis a resolver en VR-01, sin evidencia sólida todavía:

- **H-01** El listado de cuentas delegadas se obtiene con `/{id}/assigned_ad_accounts`, edge documentado para system users, y alcanza con `ads_read`. La documentación no indica qué permiso exige.
- **H-02** `debug_token` informa correctamente validez, app emisora y permisos de un token de system user de integración.
- **H-03** La revocación por `oauth/revoke`, documentada para tokens de system user, funciona con este tipo de token.
- **H-04** Qué devuelve Meta cuando el dueño quita la cuenta de la delegación. Mientras no haya evidencia, un error que no encaje en la tabla de CA-39 se trata como `desconocido`: no cambia el estado de la conexión y se muestra un error. No se asume que se perdió el acceso.

## 7. Modelo de confianza (DEC-03 + DEC-04)

### Identidad y autoridad

1. Cada Route Handler y cada Server Action del conector obtiene el actor con `requireUserForAction()`, que verifica la firma del JWT mediante `getClaims()`. La empresa se obtiene con `requireCompanyMembership()`, bajo RLS y con el JWT del usuario.
2. Ni el actor ni la empresa se aceptan del navegador, de un parámetro de URL ni del cuerpo de la petición.
3. El servidor construye un K01 `TenantContext` y llama a `worker_api` pasando `p_actor_user_id` y `p_company_id` tomados de ese K01. Cada función verifica dentro de la base que el actor sea miembro de esa empresa y que cualquier `connection_id` pertenezca a ella. Si no, devuelve un error tipado sin detalles.
4. **Límite declarado.** Por la conexión del rol de C no viaja ningún JWT, así que la base no puede verificar la identidad por sí misma. El chequeo del paso 3 protege contra errores del servidor que mezclen actor, empresa o conexión. No protege contra un servidor comprometido, que de todos modos tendría la clave de cifrado.
5. Alternativas descartadas:
   - Verificar el JWT dentro de SQL: costo alto, sin ganancia de confianza.
   - Fijar `request.jwt.claims` con `set_config` para reutilizar `auth.uid()`: la misma confianza, con más acoplamiento.
   - `private.is_company_member()` no se reutiliza en `worker_api`, porque lanza una excepción cuando no hay `auth.uid()`.

### Matriz de privilegios (encabezado obligatorio de la migración)

| Objeto | `anon` | `authenticated` | Rol de C | `PUBLIC` |
|---|---|---|---|---|
| `public.integration_connections` | — | `SELECT` por RLS | — | — |
| `public.meta_daily_coverage` (cobertura, valores vigentes y procedencia; CA-43) | — | `SELECT` por RLS | — | — |
| `public.oauth_attempts` | — | — | — | — |
| `private.integration_credentials` | — | — | — | — |
| Snapshots, días de snapshot y ejecuciones de sincronización | — | — | — | — |
| `public.chat_query_records` | — | — | — | — |
| Esquema `worker_api` | — | — | `USAGE` | — |
| Funciones de `worker_api` | — | — | `EXECUTE`, función por función | revocado |

Reglas para las funciones y el rol:

- Cada tabla nueva empieza con `revoke all ... from public, anon, authenticated` explícito, y recién después se concede lo que marca esta matriz. No se depende de los privilegios predeterminados del proyecto.
- Todas las funciones son `SECURITY DEFINER`, con `set search_path = ''` y objetos calificados.
- Cada función lleva `revoke all ... from public, anon, authenticated` explícito, siguiendo el patrón de `0001` y `0004`. Además, `alter default privileges in schema worker_api revoke execute on functions from public`.
- El rol de C es `LOGIN` y `NOBYPASSRLS`, sin grants sobre tablas.
- La migración crea el rol sin contraseña, porque el repositorio es público. La contraseña la fija el usuario fuera del repositorio: es una intervención del usuario.
- Hay que verificar en el dashboard que `worker_api` no figure entre los esquemas expuestos por la Data API.
- `pg` pasa de `devDependencies` a `dependencies`. La conexión se hace en modo transacción, sin prepared statements.

### Documentación que cambia

- **`SECURITY.md`:** la sección Credenciales deja de afirmar que no existe ninguna credencial privilegiada y documenta esta excepción: una sola credencial, acotada, con sus capacidades enumeradas.
- **`ARCHITECTURE.md`:** incorpora el conector y `worker_api`.
- **`tests/unit/no-privileged-credentials.test.ts`:** se extiende para exigir que `PRAXA_INTEGRATIONS_DB_URL` aparezca solo en un módulo `server-only` del conector. Esto reemplaza el CA-27 anterior ("sin modificar la prueba"), que dejaba la credencial nueva sin cobertura, porque la prueba solo busca siete nombres fijos.

## 8. Contratos (M05.1.2–M05.1.4)

### K01 `TenantContext` (M05.1.1)

- **CA-00** Contiene `user_id` verificado, `company_id` resuelto por membresía, `role = owner` y `request_id`. Se construye solo en el servidor, a partir de `getClaims()` y de la membresía. Nunca acepta un tenant elegido por el navegador.
- **CA-00b** Pruebas: claim ausente, empresa manipulada, membresía inexistente, rol inválido y campo extra. Son las que fija el ROADMAP para `M05.1.1`.

### K02 `OAuthAttempt`

- **CA-01** Solo se persiste el hash del `state`, que tiene 32 bytes aleatorios o más.
- **CA-02** Vencimiento explícito y corto. Un intento vencido no es consumible.
- **CA-02b** El intento queda vinculado al actor que lo inició, a su empresa y al navegador. La vinculación al navegador es el hash de un nonce guardado en una cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- **CA-02c** *(propósito)* El intento declara su propósito: `initial` o `reauth`. Un intento `reauth` guarda además la conexión esperada y la generación de credencial esperada.
- **CA-03** El consumo es único y atómico. Una sola sentencia valida el hash del `state`, el actor, la empresa, el hash de vinculación al navegador, el vencimiento y que el intento no haya sido consumido, y en esa misma sentencia lo marca consumido. Un segundo consumo es un error tipado.
- **CA-04** La URI de retorno está en una allowlist y se valida antes de tocar la base.
- **CA-05** El proveedor es un enum cerrado, con único valor `meta`.

### K03 `IntegrationConnection`

- **CA-06** *(reescrito)* Separación explícita entre el registro interno y el DTO público. Por construcción, el DTO no tiene ningún campo de credencial. Se prueba la serialización del DTO y la de los errores redactados. Se descarta rechazar texto "parecido a un token" en todos los campos: no garantiza que no haya filtraciones y puede rechazar nombres legítimos.
- **CA-07** Estados: `pending_selection`, `active`, `needs_reauth` y `disconnected`. Transiciones declaradas:
  - `pending_selection` → `active`: confirmación con probe exitoso, dentro del plazo;
  - `pending_selection` → `disconnected`: abandono o purga;
  - `active` → `needs_reauth`;
  - `needs_reauth` → `active`: reautorización;
  - `active` o `needs_reauth` → `disconnected`.

  `disconnected` significa "borrado en curso": cuando la purga termina, la fila de la conexión se elimina (CA-38). Las transiciones se aplican en `worker_api` y se prueban en pgTAP.
- **CA-08** *(corregido)* Moneda (ISO 4217), zona horaria (IANA) y cuenta externa son obligatorias en `active` y `needs_reauth`. Pueden ser nulas en `pending_selection` y también en `disconnected`, cuando la conexión viene de `pending_selection`. Ninguna transición inventa metadatos para cumplir una restricción.
- **CA-09** El último error se guarda como clase de error (sección 10) más un mensaje redactado. Nunca incluye tokens, códigos ni URLs con parámetros.
- **CA-09b** Se guardan `client_business_id` y el identificador de la cuenta externa. En la UI, en capturas y en evidencia, ese identificador se muestra truncado (CA-40).

### K04 `SecretCredential`

- **CA-10** Solo texto cifrado. No existe ningún campo de texto plano.
- **CA-11** Exige IV, etiqueta de autenticación y versión de clave.
- **CA-11b** El cifrado usa `company_id`, `connection_id` y proveedor como datos autenticados (AAD). Un texto cifrado movido a otra fila no descifra.
- **CA-11c** Guarda tipo de token, app emisora, permisos concedidos y, si existe, la expiración real (campo nullable).
- **CA-12** Ningún fixture contiene un token, ni real ni con forma de real.
- **CA-13** Toda credencial referencia una conexión.

## 9. Persistencia y cifrado (M06.1a, M06.2a, M06.3a)

- **CA-14** Las tablas nuevas tienen `company_id`, RLS habilitada y `force row level security`, como exige la aceptación de `M06.2` en el ROADMAP (`relrowsecurity` y `relforcerowsecurity`). Dos aclaraciones:
  - Contra lo que decía el plan anterior, ninguna de las once migraciones existentes usa `force`. Es una deuda de `M06.2` sobre las tablas existentes, fuera de esta ruta.
  - `force` no restringe a las funciones `SECURITY DEFINER` cuyo dueño es `postgres`, que tiene `bypassrls`. La protección real de `worker_api` es el chequeo dentro de cada función. Cambiar el dueño de las funciones a un rol sin `bypassrls` ("el rol dueño previsto no omite políticas", según `M06.2`) queda fuera de esta ruta y se declara como pendiente.
- **CA-15** `private.integration_credentials` no tiene grants para nadie salvo el dueño de las funciones.
- **CA-16/17** La matriz de la sección 7 queda documentada en el encabezado de la migración. Antes de cada grant hay un `revoke all` explícito sobre la tabla o la función.
- **CA-18** Un índice único parcial garantiza una sola conexión viva (`pending_selection`, `active` o `needs_reauth`) por empresa. La unicidad `(company_id, provider, external_account_id)` aplica a las filas existentes. Como la purga elimina la fila (CA-38), reconectar la misma cuenta después de una desconexión completada crea una fila nueva. Si queda una conexión `disconnected` con la purga sin terminar, reconectar primero reanuda esa purga.
- **CA-19** Aislamiento entre dos empresas sintéticas, probado en pgTAP.
- **CA-20** Las políticas de lectura resuelven la pertenencia con `private.is_company_member()`. Ninguna acepta un `company_id` provisto por el cliente.
- **CA-21** Ningún usuario lee credenciales por ninguna vía, ni directa ni a través de una función.
- **CA-22** El pgTAP se ejecuta como `authenticated`, como `anon` y como el rol de C. Para el rol de C se prueba que puede ejecutar sus funciones y que no puede leer ninguna tabla directamente.
- **CA-23** AES-256-GCM con IV aleatorio por operación.
- **CA-24** Clave incorrecta, texto alterado o AAD distinto fallan de forma explícita.
- **CA-25** *(rotación)* Se cifra siempre con `PRAXA_CREDENTIAL_KEY_CURRENT` y se descifra con la versión guardada, buscándola en el llavero. Procedimiento de rotación:
  1. Agregar la clave nueva al llavero.
  2. Cambiar la clave actual.
  3. Recifrar, ya sea al usar cada credencial o con un comando explícito.
  4. Retirar la clave vieja solo cuando una función de `worker_api` confirme que ninguna credencial la referencia.

  Una versión ausente del llavero produce un error explícito, no un descifrado fallido silencioso.
- **CA-26** Ni claves, ni tokens, ni códigos OAuth, ni secretos, ni URLs que los contengan aparecen en logs, errores, snapshots o fixtures. Una prueba recorre el árbol buscándolos y otra verifica la redacción de errores del cliente HTTP.
- **CA-27** *(reescrito)* `tests/unit/no-privileged-credentials.test.ts` se extiende: `PRAXA_INTEGRATIONS_DB_URL` solo puede aparecer en el módulo `server-only` del conector, y el resto de la invariante existente sigue pasando.

## 10. Ciclo de vida (M16.2)

- **CA-35** *(conexión inicial)* Después de un callback `initial`, la conexión queda en `pending_selection`: la credencial ya está cifrada, `pending_expires_at` está a 30 minutos y moneda, zona y cuenta están vacías. Se listan las cuentas delegadas (H-01), paginando hasta agotar la respuesta.
- **CA-36** El dueño confirma explícitamente la cuenta, su moneda y su zona, aunque haya delegado una sola. Si delegó más de una, elige una.
- **CA-37** Antes de pasar a `active` se hace una consulta de prueba contra la cuenta elegida. Si falla, la conexión no se activa. `confirm_connection` verifica dentro de la base que `pending_expires_at` no haya pasado, aunque la purga perezosa todavía no se haya ejecutado.
- **CA-37b** *(abandono, DEC-17)* Una conexión en `pending_selection` vence a los 30 minutos. Ese plazo es un criterio propio, no sale de ninguna fuente. La purga sigue la secuencia de CA-38:
  1. `pending_selection` → `disconnected`, sin metadatos (CA-08);
  2. intento de revocación en Meta (H-03);
  3. purga.

  Destruir solo la copia local dejaría en Meta un token sin vencimiento y la app instalada en el portfolio del dueño. Como no hay worker, la purga es perezosa: se ejecuta al iniciar un intento nuevo o al abrir la página de integraciones. Límite declarado: hasta que el dueño vuelva, la credencial cifrada persiste.
- **CA-37c** *(reautorización)* Se inicia con un intento `reauth` sobre la conexión existente (CA-02c). El callback reemplaza la credencial en esa misma conexión solo si se cumplen dos condiciones:
  - la generación de credencial sigue siendo la esperada; si cambió, el intento se rechaza;
  - la cuenta ya conectada está entre las delegadas; si no está, se rechaza, porque para cambiar de cuenta hay que desconectar primero.

  El historial nunca se reasigna a otra cuenta.
- **CA-38** *(desconexión reanudable)* Se ejecuta en este orden:
  1. `begin_disconnect`: estado `disconnected`, incremento de la generación de credencial y marca persistente `purge_requested_at`. Desde ese momento no se hacen llamadas nuevas a Meta.
  2. Intento de revocación en Meta (H-03), solo si la credencial todavía existe.
  3. `purge_connection`, idempotente. En una transacción borra la credencial, los snapshots, los días, la cobertura, las ejecuciones y los registros de consulta de la conexión, y al final la fila de la conexión (DEC-09).

  Si el proceso se corta después del paso 1, la purga se reanuda al abrir la página de integraciones, al repetir la desconexión o al iniciar una conexión nueva: cualquier conexión `disconnected` de la empresa vuelve a los pasos 2 y 3. Destruir la copia local no desinstala la app en Meta. Por eso la UI indica cómo quitarla desde las apps conectadas del negocio.
- **CA-38c** *(escrituras en vuelo)* Una operación que empezó antes de la desconexión y termina después no puede reinsertar datos. `publish_snapshot` (CA-59) y `record_query` (CA-62) verifican, en la misma transacción en la que escriben, que la conexión exista, esté `active` y conserve la generación con la que empezaron. Si no se cumple, descartan la escritura.
- **CA-38b** *(retención, DEC-09)* Reglas asociadas:
  - Borrar la cuenta de PRAXA borra en cascada todo lo de la empresa.
  - Los intentos OAuth vencidos o consumidos se purgan de forma perezosa.
  - Mientras la conexión está viva, los snapshots reemplazados se conservan, porque son la procedencia de las respuestas.
  - "Borrar" alcanza a la base activa. Según la guía de producción de Supabase, en el plan Free las copias de seguridad no se pueden descargar, y en Pro hay copias nocturnas disponibles durante 7 días. Con Pro (DEC-08), un dato borrado puede seguir hasta 7 días en esas copias. La UI y el acta lo declaran así.
  - El historial se puede recuperar reconectando y resincronizando: Meta sirve los totales hasta 37 meses hacia atrás, con los valores revisados que tenga en ese momento.
- **CA-39** *(errores)* La clasificación se hace por código de la Graph API, no por estado HTTP:

| Código | Clase | Efecto |
|---|---|---|
| 190 sin subcódigo, 190/458, 190/460, 190/463, 190/467 | Autenticación | `needs_reauth` |
| 190/459, 190/464 | Acción del usuario en Facebook | `needs_reauth`, con mensaje específico |
| 10, 200–299 | Permiso faltante o retirado | `needs_reauth`, indicando el permiso |
| Acceso a la cuenta retirado, solo con evidencia de H-04 | Acceso al activo | `needs_reauth`. Hasta tener esa evidencia, se trata como desconocido |
| 4, 17, 341, 613, 80004 y los demás de la guía de límites de la Marketing API | Límite | La conexión sigue `active`; la sincronización termina incompleta, con aviso |
| 1, 2 | Temporal | Reintento acotado (sección 11) |
| 3, 100, 3018 (rango de fechas mayor a 37 meses) | Error propio (configuración o parámetro) | La conexión queda como estaba; se registra para corregir |
| Timeout, error de red o respuesta ilegible | Transporte | Reintento acotado dentro del presupuesto; la conexión queda como estaba |
| Cualquier otro código o respuesta | Desconocido | La conexión queda como estaba; se muestra un error y se registra la clase. Nunca pasa automáticamente a `needs_reauth` |

- **CA-40** El identificador completo de la cuenta nunca aparece junto a datos de gasto en capturas, registros o evidencia.

- **CA-67** *(cierre del piloto, DEC-12 y DEC-20)* Se ejecuta al finalizar el piloto, no al terminar la demo. Procedimiento documentado, en este orden:
  1. Desconectar Meta desde la app (CA-38): bloquea las llamadas, intenta la revocación y borra la credencial y los datos de Meta.
  2. Borrar la empresa con un rol privilegiado desde el SQL editor. El borrado arrastra en cascada a miembros, contexto, reportes y todas las tablas de integración.
  3. Borrar el usuario de Supabase Auth.
  4. Quitar al dueño como tester de la app de Meta y pedirle que quite la app desde las apps conectadas de su negocio.

  El orden no es opcional. Hoy no existe ningún flujo de baja de cuenta, y el esquema actual impide borrar primero el usuario: `companies.owner_id` tiene `on delete restrict` (`0001`) y `company_context_versions.created_by` referencia a `auth.users` sin acción de borrado (`0002`). Borrar el usuario desde el dashboard falla mientras exista su empresa.

  Hipótesis a probar en el proyecto de pruebas: `reports` referencia versiones de contexto con `on delete restrict` (`0003`), y como ambas tablas se borran en cascada desde `companies`, el paso 2 podría fallar según el orden de las cascadas. La prueba corre el procedimiento completo sobre una empresa sintética con reporte, integración, observaciones y registros de consulta, y verifica que no quede ninguna fila de esa empresa ni el usuario.
- **CA-68** Todas las tablas nuevas referencian `companies` (directamente o a través de la conexión) con `on delete cascade`, incluida `private.integration_credentials`.

## 11. Sincronización manual (M16c)

### Contrato de métricas

- Nivel `account`, `time_increment=1`, campos `spend` e `impressions`, y `time_range` expresado en fechas de la zona de la cuenta.
- **CA-44b** *(precisión de punta a punta)* `spend` se guarda como `numeric` y sale de SQL como texto decimal (`::text`) en toda función o vista que lea la API, incluidos los totales. `impressions` se guarda como `bigint` y también sale como texto. En TypeScript los dos son cadenas validadas con Zod: decimal para el gasto, entero para las impresiones. Nunca pasan por `number`, y convertirlos a cadena después de haber pasado por `number` no cuenta. Se prueba de punta a punta (SQL → API → TypeScript) con valores que un `number` no representa exactamente.
- Moneda y zona son las de la cuenta confirmadas en CA-36. No se convierte moneda.

### Snapshots y cobertura (DEC-05)

- **CA-41** Cada extracción crea un snapshot inmutable. Contiene los parámetros de la consulta sin credenciales, `fetched_at`, las páginas consumidas, el resultado y, por cada día, solo `date_start`, `date_stop`, `spend` e `impressions`. No se guardan la respuesta cruda completa ni los enlaces de paginación, porque pueden contener el token.
- **CA-42** Un snapshot es completo solo si se consumieron todas las páginas de Insights sin error.
- **CA-43** *(cobertura persistida)* La cobertura vive en `public.meta_daily_coverage`, legible por `authenticated` bajo RLS. Tiene una fila por conexión y día cubierto por un snapshot completo, con:
  - presencia: `con_datos` o `sin_fila_reportada`;
  - gasto e impresiones, nulos si la presencia es `sin_fila_reportada`;
  - `snapshot_id` y `fetched_at`;
  - si la captura fue anterior al cierre del día (CA-43b).

  Un día sin fila en la tabla es `no_observado`. `publish_snapshot` actualiza la tabla en la misma transacción que el snapshot: cada día que cubre el snapshot nuevo queda con lo que ese snapshot trajo. Si un snapshot anterior traía un valor y el nuevo, completo, no trae fila, el día pasa a `sin_fila_reportada` y el valor anterior deja de sumarse. `sin_fila_reportada` no equivale a cero ni prueba ausencia de actividad; tratarla como cero requiere primero fundamentar la semántica del endpoint.
- **CA-43b** *(estado temporal y captura parcial)* Son dos cosas distintas:
  - el estado del día al consultar, en la zona de la cuenta: `abierto` o `cerrado`. `cerrado` significa que el día terminó, no que Meta ya no vaya a revisar el valor;
  - `captured_before_day_end`: si el dato vigente se extrajo antes del cierre del día. Queda persistido en la fila de cobertura. Un valor extraído al mediodía sigue marcado como captura parcial al día siguiente, hasta que lo reemplace una extracción completa posterior al cierre. Se prueba sin resincronizar.
- **CA-44** Cada valor vigente conserva la moneda, la zona y la procedencia hasta el snapshot y la ejecución que lo respaldan.
- **CA-45** *(reemplazado)* Reprocesar el mismo snapshot produce la misma cobertura, sin duplicados. Un snapshot completo más nuevo puede actualizar valores. Uno parcial o fallido nunca reemplaza datos vigentes.
- **CA-46** La cobertura por día de una ventana es consultable, con presencia, estado temporal, captura parcial, procedencia y frescura.
- **CA-47** *(reemplazado)* La completitud se verifica por separado (CA-42). Comparar sumas contra un crudo truncado no prueba nada.
- **CA-47b** Cada sincronización relee los últimos 28 días. Es un valor inicial configurable. No se afirma que Meta congele gasto e impresiones después de ese plazo.

### Ejecución

- **CA-56** Límites explícitos de ventana máxima, páginas máximas y duración máxima de la ejecución, fijados por debajo del tiempo máximo configurado en Vercel (sección 5b, Q-04). Se pagina hasta agotar la respuesta o hasta chocar un límite. Chocar un límite deja el snapshot incompleto.
- **CA-57** Solo se reintentan los errores de clase temporal o de transporte, con tope y espera, dentro del presupuesto de duración. Los límites de Meta no se reintentan en la misma ejecución.
- **CA-58** *(ejecución vigente)* Hay una sola ejecución vigente por conexión. Cada ejecución tiene un identificador, un token de posesión aleatorio y un arrendamiento con vencimiento. Iniciar una ejecución mientras hay otra vigente se rechaza con un mensaje claro. Si el arrendamiento de A venció, B puede iniciar, toma la posesión y A queda desplazada.
- **CA-59** *(publicación atómica, solo de la ejecución vigente)* `publish_snapshot` inserta el snapshot, sus días y la cobertura en una transacción, y solo si en ese momento se cumple todo esto:
  - la ejecución es la vigente de la conexión: coinciden el identificador y el token de posesión, y el arrendamiento no venció;
  - la conexión sigue `active`;
  - la generación de credencial es la del inicio.

  Una ejecución desplazada tampoco puede cambiar el estado de la conexión: `mark_needs_reauth` disparado por una sincronización exige la misma posesión. Prueba obligatoria: A vence, B empieza y publica, A termina después y queda rechazada.
- **CA-60** La paginación también se aplica al listado de cuentas.

## 12. Chat (M25a)

### Herramientas y límites

- **CA-48** Catálogo cerrado de herramientas:
  - cobertura de un período;
  - serie diaria de una métrica (`spend` o `impressions`);
  - total de una métrica en un período;
  - estado de la conexión.

  El modelo no elige empresa, tabla ni SQL.
- **CA-49** El tenant y la conexión se resuelven en el servidor. Las herramientas leen con el JWT del usuario, bajo RLS.
- **CA-70** *(límites del chat)* Valores iniciales configurables, a confirmar al implementar:
  - período máximo consultable: 93 días;
  - hasta 4 llamadas a herramientas por turno;
  - hasta 800 tokens de salida por llamada al modelo;
  - un turno en curso por usuario;
  - duración total del turno: 60 s, por debajo del máximo configurado en Vercel.

  Se aplican en el servidor. El límite de período se aplica también dentro de las funciones SQL que la API puede llamar, porque `periodSchema` solo verifica fechas y orden.

### Afirmaciones numéricas (DEC-19)

- **CA-50** *(salida estructurada con afirmaciones verificadas)* El modelo redacta en lenguaje natural y puede incluir cifras. Su salida estructurada tiene dos partes: `text` y `claims`.
  - Cada afirmación numérica de `text` sobre los datos del negocio tiene un `claim` que la vincula a un resultado de herramienta del turno actual.
  - Un claim contiene: `span` (posición exacta en el texto), `kind`, `tool_call_id` con la ruta del valor dentro del resultado, y los campos declarados `metric`, `unit`, `currency` (cuando corresponde), `account_ref` y `period`.
  - Tipos de claim:
    - `observed_value`: un valor devuelto por una herramienta;
    - `period_bound`: una fecha límite del período consultado;
    - `coverage_count`: cantidad de días en un estado de cobertura;
    - `qualitative_comparison`: mayor, menor o igual entre dos valores referenciados;
    - `user_provided`: una cifra que escribió el dueño.

  El servidor valida todo antes de mostrar nada:
  1. **Detección.** Busca en `text` todos los candidatos numéricos:
     - dígitos, con `.` o `,` como separador;
     - porcentajes;
     - cantidades escritas con palabras en español (de "cero" a "millones", incluidas fracciones como "mitad");
     - multiplicadores y variaciones: "doble", "triple", "se duplicó", "aumentó un", "cayó a la mitad";
     - comparativos: "más que", "menos que", "igual que".

     Cada candidato tiene que quedar cubierto por el `span` de un claim.
  2. **`observed_value`.** La ruta resuelve a un valor de un resultado del turno actual. `metric`, `unit`, `currency`, `account_ref` y `period` del claim coinciden exactamente con los del resultado. La cifra escrita, normalizada, coincide con el valor.
  3. **Normalización.** Se acepta el formato es-AR (miles con `.` y decimales con `,`) y también la cifra sin separador de miles.
     - Gasto: valor exacto, o redondeado a 0 o 2 decimales con redondeo half-up.
     - Impresiones: entero exacto, con o sin agrupación de miles.
     - En esta versión no se aceptan abreviaturas ("1,2 M", "30 mil") ni porcentajes.
  4. **`qualitative_comparison`.** Referencia dos `observed_value` y la relación declarada. El servidor calcula la relación, y tiene que coincidir con la declarada.
  5. **Variaciones y ratios cuantitativos** ("se duplicó", "subió un 20 %"). Ninguna herramienta los calcula, así que se rechazan. Una operación que ninguna herramienta soporta no se presenta como calculada ni verificada.
  6. **`user_provided`.** La cifra tiene que aparecer en la pregunta redactada del turno. La UI la muestra diferenciada de las cifras observadas en Meta, por ejemplo "según lo que mencionaste".
  7. **Rechazo.** Si algo no valida, la respuesta no se muestra como un hecho: se registra como `guard_rejected` y el dueño ve una abstención controlada.
- **CA-50b** *(qué se garantiza y qué se prueba)*
  - **Garantías determinísticas:**
    - ninguna cifra, cantidad en palabras, variación ni comparativo llega a la pantalla sin un claim válido;
    - todo `observed_value` coincide en valor, métrica, unidad, moneda, cuenta y período con un resultado del turno actual;
    - toda comparación cualitativa fue recalculada por el servidor.
  - **No garantizado; se evalúa con pruebas y con VR-02:**
    - que la herramienta elegida sea la correcta para la pregunta;
    - que el texto sin cifras sea fiel;
    - que la respuesta conteste lo que se preguntó.

    Validar números o JSON no asegura la corrección semántica del resto del texto.
  - **Pruebas obligatorias:**
    - cifra inventada;
    - cifra correcta atribuida a otra métrica;
    - cifra correcta atribuida a otro período;
    - comparación sin respaldo;
    - variación del tipo "se duplicó";
    - cantidad escrita con palabras sin claim;
    - cifra del dueño presentada como observada;
    - herramienta elegida incorrectamente. Este caso lo tiene que detectar la evaluación, no la guarda.
- **CA-50c** Las referencias de los claims solo resuelven contra resultados de herramientas del turno actual. Un historial manipulado, en el cliente o en el servidor, no puede introducir cifras.

### Presentación y modelo

- **CA-51** Toda respuesta declara período, zona horaria, cobertura (presencia, estado temporal y captura parcial) y frescura. Si los días provienen de extracciones distintas, se informa el rango de `fetched_at`, no solo la última sincronización.
- **CA-51b** Los totales sobre períodos con días `sin_fila_reportada`, `no_observado`, `abierto` o con captura parcial se presentan como parciales, mostrando la composición.
- **CA-52** La interfaz muestra siempre la cuenta (truncada) y el período.
- **CA-53** *(P01)* El identificador de modelo es fijo. No equivale a un despliegue inmutable: el host puede cambiar la precisión o la forma de servir el modelo sin cambiar el identificador. Para el piloto se acepta esa limitación con dos mitigaciones: VR-02 se repite antes de la demo, y cada registro guarda el identificador informado por la respuesta (CA-53b). Con el modelo caído, el chat muestra un mensaje claro, conserva la pregunta en la sesión y permite reintentar sin volver a escribirla.
- **CA-53b** *(modelo, DEC-14 y DEC-15)* DeepSeek V4.1 Flash, con sus pesos abiertos servidos por DeepInfra (DEC-16) bajo el identificador `deepseek-ai/DeepSeek-V4.1-Flash`. Según la ficha del modelo al 2026-09-23, se sirve en precisión fp8. No tiene un identificador fechado, a diferencia de `DeepSeek-V4-Flash-0731`.
  - La salida estructurada de CA-50 usa el mecanismo de esquema estricto del host: `response_format` de tipo `json_schema` con `strict`, o una herramienta en modo `strict`. El modo `json_object` no alcanza, porque garantiza JSON válido pero no el esquema.
  - Zod es la autoridad final: una salida que no valida se rechaza como `guard_rejected`.
  - Cada registro de consulta guarda el identificador de modelo solicitado y el informado por la respuesta. El informado es nulo si el proveedor no respondió.
- **CA-54** Aislamiento entre empresas, tanto frente a preguntas directas como frente a instrucciones inyectadas en la pregunta.
- **CA-55** El chat describe gasto e impresiones. No explica causas ni evalúa rentabilidad. Una interpretación se marca como tal y se separa de los hechos observados.

### Registro por consulta (DEC-10)

- **CA-61** La conversación visible vive solo durante la sesión del navegador. Esta versión no incluye listado de conversaciones, búsqueda ni memoria entre sesiones.
- **CA-62** Cada consulta genera un registro con:
  - la pregunta, redactada según CA-66;
  - los nombres de las herramientas llamadas, sin sus resultados ni argumentos que contengan identificadores;
  - el resultado: `answered`, `answered_partial_coverage` o `not_answered`;
  - si no respondió, un motivo de una lista cerrada: `out_of_scope`, `no_coverage`, `connection_not_active`, `guard_rejected`, `model_unavailable` o `tool_error`;
  - la fecha y la latencia;
  - el identificador de modelo solicitado y el informado (CA-53b);
  - la conexión a la que se refiere, o nula si todavía no hay conexión. Sin conexión, el resultado es `not_answered` con motivo `connection_not_active`, y ese registro se borra por CA-67.

  No se guardan respuestas, cifras de resultados de herramientas ni credenciales. La pregunta redactada sí puede conservar montos y fechas que escribió el dueño (CA-66). Cada reintento es un registro aparte. `record_query` cumple CA-38c.
- **CA-66** *(redacción, DEC-11)* Una única función determinística redacta la pregunta antes de persistirla y antes de enviarla al modelo. El texto original no se persiste en ningún lado.
  - **Se reemplaza por un marcador:**
    - email → `[EMAIL]`;
    - teléfono en formato internacional → `[TELEFONO]`;
    - CUIT/CUIL con guiones → `[CUIT]`;
    - número de tarjeta que pasa el control de Luhn → `[TARJETA]`;
    - CBU/CVU de 22 dígitos → `[CBU]`;
    - URL → `[URL]`;
    - cadena larga con forma de token o clave → `[SECRETO]`;
    - identificador `act_` → truncado, como exige CA-40.
  - **Se conserva:** montos y fechas.
  - **Longitud máxima configurable.** Valor inicial propuesto: 500 caracteres, a confirmar en la implementación.
  - **Límites declarados:** un DNI suelto no se distingue de un monto en formato argentino, por lo que no se redacta. Nombres, direcciones y otros datos en forma libre tampoco se detectan. Esos casos quedan cubiertos solo por el aviso de CA-65.
  - **Pruebas con casos sintéticos:** cada patrón se redacta; los montos con separador de miles no se redactan; los números de tarjeta que no pasan Luhn no se redactan; la función es idempotente.
- **CA-69** *(utilidad, DEC-13)* Cada respuesta mostrada, incluidas las abstenciones, ofrece dos botones: "útil" y "no útil".
  - El valor se guarda en el registro de esa consulta como `useful` o `not_useful`, o queda nulo si el dueño no marca nada. No admite texto libre.
  - Se escribe mediante una Server Action que construye K01 y llama a `worker_api` con el identificador opaco del registro. La función verifica que el registro pertenezca a la empresa.
  - Si el dueño marca más de una vez, queda el último valor.
- **CA-63** El texto de la pregunta nunca se escribe en logs de la aplicación ni en los de ejecución del hosting.
- **CA-64** El registro se escribe por `worker_api` (DEC-04). `authenticated` no tiene acceso de lectura, porque ninguna pantalla lo usa. El operador lo consulta desde el dashboard de Supabase, y `M03a` declara ese acceso junto con la finalidad del registro.
- **CA-65** Borrado: solo por DEC-09 y CA-67, sin plazo propio (DEC-12). La UI del chat avisa que las preguntas se registran y para qué.

**Reutilización de `reporting/contract`.** Se reutilizan `periodSchema`, el patrón `knownOr` y la distinción de procedencia (`system_fact`, `calculated_metric`, `inference`). No se reutiliza `calculatedMetricEvidenceSchema` tal cual: su `value` es `z.number()`, y el gasto exige decimal exacto (CA-44b).

### Validación del modelo

- **VR-02** Se corre sobre DeepInfra con fixtures sintéticos. Antes de correrla se congela un conjunto de evaluación con dos grupos:
  - preguntas respondibles, cada una con herramienta, métrica, período y respuesta esperados;
  - preguntas que exigen abstención: fuera de alcance, sin cobertura, variaciones sin herramienta, otra empresa.

  Criterios de aprobación iniciales (DEC-21):
  - cero cifras sin respaldo mostradas. Es una condición determinística: un solo caso reprueba;
  - exactitud de herramienta, métrica y período en las preguntas respondibles: ≥ 90 %;
  - rechazos injustificados, es decir, preguntas respondibles que terminan en `guard_rejected` o en abstención: ≤ 10 %;
  - abstención correcta en las preguntas que la exigen: ≥ 95 %;
  - latencia p95 del turno ≤ 20 s, con el esfuerzo de razonamiento elegido.

  Un modelo que se abstiene siempre no pasa, porque falla el criterio de rechazos injustificados. Además, hay que verificar tres cosas:
  - el identificador y la precisión coinciden con CA-53b;
  - la salida estricta funciona con el esquema de CA-50;
  - la respuesta informa el identificador de modelo.

  Si VR-02 falla, primero se diagnostica la causa: prompt, esquema, herramientas, esfuerzo de razonamiento o modelo. Cambiar de host es el último recurso y no es gratis: además de `llm.ts`, exige actualizar la configuración, las pruebas y `M03a`.
- **Declaración en `M03a`** (P01): DeepInfra como host, con centros de datos en EE. UU. y sin entrenamiento sobre los datos. Retención: no guarda entradas en disco, pero se reserva registrar porciones chicas de las solicitudes para depuración o seguridad. También hay que declarar que la pregunta viaja redactada (DEC-11) y que viajan las cifras de gasto e impresiones.

## 13. Parámetros pendientes de medición

| ID | Pregunta | Tipo |
|---|---|---|
| Q-04 | Valores iniciales de ventana máxima, páginas y duración de la sincronización. Se fijan en `M16c` con lo medido en VR-01 y por debajo de la duración configurada en Vercel. No bloquea ninguna microfase anterior | Técnica |

## 13b. Intervenciones del usuario

Ningún secreto se pega en el chat ni se guarda en el repositorio.

| Dónde | Qué | Cuándo |
|---|---|---|
| Meta | Asociar la app a un business portfolio propio (P-03). Crear la configuración de Login for Business de tipo system user y cargar `META_CONFIG_ID` (P-01). Registrar la URI de redirección con el dominio del piloto (P-02) | Antes de OAuth |
| Meta | Agregar al dueño como tester y confirmar que tiene control total de su portfolio (P-04) | Antes de VR-01 |
| Supabase | Fijar la contraseña del rol de C fuera del repositorio. Verificar que `worker_api` no esté expuesto por la Data API | Al aplicar la migración |
| Supabase Auth | Cargar `site_url` y las URLs de redirección con el dominio del piloto. Configurar el SMTP propio (DEC-18) | Antes de VR-01 |
| Supabase Auth | Probar la recuperación de contraseña completa con el registro público cerrado | En `M28.2a` |
| Supabase Auth y dueño | Abrir el registro público; el dueño se registra y crea su empresa; cerrar el registro (DEC-18). La demo reutiliza ese usuario | Antes de VR-01, en `M16.2` |
| Supabase | Pasar a Pro cuando el dueño use el piloto sin acompañamiento (DEC-08) | Después de VR-01 |
| Dominio | Registrar SPF y DKIM del proveedor de email | Antes de VR-01 |
| Vercel | Crear el proyecto con dominio fijo y cargar las variables de la sección 5 | Antes de OAuth |
| DeepInfra | Crear la cuenta y cargar `DEEPINFRA_API_KEY` | Antes de VR-02 |
| Local | Generar las claves de `PRAXA_CREDENTIAL_KEYS` y cargar `PRAXA_INTEGRATIONS_TEST_DB_URL` | Antes del corte de cifrado y antes de las pruebas del rol de C, respectivamente |
| Repositorio | Corregir las líneas 82 y 92 del ROADMAP y decidir la visibilidad del repositorio y la reescritura del historial | Ya |
| Documentación | Comitear la Enmienda 1 del ROADMAP y aprobar `M03a` | Antes del corte 1 y antes de cualquier dato real, respectivamente |
| Cierre | Ejecutar CA-67 | Al finalizar el piloto (DEC-20) |

## 14. Verificación

`npm run verify` ejecuta lint, typegen, typecheck, las pruebas `unit` y `component`, y el build. **No** ejecuta pgTAP (`test:policies`) ni `test:app`. Por eso cada corte declara qué corre además de `verify`:

| Corte | Suites obligatorias además de `verify` |
|---|---|
| Contratos (K01–K04) | — |
| Migración y aislamiento | `db:check:test`, `db:push:test`, `test:policies` (privilegios del rol de C y aislamiento), `test:app` (lectura efectiva de las tablas nuevas por la Data API) |
| Cifrado | — |
| OAuth | `test:app`: callback de otro actor o de otra empresa, `state` vencido o reutilizado, hash de vinculación distinto, intento `reauth` con generación vieja, URL limpia después del callback. Sin autorización real |
| Ciclo de vida | `test:policies`: transiciones, pendiente → desconectada sin metadatos, confirmación vencida rechazada en la base, purga reanudable e idempotente, reconexión después de una purga, cierre (CA-67, CA-68). `test:app`: revocación y desconexión durante una sincronización. VR-01 |
| Sincronización | `test:policies`, más pruebas unitarias con Meta simulada: paginación completa, fallo en una página intermedia, resincronización sin duplicados y con valores actualizados, ejecución desplazada (A vence, B publica, A es rechazada), snapshot nuevo sin fila donde el anterior tenía valor, captura parcial vista al día siguiente sin resincronizar, precisión SQL → API → TypeScript |
| Chat | Pruebas obligatorias de CA-50b, aislamiento (CA-54), límites (CA-70), redacción (CA-66), escritura en vuelo (CA-38c), VR-02 y transcripciones reproducibles con fixtures sintéticos |

Criterios transversales:

- **CB-01** `verify` y las suites del corte pasan.
- **CB-02** Ningún diff contiene secretos, tokens, montos reales ni identificadores completos de cuentas.
- **CB-03** Ninguna migración existente se modifica.
- **CB-04** Ninguna prueba se ejecuta contra producción.
- **CB-05** La evidencia registra comandos y resultados reales, redactados.
- **CB-06** Un gate obligatorio no se aprueba si una prueba requerida se omitió por falta de configuración. Una prueba omitida cuenta como no ejecutada.

## 15. Correcciones de documentación pendientes

- **`docs/ROADMAP.md`, líneas 82 y 92.** Contienen el identificador completo de la cuenta piloto, el nombre del negocio y una magnitud de gasto real, en un repositorio público. Propuesta:
  - Reemplazarlos por referencias redactadas: "cuenta piloto", "moneda de la cuenta", "zona de la cuenta distinta de Buenos Aires".
  - Registrar el hallazgo en `HALLAZGOS.md` sin repetir los datos.
  - Decidir por separado la visibilidad del repositorio y la reescritura del historial. Es una decisión del usuario; no se hace automáticamente.
- **Rutas desactualizadas.** `AGENTS.md`, líneas 15 y 16, apunta a `docs/microfases/<ID>/`, pero la estructura real es `docs/FASES/FASE1/<MF>/`. Además, `docs/FASES/FASE1/MF04/m04-1-auditoria.md` cita un nombre anterior del roadmap.
- **`SECURITY.md`, línea 181.** Dice que no hay política de retención. Se alinea con DEC-09 cuando `M03a` la ratifique.

## Fuentes

- Facebook Login for Business: https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business
- Cuentas asignadas a un system user: https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/system-user/assigned_ad_accounts
- Revocación de tokens de system user: https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens/
- Desconexión en Login for Business (plantilla de Conversions API): https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business/conversions-api-integration-template/
- Códigos de error de la Graph API: https://developers.facebook.com/docs/graph-api/guides/error-handling
- Límites de la Marketing API: https://developers.facebook.com/documentation/ads-commerce/marketing-api/overview/rate-limiting
- Uso comercial en Vercel: https://vercel.com/docs/limits/fair-use-guidelines
- Política de privacidad de DeepSeek: https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html
- Cambios de modelos en la API de DeepSeek: https://api-docs.deepseek.com/updates/
- Datos en DeepInfra: https://docs.deepinfra.com/account/data-privacy
- Salida estructurada en DeepInfra: https://docs.deepinfra.com/chat/structured-outputs
- Retención de datos en Fireworks: https://docs.fireworks.ai/guides/security_compliance/data_handling
- Totales de Insights disponibles hasta 37 meses: https://developers.facebook.com/blog/post/2025/10/16/ads-insights-api-metric-availability-updates/
- Duración de funciones en Vercel: https://vercel.com/docs/functions/limitations
- Pausa de proyectos Free en Supabase: https://supabase.com/docs/guides/platform/free-project-pausing
- SMTP de Supabase Auth: https://supabase.com/docs/guides/auth/auth-smtp
- Guía de producción de Supabase (copias de seguridad): https://supabase.com/docs/going-into-prod
- Cambios que rompen compatibilidad en Supabase (grants explícitos para la Data API): https://supabase.com/changelog?types=breaking-change
- Relectura de días recientes en conectores (fuentes secundarias): https://docs.airbyte.com/integrations/sources/facebook-marketing y https://fivetran.com/docs/connectors/applications/facebook-ads
