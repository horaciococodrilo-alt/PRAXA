# M16.1 — Auditoría del plan (ronda 3)

- **Fecha:** 2026-10-14
- **Commit:** `609ea29` (rama `main`; árbol con cambios sin commitear en `docs/`)
- **Hash de contenido de la spec** (sin la línea de estado): `5617217350930db2d1a54c8a26269b4220efe59f`
- **Hash de contenido del plan** (sin la línea de estado): `40bd0fe11c93dea0d0192d08a1c8d67d7eaa7b4b`

**Nota de independencia.** Las correcciones de P-01 a P-04 de `plan-audit-2` las aplicó, a pedido del usuario, la misma sesión que ahora audita. Esta ronda re-evalúa el plan completo contra la spec y la ruta, sin confiar en la ronda anterior. Aun así, el usuario puede querer una segunda lectura en una sesión nueva antes de aprobar.

## Veredicto

**APROBABLE.**

Todos los ítems están en PASS, salvo "Migraciones", que no aplica (justificado). Los cuatro hallazgos de la ronda 2 (P-01 a P-04) están resueltos. No hay hallazgos nuevos.

## Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| `spec.md` en `APROBADA` | PASS | `spec.md:3`. |
| La última `spec-audit-N` es APROBABLE | PASS | `spec-audit-4.md`. |
| El hash actual de la spec coincide con el de esa auditoría | PASS | `5617217350930db2d1a54c8a26269b4220efe59f` en los dos lados. |
| `plan.md` existe y está en `BORRADOR` | PASS | `plan.md:3`. |

## Checklist

