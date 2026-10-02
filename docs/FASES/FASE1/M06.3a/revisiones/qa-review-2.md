# QA de M06.3a — 2

## Estado y veredicto

- Fecha: 2026-10-02. Rama: `mf/M06.3a`. Commit: `83bfdd3b4ebd4562bbd228761e80997788b98141`.
- Hash del estado con la fórmula de `qa-review`, excluidos los informes: `a8a4f7ecf6c2276f0eb2ca30df2b78270ed531c8`.
- Foto inicial de `git status --porcelain=v1`: solo `?? docs/FASES/FASE1/M06.3a/revisiones/implementation-review-7.md`. La rama, el commit y el contenido no excluido coinciden con el estado limpio descrito por la última revisión, `implementation-review-7.md`, cuyo veredicto es **APROBABLE**. Esa revisión no anotó el hash de estado explícitamente; la equivalencia se comprueba por el mismo HEAD y la ausencia de cambios fuera de informes excluidos.
- **Veredicto: REQUIERE CAMBIOS.** La prueba exploratoria Q-02 falla frente a Diseño §7 y C-13: una referencia SQL de la app cuyo proyecto no se puede deducir se acepta. No se preparó `pr.md`. `G-CRYPTO` sigue pendiente de aprobación visible del usuario y M28.2a no queda habilitada.

## Matriz de comportamiento

`P` = positivo, `N` = negativo, `B` = borde. `PASS` indica prueba ejecutada o inspección indicada. Los IDs T se refieren a los casos de la spec. Una fila `Q-02 FAIL` tiene reproducción exploratoria independiente. Los criterios heredados CA-11b, CA-21 y CA-23–27 se muestran junto a los C que los verifican.

