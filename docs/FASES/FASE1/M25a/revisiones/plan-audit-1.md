# Auditoría del plan de M25a — ronda 1

- **Fecha:** 2026-11-09 (America/Buenos_Aires).
- **Commit:** `3eaf561510138cf71531423d130bb5ef14cd78db` (`docs/m25a-spec`); base de código `main@b0c854d`.
- **Hash de contenido de la spec:** `f99c64a50aae827062f399bee50cfa3ae9362d5f`.
- **Hash de contenido del plan:** `493ddcd22731f637285e4144e8137dc8d23e4080`.
- Ambos hashes excluyen exclusivamente la línea que comienza por `**Estado:**`, según la fórmula del pipeline. Se calcularon con lectura UTF-8, normalización de finales de línea equivalente al filtro y `git hash-object --stdin`.
- **Estado auditado:** spec `APROBADA`; plan `BORRADOR`. El plan y varios cambios documentales e informes ya estaban sin commit al comenzar. Esta auditoría los preserva.

## Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| Spec en `APROBADA` | PASS | `spec.md:3`. |
| Última auditoría de spec APROBABLE | PASS | El mayor número existente es `revisiones/spec-audit-14.md`; declara 18 PASS y 0 FAIL. |
| Hash actual de spec igual al auditado | PASS | `f99c64a50aae827062f399bee50cfa3ae9362d5f` coincide con el encabezado de la ronda 14. La actualización de estado no cambia ese hash. |
| Plan existente | PASS | `docs/FASES/FASE1/M25a/plan.md`, 222 líneas al auditar. |

## Veredicto

**APROBABLE: 12 PASS, 0 FAIL.**

No se modifica ni se aprueba el plan. La implementación de M25a no se inicia y `G-CHAT` no cambia.

## Checklist

En las referencias siguientes, `plan.md` y `spec.md` son los documentos de M25a; `ruta` es `docs/FASES/FASE1/meta_first/plan.md`.

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Spec base | PASS | `plan.md:7` cita la ruta de la spec y su hash completo, igual al actual y al de la auditoría 14. La spec está `APROBADA`; el plan permanece `BORRADOR`. |
| 2 | Cobertura | PASS | Cruce de las columnas «Criterios y casos que cubre» de los 29 pasos: C-01 a C-84 y T-01 a T-95 están cubiertos, sin IDs faltantes. Los intervalos son inclusivos por `plan.md:61`. La tabla de heredados (`:119–130`) asigna pasos a CA-38c, CA-44/44b, CA-48 a CA-55 y sus extensiones, CA-61 a CA-66, CA-67/68, CA-69 a CA-73, VR-02/DEC-21, DEC-23/24 y CB-01 a CB-06. Se contrastó la cobertura con los comportamientos y resultados esperados, incluidos T-27, T-44 y T-87 de composición por fila, T-79 de pilas compatibles y T-94/95 sin empresa. |
| 3 | TDD | PASS | La regla operativa de `plan.md:63` exige escribir y ejecutar los casos completos antes de implementar, comprobar el fallo esperado y llegar a verde. Los pasos 1–3, 9–13 y 17–19 aplican esa regla a SQL, redacción, herramientas, adaptador, guarda, presentación, acciones, componentes y avisos. Los casos de Data API se preparan en 3 y se ejecutan después de aplicar la migración, en 6. `:65` distingue controles manuales y documentales de TDD, y reconoce T-48/T-64 como regresiones sin fallo artificial. Los casos compartidos entre etapas se completan en .3 según `:132`; T-56/57 y T-79 tienen además el corte básico explícito en .2. |
| 4 | Archivos | PASS | Se expandieron las llaves de la tabla (`plan.md:29–53`): 56 rutas o patrones, todos contenidos en los «Archivos previstos» de la spec (`spec.md:666–692`), autorizados por II.12/II.13/II.13b y la enmienda de la ruta `:20`. Los documentos de seguimiento y pipeline tienen autorización en las precondiciones 8 y 9 (ruta `:416–417`). No se agrega `app-nav.tsx`, ni se modifican `app-data`, reporting, runners o PIPELINE. Los documentos transversales están previstos porque cambian propiedades de su contrato. |
| 5 | Pasos | PASS | Los 29 pasos tienen verificación propia. Orden: pruebas y SQL → ensayo con rollback y medición → aplicación al desechable por el usuario → Data API real → control/commit .1; adaptador y comprobación del esquema antes de la guarda → orquestador/pantalla → conjunto base congelado y VR-02 → control/commit .2; acta y comunicación → bloques/casos completos → medición y límites finales → ampliado congelado → recorrido sintético → control/commit y revisiones → migración en app → publicación → recorrido real → aprobación del gate. Pasos 4–7, 14–16 y 20–28 (`plan.md:75–113`). |
| 6 | Migraciones | PASS | La secuencia del árbol termina en `0017_meta_breakdowns.sql`; corresponde `0018_chat_queries.sql`. `plan.md:194–200` prohíbe editarla tras aplicarla, exige detenerse ante un defecto SQL posterior y no autoriza crear `0019` silenciosamente. Una reversión persistente requiere migración nueva y autorización previa. T-82 comprueba el diff; el ensayo previo no altera el historial. Coincide con `spec.md:129`. |
| 7 | Comandos | PASS | Los comandos usados existen en `package.json`, salvo `test:eval`, explícitamente previsto y autorizado por `spec.md:625,689` y creado en el paso 9. `plan.md:153` fija `vitest run --project eval`. `:138–150` incluye verify, db:check:test, policies, app, adversaria y eval en las etapas correspondientes; 23/27 añaden los recorridos. Incluye el db:check:test de .2 que exige la ficha, aunque II.13 no lo repite. CB-06 y el tratamiento de opt-in ajenas están explícitos en `:165`. |
| 8 | Acciones reservadas | PASS | Pasos 5, 7, 8, 15, 16 y 23–28, más la tabla `plan.md:178–190`: usuario aplica al desechable, hace commits, configura la clave, reaprueba el acta y comunica, recorre, aplica a app, hace push/PR/integración/despliegue y aprueba G-CHAT. Cada acción tiene verificación posterior. El ensayo antecede a db:push:test; `0018` llega a app antes del código a main; la publicación se verifica con READY y el commit correspondiente. El orden específico de M25a rige sobre el flujo genérico del pipeline. |
| 9 | Reglas | PASS | K01 y conexión se resuelven en servidor, entradas estrictas y lecturas JWT/RLS en 3 y 12; firmas públicas sin tenant/conexión en `plan.md:95`. La ampliación del cliente privilegiado queda en su módulo existente, que confina pg y la URL del rol; no hay lectura alternativa de credenciales desde herramientas. Redacción previa, logs mínimos y pruebas adversarias en 2, 10 y 12. Guardas de destino en 0/4/6 y en los controles; el recorrido sintético valida las tres referencias y usa variables de proceso de pruebas en 22. El diff y la evidencia se revisan sin datos reales en `:165–174`. No se ejecutan suites ni fixtures en app. |
| 10 | Trampas | PASS | Logs y pregunta original: 2/12 y T-46. Cifras atadas a métrica, período, unidad, cuenta y fuente, incluidos términos sin dígitos y citas repetidas: 10 y T-38–43/T-67. Elección errónea y fidelidad semántica: 14/21, sin atribuirlas a la guarda. Límite heredado de 28 días: SQL propio en 1, T-20/T-21 en 3/6. Volumen, rollback y migración aplicada: 4–6 y sección Migraciones. Concurrencia, reserva final y registro tardío: 1/6/12 y Riesgos. Atribución desconocida, ventanas distintas y filas parciales: 1/11/17 y T-26/27/44/79/87/93. Sin empresa: 12/13 y T-94/95. Host/modelo variable y JSON truncado: 9/14/20/21 y Riesgos. El cambio de proveedor queda excluido, por lo que no se activa la alternativa Fireworks. |
| 11 | Git | PASS | `plan.md:13` exige una sola corrida en `mf/M25a`; 0 prepara esa rama preservando cambios ajenos. Commits a cargo del usuario al final de cada etapa (7/15/24), con log y árbol limpio. El push queda a cargo del usuario en 26; `:192` lo prohíbe al asistente. No hay comandos destructivos. La rama actual `docs/m25a-spec` corresponde a la preparación documental, no a una implementación iniciada. |
| 12 | Fidelidad | PASS | Las tres etapas siguen la ficha de la ruta `:337–354` y II.12/13/13b. Incluye trece herramientas, seis cálculos, seis bloques básicos y diecinueve finales, restricciones de atribución/cobertura, contexto acotado, cuatro salidas de registro, avisos de consumo, dos evaluaciones y los dos recorridos. El acta se actualiza antes de datos reales al modelo. Las exclusiones de `plan.md:215–219` no agregan capacidades ajenas; los límites solo se ajustan dentro de §13 de la spec, sin cambiar los 60 s ni reducir alcance para pasar pruebas. |

