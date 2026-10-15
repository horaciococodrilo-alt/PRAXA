# M16.1 — QA y verificación final 1

- **Fecha:** 2026-10-14
- **Commit revisado:** `72ab9227fc6a22d498ed85ad4aac46be18026afd` (`mf/M16.1`)
- **Base (merge-base con `main`):** `609ea2989403682bc6772f5c2401213f0474b37c`
- **Revisión de implementación de referencia:** `implementation-review-1.md`, APROBABLE, mismo commit y misma base
- **Revisor:** asistente, como QA independiente. No se corrigió código ni documentación, no se hicieron commits ni push y no se ejecutó ningún `db:push`.

## Veredicto

**LISTO PARA PR.** Los 31 criterios operativos y los heredados (CA-28 a CA-34 con CA-29b dividida, CA-39, CA-09, CA-26, CA-02b, CA-02c, CA-04, CA-35 primera oración, CB-01 a CB-06) se cumplen. `npm run verify` y `npm run test:app` están en verde, con solo las omitidas que admite CB-06 precisada. Las 100 pruebas exploratorias (78 unitarias, 18 de componente y 4 contra la base desechable) pasaron. No hay hallazgos que exijan cambios; quedan tres observaciones informativas.

## Precondiciones

| Precondición | Resultado |
|---|---|
| Rama `mf/M16.1` | Sí |
| Última revisión de implementación APROBABLE | Sí: `implementation-review-1.md` |
| Commit revisado = `git rev-parse HEAD` | Sí: `72ab922…` en los dos |
| Base = `git merge-base main HEAD` | Sí: `609ea29…` en los dos |
| Árbol limpio, salvo informes de revisión | Sí: el comando del paso 1 no devolvió nada al inicio ni al final. Al inicio, el único archivo sin seguimiento era `revisiones/implementation-review-1.md`, excluido por ruta |
| `npm run db:check:test` antes de tocar la base | `Destino verificado.` (refs coinciden, confirmación de desechable presente, rol de C presente). Repetido justo antes de la exploratoria con base, con el mismo resultado. El ref no se copia acá |

## Matriz de comportamiento

Los casos salen de la spec de M16.1 (Diseño §2 a §8, criterios C-01 a C-31 y T-01 a T-43) y de los CA de la ruta. "QA-U" son exploratorias unitarias, "QA-C" de componente y "QA-A" contra la base desechable (código abajo). P = positivo, N = negativo, B = borde.

