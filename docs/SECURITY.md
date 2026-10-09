# Seguridad y datos

Este documento responde una sola pregunta: **qué protegemos, de quién, qué fronteras de
confianza existen, qué propiedades no se pueden romper y qué controles las sostienen.**

No es un inventario. Los detalles volátiles tienen su propia fuente y acá solo se enlazan:

| Detalle | Fuente canónica |
|---|---|
| Grants exactos por tabla, función y rol | Encabezado y cuerpo de cada migración (`supabase/migrations/`) y su pgTAP (`03_privileges`, `09_integration_privileges`) |
| Criterios, plazos, TTL, estados y códigos de error | Spec de la ruta (`docs/FASES/FASE1/meta_first/spec.md`: CA, CB y DEC) y encabezado de `0012_integrations.sql` |
| Qué microfase construye cada control | Plan de la ruta (`docs/FASES/FASE1/meta_first/plan.md`) |
| Qué está cerrado hoy | `docs/PROJECT_STATE.md` |
| Problemas conocidos y abiertos | `docs/HALLAZGOS.md` |
| Estructura y flujos | `docs/ARCHITECTURE.md` |

Cuándo se actualiza este documento: ver "Contrato documental" en `AGENTS.md`.

Cada control se marca como **vigente** (existe en el código o en la base y tiene prueba) o
**previsto** (aprobado en la spec, todavía no construido). Un control previsto no protege
nada hasta que exista.

## 1. Activos

| Activo | Por qué importa |
|---|---|
| Datos de cada empresa (contexto declarado, conexiones, métricas de Meta, registros del chat) | Su exposición a otra empresa rompe la promesa central del producto |
| Credenciales de integración (token de system user de Meta) | Dan acceso de lectura a la cuenta publicitaria del dueño fuera de PRAXA |
| Claves del llavero de cifrado (`PRAXA_CREDENTIAL_KEYS`) | Descifran todas las credenciales guardadas |
| Credencial de base del rol `praxa_integrations` (`PRAXA_INTEGRATIONS_DB_URL`) | Ejecuta `worker_api`, la única vía a las credenciales |
| Secretos de terceros (`META_APP_SECRET`, `DEEPINFRA_API_KEY`) y credenciales administrativas de Supabase | Suplantación de la app o acceso total a la base |
| Integridad de las cifras mostradas al dueño | Una cifra falsa presentada como hecho es un daño aunque no haya filtración |
| Identidad del dueño y su cuenta de Supabase Auth | Todo lo demás se autoriza a partir de ella |

## 2. Fronteras de confianza

1. **Navegador → servidor Next.** Todo lo que llega del navegador es no confiable: cookies,
   parámetros, cuerpo, identificadores de empresa o de conexión. La identidad se verifica en
   el servidor; la empresa se deriva de la membresía.
2. **Servidor Next → Data API (PostgREST) → PostgreSQL**, con el JWT del usuario. La base
   aplica `GRANT` y RLS con la identidad del JWT. Es el **camino interactivo**.
3. **Servidor Next → PostgreSQL con el rol `praxa_integrations` → `worker_api`**, sin JWT.
   Es el **camino privilegiado de integraciones**. La base no puede verificar la identidad
   del usuario por sí misma: recibe actor y empresa del servidor.
4. **Servidor Next → Meta (Graph API).** Meta es la fuente de los datos y emisora del token.
   Sus respuestas se validan; sus errores se redactan antes de guardarse o mostrarse.
5. **Servidor Next → proveedor del modelo (DeepInfra).** Recibe la pregunta redactada y
   resultados de herramientas; su salida es no confiable hasta que el servidor la valida.
6. **Entorno de ejecución (Vercel) y panel de Supabase.** Quien los controla controla todo
   lo anterior. Están fuera del modelo de amenazas que la aplicación puede mitigar.
7. **Entorno de pruebas → proyecto desechable.** Las pruebas destructivas nunca cruzan hacia
   el proyecto de la aplicación.

`worker_api` es un nombre heredado: **la ruta `meta_first` no construye ningún worker en
segundo plano** (spec, sección 2, y D2). El camino 3 lo recorre código `server-only` de Next,
dentro de una petición.

