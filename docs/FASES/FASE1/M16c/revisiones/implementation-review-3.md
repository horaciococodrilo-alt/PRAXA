# M16c — Revisión de implementación 3

Fecha: 2026-11-08, America/Argentina/Buenos_Aires.

## Estado revisado

- Solicitud de seguimiento: el usuario autorizó corregir Q-01 de `qa-review-1.md` y aprobó expresamente que, tras revalidar, se cierre `G-SYNC`. Este informe revisa el estado **antes** de registrar ese gate: `PROJECT_STATE.md` y la sesión aún dicen VERIFICADO — PENDIENTE DE APROBACIÓN.
- Rama `mf/M16c`, HEAD `cd752622f7a906d3c464720a45a2fc2d4f2dd4ea`; main local `718970a4a0623fa3c45c6c79aa44452bc6c1abc7`; base integral `a27f7270310034cc3e64346684b1f5c5e5a20ae3`, autorizada por el usuario en las revisiones anteriores porque la implementación ya está integrada en main.
- Hash literal de la skill frente a main, excluyendo revisiones: **`50e061b80b6104104c979840d60bb147ade157a8`**. Hash integral frente a `a27f727`: **`b4ed0902de91294a63bf1a61afebf867416833b0`**. Cálculo binario con `git diff <base>`, archivos no rastreados no excluidos y `git hash-object --stdin`. Son distintos de los de `implementation-review-2.md` exclusivamente por seguimiento documental.
- Foto inicial de `git status --porcelain`: M `meta_first/sesiones/M16c.md`, M `docs/HALLAZGOS.md`, M `docs/PROJECT_STATE.md`; no rastreados `implementation-review-2.md` y `qa-review-1.md`. Todos se preservaron. El diff no confirmado tiene **solo** esos tres documentos; `git diff cd752622 -- src supabase tests scripts` está vacío.

Se contrastaron `AGENTS.md`, ficha de Parte I, II.11, III.3/III.9, CA/DEC/CB de la ruta, spec/plan únicos, sesión, hallazgos y `git diff a27f727 HEAD` integral. La revisión 2 de este mismo código contiene la lectura completa de aserciones y el análisis del alcance. Esta revisión comprobó de nuevo el diff integral y los tres documentos modificados, incluido Q-01: la frase de etapas pendientes se corrigió, Q-04 ya figura fijado y `H-E1-201` identifica el hallazgo. El gate aún no está aprobado en los documentos revisados.

## Veredicto y checklist

**APROBABLE.** Los ocho ítems pasan. Q-01 quedó corregido. Esto habilita repetir QA sobre el hash nuevo; no equivale por sí solo a cerrar `G-SYNC`.

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Alcance | PASS | Solo seguimiento autorizado en F27–F29 y `HALLAZGOS`; código/esquema/pruebas idénticos al HEAD aprobado de la revisión 2. Diff integral desde `a27f727` dentro de II.11. |
| 2 | Criterios | PASS | Matriz abajo; las aserciones de T-01 a T-38 conservan el código comprobado en revisión 2. Las tres suites completas pasaron de nuevo. |
| 3 | Las pruebas detectan roturas | PASS | Tres mutaciones críticas C-09/C-12/C-18 fallaron en sus aserciones y se restauraron byte por byte. |
| 4 | Reejecución | PASS | `verify` 726 y build; pgTAP 727; app 75 pasan/7 omisiones ajenas. Sin diferencia funcional respecto a sesión/revisión 2. |
| 5 | Seguridad y reglas | PASS | No se leyeron entornos. El escaneo del cambio integral halló cuatro coincidencias de `act_[0-9]{6,}` en fixtures SQL sintéticos, cero de clave privada/proveedor/JWT. Solo 0016 es nueva desde la base; ninguna migración existente alterada. Tenant servidor, RLS, errores redactados y `server-only` verificados en la revisión previa; runtime sin cambios. |
| 6 | Calidad funcional | PASS | Caminos de error, tipos y lectura completa mantienen las pruebas y las mutaciones en verde/rojo esperado. Sin `any`/TODO nuevos. |
| 7 | Evidencia | PASS | Sesión registra controles, publicación, sincronización real y corrección Q-01; `H-E1-201` tiene ID/impacto/evidencia/asignación. `PROJECT_STATE.md` todavía no registra `G-SYNC` como aprobado. |
| 8 | Contradicciones | PASS | Las dos frases obsoletas de `PROJECT_STATE.md` están corregidas; sesión cronológica y spec Q-04 concuerdan. No se alteró el contrato de cuenta vacía D-M16c-02. |

