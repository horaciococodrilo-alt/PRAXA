# M16.1 — Auditoría del plan (ronda 2)

- **Fecha:** 2026-10-14
- **Commit:** `609ea29` (rama `main`; árbol con cambios sin commitear en `docs/`: `meta_first/{plan,spec}.md`, `HALLAZGOS.md` y `M16.1/` sin seguimiento)
- **Hash de contenido de la spec** (sin la línea de estado): `5617217350930db2d1a54c8a26269b4220efe59f`
- **Hash de contenido del plan** (sin la línea de estado): `7d3ad360094cae349847a00121484d4646c7103b`

## Veredicto

**REQUIERE CAMBIOS.**

Las precondiciones se cumplen. El plan cubre todos los criterios y casos de la spec, pero tiene dos defectos de orden y verificación entre pasos (P-01 y P-02) y dos omisiones menores (P-03 y P-04). Ninguno obliga a cambiar el alcance. Se corrigen reasignando casos y un archivo entre pasos y agregando algunas frases.

## Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| `spec.md` en `APROBADA` | PASS | `spec.md:3` dice `APROBADA`. |
| La última `spec-audit-N` es APROBABLE | PASS | `spec-audit-4.md`, veredicto APROBABLE. |
| El hash actual coincide con el de esa auditoría | PASS | `5617217350930db2d1a54c8a26269b4220efe59f` en los dos lados. |
| `plan.md` existe y está en `BORRADOR` | PASS | `plan.md:3`. |

## Checklist

| # | Ítem | Resultado | Evidencia o justificación |
|---|---|---|---|
| 1 | Spec base | PASS | `plan.md:7` cita la spec con el hash `5617217…efe59f`, igual al actual. |
| 2 | Cobertura | PASS | Casos: T-01 a T-22 (paso 2), T-23 (paso 3), T-24 a T-35 (paso 4) y T-36 a T-43 (paso 10); no falta ninguno de T-01 a T-43. Criterios: C-01 a C-31 aparecen todos (pasos 4 a 10). Heredados: CA-28 a CA-35, CA-02b/c, CA-04, CA-09, CA-26, CA-39 y CB-01 a CB-06 figuran en al menos un paso. La asignación de varios casos a un paso en el que todavía no se pueden cumplir es un defecto de orden (P-01), no de cobertura. |
| 3 | TDD | **FAIL** | Las pruebas de los pasos 2 a 4 van antes de la implementación (pasos 5 a 8), y el plan lo declara. Pero el plan no dice por qué no aplica TDD a T-24, T-36, T-38, T-39 y T-43, cuyas filas de la spec sí lo justifican (guarda, regresión, revisión manual, documentación, corrida de cierre). Ver P-03. |
| 4 | Archivos | PASS | Cada archivo de implementación está en II.9 de la ruta, o es una ubicación dentro del mismo módulo que el plan registra (`outcomes.ts`, `attempts.ts` y `connections.ts`; II.9 nombra "Repositorio de conexiones" sin ruta). Los de seguimiento son los de la precondición 8 y los del pipeline, de la 9. No hay ningún archivo ajeno. Las columnas "Autorizado por" citan "Parte II.8" y "Parte II.9" donde corresponde "precondición 8" y "precondición 9 de la Parte II" (II.8 y II.9 son secciones de `M03a` y `M16.1`); es una cita errónea sin efecto en el alcance (P-04). |
| 5 | Pasos | **FAIL** | El orden no respeta las dependencias: P-01 (el paso 5 incluye casos que dependen de los pasos 6 y 7) y P-02 (`outcomes.ts` se crea en el paso 8, pero los pasos 6 y 7 lo necesitan). Además el paso 1 y "Riesgos" describen un estado desactualizado (P-04). Los demás pasos tienen verificación propia. |
| 6 | Migraciones | NO APLICA | La spec ("Fuera de alcance" y "Archivos previstos") y la ficha excluyen migraciones y pgTAP. Los pasos 12 y 13 comprueban su ausencia y el plan declara "No hay migraciones". Último número existente: `0014`. |
| 7 | Comandos | PASS | `db:check:test`, `test:unit`, `test:component`, `test:app` y `verify` existen en `package.json`. `verify` encadena lint, typegen, typecheck, `test` (unit y component) y build. III.3 para `M16.1` exige `test:app` además de `verify`: está en los pasos 4, 7 y 10, y en "Verificación final". CB-06 aparece en el paso 4 (la guarda falla, no salta), en el paso 10 y en el 15. `git diff --stat` y la búsqueda por patrón son válidos. |
| 8 | Acciones reservadas | PASS | Merge, push y despliegue están en el paso 14 como acciones del usuario, con verificación posterior (`Ready`, `GET` 405, `POST` sin `Origin` 403, "Conectar" deshabilitado). `db:push` y `db:push:test` no aplican y no se ejecutan (pasos 12 y 13), con verificación de ausencia de migraciones. `G-OAUTH` queda en el paso 15, después de las verificaciones. |
| 9 | Reglas | PASS | Evidencia redactada y sin valores de entorno (pasos 9 y 11). Tenant por K01 en el servidor (pasos 6 y 7, C-11, T-11, T-12). Credenciales solo por `worker_api`, sin `PRAXA_INTEGRATIONS_DB_URL` en la suite (paso 4). `db:check:test` antes de cualquier prueba remota (paso 4). Sin autorización real (pasos 14 y 15). |
| 10 | Trampas | PASS | Las seis de II.9 y las 21 de la spec tienen un paso o una verificación. Consumo atómico: pasos 6 y 7 con T-13 y T-16. Código por el navegador y logs: pasos 7 y 9. Handler fuera del proxy: pasos 6 y 7. `scope`: paso 2 con T-02. Reloj de 9 min: C-10. Suite que no se salta: paso 4. URLs de salida: C-31 con T-40 a T-42. Casos A y B, H-S-13 y H-S-15: paso 11 y "Riesgos". Exposición antes de `M16.2`: paso 14. |
| 11 | Git | **FAIL** | El plan no menciona la rama `mf/M16.1`. El árbol actual está en `main` con cambios sin commitear, y ningún paso la crea ni la verifica. Tampoco dice que el asistente no hace commit ni push; solo el paso 14 reserva el merge y el push al usuario. Ver P-04. |
| 12 | Fidelidad | PASS | Los diez puntos del alcance de la spec tienen paso. No se agrega funcionalidad. Los límites ("Qué no se hace") coinciden con "Fuera de alcance". |

