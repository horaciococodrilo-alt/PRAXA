# Auditoría de spec — M28.2a — 2026-10-03

- **Commit auditado:** `7b2a30f`.
- **Hash de contenido de la spec, sin la línea de estado:** `d73bbeb970103e6a386b7fdc2786e93825713dc3` (`git hash-object --stdin` sobre los bytes de `spec.md` filtrados por la línea `**Estado:**`).
- **Estado de entrada:** `BORRADOR`. El árbol estaba limpio al redactar este informe; el commit cambió de `c41b304` a `7b2a30f` durante la auditoría. La spec auditada conserva el hash indicado.
- **Veredicto: REQUIERE CAMBIOS.** Hay una contradicción con DEC-18, una comprobación incompleta y referencias de línea falsas. `G-ENTORNO` sigue pendiente.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | Los tres criterios de la ficha, sin CA numerado, aparecen en `spec.md:125-133`; ruta Parte I, `plan.md:225-238`. |
| 2 | Alcance | PASS | Pasos y archivos documentales en `spec.md:72-121`; ficha y II.7 en `plan.md:225-238,530-551`. No se propone código nuevo. |
| 3 | Coherencia con la spec general | FAIL | `spec.md:96,145-146` abre registro para una cuenta de prueba; DEC-18 en `meta_first/spec.md:58` lo reserva al alta del dueño. A-01. |
| 4 | Decisiones | FAIL | D-M28.2a-03 consta como decisión del usuario en `spec.md:213`, pero su excepción de registro para la prueba no quedó reflejada en DEC-18. A-01. |
| 5 | Trampas | PASS | Casilla externa, SMTP predeterminado y riesgo Hobby: `spec.md:193-203`; II.7 en `plan.md:553-556`. |
| 6 | Intervenciones y acciones reservadas | PASS | `spec.md:178-191` asigna al usuario cuentas, secretos, despliegue y `db:push`; `plan.md:768-785`. Verificación posterior indicada. |
| 7 | Verificación | PASS | `spec.md:150-176` incluye humo manual y `npm run verify`, como `plan.md:787-799`; CB-06 queda expresado en `spec.md:174`. |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:19-24` registra G-DB-META y G-CRYPTO aprobados y M28.2a habilitada. Código y migración `0012` presentes. |
| 9 | Lo entregado de verdad | PASS | `spec.md:54-70` distingue pantalla vacía, cliente del rol y pruebas opt-in; comprobado en `src/app/(app)/app/integraciones/page.tsx:11-28`, `src/modules/integrations/db/worker-api.ts:108-158` y `tests/app/email-flows.test.ts:13-41`. |
| 10 | Pendientes y hallazgos | PASS | H-E1-08 asignado y pendiente (`HALLAZGOS.md:25,357`); H-E1-23 diferido (`:40,395`); ambos tratados en `spec.md:235-239`. |
| 11 | Contexto real | FAIL | `spec.md:19,54,67-70` contiene referencias que no dicen lo afirmado: `PROJECT_STATE.md:19`, `package.json:9`, `worker-api.ts:106`, `email-flows.test.ts:24`. A-03. |
| 12 | Archivos previstos | PASS | `spec.md:110-121` prevé `entorno.md`, sesión y seguimiento; II.7.9 (`plan.md:546`) autoriza `entorno.md`. |
| 13 | Diseño suficiente | PASS | Nombres, comandos, destinos y resultados de los recorridos están fijados en `spec.md:72-108,135-166`. Elegir SMTP queda asignado al usuario en el paso 6. |
| 14 | Verificable | FAIL | El diseño exige revisar `worker_api` **y** `private` (`spec.md:92`), pero C-04/T-04 solo comprueban `worker_api` (`:142,159`). A-02. |
| 15 | Sin nada abierto | PASS | Q-01 a Q-03 están resueltas por D-M28.2a-01 a 03 (`spec.md:205-233`); las hipótesis indican paso de comprobación. |
| 16 | Ejecutable ahora | PASS | `npm run verify`: exit 0 fuera del sandbox, 11 archivos/222 pruebas, build completo. Primer intento en sandbox: exit 1 por `spawn EPERM` antes de cargar Vitest, una restricción de ejecución. Scripts en `package.json:20-26`; variables actuales por nombre en `.env.example`. |
| 17 | Consistencia interna | FAIL | `spec.md:92` exige excluir dos esquemas, mientras `spec.md:142,159` reduce criterio y prueba a uno. A-02. |
| 18 | Reglas no negociables | PASS | Tenant de servidor, migraciones intactas, secreto fuera de evidencia, suites solo en desechable y rol `worker_api`: `spec.md:35-49,88-108,170-176,193-203`; excepción manual del usuario en `plan.md:551`. |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| Abrir el registro público para crear la cuenta de prueba y cerrarlo tras la comprobación (`M28.2a/spec.md:96,145-146,161-162`; D-M28.2a-03 en `:213`) | `meta_first/spec.md:58` (DEC-18): registro público abierto solo mientras se registra el dueño; `meta_first/spec.md:510`: alta del dueño en M16.2 | La ficha M28.2a y II.7.7–8 (`meta_first/plan.md:234,543-545`) exigen el ensayo externo antes de M16.2; la aclaración de II.7 (`:551`) permite el recorrido manual, pero DEC-18 no recoge esa excepción. | Hacer explícita en la spec general la excepción ya decidida para el registro sintético de M28.2a, respetando la jerarquía documental; después auditar de nuevo. No cambiar DEC-18 en este informe. |

## Hallazgos

| ID | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | alta | Diseño; decisiones; criterios | La cuenta de prueba exige abrir registro fuera de la única ventana permitida por DEC-18. La decisión D-M28.2a-03 y el plan II.7 autorizan el recorrido, pero la spec general sigue contradiciéndolo. | `M28.2a/spec.md:96,145-146,213`; `meta_first/spec.md:58,510`; `meta_first/plan.md:234,543-551`. | Alinear DEC-18 con la excepción acotada ya aprobada o pedir una decisión explícita si se quisiera un mecanismo distinto. | Sí para modificar la fuente general fuera de esta spec; la opción de recorrido manual ya fue decidida. |
| A-02 | media | Diseño; criterios; casos | Se prescribe verificar que `private` esté fuera de la Data API, pero no hay aceptación ni resultado esperado para ese esquema. | `M28.2a/spec.md:92,142,159`; `SECURITY.md`, sección 4 (exposición de tokens); `ARCHITECTURE.md:86-92`. | Incluir `private` en C-04 y T-04, con fallo explícito si aparece expuesto. | No. |
| A-03 | baja | Fuentes; contexto verificado | Varias citas de línea no sustentan la afirmación. Por ejemplo, `package.json:9` es `dev`, `worker-api.ts:106` cierra otra función, y `email-flows.test.ts:24` está en blanco. `PROJECT_STATE.md:19` solo registra G-DB-META. | `M28.2a/spec.md:19,54,68,70`; ubicaciones reales: `package.json:26`, `worker-api.ts:108-118`, `email-flows.test.ts:15-18,25-41`, `PROJECT_STATE.md:19-24`. | Corregir todas las referencias `archivo:línea` de la spec contra el commit vigente; para el contrato de URL citar también `connection-url.mjs:80-100`. | No. |

## Observación de tamaño

La implementación técnica es documental y de verificación. La espera de cuentas, DNS y SMTP depende del usuario; no hay evidencia de que el trabajo del asistente exceda ocho horas. No se recomienda partir la microfase.

## Siguiente paso

Corregir la contradicción en la fuente general con la decisión ya tomada, completar C-04/T-04 y actualizar las citas. Después repetir `$spec-auditor M28.2a`. Esta auditoría no aprueba la spec ni G-ENTORNO.