| Criterio | Caso | Tipo | Cubierto por | Resultado |
|---|---|---|---|---|
| C-01 | Dos versiones válidas entregan claves de 32 bytes | P | T-01 | PASS |
| C-01 | Versión, base64 o clave inválida dan error sin material | N | T-02 | PASS |
| C-01 | Límite de entero y versión actual ausente | B | T-02 | PASS |
| C-02 / CA-23 / CA-11b | Sellar y abrir con AAD correcto y clave actual | P | T-03 | PASS |
| C-02 / CA-23 / CA-11b | Texto vacío se rechaza | N | T-05 | PASS |
| C-02 / CA-23 / CA-11b | Dos sellos iguales usan IV distintos de 12 bytes y tag de 16 | B | T-04 | PASS |
| C-03 / CA-24 | Material auténtico devuelve el texto original | P | T-03 | PASS |
| C-03 / CA-24 | Clave, texto, tag, IV o AAD alterados fallan explícitamente | N | T-06–T-08 | PASS |
| C-03 / CA-24 | Tag corto falla antes del descifrador | B | T-09 | PASS |
| C-04 / CA-25 | Versión vieja aún presente se puede abrir | P | T-11 | PASS |
| C-04 / CA-25 | Versión ausente produce error propio | N | T-10 | PASS |
| C-04 / CA-25 | Error de versión no hereda del de autenticación | B | T-10 | PASS |
| C-05 / CA-25 | Lectura vieja recifra una vez y retiro con conteo cero | P | T-12, T-16, T-35 | PASS |
| C-05 / CA-25 | Conteo positivo impide retiro | N | T-16 | PASS |
| C-05 / CA-25 | Versión igual o mayor no recifra; se conserva versión leída | B | T-12–T-13 | PASS |
| C-06 | Estados permitidos recifran | P | T-14 | PASS |
| C-06 | Desconectada no recifra; PX006 da error | N | T-14–T-15, T-36, T-41 | PASS |
| C-06 | PX008 tolerado sin releer | B | T-15 | PASS |
| C-07 / CA-27 | Cliente del rol usa funciones fijas sin `name` | P | T-18, T-21 | PASS |
| C-07 / CA-27 | Aridad o configuración faltante dan error redactado | N | T-18 | PASS |
| C-07 / CA-27 | `server-only`, único lector de URL y `pool.on('error')` | B | T-18, T-21 | PASS |
| C-08 / CA-26 | SQLSTATE conocido se traduce a error tipado | P | T-17 | PASS |
| C-08 / CA-26 | `detail`, `hint`, URL y contraseña no salen en error | N | T-17, T-53 | PASS |
| C-08 / CA-26 | Error sin código y serialización sin `cause` | B | T-17 | PASS |
| C-09 | K01 válido y nuevo ID del servidor atan el AAD | P | T-19 | PASS |
| C-09 | K01 inválido se rechaza antes de consultar | N | T-19, T-51 | PASS |
| C-09 | Empresa ajena no descifra material movido | B | T-08, T-34 | PASS |
| C-10 | `reveal()` devuelve solo el texto autorizado | P | T-20 | PASS |
| C-10 | Serializaciones no exponen el texto | N | T-20 | PASS |
| C-10 | Plantilla e inspección muestran `[redactado]` | B | T-20 | PASS |
| C-11 | `pg` en producción y build verde | P | T-28, T-40 | PASS |
| C-11 | `pg` no queda en desarrollo | N | T-28 | PASS |
| C-11 | `@types/pg` permanece en desarrollo; lock sincronizado | B | T-28, `npm ci --dry-run --offline` | PASS |
| C-12 / CA-27 | Cinco reglas y dos pruebas originales pasan | P | T-21 | PASS |
| C-12 / CA-27 | URL del rol fuera del módulo permitido se detecta | N | T-21 | PASS |
| C-12 / CA-27 | Llavero y `pg` confinados a sus módulos | B | T-21 | PASS |
| C-13 | Rol de pruebas y referencia SQL deducible se aceptan | P | T-22, T-27 | PASS |
| C-13 | Rol, proyecto, host, puerto u override erróneo se rechazan | N | T-22, T-49 | PASS |
| C-13 | Referencia SQL de app configurada pero no deducible se rechaza | B | Exploratoria Q-02 | **FAIL** |
| C-14 | Destino de pruebas distinto de app se permite | P | T-22–T-23 | PASS |
| C-14 | Variable antigua no habilita app | N | T-23–T-24 | PASS |
| C-14 | Literal aparece solo en T-23 | B | T-24, `rg` | PASS |
| C-15 / CA-26 | Recorrido del árbol limpio | P | T-25 | PASS |
| C-15 / CA-26 | Ocho patrones detectan muestra y redactan informe | N | T-25 | PASS |
| C-15 / CA-26 | Rutas POSIX/Windows y `.env.local` excluida | B | T-25–T-26 | PASS |
| C-16 | Capacidades y flujo vigentes documentados | P | T-29, diff | PASS |
| C-16 | Sin duplicar matriz exacta ni alterar retención | N | T-29, diff | PASS |
| C-16 | OAuth y sincronización siguen previstos | B | T-29, diff | PASS |
| C-17 | Cuatro variables nuevas, vacías | P | T-30, diff | PASS |
| C-17 | Valor en `.env.example` haría fallar la guarda | N | T-30 | PASS |
| C-17 | Conteo trece y texto final corregidos | B | T-30, diff | PASS |
| C-18 / CA-21 | Rol real conecta, funciones crean/leen y rotan | P | T-31, T-33, T-35 | PASS, 8/8 focal |
| C-18 / CA-21 | Tres tablas deniegan lectura y AAD ajeno falla | N | T-32, T-34 | PASS, 8/8 focal |
| C-18 / CA-21 | Desconectada no recifra; falta de URL falla sin skip | B | T-36–T-37 | PASS |
| C-19 | Suites nuevas importan módulos con mock explícito | P | T-38 | PASS |
| C-19 | Sin alias global ni dependencia nueva de `server-only` | N | T-38, diff | PASS |
| C-19 | Convención se aplica por suite | B | T-38 | PASS |
| C-20 / CB-02–04 | Diff de `supabase/` vacío y escáner limpio | P | T-25, T-39 | PASS |
| C-20 / CB-02–04 | Sin pruebas contra app ni migraciones nuevas | N | T-27, T-39, sesión | PASS |
| C-20 / CB-02–04 | Archivos nuevos bajo `supabase/`: ninguno | B | `git ls-files --others` | PASS |
| C-21 | Operación preparada se repite idéntica | P | T-42–T-43 | PASS |
| C-21 | Otro actor/empresa o copia forjada se rechaza | N | T-42, T-51 | PASS |
| C-21 | Clave actual cambia sin resellar operación preparada | B | T-42 | PASS |
| C-22 / CA-25 | Conteo DB cero informado | P | T-16, T-44 | PASS |
| C-22 / CA-25 | Conteo cero solo no autoriza retiro | N | T-44, diff SECURITY | PASS |
| C-22 / CA-25 | Desconectada sin purga sigue contando | B | T-36, T-44 | PASS |
| C-23 | Rewrap confirmado entrega versión leída | P | T-12, T-46 | PASS |
| C-23 | Error explícito no se marca `unconfirmed` | N | T-17, T-46 | PASS |
| C-23 | Timeout durante rewrap antes/después de escribir: `unconfirmed` sin retry | B | T-45–T-46 | PASS |
| C-24 | URL sin override atraviesa la guarda | P | T-47 | PASS |
| C-24 | Parámetros TLS prohibidos se rechazan antes de pool | N | T-47 | PASS |
| C-24 | Parámetros vacíos, repetidos o codificados | B | T-47 | PASS |
| C-25 | CA versionada, TLS y login real | P | T-31, T-48 | PASS |
| C-25 | Fallo TLS no activa fallback | N | T-48 | PASS |
| C-25 | Negociación `postgres` aun con entorno adverso | B | T-50 | PASS |
| C-26 | Shared transaction pooler con 6543 se permite | P | T-31, T-49 | PASS |
| C-26 | Host/puerto/usuario u overrides incorrectos se rechazan | N | T-49 | PASS |
| C-26 | Overrides codificados, vacíos y repetidos | B | T-49 | PASS |
| C-27 | Respuesta K04 válida proyectada y descifrada | P | T-52–T-53 | PASS |
| C-27 | Entradas, envelope y respuestas inválidas se rechazan | N | T-51–T-53 | PASS |
| C-27 | Errores de validación sin SQL, material ni `cause` | B | T-53 | PASS |
| CB-01 | `verify` y suites de III.3 pasan | P | comandos abajo | PASS |
| CB-01 | Fallo exploratorio C-13 impide aceptación global | N | Q-02 | **FAIL del gate** |
| CB-01 | 7 skips ajenos al corte; rol 8/8 | B | `test:app` y focal | PASS |
| CB-05 | Comandos y resultados de implementación constan en sesión | P | sesión M06.3a | PASS |
| CB-05 | Fallos iniciales y limitaciones no se ocultan | N | sesión, revisión 7 | PASS |
| CB-05 | Este QA registra el caso exploratorio fallido | B | este informe | PASS |
| CB-06 | Suite del rol corre 8/8 | P | focal `test:app` | PASS |
| CB-06 | Sin URL, la suite falla antes de conectar | N | T-37 | PASS |
| CB-06 | Siete skips son `email-flows` opt-in y avisos negativos con remoto disponible | B | sesión y `test:app` | PASS |

