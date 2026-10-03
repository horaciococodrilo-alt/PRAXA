# M06.3a — Plan de implementación

**Estado:** APROBADO

Estados posibles: `BORRADOR` → `APROBADO`. Solo el usuario pasa este plan a `APROBADO`, después de una auditoría APROBABLE.

**Spec base:** `docs/FASES/FASE1/M06.3a/spec.md`, APROBADA, hash de contenido `73916504c73990df7a2d38ff18b7ea7f3c592375`, coincidente con `spec-audit-5.md`, APROBABLE. Ver la fórmula en `docs/_templates/mf-spec.md`.

**Base inspeccionada:** `main@f96b3b3`. G-K01, G-K02-K04 y G-DB-META están cerrados. Se preservan los cambios preexistentes en la spec, la spec general, HALLAZGOS y las auditorías. Las menciones residuales a “BORRADOR” dentro de la spec describen un estado anterior; se toma como vigente su encabezado y la aprobación indicada por el usuario, sin reescribirla.

**Objetivo:** implementar cifrado y rotación de credenciales, cliente acotado de `worker_api`, repositorio, guardas y evidencia de acceso real al proyecto desechable. Guardar este plan no ejecuta la implementación ni acredita G-CRYPTO.

**Hash de contenido de este plan.** Se calcula sin la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M06.3a/plan.md | git hash-object --stdin
```

## Archivos

Los nombres abreviados de la columna Archivo se usan en los pasos. Todo archivo de implementación pertenece a II.6; el resto es seguimiento autorizado.

| Archivo | Nuevo o modificado | Paso | Autorizado por |
|---|---|---|---|
| `tests/unit/credential-crypto.test.ts` | Nuevo | 1, 2, 4–7 | II.6.1 |
| `src/modules/integrations/crypto/keyring.ts` | Nuevo | 5 | II.6.2 |
| `src/modules/integrations/crypto/seal.ts` | Nuevo | 5 | II.6.3 |
| `src/modules/integrations/db/worker-api.ts` | Nuevo | 6 | II.6.4 |
| `src/modules/integrations/repository/credentials.ts` | Nuevo | 7 | II.6.5 |
| `package.json` | Modificado | 8 | II.6.6 |
| `package-lock.json` | Modificado | 8 | II.6.6; D-M06.3a-02 |
| `tests/unit/no-privileged-credentials.test.ts` | Modificado | 3, 9 | II.6.7 |
| `scripts/check-target.mjs` | Modificado | 9 | II.6.7b |
| `scripts/lib/sql-target.mjs` | Modificado | 9 | II.6.7b; D-M06.3a-02 |
| `tests/unit/sql-test-target.test.ts` | Modificado | 3, 9 | II.6.7b |
| `scripts/lib/target.mjs` | Modificado | 9 | II.6.7c |
| `tests/app/helpers.ts` | Modificado | 9 | II.6.7c |
| `tests/unit/no-secrets-in-tree.test.ts` | Nuevo | 3, 9 | II.6.8 |
| `docs/SECURITY.md` | Modificado | 13 | II.6.7c y II.6.9 |
| `docs/ARCHITECTURE.md` | Modificado | 13 | II.6.9 |
| `.env.example` | Modificado | 10 | II.6.10 |
| `tests/app/integrations-worker-api-client.test.ts` | Nuevo | 4, 12 | II.6.11; D-M06.3a-01 |
| `README.md` | Modificado, alcance limitado | 10 | II.6.12; D-M06.3a-02 |
| `docs/HALLAZGOS.md` | Modificado | 0, 12, 15 | Precondición 8 |
| `docs/PROJECT_STATE.md` | Modificado | 11, 15 | Precondición 8 |
| `docs/FASES/FASE1/meta_first/sesiones/M06.3a.md` | **Modificado: ya existe** | 0–16 | Precondición 8 |
| `docs/FASES/FASE1/M06.3a/plan.md` | Nuevo al materializar el plan | Pipeline | Precondición 9 |
| `docs/FASES/FASE1/M06.3a/revisiones/*.md` | Nuevos informes del pipeline | Auditoría y revisión | Precondición 9 |

La spec aprobada queda como entrada inmutable. No se prevén cambios a la ruta ni a su spec general. Los temporales de T-37 viven fuera del árbol y se eliminan al terminar. `.env.local` pertenece a la intervención del usuario, no al alcance de edición del asistente.

## Pasos

`C-NN` y `T-NN` significan `M06.3a-C-NN` y `M06.3a-T-NN`. Los rangos incluyen todos sus IDs. Cada prueba mantiene íntegros los resultados esperados de la spec; agruparlas en un paso no reduce sus casos.

| # | Acción | Archivos | Criterios y casos que cubre | Verificación del paso |
|---|---|---|---|---|
| 0 | Confirmar aprobación del plan, hash de spec, dependencias y estado Git. Preparar `mf/M06.3a` desde la base acordada conservando todos los cambios ajenos, sin reset ni limpieza. Registrar baseline y archivos preexistentes. Releer guías locales de Next sobre `server-only` y externalización de `pg`. | Seguimiento | CB-01–06; C-20; condición de entrada | `git status --short`, `git branch --show-current`, `git rev-parse HEAD`; hash de spec coincidente; PROJECT_STATE confirma dependencias. Si cambió un contrato o falta aprobación, detener implementación. |
| 1 | **RED criptográfico.** Escribir llavero válido e inválido, ciclo completo, IV nuevo, texto vacío, clave incorrecta, alteraciones, AAD ajeno, etiqueta corta, versión ausente, rotación básica y redacción de `SecretValue`. Generar material sintético durante la ejecución. | `credential-crypto.test.ts` | C-01–04, C-10; T-01–11, T-20; CA-11b, CA-23–26 | Ejecutar la suite focalizada y registrar rojo por módulos/comportamientos ausentes, no por configuración de Vitest. Mock explícito de `server-only`. |
| 2 | **RED cliente y repositorio.** Escribir las pruebas de SQL fijo, aridad, errores, cierre del pool, TLS, destino efectivo, clasificación de fallos, validaciones y proyección K04. Cubrir preparación/reintento exacto, rotación por estado y versión, conflictos, conteos e incertidumbre antes/después de escritura. | `credential-crypto.test.ts` | C-05–09, C-21, C-23–27; T-12–19, T-42, T-45–53 | Pools/WorkerApi simulados y parser instalado sin red. Comprobar cero consultas/sellados ante entradas inválidas y cero Pool/Client/red/lectura de certificados ante URL rechazada. Cada caso debe tener rojo atribuible a la funcionalidad pendiente. |
| 3 | **RED guardas e higiene.** Extender las cinco invariantes de confinamiento conservando los dos `it` originales. Agregar casos del resolvedor y regresión de la excepción de app. Escribir autopruebas de los ocho patrones y del informe redactado del scanner. | Tres suites de guardas: `no-privileged-credentials`, `sql-test-target`, `no-secrets-in-tree` | C-12–15, C-24, C-26; T-21–26, T-47, T-49; CA-26–27, T09 | Ejecutar suites focalizadas. T-23 usa raíz temporal sin entorno local. Probar fallos de Git y exclusión de `.env.local` sin leerlo. El recorrido limpio puede pasar desde el inicio; no introducir secretos para fabricar un rojo. |
| 4 | **RED integración y ausencia de configuración.** Escribir la suite permanente y el harness aislado T-37. El primer `beforeAll` valida destino antes de abrir conexiones o crear fixtures; no hay `skipIf`. Preparar recorrido real, restricciones, AAD entre empresas, rotación, desconexión y reintentos SQL. | Suite app nueva; harness en `credential-crypto.test.ts` | C-06, C-18–19, C-21, C-25; T-31–38, T-41, T-43, parte real de T-48; CB-04, CB-06 | Registrar rojo inicial por implementación ausente. El rojo de configuración se obtiene mediante el proceso aislado; la ejecución positiva remota queda para el paso 12. Un fallo de importación/arranque no acredita T-37. |
| 5 | **GREEN llavero y cifrado.** Implementar las interfaces de Diseño §§2–3, validación de versiones y base64, llavero memoizado y copias de claves. AES-256-GCM con IV aleatorio de 12 bytes, tag de 16 y AAD existente. Validar material antes de descifrar; separar versión desconocida de autenticación fallida. | `keyring.ts`, `seal.ts` | C-01–04, C-10; T-01–11, T-20 | Suite focalizada verde para estos casos. Primera sentencia `server-only` en ambos módulos. Ningún error con material ni `cause`; `SecretValue` solo revela mediante `reveal()`. |
| 6 | **GREEN cliente acotado.** Implementar `WorkerApi`, `Queryable`, factoría y singleton perezoso. Mapa cerrado de las doce funciones con casts y aridades de `0012`; consultas parametrizadas sin `name`. Aplicar guardas de URI/destino y TLS antes del parser de `pg`. Incorporar CA pública y configuración exacta de Diseño §5. | `worker-api.ts` | C-07–08, C-24–27; T-17–18, T-47–50 y frontera cliente de T-53 | Validar configuración del pool, `on('error')`, delegación de `end()`, copia de argumentos y envelope `rows`. Verificar huella con `X509Certificate`, negociación `postgres` incluso ante entorno sintético adverso y errores redactados. |
| 7 | **GREEN repositorio.** Implementar interfaces de Diseño §6 con validación antes de resolver dependencias. Preparación síncrona opaca mediante WeakMap; ejecución reutilizable sin resellar. Validar respuestas SQL y proyectar exactamente los diez campos K04. Implementar lectura, recifrado, creación, reemplazo, conteos y condición DB de retiro. | `credentials.ts` | C-05–06, C-09–10, C-21–23, C-27; T-12–16, T-19–20, T-42, T-45–46, T-51–53 | Pruebas focalizadas verdes. Comprobar errores exactos, dependencias perezosas y conversiones Date/bigint. No exponer `rewrap_credential` como operación independiente. |
| 8 | Mover únicamente `pg` a dependencias de producción; conservar su rango y versión resuelta. Mantener `@types/pg` en desarrollo. Actualizar lockfile con `npm install`, revisando que no haya actualizaciones ajenas. | `package.json`, `package-lock.json` | C-11, C-19; T-28, T-38 | T-28: el comando de inspección devuelve `true false true` y `npm ci --dry-run` pasa sin error de sincronización. No exigir aún `npm run build`; no instalar `server-only` ni cambiar configuración global. |
| 9 | **GREEN guardas e higiene.** Implementar el export y contrato real de `resolveIntegrationsTestTarget`, integrar su informe y quitar la excepción de app de ambas guardas. Completar las invariantes y el scanner. No cambiar `resolveSqlTestTarget` ni `refFromDbUrl`; no crear stubs, usar `ts-ignore` ni desactivar typecheck. | Scripts autorizados, `helpers.ts` y tres suites del paso 3 | C-12–15, C-24, C-26; T-21–23, T-25–26, T-47, T-49 | Suites focalizadas verdes, incluida la regresión negativa T-23: la antigua excepción ya no tiene efecto operativo en código ni helpers. URL definida inválida hace salir `check-target test` con 1; ausencia informa FALTA sin acreditar el gate. El resultado completo de T-24 sobre SECURITY se exige después del paso 13. |
| 10 | Agregar las cuatro variables vacías y sus instrucciones en `.env.example`; recalcular trece variables y corregir sección final. En README modificar exclusivamente tabla de variables de prueba y párrafo de salvaguardas relacionado. | `.env.example`, `README.md` | C-17; T-30; II.6.10 y II.6.12 | Prueba existente de valores vacíos verde y revisión del diff. No agregar `META_*`, claves LLM ni valores de entorno. |
| 11 | **Intervención del usuario.** Registrar `db:check:test` antes de configurar. El usuario fija contraseña del rol en `praxa-test`, ejecuta `npm run env:prepare` y carga URL de pruebas y llavero. Repetir la guarda. | Entorno local, gestionado por usuario; seguimiento | C-13, C-18; T-27; ficha e III.2 | `npm run db:check:test` verifica destino desechable y URL del rol. La carga del llavero se acredita mediante T-33, no imprimiéndolo. Detener trabajo dependiente hasta completar la intervención. |
| 12 | Ejecutar la suite real con el rol y el llavero configurado. Verificar autenticación, denegación de tablas, creación/lectura, AAD ajeno, rotación y conteos, desconexión, carrera determinística y repetición de operaciones preparadas. Cerrar recursos y limpiar fixtures aun si falla. | Suite app nueva; seguimiento | C-06, C-18, C-21, C-25; T-31–36, T-41, T-43, T-48; CA-21–25 y CA-11b | `npm run test:app -- tests/app/integrations-worker-api-client.test.ts`, sin omisiones. Login real como `praxa_integrations`, consultas de tablas con `42501`, limpieza sin pendientes. Ante fallo de acceso, diagnosticar y frenar G-CRYPTO. |
| 13 | Actualizar controles y componentes de previstos a vigentes con la evidencia obtenida. Documentar capacidades por categoría, límites del recifrado y retiro; enlazar la spec y matriz canónica. Quitar de SECURITY la referencia operativa a la antigua excepción y después ejecutar T-24 completo. | `SECURITY.md`, `ARCHITECTURE.md` | C-14, C-16, C-22; T-24, T-29, T-44; II.6.7c y II.6.9 | Revisar diff: no duplicar funciones/grants/TTL; no alterar retención; OAuth y sincronización siguen previstos. T-24 solo encuentra el literal en la regresión negativa T-23, sin soporte operativo ni ocultarlo por concatenación. Conteo cero no se presenta como autorización completa de retiro. |
| 14 | Ejecutar verificación final completa y revisar alcance, secretos, documentación y convención `server-only`. | Todos los archivos previstos, solo comprobación | C-01–27; T-24, T-27–30, T-37–40 y suites que ejecutan los demás casos; CB-01–06 | Secuencia exacta de la sección siguiente, incluida la repetición de T-24; `npm run verify` exige aquí el primer build completo verde, con todos los imports previstos ya existentes. Ninguna suite requerida omitida. Comparar diff contra baseline para separar cambios ajenos. |
| 15 | Registrar comandos, resultados reales, rojos/verdes, limitaciones y limpieza. Actualizar hallazgos y estado operativo. Presentar evidencia para aprobación visible de G-CRYPTO. | Tres archivos de seguimiento | Ficha: evidencia y condición para avanzar; CB-05–06 | Auditoría de trazabilidad completa C-01–27/T-01–53. Solo después de aprobación del usuario registrar gate aprobado y M28.2a habilitada; no iniciarla. |
| 16 | **Publicación reservada y condicional.** Preparar resumen del diff si el usuario solicita publicación. Commit, push o PR requieren solicitud expresa; push y despliegue los realiza el usuario. Los dos `db:push` quedan marcados “no aplican a M06.3a”. | Seguimiento; sin implementación adicional | AGENTS; precondición 6; III.2; C-20 | Comprobaciones posteriores de la tabla de intervenciones. Ninguna publicación ni migración forma parte del cierre técnico por defecto. |

### Contratos que fijan los pasos 6 y 7

- **Superficie nueva:** conservar nombres, firmas y tipos de Diseño §§2, 3, 5, 6 y 7. No agregar rutas HTTP, aceptar tenant desde el navegador ni modificar K01–K04.
- **Destino:** URI PostgreSQL absoluta con componentes explícitos; rechazo de overrides `user/host/port` y controles TLS, incluidos nombres codificados, repetidos o vacíos. Cliente del rol exclusivamente por shared transaction pooler en `6543`. Las referencias administrativas mantienen su modo permitido.
- **TLS:** CA oficial versionada en `worker-api.ts`, fuente/fecha/huella de la spec, `rejectUnauthorized: true`, hostname estándar y `sslnegotiation: 'postgres'`. Sin pinning del peer, descarga en runtime ni fallback. Las precauciones del parser están respaldadas por la [documentación de node-postgres](https://node-postgres.com/features/ssl); el modo de conexión por la [guía oficial de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).
- **Recifrado:** solo para versión leída menor que la actual y estado permitido. `disconnected` descifra sin recifrar. `keyVersion` siempre describe el material leído. PX006 produce `CredentialChangedError`; PX008 produce `version_conflict`. Solo transporte/timeout durante rewrap permite `unconfirmed`; TLS, autenticación, validación y demás errores explícitos se propagan.
- **Reintentos:** objeto preparado auténtico, inmutable, sin token claro y ligado a actor/empresa. Reutilizarlo envía los mismos argumentos; no hay retry automático ni persistencia tras reinicio.
- **Retiro:** `canRetireKeyVersion` comprueba exclusivamente conteo DB. El retiro completo exige además writers antiguos inhabilitados y operaciones en vuelo terminadas; si no se acredita, conservar la clave.

### Construcción de las pruebas reales y T-37

La suite positiva usa `createWorkerApi({ connectionString })`, nunca el singleton runtime. Para T-31/T-32 observa el pool real creado por la factoría, sin sustituir transporte ni respuestas, y ejecuta sobre ese pool las sondas de identidad/permisos; no se amplía la API productiva para admitir SQL arbitrario.

Fixtures mediante helpers existentes, empresas sintéticas y limpieza con `cleanupRun()`. Para reemplazo e idempotencia se preparan los intentos y estados requeridos llamando funciones existentes de `worker_api`, sin implementar OAuth. La rotación usa versiones sintéticas altas V/V+1 válidas y ausentes del conteo inicial. T-41 intercala una desconexión real mediante una barrera de promesas entre lectura y rewrap, sin sleeps ni PX006 simulado.

T-37 vive en la suite unitaria y ejecuta la suite app real mediante config/setup temporales: `envDir: false`, sin setup habitual, dotenv ni herencia PRAXA/SUPABASE. El setup elimina la URL de pruebas, incorpora una URL runtime sintética, bloquea `pg` y `fetch`, y emite solo ausencia/contadores. Se exige fallo por la variable ausente, cero conexiones y evidencia del harness. Timeout de 120 segundos termina el hijo y falla el caso; no acredita el negativo. Limpiar únicamente los temporales propios.

## Verificación final

Ejecutar en este orden después de todos los cambios y de la intervención:

```bash
npm run test:unit
npm run db:check:test
npm run test:app
npm run verify
```

`verify` incluye lint, typegen, typecheck, unit/component y build; no sustituye la suite app. `email-flows` conserva su carácter opt-in; ninguna otra omisión requerida acredita el gate.

Comprobaciones adicionales de la spec:

```bash
rg -n SUPABASE_TEST_ALLOW_APP_PROJECT scripts tests src .github docs/SECURITY.md .env.example README.md
node -e "const p=require('./package.json');console.log(Boolean(p.dependencies.pg),Boolean(p.devDependencies.pg),Boolean(p.devDependencies['@types/pg']))"
npm ci --dry-run
git diff main -- docs/SECURITY.md docs/ARCHITECTURE.md
git diff main -- .env.example
git diff main -- package.json
git diff --name-only main -- supabase/
git diff --check
git status --short
```

Resultados exigidos:

- T-24: únicamente la regresión T-23 contiene el literal de la excepción.
- T-28: `true false true` y lockfile sincronizado.
- T-29/T-30/T-38: documentación y variables dentro del alcance; mocks por suite, sin alias global.
- T-37: proceso negativo fallido por la causa esperada, sin red.
- T-39: diff de `supabase/` vacío; revisar también que no haya archivos nuevos allí.
- T-40: `verify` exit 0.
- Scanner sin hallazgos; revisión adicional del diff para datos prohibidos que sus patrones no cubren.

Si Vitest falla al cargar desde Git Bash, repetir con:

```powershell
powershell -NoProfile -Command "npm run verify"
```

Un fallo de arranque del pool se repite una vez y se registra conforme H-E1-18. No convertir estas repeticiones en aceptación de una prueba funcional fallida. No ejecutar `test:policies`, `db:preview` ni migraciones: este corte no cambia SQL.

## Intervenciones del usuario y acciones reservadas

| Paso | Acción del usuario | Verificación posterior |
|---|---|---|
| Antes de 0 | Aprobar este plan después de auditoría APROBABLE. | Aprobación visible y hash auditado coincidente. |
| 11 | Fijar contraseña de `praxa_integrations` en el SQL editor de `praxa-test`, fuera del repositorio. | T-31 autentica con el rol. Si falla, consultar por la conexión administrativa **de pruebas** solo `rolcanlogin`, `rolconnlimit` y vigencia booleana de `rolvaliduntil`; registrar diagnóstico sin secretos y detener gate. |
| 11 | Ejecutar `npm run env:prepare`; cargar URL del rol tomada de Connect → Transaction pooler, usuario del rol con referencia de pruebas, puerto 6543 y contraseña codificada. | T-27 valida configuración; T-31/T-33 verifican destino, login y consultas reales. |
| 11 | Generar clave de 32 bytes en base64 y cargar llavero/versión actual en `.env.local`. | T-33 cifra y descifra usando ese llavero. El asistente no abre el archivo ni solicita valores. |
| 15 | Aprobar G-CRYPTO después de revisar evidencia completa. | Registrar fecha/aprobación en PROJECT_STATE. Hasta entonces, gate pendiente. |
| 16, solo por solicitud | Publicación: commit/PR con autorización expresa y **push ejecutado por el usuario**. | `git log -1`, estado Git y comparación del commit remoto con el autorizado. |
| 16, no aplica aquí | Despliegue en Vercel. Corresponde a M28.2a. | En esa microfase: deployment exitoso asociado al commit y comprobación HTTPS. No atribuirlo a M06.3a. |
| 16, no aplica aquí | `npm run db:push` al proyecto app. Corresponde a M28.2a. | En esa microfase: destino validado, resultado e historial remoto. Ninguna prueba contra app. |
| 16, no aplica aquí | `npm run db:push:test`, reservado al usuario. M06.3a presupone `0012` ya aplicada por G-DB-META. | Si se detecta ausencia, detener por dependencia incumplida; no migrar automáticamente. Tras resolverla por el procedimiento autorizado, verificar historial y repetir guarda/suite real. |

En seguimiento: cerrar H-M04.1-02 y H-E1-09/10 solo con evidencia; acreditar aplicación de H-E1-17; mantener endurecimiento de H-E1-36 en M16c; registrar H-E1-37 como **mitigación y límite aceptado del repositorio**, no resolución integral SQL. Conservar H-E1-41 y registrar el comentario obsoleto de `src/lib/env.ts` con ID estable y asignación, sin editarlo.

## Migraciones

Ninguna. `0012` permanece intacta; `0013` sigue reservada a M16c.

No hay reversión SQL que ejecutar. Cualquier futura corrección de esquema requerirá otra microfase y una migración nueva. La reversión de código no autoriza retirar claves todavía referenciadas por credenciales.

## Riesgos

- **Acceso real del rol:** la contraseña o atributos del rol pueden impedir login; el diagnóstico no sustituye T-31 ni permite cambiar de rol.
- **Pooler y consultas parametrizadas:** T-33 debe demostrar compatibilidad sin `name`; si falla, detener y reportar H-S-02.
- **Confianza TLS:** cambio de CA exige revisión del certificado versionado; nunca desactivar validación.
- **Concurrencia:** conservar generación y versión leídas evita afirmar una persistencia no confirmada; verificar carreras mediante barreras determinísticas.
- **Falsos verdes:** módulos ausentes, problemas de arranque, skips o un `db:check:test` sin URL no acreditan integración.
- **Alcance:** detener ante contradicción, archivo adicional necesario, secreto/dato real requerido o dos correcciones sin converger. El límite de ocho horas no habilita omitir criterios.

## Qué no se hace

- Implementar OAuth, cliente HTTP de Meta, sincronización, workers o LLM.
- Cambiar contratos existentes, migraciones, privilegios SQL o configuración global de Vitest.
- Añadir recifrado masivo, reintentos automáticos o idempotencia durable.
- Corregir documentación ajena al alcance, incluido el conteo general del README o `src/lib/env.ts`.
- Leer `.env.local`, imprimir secretos, usar datos reales o probar contra app.
- Ejecutar push, despliegues o `db:push`; iniciar M28.2a o aprobar gates automáticamente.