## Matriz de criterios

«Sí» significa que se revisó una aserción del caso indicado en `implementation-review-2.md`, que permanece sin cambio, y se volvió a ejecutar su suite completa; las tres regresiones críticas se mutaron de nuevo. Los resultados externos de cuenta vacía conservan el límite ya declarado.

| Criterio | Prueba | Aserción verifica el criterio (sí/no) | Resultado |
|---|---|---|---|
| C-01 | T-01/02/35/36 | Sí: JWT propio/ajeno y refs | PASS |
| C-02 | T-01/24/31; pgTAP 09/13 | Sí: tablas, ACL y cascada | PASS |
| C-03 | T-03/04 | Sí: inicio único y lease | PASS |
| C-04 | T-04/05/22 | Sí: posesión desplazada y reloj | PASS |
| C-05 | T-06/20/38 | Sí: atomicidad/idempotencia | PASS |
| C-06 | T-07/08/38 | Sí: cuatro resultados y parcial | PASS |
| C-07 | T-02/08/09/10/31 | Sí: ausencia/null/cero y cobertura | PASS |
| C-08 | T-10/11/12 | Sí: historia inmutable | PASS |
| C-09 | T-13/14 | Sí: precisión texto y negativos | PASS; mutación detectada |
| C-10 | T-15/16/37 | Sí: captura, DST y relojes | PASS |
| C-11 | T-16/17/36/37 | Sí: cuatro niveles/ventana local | PASS |
| C-12 | T-17/18 | Sí: metadata y paginación completa | PASS; mutación detectada |
| C-13 | T-19/20/33/34 | Sí: presupuesto/retry/Q-04 | PASS con límite real vacío |
| C-14 | T-21/22/38 | Sí: error persistido/guardas | PASS |
| C-15 | T-03/05/23 | Sí: desconexión/reauth en vuelo | PASS |
| C-16 | T-11/23/24; pgTAP 10 | Sí: purga/cascada | PASS |
| C-17 | T-25/26; pgTAP 09 | Sí: catálogo, ACL y rol | PASS |
| C-18 | T-27/28/35 | Sí: acción/UI/lectura íntegra | PASS; mutación detectada |
| C-19 | T-18/27/29 | Sí: logs/DTO redactados | PASS |
| C-20 | T-12/14/30/31/36 | Sí: tipos, variantes, atribución | PASS con límite real vacío |
| C-21 | T-32 | Sí: listado paginado | PASS |
| C-22 | T-33/34; sesión | Sí: controles y prueba real | PASS técnico; gate pendiente al revisar |
| CA-39 | T-21/22/38 | Sí: clases de fallo y reauth | PASS |
| CA-41 | T-10/11/31 | Sí: snapshot y metadata | PASS |
| CA-42 | T-07/08/17/38 | Sí: agotamiento/cuatro niveles | PASS |
| CA-43 | T-09/10/31 | Sí: cobertura y ausencia | PASS |
| CA-43b | T-15/37 | Sí: flag/DST | PASS |
| CA-44 | T-12/30/31 | Sí: procedencia/unidad/atribución | PASS |
| CA-44b | T-13/14 | Sí: texto decimal exacto | PASS |
| CA-45 | T-06/07/38 | Sí: sustitución/idempotencia | PASS |
| CA-46 | T-02/27/35 | Sí: lectura aislada/estados | PASS |
| CA-47 | T-17/18 | Sí: completitud por agotamiento | PASS |
| CA-47b | T-16/37 | Sí: 28 días locales | PASS |
| CA-56 | T-19/20/34 | Sí: cotas y duración | PASS con límite real vacío |
| CA-57 | T-19 | Sí: retry acotado | PASS |
| CA-58 | T-03/04/05 | Sí: run único/lease | PASS |
| CA-59 | T-05/22/23 | Sí: posesión/estado/generación | PASS |
| CA-60 | T-32 | Sí: listado paginado | PASS |