| # | Ítem | Resultado | Evidencia o justificación |
|---|---|---|---|
| 1 | Spec base | PASS | `plan.md:7` cita la spec con el hash `5617217…efe59f`, igual al actual. |
| 2 | Cobertura | PASS | Casos: T-01 a T-22 (paso 2), T-23 (3), T-24 a T-35 (4) y T-36 a T-43 (10). Todos tienen un paso de implementación o de verificación. Criterios C-01 a C-31: C-01, C-03, C-05 a C-07, C-17, C-18 y C-31 en el paso 5; C-02, C-08 a C-11 y C-22 en el 6; C-04, C-12 a C-16, C-17, C-19 a C-21, C-23 y C-24 en el 7; C-25 en el 5 y el 8; C-26 en el 4; C-29 en el 9; C-27, C-28 y C-30 en el 10. Heredados: CA-28 a CA-35, CA-02b/c, CA-04, CA-09, CA-26, CA-39 y CB-01 a CB-06 figuran en al menos un paso. |
| 3 | TDD | PASS | Pruebas en los pasos 2 a 4, implementación en los pasos 5 a 8. `plan.md:49` explica por qué T-24, T-36, T-38, T-39 y T-43 quedan fuera (guarda, regresión, revisión manual, corrida de cierre) y aclara que T-37 sí sigue el orden. `plan.md:51` y cada paso de implementación indican qué casos siguen rojos hasta un paso posterior. |
| 4 | Archivos | PASS | Los archivos de implementación son los de II.9, o ubicaciones dentro del mismo módulo que el plan registra (`outcomes.ts`, `attempts.ts` y `connections.ts`; II.9 paso 7 nombra "Repositorio de conexiones" sin ruta). Los de seguimiento son `HALLAZGOS.md`, `PROJECT_STATE.md` y `sesiones/M16.1.md` (precondición 8), más `plan.md` y `revisiones/*.md` (precondición 9). Las citas ya dicen "precondición 8" y "precondición 9 de la Parte II". Ningún archivo ajeno. |
| 5 | Pasos | PASS | El orden respeta las dependencias. El paso 5 deja en verde lo que sus cinco archivos pueden cumplir (T-01, T-03, T-05, T-06, T-07 en su parte de errores, T-17 en su parte de `tokens.ts`, T-18, T-22, T-41, T-42) y nombra los casos que esperan a los pasos 6 y 7. `outcomes.ts` está antes de las rutas que lo usan. T-02 se cierra en el paso 6, y T-04, T-07 (canje), T-17 (mapeo) y T-40 en el 7, cuando existen los seis módulos y el callback. T-32 se cierra en el paso 7, porque necesita una pendiente creada por el callback. Cada paso tiene su verificación. El paso 1 ya no describe la spec como `BORRADOR`. |
| 6 | Migraciones | NO APLICA | La ficha, la spec ("Fuera de alcance", "Archivos previstos") y el plan excluyen migraciones y pgTAP. Los pasos 12 y 13 comprueban su ausencia. Último número existente: `0014`; no se crea ninguno. |
| 7 | Comandos | PASS | `db:check:test`, `test:unit`, `test:component`, `test:app` y `verify` existen en `package.json`. `verify` encadena lint, typegen, typecheck, `test` (unit y component) y build. III.3 para `M16.1` exige `test:app` además de `verify`: está en los pasos 4, 7 y 10, y en "Verificación final". CB-06 está en los pasos 4, 10 y 15. `git switch -c mf/M16.1` y `git diff --stat` son comandos válidos de Git. |
| 8 | Acciones reservadas | PASS | Commit, merge, push y despliegue son del usuario (paso 14), con verificación posterior: `Ready`, `GET` 405, `POST` sin `Origin` 403 y "Conectar" deshabilitado. `db:push` y `db:push:test` no aplican, no se ejecutan, y los pasos 12 y 13 verifican la ausencia de migraciones. `G-OAUTH` queda en el paso 15, después de las verificaciones. La aprobación visible de la Enmienda M16.1 es una intervención del usuario previa al paso 1, con verificación (encabezados de la ruta). |
| 9 | Reglas | PASS | Evidencia redactada y sin valores de entorno (pasos 9 y 11). Tenant por K01 en el servidor (pasos 6 y 7; C-11, T-11, T-12). Credenciales solo por `worker_api`, sin `PRAXA_INTEGRATIONS_DB_URL` en la suite (paso 4). `db:check:test` antes de cualquier prueba remota (paso 4). Sin autorización real (pasos 14 y 15). |
| 10 | Trampas | PASS | Las seis de II.9 y las 21 de la spec tienen paso o verificación. Consumo atómico: pasos 6 y 7 con T-13 y T-16. Código por el navegador y logs del hosting: pasos 7 y 9. Handler fuera del proxy: pasos 6 y 7. `scope`: T-02, paso 6. Reloj de 9 min: C-10. Suite que no se salta y URL del rol: paso 4. URLs de salida: C-31 con T-40 a T-42. Casos A y B, H-S-13 y H-S-15: paso 11 y "Riesgos". Exposición antes de `M16.2`: paso 14. Fixtures: paso 10. |
| 11 | Git | PASS | El paso 1 crea o retoma `mf/M16.1` con `git switch -c` (no destructivo, conserva los cambios) y dice que el asistente no hace commit ni push. El paso 14 reserva commit, merge y push al usuario. No hay operaciones destructivas. |
| 12 | Fidelidad | PASS | Los diez puntos del alcance de la spec tienen paso. El plan no agrega funcionalidad ni archivos fuera de lo previsto, y los límites de "Qué no se hace" coinciden con "Fuera de alcance". Adelantar `outcomes.ts` al paso 5 es un reordenamiento, no una ampliación. |

## Hallazgos

| ID | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| — | — | — | Ninguno. P-01 a P-04 de `plan-audit-2` están resueltos. | `plan.md:26`, `:47-51`, `:57`, `:61-64`, `:70`. | — |

## Observaciones que no afectan el veredicto

- **Enmienda M16.1.** Los encabezados de `docs/FASES/FASE1/meta_first/plan.md` y `spec.md` siguen marcándola como pendiente de aprobación visible. El paso 1 manda detenerse en ese caso, así que el usuario tiene que dejar visible esa aprobación antes de `/microfase M16.1`.
- **Tamaño.** El corte es grande para 8 horas: unos diez módulos, tres suites con 43 casos, una página y seis documentos. Si al implementar se acerca al límite, conviene cortarlo así. Una primera parte con `api.ts`, `errors.ts`, `client.ts`, `tokens.ts` y `outcomes.ts` más sus pruebas unitarias (pasos 2 a 5). Una segunda con repositorios, rutas, callback, `test:app`, página y documentación. Eso exige cambiar el ID y la ficha de la ruta, y es una decisión del usuario.

## Siguiente paso

El usuario aprueba el plan ("Apruebo el plan de M16.1: pasá el estado a APROBADO"), deja visible la aprobación de la Enmienda M16.1 en la ruta, elige modelo y esfuerzo, abre una sesión nueva y corre `/microfase M16.1`.
