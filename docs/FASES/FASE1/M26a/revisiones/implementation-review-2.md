# M26a — Revisión de implementación 2 (abreviada, en lugar de `/implementation-review` y `/qa-review`)

- **Fecha:** 2026-11-14
- **Rama:** `mf/M26a`
- **Commit revisado:** `d36ee62` («M26a: correcciones de la revisión de código (H-E1-243 a H-E1-249)»)
- **Base:** `origin/main@88fc5b7`; diff `88fc5b7..d36ee62`, 51 archivos.
- **Revisor:** el asistente de la sesión de implementación. No es independiente.
- **Excepción:** el usuario decidió no repetir `/implementation-review` ni `/qa-review` del paso 23 («con tu revisión basta»). Esta revisión los reemplaza. No hubo worktree aislado ni `npm ci`: los comandos corrieron en el directorio del usuario.

## Veredicto

**APROBABLE CON EXCEPCIONES.** El código cumple los criterios comprobables sin el modelo real, los hallazgos de la revisión 1 están resueltos y los cambios están dentro de la lista cerrada del plan. Antes de aprobar `G-DIAG` quedan pendientes los pasos 24 a 26 y las excepciones de abajo.

## Hallazgos de la revisión 1

| ID | Estado | Evidencia |
|---|---|---|
| R-01 | Resuelto | `actions.ts`: el guardado valida con el catálogo de la ventana de la elegibilidad, la misma que muestra la pantalla. |
| R-02 | Resuelto | `diagnostics-orchestrator.test.ts`, «M26a-T-21 (unitaria): páginas web con instrucciones». |
| R-03 | Resuelto | `validate.ts`: `/[\p{Nd}\p{No}]/u`. |
| R-04 | Resuelto | `git diff --check 88fc5b7 HEAD -- src tests supabase`: limpio. |
| R-05 | Resuelto | La sesión y `PROJECT_STATE.md` dicen VERIFICADO — PENDIENTE DE APROBACIÓN. |
| R-06 | Resuelto | `orchestrator.ts`: `sameInstant` corta con `sync_changed` antes de reservar; prueba R-06. |
| R-07 | Resuelto | Aviso de atribución por período (`H-E1-247`); estados traducidos (`STATUS_LABEL`); antigüedad rotulada «informada por la fuente». |
| R-08, R-09 | Decididos por el usuario | Sesión: el corpus del paso 20 no se escribe (`H-E1-242`); los subdominios quedan aprobados. |
| R-10 | Sin efecto hoy | `test:app` del 2026-11-14: 91 pasadas, 7 omitidas, exit 0. |

## Criterios

| Criterio | Estado | Evidencia principal |
|---|---|---|
| C-01 a C-08, C-11 a C-13, C-15 | Cumplen | pgTAP `17_meta_diagnostics` (127 aserciones), `tests/app/meta-diagnostics.test.ts`, pruebas unitarias del módulo. Ningún argumento ni URL acepta `company_id` o `connection_id` del navegador. |
| C-09, C-10, C-19 | Cumplen con proveedor simulado | Validación de forma, referencias, numerales y aserciones; web adversaria; reparación única; no publica ante salida inválida. |
| C-14 | Cumple, con límite | Árbol del PDF igual al modelo de documento; cabeceras; 3 PDF sintéticos aprobados por el usuario. Límite aceptado: `H-E1-252`. |
| C-16 | Cumple en parte | `SECURITY.md`, `ARCHITECTURE.md` y el acta, actualizados y aprobados. **Falta declarar la comunicación al dueño** antes del primer dato real. |
| C-17 | **Excepción** | `H-E1-242`: sin evaluación con el modelo real. |
| C-18 | Cumple | La clave solo se lee en `provider.ts`; sin `temperature`, `top_p` ni `top_k`; el uso cuenta también las respuestas inválidas facturadas (`H-E1-249`). |

## Alcance

Todos los archivos del diff están en la lista cerrada del plan (grupos A a N). `AGENTS.md` cambia solo en la línea autorizada.

## Verificaciones (2026-11-14, sobre el árbol que luego se commiteó como `d36ee62`)

| Comando | Resultado |
|---|---|
| `npm run db:check:test` | Exit 0 |
| `npm run test:policies` | 1087 aserciones, 0 problemas |
| `npm run test:app` | 91 pasadas, 7 omitidas |
| `npm run verify` | Exit 0: 1214 pruebas y build |

## Excepciones y pendientes para `G-DIAG`

1. `H-E1-242`: C-17, T-19, T-20, T-21 (parte eval) y T-31 sin modelo real.
2. `H-E1-250`, desviación de la spec aceptada; `H-E1-252`, límite del PDF aceptado.
3. `H-E1-251`: tamaño del informe sin medir con desgloses completos.
4. Revisión independiente omitida por decisión del usuario (esta revisión la reemplaza).
5. Comunicación al dueño (acta, sección 9) antes del primer dato real.
6. Pasos 24 (push, vista previa contra el desechable, `db:push` de `0022` en `app`, clave en Vercel), 25 (recorrido de `app`) y 26 (decisión de `G-DIAG`).
