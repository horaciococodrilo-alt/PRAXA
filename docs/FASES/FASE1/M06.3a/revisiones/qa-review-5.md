# QA de M06.3a — 5

## Estado y veredicto

- Fecha: 2026-10-02. Rama `mf/M06.3a`, commit `0327ad647381a8c22737dc0899e18717f57e18fe`.
- Foto inicial de `git status --porcelain`: vacía. Última revisión de implementación: `implementation-review-9.md`, **APROBABLE**. Hash de estado de esa revisión y de este QA, excluyendo informes: `dd9b8e6d4abb82049c11105d5d3988210bc51a5f`.
- **LISTO PARA PR.** Los requisitos técnicos y la evidencia de M06.3a están completos en este commit. La aprobación visible de `G-CRYPTO` es posterior a la revisión del PR y la CI; aún no se concede ni se habilita M28.2a.
- La CI configurada en `.github/workflows/verify.yml` ejecuta `npm ci` y `npm run verify` en Ubuntu. El `verify` local pasó; la CI de un PR aún no existe.

## Matriz de comportamiento

En cada fila, **P** es caso positivo, **N** caso negativo y **B** caso de borde. Los casos provienen de la spec aprobada. `T-NN` identifica las pruebas permanentes; `E` las tres sondas temporales de este QA. “PASS” significa que las pruebas citadas se ejecutaron en este QA mediante `verify`, `test:app` o la suite exploratoria, o que la comprobación documental indicada se repitió.

| Criterio | Caso | Tipo | Cubierto por | Resultado |
|---|---|---|---|---|
| CA-21 | Rol real usa función; tablas denegadas; empresa ajena no lee | P/N/B | T-31–T-34 | PASS |
| CA-23, CA-11b | Ciclo GCM; AAD ajeno falla; IV nuevo por llamada | P/N/B | T-03, T-04, T-08, T-34 | PASS |
| CA-24 | Material auténtico abre; alteraciones fallan; etiqueta corta falla antes de descifrar | P/N/B | T-03, T-06–T-09 | PASS |
| CA-25 | Clave actual y recifrado; versión ausente falla; desconexión y conteo limitan retiro | P/N/B | T-10–T-16, T-35, T-36, T-44 | PASS |
| CA-26 | Token solo por `reveal`; errores redactados; recorrido y exclusión del entorno local | P/N/B | T-17, T-20, T-25, T-26, T-53 | PASS |
| CA-27 | URL del rol confinada; uso fuera del módulo rechazado; dos invariantes originales conservadas | P/N/B | T-21 | PASS |
| CB-01–CB-06 | Suites pasan; secretos/migraciones/producción ausentes; siete skips no acreditados como ejecución | P/N/B | `verify`, `test:app`, T-24–T-40; inspección | PASS |
| C-01 | Dos claves válidas; formato inválido; versión ausente da error propio | P/N/B | T-01, T-02, T-10 | PASS |
| C-02 | Sello K04; texto vacío falla; IV y etiqueta tienen tamaño exigido | P/N/B | T-03–T-05 | PASS |
| C-03 | Abre material genuino; adulteración falla; etiqueta corta evita descifrador | P/N/B | T-03, T-06–T-09 | PASS |
| C-04 | Clave anterior abre; ausente falla; error no es de descifrado | P/N/B | T-10, T-11 | PASS |
| C-05 | Menor versión recifra; igual/mayor no; conteo cero habilita condición DB | P/N/B | T-12, T-13, T-16, T-35 | PASS |
| C-06 | Estados permitidos recifran; desconectada no; carrera real produce `PX006` | P/N/B | T-14, T-15, T-36, T-41 | PASS |
| C-07 | Llamada del mapa SQL; nombre/arity ajenos fallan; variable ausente no hace fallback | P/N/B | T-18, T-21 | PASS |
| C-08 | SQLSTATE traducido; detalle no filtra; timeout/transport se distinguen | P/N/B | T-17, T-53 | PASS |
| C-09 | Contexto K01 válido crea; inválido falla antes de DB; UUID nuevo ata AAD | P/N/B | T-19, T-51 | PASS |
| C-10 | `reveal()` entrega; JSON/String no; `inspect` redacta | P/N/B | T-20 | PASS |
| C-11 | `pg` productivo; no duplicado en desarrollo; lockfile y build | P/N/B | T-28, `npm ci --dry-run --offline`, `verify` | PASS |
| C-12 | Cinco reglas; credencial fuera del módulo detectada; dos casos originales siguen | P/N/B | T-21 | PASS |
| C-13 | Destino desechable aceptado; app/override rechazados; TLS administrativo permitido | P/N/B | T-22, T-27, T-49, E | PASS |
| C-14 | Test distinto de app; excepción antigua no habilita app; literal solo en T-23 | P/N/B | T-23, T-24 | PASS |
| C-15 | Árbol limpio; patrones detectan muestra; Git fallido y `.env.local` se excluyen | P/N/B | T-25, T-26 | PASS |
| C-16 | Excepción documental presente; sin matriz exacta duplicada; OAuth aún previsto | P/N/B | T-29, diff documental | PASS |
| C-17 | Cuatro variables vacías; valor prohibido por prueba; conteo y sección final revisados | P/N/B | T-30, diff `.env.example` | PASS |
| C-18 | Login/CRUD real; acceso directo y AAD ajeno fallan; variable ausente falla sin red | P/N/B | T-31–T-37, T-41, T-43 | PASS |
| C-19 | Suites cruzan `server-only`; sin dependencia extra; mock por suite | P/N/B | T-38, revisión de suites | PASS |
| C-20 | Suite de pruebas usa proyecto desechable; sin diff ni archivos nuevos SQL; sin app | P/N/B | T-27, T-39, inspección Git | PASS |
| C-21 | Repetición preparada idéntica; actor ajeno falla; intento real idempotente | P/N/B | T-42, T-43, T-51 | PASS |
| C-22 | Conteo cero documentado; sin prometer autorización completa; desconectada aún cuenta | P/N/B | T-44, T-36 | PASS |
| C-23 | Rewrap confirmado; fallo explícito no es incierto; timeout antes/después da `unconfirmed` | P/N/B | T-45, T-46 | PASS |
| C-24 | URL del rol sin TLS extra pasa; parámetros TLS fallan; referencia administrativa conserva TLS | P/N/B | T-47, E | PASS |
| C-25 | CA y negociación verificadas; fallo TLS no hace fallback; conexión real autentica | P/N/B | T-48, T-50, T-31 | PASS |
| C-26 | Shared pooler canónico; overrides y parser ambiguo fallan; `06543` falla | P/N/B | T-22, T-49, E | PASS |
| C-27 | Respuesta válida proyecta K04; entradas/filas inválidas fallan; errores no revelan material | P/N/B | T-51–T-53 | PASS |