| Criterio | Caso | Tipo | Cubierto por | Resultado |
|---|---|---|---|---|
| C-01 (II.9.1) | `v26.0` solo en `meta/api.ts`; URLs de Graph y diálogo con `/v26.0/` | P | T-01 | Pasa |
| C-01 | Un segundo literal de versión en `src/` | N | T-01 (recorrido de `src/`) | Pasa |
| C-01 | Borde | B | No aplica: el criterio es un recorrido del árbol sin valores intermedios | — |
| C-02 (CA-28) | Conjunto exacto de 6 parámetros, origen `www.facebook.com` | P | T-02 | Pasa |
| C-02 | `scope` presente | N | T-02 | Pasa |
| C-02 | Borde | B | No aplica: conjunto cerrado de parámetros, sin rango | — |
| C-03 | Configuración válida, `http` en `localhost` y `127.0.0.1` | P | T-03 | Pasa |
| C-03 | Cada `META_*` ausente o inválida; consulta, fragmento, otra ruta, `http` no local, credenciales | N | T-03 | Pasa |
| C-03 | URI con `?` o `#` vacíos, `/` final, `localhost.evil.test`, `[::1]`, `ftp:`, ID con espacio inicial, ID de 33 dígitos, `config_id` no numérico; los cuatro faltantes juntos; el secreto no aparece al serializar | B | QA-U "C-03" (11 casos) | Pasa |
| C-04 (CA-30) | `META_APP_SECRET` solo en `api.ts`; seis módulos con `server-only` | P | T-04, T-36 | Pasa |
| C-04 | `NEXT_PUBLIC_META` en `src/` | N | T-04 | Pasa |
| C-04 | Borde | B | No aplica: propiedad estática del árbol | — |
| C-05 (CA-39) | Tabla completa caso por caso; estado HTTP 200/403/500 indiferente | P | T-05 | Pasa |
| C-05 | `asset_access` nunca; códigos fuera de tabla → `unknown` | N | T-05 | Pasa |
| C-05 | 190 con `error_subcode: null` (→ `authentication`, como ausente); código 2147483648, -1, 190.5, `'190'`, 0, 199, 300; subcódigo `'460'`; `error` como arreglo | B | QA-U "C-05" (10 casos) | Pasa |
| C-06 (CA-39) | `redirect: 'error'`, `cache: 'no-store'`, `signal` | P | T-06 | Pasa |
| C-06 | Red caída, timeout, `<html>` → `transport`; 500 con `{}` → `unknown` | N | T-06 | Pasa |
| C-06 | 200 con objeto `error` → clasificado; 400 con `error` cadena → `unknown`; 200 con `null`; cuerpo vacío → `transport` | B | QA-U "C-15/C-16" (4 de 8 casos) | Pasa |
| C-07 (CA-09, CA-26) | Plantilla exacta `Graph 190/460: …`; textos invariantes bajo redacción | P | T-07 | Pasa |
| C-07 | Texto libre de Meta con URL, `clave=valor`, `Bearer`, valores sueltos y `act_`; sin `cause` | N | T-07 | Pasa |
| C-07 | Código como cadena igual al token | B | T-07 | Pasa |
| C-08 (CA-28, CA-02c) | Sin conexión → `initial`; `active`/`needs_reauth` → `reauth` con su id | P | T-08, T-09, T-25, T-32 | Pasa |
| C-08 | `initial` directo con conexión viva → `LiveConnectionExistsError`; carrera → `conexion_existente` | N | T-32, T-11 | Pasa |
| C-08 | Lectura de conexión que falla y `create_oauth_attempt` no disponible → `error` sin cookie de vinculación con valor ni redirección a Meta | B | QA-U "C-08" (2 casos) | Pasa |
| C-09 (CA-01, CA-02b) | Atributos exactos de la cookie, `Max-Age=540`, sin `Domain`; 43 caracteres; solo SHA-256 a la base | P | T-08, T-25 | Pasa |
| C-09 | `state` igual al nonce | N | T-08 | Pasa |
| C-09 | Borde | B | No aplica: tamaños fijos (32 bytes); el borde de longitud se cubre del lado del callback (C-13) | — |
| C-10 (CA-04, CA-02) | `return_path` validado antes de la base; vencimiento ≤ 540 s | P | T-08 | Pasa |
| C-10 | Vencimiento por encima del tope de la base | N | QA-A03 (reloj adelantado 2 min → la base rechaza, `meta=error`, sin cookie con valor ni conexión) | Pasa |
| C-10 | Margen de 9 min frente al tope de 10 min con el reloj real | B | T-25 a T-34 (todas crean intentos reales) | Pasa |
| C-11 | `POST` con `Origin` propio | P | T-08 | Pasa |
| C-11 | Sin `Origin` u otro origen → 403 sin K01; sin sesión, sin empresa, sin configuración; `route.ts` sin `GET` | N | T-11 | Pasa |
| C-11 | `Origin` `"null"`, mismo host con `http`, otro puerto, subdominio, con `/` final → 403 sin K01; K01 con error genérico → `error`; `iniciar` exporta solo `POST` y `callback` solo `GET` | B | QA-U "C-11" (6 casos) y "métodos exportados" (1) | Pasa |
| C-12 (CA-30) | `303` exacto, `no-referrer`, `no-store`, cookie con `Max-Age=0` | P | T-12, T-15, T-35 | Pasa |
| C-12 | Sin sesión → login y nada más | N | T-12 | Pasa |
| C-12 | K01 con error genérico, consumo no disponible (sin reintento ni Meta), parámetros extra (`foo`, `error_description`, `meta=error`) en un callback exitoso, configuración inválida tras consumir → `Location` con solo `meta` | B | QA-U "C-12" (4 casos) | Pasa |
| C-13 (CA-29, CA-03) | Callback válido consume una vez | P | T-16, T-25 | Pasa |
| C-13 | `state`/cookie ausentes o mal formados, sin `code`; desconocido, vencido, consumido, otro actor, otra empresa, otro nonce | N | T-12, T-13, T-26 a T-31 | Pasa |
| C-13 | `state` de 257 y de 42 caracteres, con `+`, cookie de 257, `code=` vacío → `rechazado` sin base ni Meta; `state` de 256 sí llega al consumo; `state` y cookie de dos intentos propios cruzados → `rechazado` sin gastar ninguno | B | QA-U "C-13" (6 casos), QA-A04 | Pasa |
| C-14 (CA-34) | Cancelación con `state` y cookie → consume y `cancelado` | P | T-14; QA-A01 (en la base: el intento queda gastado y el callback siguiente da `rechazado`) | Pasa |
| C-14 | Sin `state` → `cancelado` sin consumir; consumo que falla → igual `cancelado` | N | T-14 | Pasa |
| C-14 | `state` válido sin cookie → `cancelado` sin consumir (y en la base el intento sigue utilizable); `error` junto con `code` → consume una vez sin canje; `error=` vacío → `cancelado` | B | QA-U "C-14" (3 casos), QA-A02 | Pasa |
| C-15 (`H-E1-24`) | Orden consumo → canje → `debug_token` → `/me` → pendiente | P | T-16 | Pasa |
| C-15 | Consumo que falla → nada más | N | T-16 | Pasa |
| C-15 | Fallo en cada etapa posterior al canje corta la secuencia sin pendiente | B | QA-U "C-15/C-16" (8 casos) | Pasa |
| C-16 (CA-30, CA-33) | `client_secret` solo hacia Graph; un canje por callback | P | T-07, T-19, T-28 | Pasa |
| C-16 | Canje rechazado no se reintenta por `GET` | N | T-40 | Pasa |
| C-16 | Fallos de `debug_token` y `/me` con un único canje | B | QA-U "C-17" y "C-15/C-16" | Pasa |
| C-17 (CA-31, CA-32) | `app_id` numérico igual al de la app se acepta | P | QA-U "C-17" | Pasa |
| C-17 | Sin `ads_read`, inválido, otra app, `USER`, tipo ausente, `/me` sin negocio | N | T-17, T-34 | Pasa |
| C-17 | `is_valid` `"true"` o `1`, `scopes` cadena o en mayúsculas, `type` en minúsculas, sin `data`, negocio con espacio, de 65 caracteres o numérico → sin pendiente | B | QA-U "C-17" (9 casos) | Pasa |
| C-18 (CA-31) | Epoch exacto, `system_user`, app, permisos | P | T-18, T-20, T-25 | Pasa |
| C-18 | `0`, ausente → `null` | N | T-18 | Pasa |
| C-18 | `NaN`, `Infinity`, cadena, `1e20`, negativo, año fuera de rango ISO | B | T-18 | Pasa |
| C-19 (CA-35, CA-10) | `pending_selection`, metadatos nulos, 30 ± 2 min, descifra al token | P | T-25 | Pasa |
| C-19 | Cifrado distinto del token | N | T-25 | Pasa |
| C-19 | Tolerancia de ±2 min | B | T-25 | Pasa |
| C-20 (CA-33) | Primer callback `pendiente` | P | T-28 | Pasa |
| C-20 | Segundo callback idéntico → `rechazado`, un canje, una conexión | N | T-28 | Pasa |
| C-20 | Dos intentos `initial` vigentes de la misma empresa: el segundo termina en `conexion_existente` con una sola conexión | B | QA-A04 | Pasa |
| C-21 (CA-29b enmendada) | Misma conexión y generación → `reautorizacion_no_disponible`, sin Meta | P | T-21, T-33 | Pasa |
| C-21 | Sin conexión, otra conexión u otra generación → `credencial_cambio` | N | T-21, T-33 | Pasa |
| C-21 | Lectura que falla → `error` sin Meta; configuración inválida no afecta `reauth`; misma id en `pending_selection` (inalcanzable en la práctica) | B | QA-U "C-21" (3 casos) | Pasa (ver O-03) |
| C-22 (`H-E1-21`) | Con pendiente → `pendiente_vigente`, intacta | P | T-10, T-32 | Pasa |
| C-22 | Sin intento, purga ni revocación | N | T-10 | Pasa |
| C-22 | Borde | B | No aplica en M16.1: la pendiente vencida sin purgar es un límite declarado (Diseño §6.1, paso 4), asignado a M16.2 | — |
| C-23 (CA-26) | Callback exitoso sin datos sensibles en encabezados, cuerpo ni consola | P | T-15 | Pasa |
| C-23 | Registro por defecto (consola) en caminos de fallo: canje con texto libre que contiene token, código y secreto; `debug_token` sin `ads_read`; `/me` sin negocio → solo claves permitidas, sin secretos, hashes, negocio ni URL de Graph | N | QA-U "C-23" (3 casos) | Pasa |
| C-23 | Borde | B | No aplica: formato fijo, sin valores intermedios | — |
| C-24 | Transporte o timeout → un reintento idéntico | P | T-20 | Pasa |
| C-24 | Dos fallos → `error`; `PX003` sin reintento | N | T-20 | Pasa |
| C-24 | `unavailable/other`, `not_authorized`, error genérico → sin reintento; timeout y luego `PX003` → `conexion_existente` con dos intentos | B | QA-U "C-24" (4 casos) | Pasa |
| C-25 (CA-29, CA-34) | `cancelado` → `status`; `error` → `alert`; cada uno de los 12 resultados muestra exactamente su texto y un solo aviso | P | T-22, T-23, QA-C (12 casos) | Pasa |
| C-25 | Desconocido, repetido o ausente sin aviso; parámetros de la URL no se muestran; sin sesión rechaza antes de leer | N | T-22, T-23 | Pasa |
| C-25 | HTML inyectado, mayúsculas, espacio final, arreglo de un elemento, `constructor`, vacío → sin aviso; "Conectar" deshabilitado en los 12 | B | QA-C (6 casos más) | Pasa (ver O-02) |
| C-26 (CB-06) | Corrida con configuración → 10/10 sin omitidas | P | T-43 (reejecutada acá) | Pasa |
| C-26 | URL del rol inválida → el archivo falla | N | T-24; comprobado por ejecución en `implementation-review-1` | Pasa |
| C-26 | Borde | B | No aplica: guarda binaria | — |
| C-27 (CA-12) | Fixtures de menos de 20 caracteres; guardas del árbol en verde | P | T-36, T-38 | Pasa |
| C-27 | Fixture con forma real | N | `no-secrets-in-tree` dentro de `verify` | Pasa |
| C-27 | Borde | B | No aplica en QA: las exploratorias usaron los mismos valores sintéticos y se borraron | — |
| C-28 (CB-01, CB-06) | `verify` exit 0; `test:app` exit 0 | P | T-37, T-43 (reejecutadas acá) | Pasa |
| C-28 | Omitida de `meta-oauth` o de suite positiva | N | Conteo por archivo (abajo) | Pasa |
| C-28 | Omitidas ajenas admitidas | B | 7 omitidas: `email-flows` 3 (opt-in) y un bloque `NO EJECUTADA` en `concurrency`, `integrations-data-api`, `isolation` y `onboarding` | Pasa |
| C-29 | Documentos según Diseño §11 | P/N | T-39 (manual), revisado en `implementation-review-1` | Pasa |
| C-29 | Borde | B | No aplica: revisión documental | — |
| C-30 | Solo `api.ts` lee `META_*` y tiene `server-only`; sin autorización real | P/N | T-41; la sesión no registra autorización real | Pasa |
| C-30 | Borde | B | No aplica: propiedad estática y de evidencia | — |
| C-31 (INV-06, D-M16.1-08) | Canje y `debug_token` por `POST` sin consulta; `/me` con `Bearer` y solo `fields` | P | T-40, T-42 | Pasa |
| C-31 | Parámetros prohibidos, otro origen, credenciales, token bajo `fields`, en la ruta o en el fragmento | N | T-42 | Pasa |
| C-31 | Parámetro prohibido escondido en el argumento `path` de `graphUrl` (lo frena el cliente antes de `fetch`); `http:` al host de Graph, host parecido, `www.facebook.com`; secreto en la ruta de un `POST`; token con todos sus caracteres codificados; `access%5Ftoken` | B | QA-U "C-31" (7 casos) | Pasa |
| CB-02 | Sin secretos ni identificadores reales en el diff | N | T-38 y búsqueda por patrón de `implementation-review-1` | Pasa |
| CB-03 | Sin migraciones modificadas | N | `git diff --name-status BASE HEAD -- supabase/` vacío (`implementation-review-1`) | Pasa |
| CB-04 | Ninguna prueba contra producción | N | `db:check:test` antes de cada corrida con base | Pasa |
| CB-05 | Evidencia con comandos y resultados reales | P | `sesiones/M16.1.md` | Pasa |

## Pruebas exploratorias