## 3. Invariantes de seguridad

Propiedades que ninguna microfase puede romper. Si una tiene que cambiar, primero cambia la
spec, con decisión del usuario.

- **INV-01 — Tenant del servidor.** La empresa de una operación se resuelve en el servidor a
  partir de la identidad verificada y la membresía. Ningún `company_id` enviado por el
  navegador decide acceso.
- **INV-02 — Aislamiento en la base.** Un usuario solo ve o modifica filas de empresas donde
  es miembro, aunque el código del servidor tenga un error. Lo garantizan `GRANT` + RLS en
  el camino interactivo y el chequeo de pertenencia dentro de cada función en el camino
  privilegiado.
- **INV-03 — Credenciales fuera de alcance.** `anon` y `authenticated` no leen credenciales
  de integración por ninguna vía, directa ni a través de una función (CA-21).
- **INV-04 — Mínimo privilegio del runtime.** El runtime interactivo usa solo la clave
  publishable. La única credencial privilegiada que el runtime puede tener es la del rol
  `praxa_integrations`, que no lee tablas y solo ejecuta funciones concretas de `worker_api`.
  `service_role` no es un cliente del runtime.
- **INV-05 — Secretos en reposo.** Los tokens de integración se guardan solo cifrados; la
  clave de cifrado nunca vive en la base.
- **INV-06 — Secretos fuera de canales visibles.** Ni tokens, ni códigos OAuth, ni claves,
  ni URLs que los contengan aparecen en el navegador, logs, errores, snapshots, fixtures,
  documentación o evidencia (CA-26, CB-02).
- **INV-07 — Solo lectura sobre sistemas externos.** PRAXA no escribe en Meta. El único
  permiso objetivo es `ads_read`.
- **INV-08 — El LLM no es autoridad.** Ningún número, estado ni política que ve el dueño sale
  del modelo sin verificación determinística del servidor.
- **INV-09 — Membresías inmutables para el usuario.** Nadie se otorga ni modifica membresías
  desde la aplicación.
- **INV-10 — Pruebas aisladas.** Ninguna prueba se ejecuta contra el proyecto de la
  aplicación (CB-04).

## 4. Modelo de amenazas