## Prueba exploratoria

- Se creó temporalmente `tests/unit/__qa__/M06.3a-target-ambiguity.test.ts` usando solo la exportación pública `resolveIntegrationsTestTarget`, con referencias y contraseñas sintéticas, sin red.
- Configuración: URL SQL de app definida en host no Supabase, sin referencia deducible; API pública de app y rol de pruebas con la misma referencia sintética; URL SQL de pruebas válida y marca desechable. Según Diseño §7, la referencia ambigua se rechaza.
- `npm run test:unit -- tests/unit/__qa__/`: exit 1, 1/1 fallida. `expect(result.ok).toBe(false)` recibió `true`. El caso quedó sin cobertura permanente y se propone convertirlo en regresión T-22.
- La prueba temporal se borró. `git status --porcelain=v1` volvió exactamente a la foto inicial, antes de escribir este informe. No hay UI ni recorrido manual de M06.3a: la ruta III.8 declara que este corte no tiene superficie visible.

## Verificación ejecutada

| Comando | Resultado |
|---|---|
| `npm run db:check:test` | Exit 0, destino desechable y URL del rol con la misma referencia; valores no registrados aquí |
| `npm run test:app` en sandbox | Exit 1 al cargar Vitest por `spawn EPERM`; no cuenta como prueba funcional |
| `npm run test:app` con permiso de ejecución | Exit 0, 6 archivos, 37 pasadas, 7 omitidas; ninguna de la suite del rol |
| `npm run test:app -- tests/app/integrations-worker-api-client.test.ts` | Exit 0, 8/8 sin omisiones |
| `npm run verify` | Exit 0: lint, typegen, typecheck, 193/193 unit/component, build completo |
| `npm run test:unit` | Exit 0, 9 archivos, 184/184 |
| `npm run test:unit -- tests/unit/no-secrets-in-tree.test.ts` tras escribir el informe | Exit 0, 5/5; informe y árbol sin hallazgos |
| `npm run test:unit -- tests/unit/__qa__/` | Exit 1 esperado para documentar Q-02, 1/1 fallida |
| `npm ci --dry-run --offline` | Exit 0, lockfile sincronizado |
| T-24: `rg -n SUPABASE_TEST_ALLOW_APP_PROJECT scripts tests src .github docs/SECURITY.md .env.example README.md` | Tres coincidencias, todas en T-23 |
| T-28: comprobación de `pg`/`@types/pg` | `true false true` |
| T-29/T-30/T-38: diffs de SECURITY, ARCHITECTURE, `.env.example`, `package.json` | Dentro de alcance; cuatro variables vacías; `pg` movido |
| T-39: `git diff --name-only main -- supabase/`; archivos no versionados en `supabase/` | Sin salida |
| `git diff --check main` | Exit 0 |