| Archivo temporal | Dónde corrió | Comando | Archivos | Pruebas | Resultado |
|---|---|---|---|---|---|
| `tests/unit/__qa__/m161-qa.test.ts` | Worktree `../praxa-qa-M16.1` desacoplado en `72ab922`, con `npm ci` | `npm run test:unit -- tests/unit/__qa__/m161-qa.test.ts` | 1 | 78 | 78 pasan |
| `tests/component/__qa__/m161-aviso-qa.test.tsx` | Mismo worktree | `npm run test:component -- tests/component/__qa__/m161-aviso-qa.test.tsx` | 1 | 18 | 18 pasan |
| `tests/app/__qa__/m161-qa-app.test.ts` | Directorio del usuario, después de `db:check:test` | `npx vitest run --project app tests/app/__qa__/m161-qa-app.test.ts --reporter=verbose` | 1 | 4 | 4 pasan (QA-A01 a QA-A04) |

Los conteos coinciden con lo escrito: 78 = 6 (C-11) + 2 (C-08) + 6 (C-13) + 3 (C-14) + 4 (C-12) + 10 (C-17) + 8 (C-15/C-16) + 3 (C-23) + 4 (C-24) + 3 (C-21) + 10 (C-05) + 11 (C-03) + 7 (C-31) + 1 (métodos); 18 = 12 resultados + 6 entradas hostiles.

**Borrado.** `tests/app/__qa__/` se borró del directorio del usuario y el worktree se eliminó con `git worktree remove --force ../praxa-qa-M16.1`. `git worktree list` muestra solo `C:/Users/Simon/dev/PRAXA`, el directorio `../praxa-qa-M16.1` no existe y el comando de árbol limpio del paso 1 sigue sin devolver nada.

Ningún caso exploratorio falló, así que ninguno es hallazgo. Si se quiere fortalecer la suite permanente, los candidatos de más valor son QA-A01 (la cancelación gasta el intento en la base), QA-A04 (estados cruzados de dos intentos propios), el bloque C-23 en caminos de fallo y el bloque C-31 con el parámetro escondido en `path`. Es opcional y no bloquea.

El código de cada prueba está en el anexo, al final de este informe.

## Verificación

En el directorio del usuario, sin modificar archivos rastreados:

| Comando | Resultado |
|---|---|
| `npm run db:check:test` | `Destino verificado.` (dos veces) |
| `npm run verify` | **exit 0**: lint, typegen, typecheck, 23 archivos y 510 pruebas (`unit` y `component`), build con `ƒ /api/integraciones/meta/callback` y `ƒ /api/integraciones/meta/iniciar` |
| `npx vitest run --project app --reporter=verbose` (equivale a `npm run test:app` con detalle) | **exit 0**: 8 archivos, 48 pasadas y 7 omitidas (55) |

`test:app` por archivo:

| Archivo | Pasadas | Omitidas | Motivo |
|---|---:|---:|---|
| `closure-storage.test.ts` | 1 | 0 | — |
| `concurrency.test.ts` | 6 | 1 | `NO EJECUTADA: falta el proyecto remoto de pruebas` (bloque complementario, se omite por diseño con configuración) |
| `email-flows.test.ts` | 1 | 3 | Opt-in de correo, ajeno a M16.1 |
| `integrations-data-api.test.ts` | 6 | 1 | Bloque `NO EJECUTADA` |
| `integrations-worker-api-client.test.ts` | 8 | 0 | — |
| `isolation.test.ts` | 9 | 1 | Bloque `NO EJECUTADA` |
| `meta-oauth.test.ts` | 10 | 0 | — |
| `onboarding.test.ts` | 7 | 1 | Bloque `NO EJECUTADA` |

Coincide archivo por archivo con la sesión y con `implementation-review-1`. Ninguna prueba de `meta-oauth.test.ts` ni suite positiva se omitió (CB-06 precisada). `test:policies`, `db:push:test` y `db:push` no aplican: no hay migración ni pgTAP. Vitest cargó las suites desde Git Bash sin problemas (`H-E1-20` no se repitió).

## Requisitos, separados por etapa

| Requisito | Origen | Etapa | Estado |
|---|---|---|---|
| CA-28 a CA-34 con CA-29b dividida, y los criterios C-01 a C-31 | Ficha, "Criterio de aceptación"; spec de M16.1 | PR | Cumplido |
| `npm run verify` en verde | III.3; C-28 | PR | Cumplido (exit 0) |
| `npm run test:app` en verde, sin omitidas requeridas | III.3; CB-06 precisada | PR | Cumplido (exit 0; 7 omitidas admitidas) |
| `db:check:test` antes de las suites con base | Spec, "Verificación" | PR | Cumplido |
| "Pruebas en verde" (evidencia de cierre) | Ficha | PR | Cumplido; registrado en `sesiones/M16.1.md` |
| Sin autorización real ni datos reales en la evidencia | Ficha; C-30; D-M16.1-06 | PR | Cumplido |
| Revisión de Codex sin bloqueantes | Proceso | Merge | Pendiente (usuario) |
| CI (`verify.yml`, solo `npm run verify`) en verde | Proceso | Merge | Pendiente; local en verde |
| Merge, push y despliegue en Vercel (`Ready`) | Plan, paso 14 | Gate | Pendiente (usuario) |
| En producción, sin autorización real: `GET /api/integraciones/meta/iniciar` → 405, `POST` sin `Origin` → 403, "Conectar" deshabilitado; registrar en la sesión, redactado | Plan, paso 14; C-11, C-25 | Gate | Pendiente (usuario). Guion abajo |
| Confirmar la actualización de los encabezados de la ruta hecha por el asistente a pedido del usuario (R-01 de `implementation-review-1`) | Plan, "Intervenciones", paso 1 | Gate | Pendiente (usuario) |
| Aprobación visible de `G-OAUTH` | Ficha, "Condición para avanzar"; plan, paso 15 | Gate | Pendiente (usuario) |
| Actualizar `PROJECT_STATE.md` (cierre de M16.1, `G-OAUTH`, siguiente habilitada `M16.2`) | Plan, paso 15 | Gate, después de aprobar | Pendiente |
| Ninguna autorización real en el piloto hasta `M16.2` y `G-ACTA-META` | D-M16.1-06; III.2 | Continuo | Vigente |
| `db:push` al proyecto `app` | Plan, paso 13 | — | No aplica: sin migraciones |

**Consistencia de los documentos de estado.** `PROJECT_STATE.md` no cambió en la rama (el plan solo lo permite después de `G-OAUTH`) y contiene solo estado. Dice que M16.1 está "sin empezar", lo que ya no describe el trabajo en curso; el plan lo admite hasta el gate (ver O-01). La sesión termina en `VERIFICADO — PENDIENTE DE APROBACIÓN`, coherente con este resultado, y no declara aprobado `G-OAUTH`.

## Guion manual (paso 14, usuario, después del despliegue)

Sin datos reales, sin iniciar sesión con Meta y sin completar ninguna autorización.

| # | Paso | Resultado esperado | Qué capturar (redactado) |
|---|---|---|---|
| 1 | En Vercel, abrir el despliegue de producción del merge | Estado `Ready` | Estado y hash corto del commit; sin URLs privadas ni variables |
| 2 | Abrir en el navegador `https://<dominio del piloto>/api/integraciones/meta/iniciar` (es un `GET`) | `405 Method Not Allowed` | Código de estado de la pestaña de red |
| 3 | Desde una terminal: `curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<dominio del piloto>/api/integraciones/meta/iniciar` (sin `Origin`) | `403` | Solo el código impreso |
| 4 | Opcional: el mismo `curl` con `-H "Origin: https://otro.example"` | `403` | Solo el código |
| 5 | Iniciar sesión con la cuenta de prueba propia y abrir `/app/integraciones` | "Conectar" deshabilitado en la tarjeta de Meta Ads; sin aviso | Captura de la tarjeta, sin datos de la empresa |
| 6 | Abrir `/app/integraciones?meta=cancelado` y luego `?meta=<b>x</b>` | El primero muestra "Cancelaste la conexión con Meta…"; el segundo no muestra aviso ni HTML | Captura del aviso |
| 7 | Registrar los resultados de 1 a 6 en `sesiones/M16.1.md`, sin dominio, ref ni identificadores | — | — |

No hacer `POST` con el `Origin` propio desde la sesión: eso redirigiría al diálogo real de Meta.

## Hallazgos

No hay hallazgos que exijan cambios. Observaciones informativas:

| ID | Severidad | Criterio | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| Q-01 (O-01) | informativa | Contrato documental | `PROJECT_STATE.md` dice que M16.1 está "sin empezar" mientras la rama está verificada | `docs/PROJECT_STATE.md`, "Siguiente habilitada"; el plan (paso 15) solo permite editarlo después de `G-OAUTH` | Ninguna antes del gate; al aprobar `G-OAUTH`, actualizarlo como dice el paso 15 |
| Q-02 (O-02) | informativa | C-25 | El Diseño §8 dice "`role="alert"` para `error`". La implementación usa `alert` para todo resultado de tono `error` (7 de 12: `rechazado`, `permiso_faltante`, `token_no_valido`, `credencial_cambio`, `sin_empresa`, `meta_no_disponible`, `error`) y `status` para el resto. T-23 solo fija `cancelado` y `error` | QA-C, 12 casos | Ninguna: es una lectura razonable de la spec y no afecta seguridad. Si el usuario quiere la lectura literal (solo `error`), es un cambio de una línea en una microfase posterior |
| Q-03 (O-03) | informativa | C-21 | Si en el camino `reauth` la conexión viva tuviera el id y la generación esperados pero estado `pending_selection`, el resultado sería `reautorizacion_no_disponible`, porque se comparan id y generación, no el estado. Es inalcanzable: una conexión no vuelve de `active` a `pending_selection`, y `reauth` exige `active` o `needs_reauth` | QA-U "C-21" | Ninguna en M16.1. `M16.2` reemplaza este paso por `replace_credential`, que vuelve a validar en la base |

Ninguna observación es nueva respecto de `docs/HALLAZGOS.md` en un sentido que exija un ID estable: Q-01 es el procedimiento normal del gate, y Q-02 y Q-03 no cambian el comportamiento exigido.

## Pendientes del usuario

1. Push de `mf/M16.1` y apertura del PR con `revisiones/pr.md`.
2. Esperar la revisión de Codex y la CI; resolver cualquier bloqueante antes del merge.
3. Merge y despliegue; ejecutar el guion manual del paso 14 y registrarlo en la sesión.
4. Confirmar R-01 (encabezados de la ruta) y aprobar `G-OAUTH` de forma visible; después, actualizar `PROJECT_STATE.md`.
5. No completar ninguna autorización real en el piloto hasta `M16.2` y `G-ACTA-META`.

## Comprobaciones finales

- `git rev-parse HEAD`: `72ab9227fc6a22d498ed85ad4aac46be18026afd`, sin cambios durante la revisión.
- `git merge-base main HEAD`: `609ea2989403682bc6772f5c2401213f0474b37c`.
- El comando de árbol limpio del paso 1 no devuelve nada (este informe y `pr.md` quedan excluidos por ruta).
- `git worktree list`: solo `C:/Users/Simon/dev/PRAXA`.

## Anexo: código de las pruebas exploratorias

Copiado antes de borrarlas. Valores sintéticos de menos de 20 caracteres, sin datos reales.

### `tests/unit/__qa__/m161-qa.test.ts` (78 pruebas, todas pasan)

