# Auditoría de la spec M16c — 9

**Fecha:** 2026-11-07  
**Commit base:** `a27f727`  
**Hash de contenido de la spec, excluyendo solo la línea de estado:** `a31ed49e9b88321e2df01ddbb42bf37795d6d4f2`  
**Estado auditado:** BORRADOR.

Se auditó la versión vigente de `M16c/spec.md` frente a la ruta `meta_first` enmendada, el estado, la evidencia de dependencias y el código. Los cambios preexistentes del árbol de trabajo se preservaron.

## Veredicto

**APROBABLE: 18 PASS, 0 FAIL.** La contradicción A-01 de `spec-audit-8.md` está resuelta. Esta auditoría no cambia el estado de la spec ni habilita por sí sola M16c.1.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | Los 16 CA de la ficha `meta_first/plan.md:303` aparecen en Heredados, sin duplicar CA-44b (`M16c/spec.md:241-262`). |
| 2 | Alcance | PASS | Los tres cortes y C-01 a C-22 trazan a la ficha, II.11, CA, DEC o trampas (`M16c/spec.md:26-40,264-289`; `meta_first/plan.md:294-319,681-698`). |
| 3 | Coherencia con la spec general y sucesoras | PASS | Catálogo, cobertura, precisión, atribución y referencias opacas siguen §11 y el contrato que consumirá M25a (`meta_first/spec.md:326-395`; `meta_first/plan.md:321-349`; `M16c/spec.md:68-106,146-156,170`). |
| 4 | Decisiones | PASS | D-M16c-01 a -04 identifican decisión del usuario y fecha; la enmienda de G-SYNC está integrada (`M16c/spec.md:382-389`; `meta_first/sesiones/enmienda-gsync-2026-11-07.md`). |
| 5 | Trampas | PASS | Ausencia, paginación, posesión, precisión, agregación y metadata histórica están reflejadas (`meta_first/plan.md:698`; `M16c/spec.md:368-380`). |
| 6 | Intervenciones y acciones reservadas | PASS | `db:push:test`, `db:push` de app, push/despliegue, comunicación, ensayo y gates están asignados al usuario con verificación posterior (`M16c/spec.md:346-364`; `meta_first/plan.md:814-833`). |
| 7 | Verificación | PASS | Cada corte exige `verify`, `db:check:test`, `test:policies` y `test:app`; aplica CB-06 a las omitidas (`M16c/spec.md:338-342`; `meta_first/plan.md:835-856`). |
| 8 | Dependencias | PASS | `PROJECT_STATE.md` registra G-VR01 aprobado y M16c.1 como siguiente; la base contiene M16.2. G-SYNC-DB y G-SYNC-EXTRACT permanecen pendientes para los cortes posteriores. |
| 9 | Lo entregado de verdad | PASS | Las firmas y contratos citados de 0012, repositorios, `purge_connection`, adaptador, `graphUrl` y cliente coinciden con el código; las diferencias frente a la ruta quedan resueltas (`M16c/spec.md:42-64,112-144,174-182`). |
| 10 | Pendientes y hallazgos | PASS | H-E1-22/27/35/36 se asignan a .1; H-E1-117/189 a .3; H-E1-188 se difiere con motivo y H-E1-190 no afecta este corte (`M16c/spec.md:391-409`; `HALLAZGOS.md`; `PROJECT_STATE.md`). |
| 11 | Contexto real | PASS | Se cotejaron las referencias `archivo:línea` de `M16c/spec.md:42-64,140,401-402` con migración 0012, pgTAP 09/10, runner, repositorios, adaptador, Meta, pruebas y sesión M16.2; existen y sostienen lo afirmado. |
| 12 | Archivos previstos | PASS | La tabla `M16c/spec.md:209-237` corresponde a II.11 o a seguimiento; `sync-calls.ts` es ruta sugerida dentro del módulo y la tarjeta preserva su contrato existente (`meta_first/plan.md:687-694,954`). |
| 13 | Diseño suficiente | PASS | Define objetos SQL, firmas, estados, posesión, payloads, clasificación de fallos, lecturas, interfaces y resultado de acción (`M16c/spec.md:68-207`). El rechazo 22023 tiene salida ejecutable (`:160-167`). |
| 14 | Verificable | PASS | C-01 a C-22 tienen casos T-01 a T-38 con comandos reales y resultados concretos, incluidos negativos, carreras, reloj adelantado y reintento (`M16c/spec.md:264-336`; `package.json`). |
| 15 | Sin nada abierto | PASS | «Preguntas abiertas» no conserva decisiones pendientes; cada hipótesis tiene verificación y momento asignado (`M16c/spec.md:391-409`). |
| 16 | Ejecutable ahora | PASS | `npm run verify` sobre `main@a27f727`: exit 0, lint, typegen, typecheck, 26 archivos/595 pruebas y build de 13 páginas estáticas. Scripts requeridos en `package.json` y nombres de variables en `.env.example` existen; la intervención de .1 está asignada (`M16c/spec.md:350-352`). |
| 17 | Consistencia interna | PASS | El `p_fetched_at` permanece congelado; solo `fail_sync_run` acepta el futuro y guarda hora de fallo de la base, sin cobertura ni frescura ficticia. T-37 verifica nivel, run, conexión e idempotencia (`M16c/spec.md:158-168,277,333-336`). |
| 18 | Reglas no negociables | PASS | K01 servidor, migración nueva, pruebas en desechable, credenciales por `worker_api`, errores redactados y ausencia de secretos/datos reales están expresos (`M16c/spec.md:32,86,112,174,182,207,215,338-356`; `SECURITY.md`). |

## Contradicciones

Ninguna.

## Hallazgos

Ninguno.

## Seguimiento de la auditoría 8

A-01 quedó corregido: `publish_snapshot` conserva el rechazo 22023 de un instante futuro; la orquestación registra el fallo por `fail_sync_run` con payload vacío y sin progreso, y SQL guarda la hora de la base solo en el snapshot fallido. El instante original queda en `request_payload` para reconocer un reintento idéntico. No se escribe cobertura ni se muestra esa hora como frescura. T-37 exige comprobar esos efectos (`M16c/spec.md:160-167,333-336`).

## Evidencia y límites

- `git status --short --branch`: los cambios documentales y el directorio M16c ya existían; esta auditoría solo añadió este informe. `git rev-parse --short HEAD`: `a27f727`. El hash se calculó sobre los bytes de la spec sin la línea `**Estado:**`, conservando los saltos de línea.
- Se leyeron la spec M16c, `AGENTS.md`, la ruta, su spec general, `PROJECT_STATE.md`, los hallazgos pertinentes, las sesiones de dependencias/enmiendas, `SECURITY.md` y el código citado. El informe 8 se usó para comprobar la corrección, no como sustituto del checklist.
- `npm run verify`: exit 0. No se aplicó 0016 ni se ejecutaron `test:policies` o `test:app`: corresponden a la implementación y cierre de cada corte. No se leyó `.env.local`.
- Sin commit, push, despliegue, acceso a producción ni cambios a la spec u otros archivos.

## Tamaño del corte

M16c.1 concentra migración, ACL/RLS, funciones, purga, adaptador, lifecycle y pgTAP. Su plan propio debe comprobar el límite de ocho horas y subdividir antes de implementar si no cabe, conforme a `meta_first/plan.md:311`.

## Siguiente paso

El usuario puede aprobar esta spec y pasarla a `APROBADA`; después corresponde preparar y auditar la spec y el plan propios de M16c.1. Esta auditoría no inicia M16c.1 ni cierra sus gates.