## Hallazgos

No se identificaron hallazgos del checklist.

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| — | — | — | Ninguno | 12 ítems en PASS | — |

## Observación sobre tamaño

M25a excede el corte ordinario de ocho horas, pero tiene una excepción explícita aprobada por el usuario y tres etapas obligatorias (ruta `:18,337,348–354`). El plan conserva ese corte. No corresponde proponer microfases nuevas ni gates adicionales.

## Verificaciones y límites

- Se leyeron la skill, AGENTS, plan, spec y fuentes de la ruta, y se contrastaron los archivos existentes afectados: cliente worker_api; pgTAP 09/10; chat, estilos y páginas; pruebas component de pantalla/sesión; configuración Vitest; package.json; entorno; acta y documentos transversales. Para la semántica heredada se contrastaron migraciones 0016/0017 y las referencias del código de integraciones.
- Se comprobaron los hashes de contenido y el estado de la última auditoría de spec. El plan auditado está vinculado al hash completo del encabezado de este informe.
- Cruce estático por script: 84/84 criterios operativos, 95/95 casos, 29 pasos con verificación y 56 rutas/patrones autorizados tras expandir las agrupaciones. La cobertura por ID se complementó con el contraste de comportamiento del checklist.
- Se contrastaron comandos con los scripts actuales de package.json. El único script nuevo usado por el plan es test:eval, cuya creación ya exige la spec.
- `git diff --quiet main -- src supabase tests scripts package.json package-lock.json vitest.config.mts` terminó con **exit 0**: el código actual coincide con la base main. Se confirmó que la última migración existente es 0017.
- Esta es una auditoría del plan. No se ejecutaron verify, pgTAP, test:app, evaluaciones, migraciones, recorridos, commits, pushes ni despliegues. Ningún resultado futuro del plan se declara probado.
- Solo se agrega `docs/FASES/FASE1/M25a/revisiones/plan-audit-1.md`. No se edita el plan, la spec, el estado del proyecto ni los cambios preexistentes.

## Siguiente paso

El usuario puede aprobar el plan y pasarlo a `APROBADO`. Después corresponde elegir modelo y esfuerzo, abrir una sesión nueva y ejecutar `$microfase M25a`. M25a requiere esfuerzo alto según la spec; no se inicia mediante esta auditoría.

Una auditoría APROBABLE no reemplaza la aprobación del usuario ni aprueba G-CHAT.