```ts
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TenantContext } from '@/modules/tenant/context';

/**
 * QA M16.1 (temporal, se borra): casos de borde y negativos derivados de la spec que la
 * suite permanente no cubre. Solo interfaz pública. Valores sintéticos de menos de 20
 * caracteres.
 */

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const APP_ID = '1234567';
const CONFIG_ID = '7654321';
const SECRET = 'secreto-sint';
const CODE = 'codigo-sint';
const TOKEN = 'token-sint-meta';
const BUSINESS = 'negocio_sintetico';
const ORIGIN = 'https://praxa.test';
const REDIRECT_URI = `${ORIGIN}/api/integraciones/meta/callback`;
const COOKIE = '__Host-praxa_oauth_binding';
const NOW = new Date('2026-10-14T12:00:00.000Z');
const CONNECTION_ID = '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a';

const CTX: TenantContext = Object.freeze({
  user_id: '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d',
  company_id: '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f',
  role: 'owner',
  request_id: '7c6b5a49-3827-4165-a4b3-c2d1e0f9a8b7',
});

const api = await import('@/modules/integrations/meta/api');
const errors = await import('@/modules/integrations/meta/errors');
const client = await import('@/modules/integrations/meta/client');
const oauth = await import('@/modules/integrations/meta/oauth');
const { WorkerApiError } = await import('@/modules/integrations/db/worker-api');
const { parseCredentialKeyring } = await import('@/modules/integrations/crypto/keyring');
const { SecretValue } = await import('@/modules/integrations/crypto/seal');

type MetaFetch = import('@/modules/integrations/meta/client').MetaFetch;
type MetaOAuthDeps = import('@/modules/integrations/meta/oauth').MetaOAuthDeps;
type WorkerApi = import('@/modules/integrations/db/worker-api').WorkerApi;

const ENV = {
  META_APP_ID: APP_ID,
  META_APP_SECRET: SECRET,
  META_REDIRECT_URI: REDIRECT_URI,
  META_CONFIG_ID: CONFIG_ID,
};
const CONFIG = api.readMetaOAuthConfig(ENV as unknown as NodeJS.ProcessEnv);
const KEYRING = parseCredentialKeyring(`1:${randomBytes(32).toString('base64')}`, '1');
const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const state43 = () => randomBytes(32).toString('base64url');
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type Responder = () => Response | Promise<Response>;
const DEFAULTS: Record<string, Responder> = {
  '/v26.0/oauth/access_token': () => json({ access_token: TOKEN }),
  '/v26.0/debug_token': () =>
    json({ data: { is_valid: true, app_id: APP_ID, type: 'SYSTEM_USER', scopes: ['ads_read'], expires_at: 0 } }),
  '/v26.0/me': () => json({ id: '9876543', client_business_id: BUSINESS }),
};

function fakeMeta(overrides: Record<string, Responder> = {}) {
  const calls: string[] = [];
  const responses = { ...DEFAULTS, ...overrides };
  const fetch: MetaFetch = async (input) => {
    const url = new URL(input);
    calls.push(url.pathname);
    const responder = responses[url.pathname];
    return responder ? responder() : json({ error: { code: 803 } }, 404);
  };
  return { fetch, calls, http: client.createMetaHttpClient({ fetch }) };
}

type Handler = (args: readonly unknown[]) => unknown[] | Promise<unknown[]>;
function consumed(purpose: 'initial' | 'reauth' = 'initial', generation: number | null = null) {
  return {
    attempt_id: randomUUID(),
    purpose,
    expected_connection_id: purpose === 'reauth' ? CONNECTION_ID : null,
    expected_generation: purpose === 'reauth' ? generation : null,
    return_path: '/app/integraciones',
  };
}
function fakeWorker(overrides: Partial<Record<string, Handler>> = {}) {
  const calls: Array<{ fn: string; args: readonly unknown[] }> = [];
  const handlers: Record<string, Handler> = {
    create_oauth_attempt: (args) => [
      {
        attempt_id: randomUUID(),
        purpose: args[2],
        expected_connection_id: args[7] ?? null,
        expected_generation: args[2] === 'reauth' ? 3 : null,
        created_at: new Date(NOW),
        expires_at: new Date(String(args[6])),
      },
    ],
    consume_oauth_attempt: () => [consumed()],
    create_pending_connection: (args) => [
      {
        connection_id: args[2],
        status: 'pending_selection',
        pending_expires_at: new Date(NOW.getTime() + 30 * 60_000),
        credential_generation: 0,
      },
    ],
    ...overrides,
  };
  const workerApi: WorkerApi = {
    call: (async (fn: string, args: readonly unknown[]) => {
      calls.push({ fn, args });
      const handler = handlers[fn];
      if (!handler) throw new Error(`no esperada: ${fn}`);
      return handler(args);
    }) as WorkerApi['call'],
  };
  return { workerApi, calls, fns: () => calls.map((c) => c.fn) };
}

let logs: unknown[] = [];
function deps(meta: ReturnType<typeof fakeMeta>, worker: ReturnType<typeof fakeWorker>, over: Partial<MetaOAuthDeps> = {}) {
  return {
    tenant: async () => CTX,
    config: () => CONFIG,
    http: meta.http,
    workerApi: worker.workerApi,
    keyring: KEYRING,
    readLiveConnection: async () => null,
    now: () => new Date(NOW),
    log: (event: unknown) => logs.push(event),
    ...over,
  } as Partial<MetaOAuthDeps>;
}

function startRequest(origin: string | null) {
  const headers = new Headers();
  if (origin !== null) headers.set('origin', origin);
  return new NextRequest(`${ORIGIN}/api/integraciones/meta/iniciar`, { method: 'POST', headers });
}
function callbackRequest(query: string, nonce?: string) {
  const headers = new Headers();
  if (nonce !== undefined) headers.set('cookie', `${COOKIE}=${nonce}`);
  return new NextRequest(`${REDIRECT_URI}?${query}`, { headers });
}
const RESULT = (o: string) => `${ORIGIN}/app/integraciones?meta=${o}`;

function expectClean(response: Response) {
  expect(response.status).toBe(303);
  const location = new URL(response.headers.get('location') ?? '');
  expect([...location.searchParams.keys()]).toEqual(['meta']);
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('set-cookie') ?? '').toMatch(/Max-Age=0/i);
}

const noBindingValue = (response: Response) =>
  expect(response.headers.get('set-cookie') ?? '').not.toMatch(new RegExp(`${COOKIE}=[^;]+`));

beforeEach(() => {
  logs = [];
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// C-11: barreras del inicio
// ---------------------------------------------------------------------------

describe('QA C-11: Origin no propio', () => {
  it.each(['null', 'http://praxa.test', 'https://praxa.test:8443', 'https://sub.praxa.test', 'https://praxa.test/'])(
    'Origin %j → 403 sin K01',
    async (origin) => {
      const tenant = vi.fn(async () => CTX);
      const worker = fakeWorker();
      const response = await oauth.handleMetaStart(startRequest(origin), deps(fakeMeta(), worker, { tenant }));
      expect(response.status).toBe(403);
      expect(tenant).not.toHaveBeenCalled();
      expect(worker.calls).toEqual([]);
      noBindingValue(response);
    },
  );

  it('K01 con otro error → error sin intento', async () => {
    const worker = fakeWorker();
    const response = await oauth.handleMetaStart(
      startRequest(ORIGIN),
      deps(fakeMeta(), worker, { tenant: async () => { throw new Error('x'); } }),
    );
    expect(response.headers.get('location')).toBe(RESULT('error'));
    expect(worker.calls).toEqual([]);
    noBindingValue(response);
  });
});

describe('QA C-08: fallos del inicio no emiten cookie ni redirigen a Meta', () => {
  it('readLiveConnection falla → error, sin intento', async () => {
    const worker = fakeWorker();
    const response = await oauth.handleMetaStart(
      startRequest(ORIGIN),
      deps(fakeMeta(), worker, { readLiveConnection: async () => { throw new Error('rls'); } }),
    );
    expect(response.headers.get('location')).toBe(RESULT('error'));
    expect(worker.calls).toEqual([]);
    noBindingValue(response);
  });

  it('create_oauth_attempt no disponible → error, sin cookie', async () => {
    const worker = fakeWorker({
      create_oauth_attempt: () => { throw new WorkerApiError('unavailable', 'transport'); },
    });
    const response = await oauth.handleMetaStart(startRequest(ORIGIN), deps(fakeMeta(), worker));
    expect(response.headers.get('location')).toBe(RESULT('error'));
    expect(worker.fns()).toEqual(['create_oauth_attempt']);
    noBindingValue(response);
  });
});

// ---------------------------------------------------------------------------
// C-12 a C-14: callback
// ---------------------------------------------------------------------------

describe('QA C-13: state, cookie y código en el borde', () => {
  const valid = state43();
  const cases: Array<[string, string, string | undefined]> = [
    ['state de 257 caracteres', `state=${'a'.repeat(257)}&code=${CODE}`, state43()],
    ['state con un carácter fuera de base64url', `state=${valid.slice(0, 42)}%2B&code=${CODE}`, state43()],
    ['state de 42 caracteres', `state=${valid.slice(0, 42)}&code=${CODE}`, state43()],
    ['cookie de 257 caracteres', `state=${valid}&code=${CODE}`, 'a'.repeat(257)],
    ['code vacío', `state=${valid}&code=`, state43()],
  ];
  it.each(cases)('%s → rechazado sin base ni Meta', async (_n, query, nonce) => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const response = await oauth.handleMetaCallback(callbackRequest(query, nonce), deps(meta, worker));
    expectClean(response);
    expect(response.headers.get('location')).toBe(RESULT('rechazado'));
    expect(worker.calls).toEqual([]);
    expect(meta.calls).toEqual([]);
  });

  it('state de 256 caracteres válido llega al consumo (borde superior admitido)', async () => {
    const worker = fakeWorker({ consume_oauth_attempt: () => { throw new WorkerApiError('attempt_rejected'); } });
    const response = await oauth.handleMetaCallback(
      callbackRequest(`state=${'a'.repeat(256)}&code=${CODE}`, state43()),
      deps(fakeMeta(), worker),
    );
    expect(response.headers.get('location')).toBe(RESULT('rechazado'));
    expect(worker.fns()).toEqual(['consume_oauth_attempt']);
  });
});

describe('QA C-14: cancelación', () => {
  it('error con state válido pero sin cookie → cancelado sin consumir', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const response = await oauth.handleMetaCallback(
      callbackRequest(`error=access_denied&state=${state43()}`),
      deps(meta, worker),
    );
    expectClean(response);
    expect(response.headers.get('location')).toBe(RESULT('cancelado'));
    expect(worker.calls).toEqual([]);
    expect(meta.calls).toEqual([]);
  });

  it('error junto con code, state y cookie → cancelado, consume una vez, sin canje', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const state = state43();
    const nonce = state43();
    const response = await oauth.handleMetaCallback(
      callbackRequest(`error=access_denied&code=${CODE}&state=${state}`, nonce),
      deps(meta, worker),
    );
    expect(response.headers.get('location')).toBe(RESULT('cancelado'));
    expect(worker.fns()).toEqual(['consume_oauth_attempt']);
    expect(worker.calls[0].args.slice(2)).toEqual([sha256(state), sha256(nonce)]);
    expect(meta.calls).toEqual([]);
  });

  it('error vacío (presente) → cancelado', async () => {
    const meta = fakeMeta();
    const response = await oauth.handleMetaCallback(callbackRequest('error='), deps(meta, fakeWorker()));
    expect(response.headers.get('location')).toBe(RESULT('cancelado'));
    expect(meta.calls).toEqual([]);
  });
});

describe('QA C-12: errores no previstos en el callback', () => {
  it('K01 con otro error → error limpio, sin consumir', async () => {
    const worker = fakeWorker();
    const response = await oauth.handleMetaCallback(
      callbackRequest(`state=${state43()}&code=${CODE}`, state43()),
      deps(fakeMeta(), worker, { tenant: async () => { throw new Error('x'); } }),
    );
    expectClean(response);
    expect(response.headers.get('location')).toBe(RESULT('error'));
    expect(worker.calls).toEqual([]);
  });

  it('consume no disponible → error limpio, sin reintento ni Meta', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker({
      consume_oauth_attempt: () => { throw new WorkerApiError('unavailable', 'transport'); },
    });
    const response = await oauth.handleMetaCallback(
      callbackRequest(`state=${state43()}&code=${CODE}`, state43()),
      deps(meta, worker),
    );
    expectClean(response);
    expect(response.headers.get('location')).toBe(RESULT('error'));
    expect(worker.fns()).toEqual(['consume_oauth_attempt']);
    expect(meta.calls).toEqual([]);
  });

  it('parámetros extra en un callback exitoso no se reenvían', async () => {
    const response = await oauth.handleMetaCallback(
      callbackRequest(`state=${state43()}&code=${CODE}&foo=bar&error_description=x&meta=error`, state43()),
      deps(fakeMeta(), fakeWorker()),
    );
    expectClean(response);
    expect(response.headers.get('location')).toBe(RESULT('pendiente'));
  });

  it('configuración inválida en el callback initial → error después de consumir, sin Meta', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker();
    const response = await oauth.handleMetaCallback(
      callbackRequest(`state=${state43()}&code=${CODE}`, state43()),
      deps(meta, worker, { config: () => api.readMetaOAuthConfig({} as NodeJS.ProcessEnv) }),
    );
    expectClean(response);
    expect(response.headers.get('location')).toBe(RESULT('error'));
    expect(worker.fns()).toEqual(['consume_oauth_attempt']);
    expect(meta.calls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// C-15 a C-17: canje, inspección y negocio
// ---------------------------------------------------------------------------

async function runCallback(meta: ReturnType<typeof fakeMeta>, worker: ReturnType<typeof fakeWorker>, over: Partial<MetaOAuthDeps> = {}) {
  const response = await oauth.handleMetaCallback(
    callbackRequest(`state=${state43()}&code=${CODE}`, state43()),
    deps(meta, worker, over),
  );
  expectClean(response);
  return response.headers.get('location');
}

describe('QA C-17: debug_token y /me en el borde', () => {
  const debug = (data: Record<string, unknown>) => () =>
    json({ data: { is_valid: true, app_id: APP_ID, type: 'SYSTEM_USER', scopes: ['ads_read'], expires_at: 0, ...data } });

  it.each([
    ['is_valid "true" (cadena)', { '/v26.0/debug_token': debug({ is_valid: 'true' }) }, 'token_no_valido'],
    ['is_valid 1', { '/v26.0/debug_token': debug({ is_valid: 1 }) }, 'token_no_valido'],
    ['scopes como cadena', { '/v26.0/debug_token': debug({ scopes: 'ads_read' }) }, 'permiso_faltante'],
    ['scopes con ADS_READ en mayúsculas', { '/v26.0/debug_token': debug({ scopes: ['ADS_READ'] }) }, 'permiso_faltante'],
    ['type system_user en minúsculas', { '/v26.0/debug_token': debug({ type: 'system_user' }) }, 'token_no_valido'],
    ['debug_token sin data', { '/v26.0/debug_token': () => json({}) }, 'token_no_valido'],
    ['client_business_id con espacio', { '/v26.0/me': () => json({ client_business_id: 'neg ocio' }) }, 'token_no_valido'],
    ['client_business_id de 65 caracteres', { '/v26.0/me': () => json({ client_business_id: 'a'.repeat(65) }) }, 'token_no_valido'],
    ['client_business_id numérico', { '/v26.0/me': () => json({ client_business_id: 123 }) }, 'token_no_valido'],
  ] as Array<[string, Record<string, Responder>, string]>)('%s → %s sin pendiente', async (_n, overrides, outcome) => {
    const meta = fakeMeta(overrides);
    const worker = fakeWorker();
    expect(await runCallback(meta, worker)).toBe(RESULT(outcome));
    expect(worker.fns()).toEqual(['consume_oauth_attempt']);
    expect(meta.calls.filter((p) => p === '/v26.0/oauth/access_token')).toHaveLength(1);
  });

  it('app_id numérico igual al de la app se acepta (positivo)', async () => {
    const meta = fakeMeta({ '/v26.0/debug_token': debug({ app_id: Number(APP_ID) }) });
    const worker = fakeWorker();
    expect(await runCallback(meta, worker)).toBe(RESULT('pendiente'));
  });
});

describe('QA C-15/C-16: fallos de Meta después del canje', () => {
  it.each([
    ['debug_token con red caída', { '/v26.0/debug_token': () => Promise.reject(new TypeError('red')) }, 'meta_no_disponible', ['/v26.0/oauth/access_token', '/v26.0/debug_token']],
    ['debug_token con límite (4)', { '/v26.0/debug_token': () => json({ error: { code: 4 } }, 400) }, 'meta_no_disponible', ['/v26.0/oauth/access_token', '/v26.0/debug_token']],
    ['/me con 190', { '/v26.0/me': () => json({ error: { code: 190 } }, 401) }, 'rechazado', ['/v26.0/oauth/access_token', '/v26.0/debug_token', '/v26.0/me']],
    ['/me con cuerpo ilegible', { '/v26.0/me': () => new Response('<html>', { status: 200 }) }, 'meta_no_disponible', ['/v26.0/oauth/access_token', '/v26.0/debug_token', '/v26.0/me']],
    ['canje 200 con objeto error (190/460)', { '/v26.0/oauth/access_token': () => json({ error: { code: 190, error_subcode: 460 } }, 200) }, 'rechazado', ['/v26.0/oauth/access_token']],
    ['canje 400 con error como cadena', { '/v26.0/oauth/access_token': () => json({ error: 'x' }, 400) }, 'meta_no_disponible', ['/v26.0/oauth/access_token']],
    ['canje 200 con cuerpo null', { '/v26.0/oauth/access_token': () => json(null, 200) }, 'meta_no_disponible', ['/v26.0/oauth/access_token']],
    ['canje con cuerpo vacío', { '/v26.0/oauth/access_token': () => new Response('', { status: 200 }) }, 'meta_no_disponible', ['/v26.0/oauth/access_token']],
  ] as Array<[string, Record<string, Responder>, string, string[]]>)('%s → %s', async (_n, overrides, outcome, path) => {
    const meta = fakeMeta(overrides);
    const worker = fakeWorker();
    expect(await runCallback(meta, worker)).toBe(RESULT(outcome));
    expect(meta.calls).toEqual(path);
    expect(worker.fns()).toEqual(['consume_oauth_attempt']);
  });
});

// ---------------------------------------------------------------------------
// C-23: registro por defecto en caminos de fallo
// ---------------------------------------------------------------------------

describe('QA C-23: el registro por defecto en caminos de fallo', () => {
  it.each([
    ['canje con texto libre que contiene secretos', { '/v26.0/oauth/access_token': () => json({ error: { code: 100, message: `token ${TOKEN} code ${CODE} secreto ${SECRET}`, fbtrace_id: TOKEN } }, 400) }],
    ['debug_token sin ads_read', { '/v26.0/debug_token': () => json({ data: { is_valid: true, app_id: APP_ID, type: 'SYSTEM_USER', scopes: [] } }) }],
    ['/me sin negocio', { '/v26.0/me': () => json({ id: '1' }) }],
  ] as Array<[string, Record<string, Responder>]>)('%s', async (_n, overrides) => {
    const lines: string[] = [];
    for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        lines.push(args.map(String).join(' '));
      });
    }
    const state = state43();
    const nonce = state43();
    const meta = fakeMeta(overrides);
    const d = deps(meta, fakeWorker());
    delete d.log;
    const response = await oauth.handleMetaCallback(callbackRequest(`state=${state}&code=${CODE}`, nonce), d);
    expectClean(response);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      for (const secret of [TOKEN, CODE, SECRET, state, nonce, sha256(state), sha256(nonce), BUSINESS, 'graph.facebook.com']) {
        expect(line).not.toContain(secret);
      }
      const parsed = JSON.parse(line) as Record<string, unknown>;
      for (const key of Object.keys(parsed)) expect(['evento', 'etapa', 'resultado', 'clase', 'request_id']).toContain(key);
    }
    const body = await response.text();
    for (const secret of [TOKEN, CODE, SECRET, state, nonce]) expect(body).not.toContain(secret);
  });
});

// ---------------------------------------------------------------------------
// C-24: reintento solo ante transporte o timeout
// ---------------------------------------------------------------------------

describe('QA C-24: sin reintento ante otras fallas', () => {
  it.each([
    ['unavailable/other', () => new WorkerApiError('unavailable', 'other')],
    ['not_authorized', () => new WorkerApiError('not_authorized')],
    ['Error genérico', () => new Error('x')],
  ] as Array<[string, () => Error]>)('%s → error con un solo intento', async (_n, make) => {
    const worker = fakeWorker({ create_pending_connection: () => { throw make(); } });
    expect(await runCallback(fakeMeta(), worker)).toBe(RESULT('error'));
    expect(worker.fns().filter((f) => f === 'create_pending_connection')).toHaveLength(1);
  });

  it('transporte y luego PX003 → conexion_existente (segundo intento sin un tercero)', async () => {
    let n = 0;
    const worker = fakeWorker({
      create_pending_connection: () => {
        n += 1;
        throw n === 1 ? new WorkerApiError('unavailable', 'timeout') : new WorkerApiError('live_connection_exists');
      },
    });
    expect(await runCallback(fakeMeta(), worker)).toBe(RESULT('conexion_existente'));
    expect(n).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// C-21: reauth
// ---------------------------------------------------------------------------

describe('QA C-21: reauth en el borde', () => {
  it('lectura de la conexión que falla → error, sin Meta', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker({ consume_oauth_attempt: () => [consumed('reauth', 2)] });
    expect(await runCallback(meta, worker, { readLiveConnection: async () => { throw new Error('rls'); } })).toBe(RESULT('error'));
    expect(meta.calls).toEqual([]);
  });

  it('pendiente con el mismo id → credencial_cambio? (misma generación)', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker({ consume_oauth_attempt: () => [consumed('reauth', 2)] });
    const location = await runCallback(meta, worker, {
      readLiveConnection: async () => ({ id: CONNECTION_ID, status: 'pending_selection', credentialGeneration: 2 }),
    });
    // Solo se registra el resultado: la spec compara id y generación, no el estado.
    expect(['credencial_cambio', 'reautorizacion_no_disponible'].map(RESULT)).toContain(location);
    expect(meta.calls).toEqual([]);
  });

  it('configuración inválida no afecta el camino reauth', async () => {
    const meta = fakeMeta();
    const worker = fakeWorker({ consume_oauth_attempt: () => [consumed('reauth', 2)] });
    const location = await runCallback(meta, worker, {
      config: () => api.readMetaOAuthConfig({} as NodeJS.ProcessEnv),
      readLiveConnection: async () => ({ id: CONNECTION_ID, status: 'active', credentialGeneration: 2 }),
    });
    expect(location).toBe(RESULT('reautorizacion_no_disponible'));
    expect(meta.calls).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// C-05: clasificación en el borde
// ---------------------------------------------------------------------------

describe('QA C-05: clasificación en el borde', () => {
  it.each([
    [{ code: 190, error_subcode: null }, 'authentication'],
    [{ code: 2147483648 }, 'unknown'],
    [{ code: -1 }, 'unknown'],
    [{ code: 190.5 }, 'unknown'],
    [{ code: '190' }, 'unknown'],
    [{ code: 190, error_subcode: '460' }, 'unknown'],
    [{ code: 199 }, 'unknown'],
    [{ code: 300 }, 'unknown'],
    [{ code: 0 }, 'unknown'],
  ] as Array<[Record<string, unknown>, string]>)('%j → %s', (error, expected) => {
    const failure = errors.classifyGraphError({ error });
    expect(failure.errorClass).toBe(expected);
    expect(failure.errorClass).not.toBe('asset_access');
  });

  it('error como arreglo → unknown', () => {
    expect(errors.classifyGraphError({ error: [190] }).errorClass).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// C-03: configuración en el borde
// ---------------------------------------------------------------------------

describe('QA C-03: configuración en el borde', () => {
  it.each([
    ['META_REDIRECT_URI', `${REDIRECT_URI}?`],
    ['META_REDIRECT_URI', `${REDIRECT_URI}#`],
    ['META_REDIRECT_URI', `${REDIRECT_URI}/`],
    ['META_REDIRECT_URI', 'http://localhost.evil.test/api/integraciones/meta/callback'],
    ['META_REDIRECT_URI', 'http://[::1]:3000/api/integraciones/meta/callback'],
    ['META_REDIRECT_URI', 'ftp://praxa.test/api/integraciones/meta/callback'],
    ['META_APP_ID', ' 1234567'],
    ['META_APP_ID', '1'.repeat(33)],
    ['META_CONFIG_ID', '12a'],
  ])('%s = %j se rechaza nombrando la variable sin el valor', (name, value) => {
    const env = { ...ENV, [name]: value } as unknown as NodeJS.ProcessEnv;
    let caught: unknown;
    try {
      api.readMetaOAuthConfig(env);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(api.MetaConfigError);
    const message = (caught as Error).message;
    expect(message).toContain(name);
    expect(message).not.toContain(value.trim());
    expect(JSON.stringify(caught)).not.toContain(SECRET);
  });

  it('los cuatro valores faltantes se nombran juntos y sin valores', () => {
    let caught: unknown;
    try {
      api.readMetaOAuthConfig({} as NodeJS.ProcessEnv);
    } catch (error) {
      caught = error;
    }
    for (const name of ['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI', 'META_CONFIG_ID']) {
      expect((caught as Error).message).toContain(name);
    }
  });

  it('el secreto leído no aparece al serializar la configuración', () => {
    expect(JSON.stringify(CONFIG)).not.toContain(SECRET);
    expect(String(CONFIG.appSecret)).not.toContain(SECRET);
  });
});

