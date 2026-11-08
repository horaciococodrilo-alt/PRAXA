# Auditoría de la spec M16c — 11

**Fecha:** 2026-11-07  
**Commit base:** `a27f727`  
**Hash de contenido de la spec, excluyendo solo la línea de estado:** `3c1db5b57f9ef68a54760841185cafdef50156db`  
**Estado auditado:** BORRADOR.

Se auditó la versión posterior a `spec-audit-10.md`, con la enmienda de corrida única vigente en el árbol de trabajo. Se preservaron los cambios documentales preexistentes.

## Veredicto

**APROBABLE: 18 PASS, 0 FAIL.** A-01 y A-02 de la auditoría 10 están corregidos en la spec. `npm run verify` terminó con exit 0 en esta auditoría, por lo que A-03 no bloquea la entrada. Esta revisión no cambia el estado de la spec ni cierra G-SYNC.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | Los 16 CA de la ficha están en Heredados, sin contar CA-44b dos veces (`meta_first/plan.md:305`; `M16c/spec.md:241-262`). |
| 2 | Alcance | PASS | Una spec, un plan, tres etapas y una corrida coinciden con la Parte I y II.11 (`meta_first/plan.md:296-327,689-704`; `M16c/spec.md:5,30-40,209-237,289`). C-01 a C-22 trazan a CA, DEC o trampas (`:264-289`). |
| 3 | Coherencia con la spec general y sucesoras | PASS | Catálogo, cobertura, precisión y referencias opacas conservan §11; M25a.1 consume datos guardados y calcula en SQL, sin trasladar su trabajo a M16c (`meta_first/spec.md:326-395`; `meta_first/plan.md:329-357`; `M16c/spec.md:68-106,146-170`). |
| 4 | Decisiones | PASS | D-M16c-01 a -05 identifican decisión del usuario y fecha; D-M16c-05 corresponde a la propuesta aprobada y su sesión de integración (`M16c/spec.md:383-391`; `meta_first/sesiones/enmienda-corrida-unica-2026-11-07.md`). La excepción puntual de ocho horas fue aprobada expresamente. |
| 5 | Trampas | PASS | Ausencia, `paging.next`, posesión, precisión, agregación y metadata histórica están reflejadas (`meta_first/plan.md:706`; `M16c/spec.md:367-381`). |
| 6 | Intervenciones y acciones reservadas | PASS | `db:push:test`, commits de etapa, comunicación, `db:push` en app, integración, push/despliegue, ensayo y aprobación de G-SYNC están asignados al usuario, con verificación posterior (`M16c/spec.md:346-365`; `meta_first/plan.md:315-319,822-841`). |
| 7 | Verificación | PASS | Cada etapa exige `verify`, `db:check:test`, `test:policies` y `test:app` completos; CB-06 impide acreditar pruebas requeridas omitidas (`M16c/spec.md:329,338-342`; `meta_first/plan.md:843-864`). |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:24,28-38` registra G-VR01 aprobado, M16c como siguiente y G-SYNC pendiente; el trabajo de M16.2 está en la rama base. |
| 9 | Lo entregado de verdad | PASS | Las firmas y comportamientos citados de 0012, repositorios, `purge_connection`, adaptador, `graphUrl` y cliente coinciden con el código vigente (`M16c/spec.md:42-64,112-144,174-182`). Las diferencias con la ruta se resuelven en la spec. |
| 10 | Pendientes y hallazgos | PASS | H-E1-22/27/35/36 se asignan a .1; H-E1-117/189 a .3; H-E1-188 queda fuera con motivo; H-E1-190 no bloquea M16c. H-E1-191 documenta el fallo de entorno y esta corrida confirma que no persiste (`M16c/spec.md:393-415,427`; `HALLAZGOS.md:39,44,52-53,129,191-195`). |
| 11 | Contexto real | PASS | Las referencias `archivo:línea` de `M16c/spec.md:44-64,140,221,359,364` existen y sostienen lo afirmado. `PROJECT_STATE.md:28` nombra M16c; el texto histórico de Q-04 se cita ahora en la propuesta que lo conserva (`M16c/spec.md:20,409`; `propuesta-enmienda-gsync-1.md`, «Cambios propuestos»). |
| 12 | Archivos previstos | PASS | `M16c/spec.md:213-237` corresponde a II.11 o a seguimiento y contiene plan y sesión únicos (`meta_first/plan.md:689-704`). La ruta sugerida `sync-calls.ts` queda dentro del módulo permitido. |
| 13 | Diseño suficiente | PASS | Define objetos SQL, firmas, tipos, estados, posesión, payloads, lecturas, interfaces y resultados (`M16c/spec.md:68-207`). La excepción de reloj para `fail_sync_run` tiene salida determinada (`:158-168`). |
| 14 | Verificable | PASS | C-01 a C-22 tienen casos T-01 a T-38 con comandos reales y resultados concretos, incluidos negativos, carreras, reloj y reintento (`M16c/spec.md:264-342`; `package.json`). |
| 15 | Sin nada abierto | PASS | «Preguntas abiertas» no conserva decisiones pendientes; H-01 a H-08 y Ruta H-04 indican cómo y cuándo se contrastan (`M16c/spec.md:393-411`). |
| 16 | Ejecutable ahora | PASS | `npm run verify` sobre `main@a27f727`: exit 0; lint, typegen, typecheck, 26 archivos/595 pruebas y build de Turbopack con 13 páginas estáticas. Scripts requeridos y nombres de variables existen en `package.json` y `.env.example`; las intervenciones previas tienen paso asignado (`M16c/spec.md:350-353`). |
| 17 | Consistencia interna | PASS | La spec declara una única solicitud de `/microfase M16c`, avance entre etapas después de controles/intervenciones y una sola spec para registrar desvíos (`M16c/spec.md:5,7,232-237,340,381,391`), coherente con criterios y casos (`:289,329`). |
| 18 | Reglas no negociables | PASS | K01 en servidor, sin secretos ni datos reales, migración nueva, pruebas en desechable, credenciales por `worker_api` y errores redactados (`M16c/spec.md:32,40,86,112,174,182,207,215,338-356`; `SECURITY.md` §§3, 5, 6 y 11). |

## Contradicciones

Ninguna.

## Hallazgos

Ninguno.

## Seguimiento de la auditoría 10

- **A-01:** `M16c/spec.md:5` ahora distingue la aprobación documental de la solicitud `/microfase M16c` y permite avanzar entre las tres etapas tras sus controles e intervenciones. Las paradas remiten a la spec única (`:237,381`).
- **A-02:** la siguiente microfase se nombra M16c (`:20`); el texto anterior de Q-04 se atribuye a la propuesta aprobada, no a líneas ya enmendadas (`:409`).
- **A-03:** el fallo de creación del proceso de PostCSS quedó registrado como H-E1-191. Esta auditoría ejecutó el comando exacto `npm run verify` fuera de la restricción donde falló antes: exit 0, incluido Turbopack. No se cambió código para obtenerlo.

## Evidencia y límites

- `git status --short --branch` mostró cambios documentales preexistentes y M16c sin rastrear; esta auditoría solo añadió este informe. `git rev-parse --short HEAD`: `a27f727`. El hash se calculó con los bytes de la spec sin la línea `**Estado:**`, conservando los saltos de línea.
- Se contrastaron la spec M16c, `AGENTS.md`, la ruta y su spec general, `PROJECT_STATE.md`, hallazgos, sesiones de dependencias/enmiendas, `SECURITY.md` y el código citado. Los informes anteriores se usaron para comprobar correcciones, no como reemplazo del checklist.
- `npm run verify`: exit 0. No se aplicó 0016 ni se ejecutaron `test:policies` o `test:app`: corresponden a los controles de implementación. No se leyó `.env.local`; el build cargó su configuración normal sin imprimir valores.
- Sin commit, push, despliegue, acceso a producción ni cambios a la spec u otros archivos.

## Tamaño de M16c

La corrida completa probablemente supera ocho horas, pero D-M16c-05 y la Parte I autorizan la excepción puntual con tres controles de etapa. No se propone subdividirla contra esa decisión.

## Siguiente paso

El usuario puede aprobar esta versión de la spec y pasarla a `APROBADA`. Después corresponde preparar y auditar el plan único de M16c. G-SYNC permanece pendiente; esta auditoría no inicia la implementación.
