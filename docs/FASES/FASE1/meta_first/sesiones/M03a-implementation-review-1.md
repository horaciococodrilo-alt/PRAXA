# M03a — Revisión de implementación 1

## Estado revisado

- Fecha: 2026-10-18.
- Rama: `mf/M03a`; commit: `f71829b59ae008394f683c84edc60882e3d7f14d`.
- Hash del estado, con el método de la skill y excluyendo informes de revisión: `927d809bd97aff955a137789ec179d3833772d6b`.
- Foto inicial de `git status --porcelain`: `M docs/HALLAZGOS.md`, `M docs/PROJECT_STATE.md`, `M docs/SECURITY.md`, `?? docs/FASES/FASE1/M03a/`, `?? docs/FASES/FASE1/meta_first/sesiones/M03a.md`.
- No hay spec ni plan propios de M03a. Se revisaron la ficha de Parte I, II.8, III.3, III.6 y III.9 del plan de la ruta, la spec `meta_first`, `AGENTS.md`, la sesión M03a, los hallazgos H-E1-03 y H-E1-40, los tres documentos modificados y el acta nueva. `git diff main...HEAD` está vacío; se leyó `git diff` y el contenido de los archivos nuevos.
- **Excepción solicitada por el usuario:** la skill exige estado `VERIFICADO — PENDIENTE DE APROBACIÓN`, pero la sesión y `PROJECT_STATE.md` ya registran M03a como cerrada y `G-ACTA-META` aprobado. El usuario pidió hacer igualmente esta revisión del acta. La revisión no revoca por sí misma el gate registrado.

## Veredicto

**REQUIERE CAMBIOS** en el acta por dos omisiones documentales. Los nueve apartados de III.6 están presentes y la revisión cruzada con los DEC y CA citados no encontró otra contradicción interna. La aprobación del usuario está registrada en la sesión y en el estado del proyecto; esta revisión no tiene acceso independiente al mensaje original de aprobación ni a los dashboards de los proveedores.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---:|---|---|---|
| 1 | Alcance | PASS | Solo se modificaron `SECURITY.md` y documentos de seguimiento, además del acta y la sesión nuevos; son los archivos de II.8 o seguimiento. Sin código ni migraciones. |
| 2 | Criterios | FAIL | Revisión documental de III.6 y de los CA/DEC citados: cobertura general completa, pero los detalles de ubicación de Resend y comunicación al dueño requieren corrección (R-01 y R-02). M03a no tiene pruebas automatizadas propias en III.3. |
| 3 | Las pruebas detectan roturas | PASS | No se seleccionaron roturas de código: M03a solo produjo documentación y el plan exige revisión cruzada, sin archivo de implementación ejecutable ni prueba correspondiente que mutar. No se tocó ni restauró código. |
| 4 | Reejecución | PASS | `npm run verify`: segunda ejecución, exit 0, 26/26 suites, 590/590 pruebas y build correcto, coincidente con la sesión. III.3 no añade suites para M03a. La primera ejecución en sandbox falló en seis suites al leer archivos temporales (`ENOENT`); 20 suites y 241 pruebas pasaron. Reejecutada fuera de ese aislamiento, pasó íntegra. |
| 5 | Seguridad y reglas | PASS | Búsqueda de patrones `act_[0-9]{6,}`, `EAA...`, `eyJ...`, `sb_secret_...`: 0 coincidencias en acta y documentos modificados (excluido el patrón escrito literalmente en la sesión). `git diff main --name-only -- supabase/migrations`: vacío. No se leyó `.env.local`, no se usó `service_role`, ni se ejecutó `db:push`. Reglas K01 y `server-only` no cambian en este corte. |
| 6 | Calidad funcional/documental | FAIL | La ubicación declarada de Resend es solo la de envío; falta su almacenamiento en EE. UU. y su plazo publicado de correos/logs. El guion de comunicación menciona datos de Meta y chat, pero no explícitamente los otros datos personales que §1 declara. |
| 7 | Evidencia | PASS | La sesión registra la revisión cruzada, `npm run verify`, sus correcciones y la aprobación declarada. `PROJECT_STATE.md` ya registra el gate aprobado por el usuario; excepción de precondición de esta revisión, no aprobación inferida por el revisor. H-E1-40 sigue pendiente en la ruta. |
| 8 | Contradicciones con las fuentes internas | PASS | El acta sigue DEC-09 a DEC-18, CA-38/38b, CA-62 a CA-67 y las marcas de revisión profesional de III.6. La referencia obsoleta a la línea 181 de `SECURITY.md` está diagnosticada como H-E1-40; se alineó la fila equivalente de §9. |

## Matriz de criterios documentales