// ---------------------------------------------------------------------------
// C-31: barreras de URLs de salida en el borde
// ---------------------------------------------------------------------------

describe('QA C-31: barreras en el borde', () => {
  const guarded = () => {
    const fetch = vi.fn<MetaFetch>(async () => json({}));
    return { fetch, http: client.createMetaHttpClient({ fetch }) };
  };

  it('graphUrl con un parámetro prohibido escondido en la ruta: el cliente lo frena antes de fetch', async () => {
    const { fetch, http } = guarded();
    const url = api.graphUrl('me?access_token=x');
    await expect(http.getJson(url)).rejects.toBeInstanceOf(client.MetaRequestRejectedError);
    await expect(http.postFormJson(api.graphUrl('debug_token?input_token=x'), {})).rejects.toBeInstanceOf(
      client.MetaRequestRejectedError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    'http://graph.facebook.com/v26.0/me',
    'https://graph.facebook.com.evil.test/v26.0/me',
    'https://www.facebook.com/v26.0/me',
  ])('origen %s → rechazo sin fetch', async (raw) => {
    const { fetch, http } = guarded();
    await expect(http.getJson(new URL(raw))).rejects.toBeInstanceOf(client.MetaRequestRejectedError);
    await expect(http.postFormJson(new URL(raw), {})).rejects.toBeInstanceOf(client.MetaRequestRejectedError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('postFormJson con el secreto en la ruta → rechazo sin fetch', async () => {
    const { fetch, http } = guarded();
    const url = new URL(`https://graph.facebook.com/v26.0/${SECRET}`);
    await expect(http.postFormJson(url, { client_secret: new SecretValue(SECRET) })).rejects.toThrow(
      'Petición a Meta rechazada: la URL no es válida.',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('getJson con el token totalmente codificado en la consulta → rechazo', async () => {
    const { fetch, http } = guarded();
    const encoded = [...TOKEN].map((c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`).join('');
    const url = new URL(`https://graph.facebook.com/v26.0/me?fields=${encoded}`);
    await expect(http.getJson(url, { bearer: new SecretValue(TOKEN) })).rejects.toBeInstanceOf(
      client.MetaRequestRejectedError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('nombre prohibido con codificación porcentual en la consulta → rechazo', async () => {
    const { fetch, http } = guarded();
    const url = new URL('https://graph.facebook.com/v26.0/me?access%5Ftoken=x');
    await expect(http.getJson(url)).rejects.toBeInstanceOf(client.MetaRequestRejectedError);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('QA C-11/C-12: métodos exportados por las rutas', () => {
  it('iniciar exporta solo POST y callback solo GET', async () => {
    const start = await import('@/app/api/integraciones/meta/iniciar/route');
    const back = await import('@/app/api/integraciones/meta/callback/route');
    expect(Object.keys(start).sort()).toEqual(['POST']);
    expect(Object.keys(back).sort()).toEqual(['GET']);
  });
});
```

### `tests/component/__qa__/m161-aviso-qa.test.tsx` (18 pruebas, todas pasan)

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** QA M16.1 (temporal, se borra): C-25 para cada resultado y entradas hostiles. */

const requireAppSession = vi.fn();

vi.mock('@/modules/app-data', () => ({
  requireAppSession: (ruta: string) => requireAppSession(ruta),
  getIntegraciones: async () => [
    { id: 'meta_ads', nombre: 'Meta Ads', descripcion: ['Campañas de Facebook', 'e Instagram'], conectada: false },
  ],
}));

const { default: IntegracionesPage } = await import('@/app/(app)/app/integraciones/page');
const { META_OAUTH_MESSAGES, META_OAUTH_OUTCOMES } = await import('@/modules/integrations/meta/outcomes');

type Params = Record<string, string | string[] | undefined>;
async function renderPage(searchParams: Params) {
  const ui = await IntegracionesPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  } as Parameters<typeof IntegracionesPage>[0]);
  return render(ui);
}

describe('QA C-25: aviso por resultado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAppSession.mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  it.each([...META_OAUTH_OUTCOMES])('meta=%s muestra exactamente su texto, un solo aviso, Conectar deshabilitado', async (outcome) => {
    await renderPage({ meta: outcome });
    const message = META_OAUTH_MESSAGES[outcome];
    const role = message.tone === 'error' ? 'alert' : 'status';
    const other = role === 'alert' ? 'status' : 'alert';
    expect(screen.getByRole(role)).toHaveTextContent(message.text);
    expect(screen.queryByRole(other)).not.toBeInTheDocument();
    for (const [key, { text }] of Object.entries(META_OAUTH_MESSAGES)) {
      if (key !== outcome && text !== message.text) expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Conectar' })).toBeDisabled();
  });

  it.each([
    ['HTML inyectado', { meta: '<b>x</b>' }],
    ['mayúsculas', { meta: 'CANCELADO' }],
    ['con espacio', { meta: 'cancelado ' }],
    ['arreglo de un elemento', { meta: ['cancelado'] }],
    ['nombre de propiedad de Object', { meta: 'constructor' }],
    ['vacío', { meta: '' }],
  ] as Array<[string, Params]>)('%s no muestra aviso', async (_n, params) => {
    const { container } = await renderPage(params);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('<b>x</b>');
  });
});
```

### `tests/app/__qa__/m161-qa-app.test.ts` (4 pruebas, todas pasan)

```ts
import { randomBytes, randomUUID } from 'node:crypto';

import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { MetaFetch } from '@/modules/integrations/meta/client';
import type { MetaOAuthDeps } from '@/modules/integrations/meta/oauth';
import type { TenantContext } from '@/modules/tenant/context';
import { resolveIntegrationsTestTarget } from '../../../scripts/lib/sql-target.mjs';
import {
  blockedReason,
  cleanupRun,
  createConfirmedUser,
  pendingCleanupCount,
  remoteProjectReachable,
  RUN_ID,
  type TestUser,
} from '../helpers';

/** QA M16.1 (temporal, se borra): cancelación y reloj contra la base desechable real. */

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const APP_ID = '1234567';
const CODE = 'codigo-sint';
const ORIGIN = 'https://praxa.test';
const REDIRECT_URI = `${ORIGIN}/api/integraciones/meta/callback`;
const COOKIE = '__Host-praxa_oauth_binding';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
type Company = { user: TestUser; ctx: TenantContext };

describe('QA M16.1 con la base desechable', () => {
  let oauth: typeof import('@/modules/integrations/meta/oauth');
  let api: typeof import('@/modules/integrations/meta/api');
  let clientModule: typeof import('@/modules/integrations/meta/client');
  let connections: typeof import('@/modules/integrations/repository/connections');
  let keyringModule: typeof import('@/modules/integrations/crypto/keyring');
  let workerApi: ReturnType<typeof import('@/modules/integrations/db/worker-api').createWorkerApi> | undefined;

  beforeAll(async () => {
    const target = resolveIntegrationsTestTarget(process.env);
    if (!target.ok) throw new Error('Destino del rol no verificado.');
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);
    if (!(await remoteProjectReachable())) throw new Error('El proyecto de pruebas no responde.');
    let workerModule: typeof import('@/modules/integrations/db/worker-api');
    [oauth, api, clientModule, connections, keyringModule, workerModule] = await Promise.all([
      import('@/modules/integrations/meta/oauth'),
      import('@/modules/integrations/meta/api'),
      import('@/modules/integrations/meta/client'),
      import('@/modules/integrations/repository/connections'),
      import('@/modules/integrations/crypto/keyring'),
      import('@/modules/integrations/db/worker-api'),
    ]);
    workerApi = workerModule.createWorkerApi({ connectionString: target.connectionString });
  });

  afterAll(async () => {
    try {
      await workerApi?.end();
    } finally {
      await cleanupRun();
      expect(pendingCleanupCount()).toBe(0);
    }
  });

  async function company(prefix: string): Promise<Company> {
    const user = await createConfirmedUser(prefix);
    const { data, error } = await user.client
      .rpc('create_company_for_current_user', { p_name: `Empresa sintética ${RUN_ID} ${prefix}` })
      .single<{ id: string }>();
    if (error || !data) throw new Error('No se pudo crear la empresa sintética.');
    return { user, ctx: { user_id: user.id, company_id: data.id, role: 'owner', request_id: randomUUID() } };
  }

  function fakeMeta() {
    const calls: string[] = [];
    const fetch: MetaFetch = async (input) => {
      const url = new URL(input);
      calls.push(url.pathname);
      if (url.pathname === '/v26.0/oauth/access_token') return json({ access_token: 'token-sint-meta' });
      if (url.pathname === '/v26.0/debug_token')
        return json({ data: { is_valid: true, app_id: APP_ID, type: 'SYSTEM_USER', scopes: ['ads_read'], expires_at: 0 } });
      if (url.pathname === '/v26.0/me') return json({ id: '9876543', client_business_id: 'negocio_sintetico' });
      return json({ error: { code: 803 } }, 404);
    };
    return { calls, http: clientModule.createMetaHttpClient({ fetch }) };
  }

  function deps(owner: Company, meta: ReturnType<typeof fakeMeta>, over: Partial<MetaOAuthDeps> = {}) {
    const config = api.readMetaOAuthConfig({
      META_APP_ID: APP_ID,
      META_APP_SECRET: 'secreto-sint',
      META_REDIRECT_URI: REDIRECT_URI,
      META_CONFIG_ID: '7654321',
    } as unknown as NodeJS.ProcessEnv);
    return {
      tenant: async () => owner.ctx,
      config: () => config,
      http: meta.http,
      workerApi: workerApi!,
      keyring: keyringModule.getCredentialKeyring(),
      readLiveConnection: (ctx: TenantContext) => connections.readLiveConnection(ctx, { supabase: owner.user.client }),
      log: () => {},
      ...over,
    } satisfies Partial<MetaOAuthDeps>;
  }

  async function start(owner: Company, over: Partial<MetaOAuthDeps> = {}) {
    const request = new NextRequest(`${ORIGIN}/api/integraciones/meta/iniciar`, { method: 'POST', headers: { origin: ORIGIN } });
    const response = await oauth.handleMetaStart(request, deps(owner, fakeMeta(), over));
    const location = response.headers.get('location') ?? '';
    const cookie = response.headers.get('set-cookie') ?? '';
    const nonce = /__Host-praxa_oauth_binding=([^;]*)/.exec(cookie)?.[1] ?? '';
    const state = location.startsWith('https://www.facebook.com/') ? (new URL(location).searchParams.get('state') ?? '') : '';
    return { response, location, cookie, state, nonce };
  }

  async function callback(owner: Company, params: Record<string, string>, nonce: string | null, meta = fakeMeta()) {
    const url = new URL(REDIRECT_URI);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const headers: Record<string, string> = nonce === null ? {} : { cookie: `${COOKIE}=${nonce}` };
    const response = await oauth.handleMetaCallback(new NextRequest(url, { headers }), deps(owner, meta));
    expect(response.status).toBe(303);
    expect(response.headers.get('set-cookie') ?? '').toMatch(/Max-Age=0/i);
    return response.headers.get('location');
  }

  const RESULT = (o: string) => `${ORIGIN}/app/integraciones?meta=${o}`;
  async function rows(owner: Company) {
    const { data, error } = await owner.user.client.from('integration_connections').select('id').eq('company_id', owner.ctx.company_id);
    if (error) throw new Error('lectura RLS falló');
    return data ?? [];
  }

  it('QA-A01 C-14: cancelar con state y cookie válidos gasta el intento en la base', async () => {
    const owner = await company('qa161-cancela');
    const started = await start(owner);
    expect(started.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const meta = fakeMeta();
    expect(await callback(owner, { error: 'access_denied', error_reason: 'user_denied', state: started.state }, started.nonce, meta)).toBe(
      RESULT('cancelado'),
    );
    expect(await callback(owner, { state: started.state, code: CODE }, started.nonce, meta)).toBe(RESULT('rechazado'));
    expect(meta.calls).toEqual([]);
    expect(await rows(owner)).toEqual([]);
  });

  it('QA-A02 C-14: cancelar sin cookie no gasta el intento (solo se consume si state y nonce validan)', async () => {
    const owner = await company('qa161-cancela-sc');
    const started = await start(owner);
    expect(await callback(owner, { error: 'access_denied', state: started.state }, null)).toBe(RESULT('cancelado'));
    expect(await callback(owner, { state: started.state, code: CODE }, started.nonce)).toBe(RESULT('pendiente'));
    expect(await rows(owner)).toHaveLength(1);
  });

  it('QA-A03 C-10: un vencimiento más allá del tope de la base termina en error, sin cookie ni redirección a Meta', async () => {
    const owner = await company('qa161-reloj');
    const started = await start(owner, { now: () => new Date(Date.now() + 2 * 60_000) });
    expect(started.location).toBe(RESULT('error'));
    expect(started.cookie).not.toMatch(/__Host-praxa_oauth_binding=[^;]+/);
    expect(await rows(owner)).toEqual([]);
  });

  it('QA-A04 C-13: un state válido con la cookie de otro intento propio se rechaza y no gasta ninguno', async () => {
    const owner = await company('qa161-cruzado');
    const first = await start(owner);
    const second = await start(owner);
    expect(await callback(owner, { state: first.state, code: CODE }, second.nonce)).toBe(RESULT('rechazado'));
    expect(await callback(owner, { state: second.state, code: CODE }, first.nonce)).toBe(RESULT('rechazado'));
    expect(await callback(owner, { state: first.state, code: CODE }, first.nonce)).toBe(RESULT('pendiente'));
    expect(await callback(owner, { state: second.state, code: CODE }, second.nonce)).toBe(RESULT('conexion_existente'));
    expect(await rows(owner)).toHaveLength(1);
  });
});

void randomBytes;
```