| Amenaza | Control | Cobertura | Límite |
|---|---|---|---|
| Navegador manipulado (cookies, formularios, rutas alteradas) | Verificación de identidad con `getClaims()` en cada página, Server Action y Route Handler; K01 construido solo en el servidor | Vigente para el camino interactivo; K01 existe (`src/modules/tenant/context.ts`) | `proxy.ts` no es frontera: un cambio de `matcher` puede dejar una ruta sin refresco, y la verificación tiene que estar en el handler |
| `company_id` o `connection_id` manipulados | INV-01; RLS con `private.is_company_member()`; en `worker_api`, pertenencia del actor y propiedad de la conexión verificadas dentro de cada función (errores indistinguibles entre "ajena" e "inexistente") | Vigente en la base (`0001`–`0012`, pgTAP `01`, `08`, `09`) | — |
| Acceso cross-tenant por error del servidor | RLS (camino interactivo) y chequeo por actor/empresa en `worker_api` (camino privilegiado) | Vigente | En el camino privilegiado la base confía en el actor y la empresa que manda el servidor; protege contra **mezclarlos**, no contra un servidor que mienta |
| Escalada por membresías | Sin privilegio de escritura sobre `company_members`; la membresía inicial la crea un trigger `SECURITY DEFINER` en la misma transacción que el alta; `owner_id` inmutable | Vigente | Una cuenta administra una sola empresa (ver "Limitaciones") |
| Exposición de tokens por la Data API | Credenciales en `private` (no expuesto); `worker_api` no expuesto; `revoke all` explícito antes de cada grant; RLS forzada en las tablas de integraciones | Vigente en la base y en `supabase/config.toml` | En el proyecto remoto, la lista de esquemas expuestos se verifica en el panel (intervención del usuario al preparar el entorno) |
| Privilegios excesivos del runtime | INV-04; rol `praxa_integrations` `LOGIN`, `NOBYPASSRLS`, `NOINHERIT`, sin grants sobre tablas, `EXECUTE` función por función; la migración rechaza un rol preexistente con privilegios o membresías | Base: vigente. Cliente Node del rol y prueba que confina su variable a un módulo `server-only` (CA-27): previstos | Mientras no exista el cliente, la invariante "una sola credencial privilegiada, en un solo módulo" no tiene prueba automática |
| Replay o abuso del flujo OAuth | Propiedades de la sección 7 | Tabla y funciones de intentos: vigentes en la base. Rutas `iniciar` y `callback`: previstas | La base no ata la creación de una conexión pendiente a un intento consumido: lo garantiza el orden del servidor (`H-E1-24`) |
| Filtración de un dump o backup de la base | Tokens cifrados con AES-256-GCM y clave fuera de la base (sección 6) | Previsto (el esquema de la credencial cifrada es vigente; el cifrado en Node no) | Un dump expone todo lo que no es credencial: conexiones, métricas y registros del chat |
| Filtración de las variables del runtime | Ninguno completo. Rotación del llavero (CA-25) y revocación en Meta como respuesta a incidentes | Parcial | **Límite deliberado:** si `PRAXA_CREDENTIAL_KEYS` y `PRAXA_INTEGRATIONS_DB_URL` viven en el mismo entorno, quien lo compromete alcanza base y llavero, y puede descifrar las credenciales |
| Logs o errores que filtren secretos o identificadores | INV-06; errores de `worker_api` con mensajes fijos, sin `DETAIL` ni valores; clase de error + mensaje redactado en la conexión (CA-09); identificador de cuenta truncado fuera de la base (CA-40); la pregunta del chat nunca va a logs (CA-63) | Base: vigente. Redacción del cliente HTTP y recorrido del árbol (CA-26): previstos | La redacción por patrones no detecta datos personales en forma libre (CA-66) |
| Pruebas destructivas contra el proyecto equivocado | Sección 11 | Vigente | La guarda de `test:app` todavía admite una excepción explícita (`H-M04.1-02`) |
| Prompt o pregunta maliciosa hacia el LLM | Catálogo cerrado de herramientas; el modelo no elige empresa, tabla ni SQL; las herramientas leen con el JWT del usuario bajo RLS (sección 8) | Previsto | La inyección puede degradar la respuesta; no puede ampliar el alcance de los datos |
| Cifras o estados inventados por el LLM | Salida estructurada `text` + `claims`, verificación del servidor antes de mostrar; abstención controlada si no valida (sección 8) | Previsto | No garantiza que la herramienta elegida sea la correcta ni que el texto sin cifras sea fiel (CA-50b); eso lo mide VR-02 |

Fuera del modelo: un compromiso completo del servidor, de la cuenta de Vercel, del panel de
Supabase o de la cuenta de Meta del dueño. La aplicación no puede defenderse de quien ya
controla su entorno de ejecución.

## 5. Aislamiento multiempresa

Tres capas independientes. Cada una tiene que ser correcta por su cuenta; ninguna cubre los
errores de otra.

1. **Privilegios SQL** (`GRANT`/`REVOKE`): qué objetos y operaciones puede tocar cada rol.
   Supabase concede privilegios amplios por defecto sobre objetos nuevos de `public`; cada
   migración revoca y concede operación por operación. **RLS no reemplaza los privilegios.**
2. **RLS:** qué filas puede ver o escribir cada usuario dentro de lo permitido. Las
   políticas de escritura llevan `USING` **y** `WITH CHECK`.
3. **Autorización en el servidor:** identidad verificada y pertenencia comprobada antes de
   cada operación.

Reglas del servidor:

- **El proxy no es la autorización final.** `proxy.ts` refresca la sesión y redirige. Las
  Server Functions son POST a la ruta donde se usan, y un cambio de `matcher` puede quitarles
  cobertura sin aviso.
- Cada página protegida, Server Action y Route Handler verifica identidad con
  **`getClaims()`**, que valida la firma del JWT. **`getSession()` nunca es prueba de
  identidad.**
- Toda operación del conector construye un K01 `TenantContext` dentro del handler. K01
  nunca se recibe como argumento.