## Hallazgos

| ID | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-01 | Media | 5 (y 6, 7) | El paso 5 declara como cubiertos, y verificables "hasta verde", casos que dependen de código de los pasos 6 y 7. C-02/T-02: `buildAuthorizationUrl` está en `oauth.ts`. T-04: los seis módulos tienen que existir (incluidos `oauth.ts`, `attempts.ts` y `connections.ts`). T-07: el canje es `exchangeCodeForToken`, en `oauth.ts`. T-17: la traducción a `permiso_faltante` y `token_no_valido` es del callback. T-40: recorre un callback `initial` completo. La verificación del paso 5 no se puede cumplir tal como está escrita. | `plan.md:58` (casos C-02, C-04, C-07, T-02, T-04, T-07, T-17, T-40) contra `plan.md:25-28` (`oauth.ts`, `attempts.ts` y `connections.ts` van en los pasos 6 a 7) y la spec §6 y §1 (dónde vive cada función). | Reasignar C-02/T-02, C-04/T-04, T-07 (la parte del canje), T-17 (la parte del callback) y T-40 al paso 6 o 7, según el módulo que los cumple. Limitar la verificación del paso 5 a los casos que sus archivos pueden cumplir (T-01, T-03, T-05, T-06, T-18, T-41 y T-42), y la parte de `tokens.ts` de T-17. |
| P-02 | Media | 6, 7 y 8 | `outcomes.ts` (lista cerrada, tipo `MetaOAuthOutcome` y textos) se implementa en el paso 8. Pero las rutas y el registro de los pasos 6 y 7 emiten `?meta=<resultado>` y tipan `resultado` con ese tipo (spec §6 "Registro", §6.1 y §6.2). T-22 (que prueba `outcomes.ts`) está en el paso 2. Los pasos 6 y 7 piden "pruebas verdes" que no pueden pasar ni compilar sin ese archivo. | `plan.md:26` (`outcomes.ts`, paso 8); `plan.md:59-61`; spec §1 (`outcomes.ts` "puro; D-M16.1-01") y §6. | Implementar `outcomes.ts` y T-22 antes del paso 6 (por ejemplo, como parte del paso 5 o en un paso nuevo). Dejar en el paso 8 solo la página y su prueba de componente. Actualizar la tabla de archivos. |
| P-03 | Baja | 2 a 4, 10 | El plan no indica qué casos quedan fuera de TDD ni por qué. | Spec, columna "¿Falla sin la implementación?" de T-24, T-36, T-38, T-39 y T-43; `plan.md:48` solo habla de las pruebas nuevas. | Agregar una frase al plan: T-24 es la guarda, T-36 es regresión, T-38, T-39 y T-43 son revisión o corrida de cierre. El resto sigue el orden prueba, luego código. |
| P-04 | Baja | 1, Archivos, Riesgos y acciones reservadas | (a) No hay referencia a la rama `mf/M16.1` ni a que el asistente no hace commit ni push. (b) El paso 1, la fila de `spec.md` ("Solo regularización de estado") y el primer punto de "Riesgos" describen la spec como `BORRADOR`. Hoy está `APROBADA`, y solo el usuario cambia ese estado. (c) Las citas "Parte II.8" y "Parte II.9" de la tabla de archivos deberían decir precondición 8 y precondición 9 de la Parte II. | `plan.md:40-44`, `:54`, `:88`, `:100`; `spec.md:3`; `plan.md:17` ya dice "precondiciones 8 y 9". | (a) Agregar al paso 1 la creación o verificación de `git switch -c mf/M16.1` preservando los cambios existentes, y que el asistente no hace commit ni push. (b) Quitar la fila de `spec.md` y el primer punto de "Riesgos", y reformular el paso 1 para que solo exija confirmar que la spec está `APROBADA` y qué falta de la Enmienda M16.1. (c) Corregir las citas. |

## Observaciones que no afectan el veredicto

- **Enmienda M16.1.** Los encabezados de `docs/FASES/FASE1/meta_first/plan.md` y `spec.md` siguen marcándola como pendiente. El paso 1 ya manda detenerse en ese caso; el usuario tiene que dejar visible su aprobación antes de implementar. La declaración "confirmada por el usuario al planificar" (`plan.md:88`) no se puede verificar desde el repositorio.
- **Tamaño.** El corte es grande para 8 horas: unos diez módulos, tres suites con 43 casos, una página y seis documentos. Si al implementar se acerca al límite, conviene partirlo así. Una primera parte con `api.ts`, `errors.ts`, `client.ts`, `tokens.ts` y `outcomes.ts` más sus pruebas unitarias (pasos 2 a 5). Una segunda con repositorios, rutas, callback, `test:app`, página y documentación. Partirlo exige cambiar el ID y la ficha de la ruta, así que es una decisión del usuario.

## Siguiente paso

Volver a plan mode, corregir P-01 a P-04 y auditar de nuevo con `/plan-auditor M16.1`.