La microfase no tiene UI visible ni recorrido manual: Parte III.8 de la ruta la clasifica como cimiento. La prueba real del rol fue ejecutada; no queda guion manual obligatorio para el usuario.

## Sondas exploratorias

Se creó temporalmente `tests/unit/__qa__/M06.3a-boundaries.test.ts`, usando solo `resolveIntegrationsTestTarget` y `createWorkerApi` exportados, con URLs sintéticas y sin conexión:

1. Referencia administrativa con `sslmode=require` aceptada; URL del rol con ese parámetro rechazada.
2. Puerto `06543`, usuario codificado con `%zz` en query y usuario codificado con espacio en contraseña rechazados por resolvedor y cliente con `config_invalid`.
3. Referencia SQL de app no deducible y URL pública igual a pruebas rechazada.

`npm run test:unit -- tests/unit/__qa__/` → 1 archivo, **3/3 PASS**. El archivo se borró. `Test-Path` devolvió `False`, `git status --porcelain` volvió a quedar vacío y el hash de estado permaneció igual.

## Verificación completa

| Comando | Resultado |
|---|---|
| `npm run verify` | Exit 0; lint, typegen, typecheck, 10 archivos y 197/197 pruebas unitarias/de componentes, build Next completo |
| `npm run db:check:test` | Exit 0, destino desechable y rol presentes, `Destino verificado.`; no se registran referencias ni secretos |
| `npm run test:app` | Exit 0, 6 archivos, 37 pasadas y 7 omitidas; la suite del rol tiene sus ocho casos ejecutados |
| T-24, `rg -n SUPABASE_TEST_ALLOW_APP_PROJECT ...` | Solo tres líneas de T-23 |
| T-28, inspección de dependencias | `true false true`; `npm ci --dry-run --offline` exit 0 |
| T-29, T-30, T-38 | Diffs de documentación, entorno y paquete dentro de la spec; mocks por suite |
| T-39, diff/archivos nuevos en `supabase/` | Sin salida; `git diff --check main` exit 0 |

Las siete omisiones de `test:app` son tres pruebas de correo opt-in y cuatro avisos negativos de otras suites. Ninguna pertenece a la suite real de M06.3a, y ninguna se contó como ejecutada. `test:policies` no corresponde a este corte: no cambia SQL y III.3 exige `db:check:test` y `test:app`.

## Condición del gate y evidencia de cierre

| Parte | Estado | Evidencia o siguiente acción |
|---|---|---|
| Dependencia `G-DB-META` | Cumplida | `PROJECT_STATE.md` la registra aprobada |
| Implementación y CA-21/23–27/11b | Cumplida | Matriz anterior, revisión de implementación APROBABLE |
| Pruebas de la ficha y suites de III.3 | Cumplida | `verify`, `db:check:test`, `test:app`, incluyendo rol real |
| Diff de `SECURITY.md` y `ARCHITECTURE.md` | Cumplida | T-29 y revisión documental |
| Higiene, migraciones y destino | Cumplida | T-24–T-26, T-39, hash y diff |
| Revisión de PR y CI Linux | Pendiente de PR | El usuario crea el PR; CI corre `npm ci` y `verify` |
| Aprobación visible de `G-CRYPTO` | Pendiente del usuario | Tras revisar evidencia y PR/CI, registrar aprobación con fecha en `PROJECT_STATE.md`; hasta entonces M28.2a sigue inhabilitada |

`PROJECT_STATE.md` conserva el estado conservador **VERIFICADO — PENDIENTE DE NUEVA REVISIÓN Y QA** y `G-CRYPTO` pendiente; la sesión registra la implementación verificada. Este QA acredita la nueva revisión, sin actualizar el gate ni alterar esos archivos porque la skill solo autoriza el informe y `pr.md`.

## Hallazgos

| ID (Q-NN) | Severidad | Criterio | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| — | — | — | Ningún hallazgo nuevo | Pruebas permanentes y exploratorias en verde | — |

Las cuatro observaciones pendientes de QA 4 se volvieron a comprobar con las pruebas permanentes y las sondas anteriores. No se creó ningún test permanente adicional. La CI Linux queda pendiente del PR.

## Pendientes del usuario

Commit, push y apertura del PR usando `pr.md`; revisión de Codex y CI; aprobación visible de `G-CRYPTO` después de evaluar esa evidencia. No se solicita ningún secreto ni intervención adicional en la base de pruebas.