## Roturas controladas

Se reutilizaron las copias binarias externas de la revisión 2 solo tras comprobar que los originales seguían idénticos. Cada mutación se aplicó de forma aislada y se restauró en `finally`; comparación binaria y SHA-256 confirmados. Los filtros deliberados `-t` no cuentan como verificación completa. Después, la suite unitaria sin mutaciones pasó **114/114**.

| Criterio | Rotura | Prueba que la detectó | Restaurado (cmp) |
|---|---|---|---|
| C-09 | Decimal convertido con `Number`: `00.50` pasa a `0.5` | T-14, exit 1; 1 aserción fallida | Sí; insights `aa25913eac34e105114e86574cf26750e5c2eee2a348d61e8feb226030e7c3d2` |
| C-12 | Quitar rechazo de ID de metadata repetido entre páginas | T-17, exit 1; 2 aserciones fallidas | Sí; entities `cee95b33b84f456a4af05f1073160f1c737f0017d01449f2987a64fa38f3b627` |
| C-18 | Devolver lectura de cobertura antes de agotar total | T-27/lectura, exit 1; 1000 en vez de 2500 | Sí; insights con el SHA-256 anterior |

## Comandos reejecutados

| Comando | Resultado |
|---|---|
| `npm run verify` | Exit 0; lint, typegen, typecheck, 28 archivos/726 pruebas, Turbopack y 13 páginas. |
| `npm run db:check:test` | Exit 0; desechable y rol de cliente válidos. |
| `npm run test:policies` | Exit 0; 14 archivos, 15 ejecuciones, 727 aserciones, 0 problemas. |
| `npm run test:app -- --reporter=verbose` | Exit 0; 11 archivos, 75 aprobadas/7 omitidas, 443,49 s. |
| `npm run test:unit -- tests/unit/meta-insights.test.ts`, tras restaurar | Exit 0; 114/114. |
| `git diff --check` y diff de runtime frente a HEAD | Exit 0; solo tres documentos de seguimiento modificados. |

Las siete omisiones son las tres opt-in de `email-flows.test.ts` y cuatro centinelas de configuración en concurrency, onboarding, integrations-data-api e isolation. Sus suites positivas corrieron; ningún caso requerido de M16c quedó omitido. Las pruebas remotas solo usaron el desechable. No se ejecutó `db:push`, ni se consultó producción o Meta.

## Hallazgos y siguiente paso

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| — | — | — | Ningún hallazgo nuevo | Q-01 corregido en `PROJECT_STATE.md`; suites y mutaciones en verde | — |

La sincronización real de la versión corregida terminó en los cuatro niveles con cero filas. Conforme a D-M16c-02, eso no valida campos/tipos ni holgura con actividad; `H-E1-189` y `H-E1-194` conservan seguimiento. El usuario confirmó en el primer QA el aviso, cuatro niveles y fecha final de Anuncios → Todas.

**Pendiente inmediato:** `$qa-review M16c` sobre este hash. La aprobación explícita del usuario para `G-SYNC` ya fue recibida, pero se registra en el estado después de QA. M25a.1 aún no se inicia.

Preservación: foto inicial más únicamente este informe; mutaciones restauradas byte por byte y diff de implementación vacío. No se hizo commit, push ni publicación.