Garantías de la base, vigentes y probadas en pgTAP:

- Las claves foráneas compuestas `(company_id, …)` impiden relacionar filas de empresas
  distintas aunque alguien eluda las políticas.
- Toda tabla de empresa tiene `company_id NOT NULL` y se borra en cascada desde `companies`,
  directamente o a través de su fila padre (CA-68).
- `owner_id` e `id` de una empresa son inmutables.
- Las funciones que escriben con privilegios elevados vuelven a verificar la pertenencia
  por su cuenta: con `auth.uid()` en `private`, y con el actor recibido en `worker_api`
  (sin JWT, `private.is_company_member()` no se puede usar ahí).
- `force row level security` se aplica a las tablas de integraciones. No restringe a las
  funciones `SECURITY DEFINER` cuyo dueño tiene `bypassrls`: lo que protege `worker_api` es
  el chequeo dentro de cada función. Las tablas anteriores a `0012` no usan `force`; es una
  deuda declarada fuera de la ruta (CA-14, `H-E1-05`).

La matriz exacta de privilegios vive en cada migración y en su pgTAP. No se copia acá.

## 6. Credenciales, secretos y cifrado

### Qué credencial usa cada camino

| Camino | Credencial | Alcance |
|---|---|---|
| Interactivo | Clave publishable + JWT del usuario | Pública por diseño; el aislamiento lo dan `GRANT` + RLS, no el secreto de la clave |
| Privilegiado de integraciones | `PRAXA_INTEGRATIONS_DB_URL` (rol `praxa_integrations`) | Solo `EXECUTE` sobre funciones de `worker_api`; ninguna lectura directa de tablas. **Previsto:** confinada a un único módulo `server-only` (CA-27) |
| Pruebas de aplicación | `SUPABASE_TEST_SECRET_KEY` (`service_role`) | Solo fixtures administrativos en Node (sección 11) |
| Operación administrativa | Rol administrativo desde el panel de Supabase | Fuera de la aplicación: cierre del piloto (CA-67) y migraciones ejecutadas por el usuario |

Las capacidades exactas del rol `praxa_integrations` son las funciones que le concede la
migración vigente (encabezado de `0012` y de cada migración posterior que sume funciones),
probadas en `09_integration_privileges`. Por categoría: intentos OAuth, ciclo de vida de la
conexión, lectura y reemplazo de la credencial cifrada, purga, y rotación de claves. Cada
función, salvo el conteo global por versión de clave, recibe actor y empresa y verifica
pertenencia y propiedad.

`tests/unit/no-privileged-credentials.test.ts` falla si aparece una clave de servicio bajo
`src/` o en `proxy.ts`. Hoy compara nombres fijos, no una invariante general (`H-E1-10`).

### Reglas de secretos

- Ningún secreto se pega en el chat, se guarda en el repositorio ni se lee de `.env.local`
  por un asistente.
- Ninguna variable secreta es `NEXT_PUBLIC_*`. `.env.example` lleva solo nombres, sin
  valores (hay una prueba que lo exige).
- El rol `praxa_integrations` se crea sin contraseña: la fija el usuario fuera del
  repositorio, en cada proyecto.
- Las variables de prueba (`SUPABASE_TEST_*`, `PRAXA_INTEGRATIONS_TEST_DB_URL`) nunca se
  cargan en el entorno de despliegue.

### Cifrado de credenciales (DEC-03, CA-10 a CA-13, CA-23 a CA-25)

Diseño aprobado:

- La base guarda solo texto cifrado, IV, etiqueta de autenticación y versión de clave. No
  existe un campo de texto plano. **Vigente** (esquema de `private.integration_credentials`).
- AES-256-GCM con IV aleatorio por operación; los datos autenticados (AAD) atan el texto
  cifrado a su empresa, conexión y proveedor: movido a otra fila, no descifra.
  **Previsto.**
- El llavero vive fuera de la base, en variables del servidor, con versiones. Se cifra con
  la versión actual y se descifra con la versión guardada; una versión ausente es un error
  explícito. La rotación sigue el procedimiento de CA-25. **Previsto** (la función de la
  base que cuenta credenciales por versión es vigente).