| Criterio | Prueba/revisión | La aserción verifica el criterio | Resultado |
|---|---|---|---|
| III.6, qué datos entran | Comparación de §1 con III.6, CA-09b, CA-44b, CA-62, CA-66 y datos existentes de identidad/empresa | Sí | PASS |
| III.6, finalidad y accesos | Comparación de §§2-3 con DEC-10, DEC-13 y CA-64 | Sí | PASS |
| III.6, terceros y ubicación | Comparación de §4 con spec §12, DEC-15, DEC-18 y documentación de Resend | Sí | FAIL, R-01 |
| III.6, retención y borrado | Comparación de §§5-6 con DEC-09/12/17/18/20 y CA-37b/38/38b/67 | Sí | PASS para base y cierre; falta plazo publicado de Resend en R-01 |
| III.6, transferencias e incidentes | Comparación de §§7-8 con III.6, CA-25 y Ley 25.326 art. 12 | Sí | PASS: limitación legal declarada, sin afirmar cumplimiento |
| III.6, comunicación al dueño | Comparación de §9 con III.6 y con todos los datos de §1 | Sí | FAIL, R-02 |
| Aprobación y gate | Sesión M03a, acta §10 y `PROJECT_STATE.md` | Sí, para consistencia documental; no acredita el mensaje original | Registrado como aprobado |

## Roturas

| Criterio | Rotura | Prueba que la detectó | Restaurado (`cmp`) |
|---|---|---|---|
| No aplica | El corte no contiene código ejecutable ni pruebas automatizadas de M03a; se hicieron comparaciones documentales directas | No aplica | No se modificó código |

## Comandos reejecutados y resultados

- `git status --porcelain`, `git diff main...HEAD`, `git diff`, lectura de archivos nuevos y `git diff --check`: sin diff commiteado ni errores de whitespace; estado inicial consignado arriba.
- `npm run verify` en sandbox: exit 1 por `ENOENT` de temporales en seis suites; lint, typegen y typecheck pasaron; build no llegó a correr.
- `npm run verify` fuera del sandbox temporal: exit 0; lint, typegen, typecheck, 26 suites/590 pruebas y build correctos.
- Búsqueda por patrón de secretos e identificadores sobre el acta y documentos modificados: 0 coincidencias efectivas.
- `git diff main --name-only -- supabase/migrations`: sin migraciones modificadas.
- Hash calculado con `git diff main` y bytes de archivos no rastreados, excluyendo informes de revisión, enviados a `git hash-object --stdin` mediante Python para preservar los bytes en Windows.

## Hallazgos

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-01 | media | `docs/FASES/FASE1/M03a/acta-meta.md:61` | La columna «Ubicación» muestra São Paulo para Resend y la salvedad posterior deja sin precisar dónde se almacenan el correo y los registros. Tampoco se explicita su retención publicada. | [Resend, Security](https://resend.com/security): la región elegida controla el envío; los datos almacenados están en EE. UU.; correos y logs se retienen 30 días, con copias de seguridad durante 7 días. §63 del acta advierte que la región de envío no acredita almacenamiento, pero no informa el destino conocido. | Diferenciar «envío desde São Paulo» de «almacenamiento en EE. UU.» y declarar la retención publicada, con fecha/fuente y límite de verificación del proyecto. Ajustar §7 si corresponde. |
| R-02 | media | `docs/FASES/FASE1/M03a/acta-meta.md:107` | El contenido enumerado de la conversación previa explica los datos de Meta y del chat, pero no nombra expresamente los datos de Auth, perfil/contexto de empresa y foto que §1 declara. | §1, líneas 15 y 25, frente al punto 1 de §9. El objetivo de M03a es declarar al dueño qué se guarda, para qué y dónde. | Ampliar el punto 1 de §9 para incluir esos datos y su finalidad, remitiendo a §§1-2. |

**Observación de fuente externa:** la [página actual de privacidad de DeepInfra](https://docs.deepinfra.com/account/data-privacy) dice que no registra contenido de las solicitudes y solo conserva metadatos técnicos. La spec aprobada (DEC-15 y §12) y el acta declaran de forma más conservadora la posibilidad de registrar porciones para depuración o seguridad. No se recomienda suavizar esa declaración solo con esta revisión; antes de escalar, corresponde contrastar las condiciones aplicables y, si cambian, enmendar la ruta y el acta juntas.

## Pendientes del usuario y siguiente paso

- No hace falta una acción del usuario para corregir R-01 y R-02 dentro de M03a; sí corresponde que el usuario apruebe cualquier versión revisada del acta antes de apoyarse en ella como declaración aprobada.
- La evaluación profesional de transferencias y notificación de incidentes permanece expresamente no realizada por decisión del usuario; no se afirma cumplimiento legal.
- Siguiente paso de la skill: `$microfase M03a` con R-01 y R-02. No se inició otra microfase ni se modificó el acta.