`test:policies` no aplica a este corte: la spec §Verificación lo excluye porque no cambió SQL. La CI Linux no se ejecutó; su flujo corre `npm ci` y `npm run verify`.

## Gate y evidencia de cierre

| Parte | Estado | Evidencia / pendiente |
|---|---|---|
| Dependencia `G-DB-META` | Cumplida | `PROJECT_STATE.md` la registra aprobada |
| Pruebas de la ficha: ciclo, alteraciones, AAD, versión y rotación | Cumplida | T-01–T-16, T-31–T-36; 8/8 en rol real |
| CA-21, CA-23–CA-27 y CA-11b | Cumplida en sus casos especificados | Matriz, pruebas unitarias y app |
| Criterio operativo C-13 / Diseño §7 | **No cumplida** | Q-02: referencia SQL de app ambigua aceptada |
| Evidencia de cierre: pruebas verdes | **No cumplida globalmente** | Suites permanentes verdes; exploratoria requerida fallida |
| Evidencia de cierre: diff documental | Cumplida | T-29; SECURITY y ARCHITECTURE revisados |
| CB-01–CB-06 | CB-01 no cumplida globalmente; resto cumplido | Q-02, comandos y matriz |
| `G-CRYPTO` / condición para avanzar | Pendiente | Corregir Q-02, repetir QA y obtener aprobación visible del usuario |
| `PROJECT_STATE.md` y sesión | Consistentes con el estado anterior a QA; requieren actualización tras la corrección | Mantienen `VERIFICADO — PENDIENTE DE APROBACIÓN` y no habilitan M28.2a |

## Hallazgos

| ID | Severidad | Criterio | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| Q-02 | Media; M06.3a | C-13, Diseño §7, aislamiento de pruebas | `resolveIntegrationsTestTarget` acepta una URL SQL de app cuya referencia no puede deducirse. Puede dar `ok: true` aunque la referencia pública de app coincida con la del rol de pruebas, si falta `SUPABASE_TEST_URL`. | Prueba exploratoria pública, sintética y sin red: exit 1, recibido `ok: true` frente al rechazo requerido. Coincide con la observación R-02 de `implementation-review-7.md`, que la consideró no bloqueante. | Rechazar la referencia SQL de app ambigua dentro de `resolveIntegrationsTestTarget`, sin cambiar `resolveSqlTestTarget`; añadir regresión permanente a T-22 y repetir QA. Registrar formalmente el hallazgo en `docs/HALLAZGOS.md` durante esa corrección. |

## Pendientes del usuario

- Ninguna prueba manual ni dato adicional se necesita para corregir Q-02. La aprobación visible de `G-CRYPTO` corresponde después de una nueva evidencia completa en verde; todavía no se solicita.
- Antes del merge, la CI del PR debe ejecutar `verify` en Linux. No se acredita esa ejecución localmente.