Qué protege y qué no:

- **Protege** frente a la filtración aislada de la base: un dump o un backup sin el llavero
  no revela tokens.
- **No protege** frente a un compromiso del entorno de ejecución. Si el llavero y la
  credencial de base del rol conviven en las mismas variables del despliegue, quien las
  obtiene puede leer y descifrar. Es un límite deliberado del piloto, no un defecto a
  corregir en silencio.

## 7. OAuth con Meta (spec, sección 6; K02)

Propiedades que tiene que cumplir el flujo. Los valores exactos (tamaño del `state`,
vencimiento, cookies, clasificación de errores) están en CA-01 a CA-05 y CA-28 a CA-34.

- El `state` es aleatorio y la base guarda solo su hash.
- El intento queda atado al actor, a su empresa y al navegador, este último mediante el
  hash de un nonce en una cookie `HttpOnly` independiente del `state`.
- El intento vence pronto; la base hace cumplir el tope de vida.
- El consumo es único y atómico: una sola sentencia valida `state`, vinculación al
  navegador, actor, empresa, vencimiento y no-consumo, y lo marca consumido. El error no
  dice cuál condición falló.
- El callback no confía solo en los parámetros del navegador: reconstruye K01 y exige que el
  intento sea de ese actor y esa empresa.
- El código de autorización pasa por el navegador (es parte del flujo), pero en el servidor
  existe solo durante el canje: no se persiste ni se registra. El callback termina con una
  redirección a una URL limpia, con `Referrer-Policy: no-referrer`.
- El token nunca llega al navegador, al HTML, a una cookie ni a una URL.
- Antes de considerar válida una conexión, el servidor verifica el token: válido, emitido
  para esta app y con `ads_read` concedido.

Vigente: tabla de intentos, creación y consumo atómico en `worker_api`, probados en pgTAP.
Previsto: rutas `iniciar` y `callback`, canje e inspección del token.

## 8. Frontera del LLM (DEC-06, DEC-19; CA-48 a CA-50c, CA-54, CA-66)

Todo previsto. Invariantes que el diseño del chat tiene que sostener:

- El modelo elige solo entre herramientas de un catálogo cerrado. No recibe SQL, nombres de
  tabla ni la capacidad de elegir `company_id` o conexión: el servidor los resuelve con K01.
- Las herramientas se ejecutan en el servidor con el JWT del usuario, bajo RLS. Los cálculos
  autoritativos ocurren en SQL o en código determinístico.
- Toda afirmación numérica del texto se vincula a un resultado de herramienta del turno
  actual y el servidor la verifica antes de mostrarla. Si no valida, el dueño ve una
  abstención controlada, no la respuesta.
- La pregunta se redacta con una función determinística antes de persistirla y antes de
  enviarla al modelo. Ningún secreto ni credencial llega al modelo.
- El modelo no tiene acceso a Meta ni permisos de escritura sobre ningún sistema.

Riesgo aceptado (DEC-15): el host del modelo no entrena ni guarda en disco, pero se reserva
registrar porciones de solicitudes para depuración y seguridad; recibe la pregunta redactada
y las cifras de gasto e impresiones.

## 9. Datos, retención y borrado

Estado de cada pieza, sin repetir los plazos (la fuente es la spec):

| Pieza | Estado |
|---|---|
| Decisiones de retención: al desconectar se borra todo lo de la conexión (DEC-09); registros del chat sin plazo propio (DEC-12); vencimiento de conexiones pendientes (DEC-17); purga perezosa de intentos y copias de seguridad (CA-38b) | Cerradas en la spec |
| Acta de datos reales que las ratifica y declara finalidad, accesos, terceros y transferencias | Pendiente en `M03a` (`G-ACTA-META`); ningún dato real entra antes (`H-E1-03`) |
| Funciones de la base para desconexión y purga idempotente | Vigentes en `worker_api` |
| Orquestación de la purga perezosa y revocación en Meta | Previstas |
| Flujo de baja de cuenta desde la aplicación | No existe (`H-E1-06`). El cierre del piloto es un procedimiento administrativo con orden obligatorio (CA-67) |
| Copias de seguridad del proveedor | Un dato borrado de la base activa puede seguir en las copias durante su plazo (CA-38b). Es un límite declarado, no se mitiga |

