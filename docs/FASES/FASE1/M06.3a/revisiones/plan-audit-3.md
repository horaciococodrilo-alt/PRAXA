# M06.3a — Auditoría de plan 3

- Fecha: 2026-10-01.
- Commit base: `f96b3b3a0c49e6e67d132724fee7ba629e60170f` (`main`).
- Spec aprobada: `docs/FASES/FASE1/M06.3a/spec.md`; hash de contenido sin la línea `**Estado:**`: `73916504c73990df7a2d38ff18b7ea7f3c592375`.
- Plan en estado BORRADOR: `docs/FASES/FASE1/M06.3a/plan.md`; hash de contenido sin la línea `**Estado:**`: `9dba61e69272a17d27479c56cd526405a2c44fe2`.
- El hash del plan coincide con el de `plan-audit-2.md`; no hubo cambios de contenido desde esa auditoría.

## Precondiciones y veredicto

Las cuatro precondiciones pasan. La spec figura como **APROBADA**; `spec-audit-5.md` es la última auditoría de spec y concluye **APROBABLE**; su hash registrado coincide con el actual; el plan existe. Los hashes se calcularon como objetos Git `blob` a partir de los bytes del archivo, excluyendo únicamente la línea de estado.

**APROBABLE.** Los doce ítems pasan. Este veredicto audita el plan; no implementa M06.3a ni aprueba `G-CRYPTO`.

En la tabla, **P** es el plan de M06.3a, **S** su spec y **R** el plan de `meta_first`.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Spec base | PASS | P:7 cita S aprobada y su hash `73916504...`, idéntico al cálculo actual y a `spec-audit-5.md`. |
| 2 | Cobertura | PASS | Al expandir los rangos de P §Pasos, los pasos concretos 0–13 cubren 27/27 criterios operativos y los pasos 0–15 cubren 53/53 casos T-01–T-53. Los CA heredados de S:475–485 se trazan a cifrado (1, 5), repositorio (2, 7), guardas (3, 9), acceso real (4, 12) y cierre (13–14). |
| 3 | TDD | PASS | P pasos 1–4 escriben las pruebas antes de los módulos y guardas de 5–9; cada rojo debe atribuirse a funcionalidad ausente. Los casos manuales y documentales tienen inspección o diff; P:61 justifica no fabricar un secreto para forzar rojo del scanner. |
| 4 | Archivos | PASS | P:25–43 se contiene en R II.6:505–518. P:44–46 son los tres archivos de seguimiento autorizados por R precondición 8; P:47–48 son artefactos del pipeline autorizados por la precondición 9. No se prevén archivos de implementación adicionales. |
| 5 | Pasos | PASS | Cada fila de P:58–74 tiene verificación. El paso 8 comprueba dependencias y lockfile sin exigir build antes del resolvedor del paso 9. T-24 completo sigue a la edición de SECURITY en 13; el build completo se exige en 14. La intervención 11 antecede a la suite real 12, y la evidencia 15 antecede a la aprobación del gate. |
| 6 | Migraciones | PASS | P:154–158 no crea ni altera SQL. El último archivo es `0012_integrations.sql`; `0013` queda asignada a M16c. T-39 exige diff vacío en `supabase/` y una eventual reversión de esquema requeriría migración nueva. |
| 7 | Comandos | PASS | `test:unit`, `db:check:test`, `test:app`, `verify`, `build`, `env:prepare`, `db:push` y `db:push:test` existen en `package.json`; `npm ci --dry-run` verifica sincronización. P:97–104 conserva `db:check:test`, `test:app` y `verify` de R III.3, con suite real obligatoria y sin omisión por configuración (CB-06). |
| 8 | Acciones reservadas | PASS | P pasos 11, 15–16 y P:140–150 ubican contraseña, URL y llavero a cargo del usuario antes de T-31/T-33, y aprobación visible después de la evidencia. Push, despliegue y ambos `db:push` quedan reservados al usuario, no aplican al trabajo técnico de este corte y tienen comprobación posterior. |
| 9 | Reglas | PASS | P exige material sintético, scanner y errores redactados; P:78–83 conserva K01 como fuente de actor/empresa y `worker_api` como única vía de credenciales. P:69–70 y P:95–104 exigen validar el proyecto desechable antes de la suite real; no se prevé leer `.env.local` ni conectar al proyecto `app`. |
| 10 | Trampas | PASS | P pasos 1/5 prueban IV nuevo, etiqueta y versión ausente diferenciada; 2/6/9 cubren parser, TLS, pooler, errores y destino efectivo; 3/9 cubren la excepción obsoleta y el scanner; 4/12 y T-37 impiden falsos verdes por configuración. P:619–650 registra los demás riesgos de la ruta y S con verificación o parada. |
| 11 | Git | PASS | P:58 prepara `mf/M06.3a` conservando cambios previos, sin reset ni limpieza; P:73–74 y P:146–150 reservan cualquier publicación y el push al usuario. La auditoría actual en `main` no ejecuta la microfase. |
| 12 | Fidelidad | PASS | P conserva las interfaces y decisiones de S §§2–12, los resultados de T-01–T-53, el límite de recifrado de H-E1-37 y los archivos de R II.6. No agrega OAuth, migración, retry automático, infraestructura de retiro ni API productiva para las sondas de prueba. |

## Hallazgos

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| — | — | — | Ninguno en esta auditoría. | Doce ítems PASS; el hash del plan sigue siendo el auditado en `plan-audit-2.md`. | — |

## Verificaciones y límites

- Se leyeron AGENTS, S, P, la ficha de M06.3a y II.6 de R, las precondiciones 8–9, III.2/III.3/III.9, `PROJECT_STATE.md`, `package.json`, el directorio de migraciones y el código existente afectado por el plan. G-K01, G-K02-K04 y G-DB-META figuran cerrados en `PROJECT_STATE.md`.
- Una expansión de los rangos C/T de la columna de pasos produjo 27/27 criterios y 53/53 casos, sin ausencias. Se revisó la cobertura semántica y el orden de los pasos, incluidos los hallazgos P-01/P-02 de `plan-audit-1.md`, ya resueltos en el contenido actual.
- `git diff --check` terminó con exit 0 y `git diff --name-only main -- supabase/` no produjo salida. Git mostró avisos de normalización LF/CRLF en tres documentos modificados previamente; no son fallos del diff.
- No se ejecutaron las suites, la guarda de base ni `verify`: los módulos y pruebas nuevos todavía no existen. Tampoco se abrió `.env.local`, se conectó a una base, se instaló nada ni se hizo commit o push. Los cambios preexistentes se preservaron.

## Observación sobre tamaño y siguiente paso

El plan reúne cifrado, guardas y una prueba remota, pero la revisión documental no aporta una medición suficiente para afirmar que excede las ocho horas ni para recomendar una división concreta. Esta observación no cambia el veredicto.

El usuario puede revisar y aprobar visiblemente el plan. Después, en una sesión nueva, elegir modelo y esfuerzo y solicitar `$microfase M06.3a`. `G-CRYPTO` permanece pendiente hasta ejecutar y verificar la implementación.
