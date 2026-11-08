# Auditoría del plan M16c — 3

**Fecha:** 2026-11-08  
**Commit base:** `a27f7270310034cc3e64346684b1f5c5e5a20ae3` (`main`)  
**Hash de contenido de la spec, excluyendo la línea de estado:** `3c1db5b57f9ef68a54760841185cafdef50156db`  
**Hash de contenido del plan, excluyendo la línea de estado:** `89d59a82d7a3bf3c43e55e6b5f831edb3d5e9c0b`

## Veredicto

**APROBABLE: 12 PASS, 0 FAIL.** P-01 a P-03 de `plan-audit-2.md` están corregidos. El plan sigue en `BORRADOR`; esta auditoría no lo aprueba por el usuario ni inicia M16c.

## Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| Spec `APROBADA` | Cumple | `M16c/spec.md:3`. |
| Última auditoría de spec APROBABLE | Cumple | `spec-audit-11.md:12`: 18 PASS, 0 FAIL. |
| Hash actual de spec igual al auditado | Cumple | `3c1db5b…` calculado sobre los bytes actuales coincide con `spec-audit-11.md:5`. |
| Plan existente | Cumple | `M16c/plan.md`, en `BORRADOR`. |

## Checklist

| # | Ítem | Resultado | Evidencia |
|---:|---|---|---|
| 1 | Spec base | PASS | `plan.md:7` cita `spec.md` y `3c1db5b…`; coincide con el hash actual y la auditoría 11. |
| 2 | Cobertura | PASS | Los pasos 0–20 trazan C-01 a C-22, T-01 a T-38 y los 16 CA heredados. El paso 20 consolida la matriz; los pasos 2, 3, 8, 9 y 14 asignan los casos a pruebas concretas. |
| 3 | TDD | PASS | RED 2→GREEN 4, RED 3→GREEN 6, RED 8/9→GREEN 10/11 y RED 14→GREEN 15. El paso 13 exige probar bordes antes de fijar Q-04. `plan.md:144` justifica T-32, T-33 y T-34 sin TDD. |
| 4 | Archivos | PASS | F01–F29 (`plan.md:27-55`) están en II.11 de la ruta o son spec, plan y seguimiento autorizados. F07 es una ubicación sugerida dentro de `integrations` permitida por `spec.md:221` y la regla de la ruta. F12 incluye ahora el paso 15. |
| 5 | Pasos | PASS | Cada paso tiene verificación. El parser y la precedencia probados en RED del 14 tienen GREEN explícito en F12 del 15 (`plan.md:103-104`), corrigiendo P-01. 0016 se aplica al desechable antes de pruebas de integración; Q-04, comunicación y migración de app preceden la captura real. |
| 6 | Migraciones | PASS | La última migración existente es `0015_activation_row_lock.sql`. `plan.md:164-171` crea solo 0016, conserva 0001–0015 y exige una migración nueva para correcciones posteriores a su aplicación. |
| 7 | Comandos | PASS | `package.json` define `verify`, `db:check:test`, `test:policies`, `test:app`, `test:unit`, `test:component`, `db:check`, `db:preview`, `db:push` y `db:push:test`. `plan.md:113-140` incluye las suites completas de III.3 en cada etapa y CB-06. |
| 8 | Acciones reservadas | PASS | `plan.md:146-161` reserva al usuario `db:push:test` (5), configuración del checkout (7), commits, límite Vercel (13), comunicación (16), `db:push` en app, integración/push/despliegue (18), ensayo (19) y gate (20), cada una con verificación posterior. El paso 7 detalla checkout, `npm ci`, guarda, prueba y limpieza, corrigiendo P-02. |
| 9 | Reglas | PASS | K01 se resuelve en servidor y la acción no recibe argumentos de negocio (11, 15). Credenciales y operaciones privilegiadas pasan por repositorio y `worker_api` (6, 11). Fixtures sintéticos y pruebas solo en desechable; sin secretos ni valores reales en evidencia y sin suites en app (0, 2, 9, 18, 19). |
| 10 | Trampas | PASS | Ausencia ≠ cero (9), `paging.next` descartado (10), posesión/reloj bajo bloqueos (1–4), SQL textual y no sumar niveles/tasas/atribuciones (decisiones 10/11 y «Qué no se hace»), metadata histórica (2, 8), purga/catálogo/timeout (2–4, 8, 11). Las hipótesis H-02, H-03 y H-07 tienen contraste real y registro explícito en 19–20, corrigiendo P-03. |
| 11 | Git | PASS | `plan.md:61,74,161,180` sitúa la implementación en `mf/M16c`, preserva el árbol, reserva commits y push al usuario y evita operaciones destructivas. El checkout temporal del SHA base se crea y retira sin `--force`. |
| 12 | Fidelidad | PASS | Las tres etapas, los cuatro niveles, la acción/UI, Q-04 y G-SYNC corresponden a `spec.md:30-40,209-237,239-365` y a Parte I/II.11. `plan.md:185-191` excluye chat, workers y otras funciones ajenas. La corrección del parser queda en el archivo autorizado F12. |

## Hallazgos

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| — | — | — | Ninguno. | — | — |

## Evidencia y límites

- Hashes calculados con los bytes de cada archivo, excluyendo únicamente la línea que comienza `**Estado:**`, y `git hash-object --stdin`.
- Se contrastaron `AGENTS.md`, spec y plan completos de M16c, la ficha de Parte I, II.11, III.3 y III.9 de `meta_first/plan.md`, `package.json`, la numeración de `supabase/migrations/`, los archivos de código y pruebas previstos, `tests/app/setup.ts` y el informe anterior. El árbol ya contenía cambios documentales del usuario y M16c sin rastrear; se preservaron.
- No se ejecutaron suites ni migraciones: esta es una auditoría documental. La auditoría de spec 11 registró `npm run verify` en verde sobre el mismo commit. No se leyó `.env.local`.
- Esta auditoría solo añade este informe. Sin commit, push ni despliegue.

## Tamaño

M16c supera ocho horas, pero D-M16c-05 y Parte I autorizan expresamente la excepción con tres controles de etapa. No se recomienda partir la microfase contra esa decisión.

## Siguiente paso

El usuario puede pasar el plan a `APROBADO`. Después, elegir modelo y esfuerzo, abrir una sesión nueva y correr `$microfase M16c`.