"Borrado" en este documento significa borrado en la base activa.

## 10. Inmutabilidad y excepción administrativa de borrado

Las versiones de contexto `active` o `superseded`, y sus filas hijas, son inmutables para
todos los roles frente a `UPDATE`, incluido `service_role`.

Para `DELETE` hay una única excepción, necesaria para que la cascada desde `companies`
funcione (limpiar pruebas, cerrar el piloto, atender un pedido de eliminación). Exige **dos**
condiciones simultáneas:

1. el rol es administrativo (`service_role`, `supabase_admin` o `postgres`), **y**
2. `auth.uid()` es nulo: no hay ningún usuario final detrás.

La segunda cierra la vía indirecta: dentro de una función `SECURITY DEFINER`, `current_user`
pasa a ser el dueño de la función, pero el claim `sub` del JWT sobrevive al cambio de rol.
Cubierto por `05_delete_carveout.test.sql`.

## 11. Entornos de prueba

- Las pruebas destructivas corren solo contra un proyecto declarado desechable
  (`SUPABASE_TEST_IS_DISPOSABLE`) y con variables propias (`SUPABASE_TEST_*`), distintas de
  las de la aplicación.
- Ninguna guarda recurre en silencio a una variable del runtime: las pruebas SQL no usan
  `SUPABASE_DB_URL` como respaldo, y las del cliente del rol usarán solo
  `PRAXA_INTEGRATIONS_TEST_DB_URL`, nunca `PRAXA_INTEGRATIONS_DB_URL` (spec, sección 5;
  previsto).
- La guarda de las pruebas SQL rechaza un destino que coincida con el proyecto de la
  aplicación o que no se pueda comprobar. La de `test:app` y `db:check:test` todavía admite
  `SUPABASE_TEST_ALLOW_APP_PROJECT=true`; su eliminación está asignada en `H-M04.1-02`.
- `service_role` solo prepara y limpia fixtures administrativos en Node (crear usuarios
  confirmados, borrar lo creado). Ninguna aserción de aislamiento se hace con él. Las tablas
  y funciones de integraciones le revocan todo privilegio: sus fixtures se siembran por
  `worker_api` y se limpian por cascada.
- Cada corrida etiqueta lo que crea con un identificador único y borra solo eso.
- `npm run verify` no ejecuta pgTAP ni `test:app` (`H-E1-12`). Un `verify` en verde no prueba
  aislamiento ni privilegios; cada microfase declara qué suites corre además.

## 12. Limitaciones y riesgos aceptados

- **Una cuenta administra una sola empresa** (`companies_owner_unique`). Es lo que permite no
  tener ninguna vía de escritura sobre `company_members`. Revertirlo exige reglas de rol y
  selección explícita de empresa (ver `ARCHITECTURE.md`).
- **El camino privilegiado confía en el servidor.** La base verifica que actor, empresa y
  conexión sean coherentes, no que el actor sea quien dice ser.
- **Llavero y credencial de base en el mismo entorno** (sección 6).
- **Las funciones `SECURITY DEFINER` son propiedad de un rol con `bypassrls`.** Cambiar su
  dueño queda fuera de la ruta (CA-14).
- **Sin limitación de intentos de inicio de sesión** propia, más allá de la de Supabase Auth.
- **El registro revela si un correo ya tiene cuenta.** Crear cuenta con un correo registrado
  muestra un aviso en vez de la respuesta neutra de Supabase, así que cualquiera puede comprobar
  si un correo es usuario de PRAXA. Lo aceptó el usuario por claridad (`H-E1-73`). Recuperar la
  contraseña e iniciar sesión siguen respondiendo igual exista o no la cuenta.
- **Sin registro de auditoría** de accesos ni de cambios, más allá de las versiones de
  contexto, las marcas de tiempo y los registros por consulta del chat.
- **Retención del host del modelo** (sección 8) y **copias de seguridad** (sección 9).
