# M16c — Plan de implementación

**Estado:** APROBADO

Solo el usuario pasa este plan a `APROBADO`, después de una auditoría APROBABLE. Su aprobación no inicia la implementación.

**Spec base:** [M16c/spec.md](spec.md), hash de contenido `3c1db5b57f9ef68a54760841185cafdef50156db`, coincidente con la auditoría 11, APROBABLE. El usuario aprobó esta versión y la spec figura en estado `APROBADA`.

**Base inspeccionada:** `main@a27f7270310034cc3e64346684b1f5c5e5a20ae3`, con cambios documentales preexistentes que deben preservarse. G-VR01 aprobado; G-SYNC pendiente. La secuencia actual de migraciones termina en 0015.

**Ejecución:** una microfase, una spec, un plan y una corrida en `mf/M16c`, organizada en tres etapas. Las etapas .1 y .2 habilitan la siguiente mediante controles técnicos, evidencia y commit del usuario. Solo existe un gate final: G-SYNC.

**Hash de contenido de este plan.** Se calcula excluyendo únicamente la línea de estado, conservando los demás bytes y saltos de línea:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M16c/plan.md | git hash-object --stdin
```

Registrar el resultado en su auditoría; no insertar un hash autorreferencial.

## Archivos

Los identificadores F01–F29 se usan en los pasos. Ningún archivo de implementación queda fuera de II.11 y de las ubicaciones sugeridas que la spec autoriza dentro del mismo módulo. Las rutas de esta tabla son relativas a la raíz del repositorio.

| Archivo | Nuevo o modificado | Paso | Autorizado por |
|---|---|---|---|
| F01 — `supabase/migrations/0016_meta_insights.sql` | Nuevo | 1, 4 | II.11, persistencia .1 |
| F02 — `supabase/tests/13_meta_insights.test.sql` | Nuevo | 2 | II.11, pgTAP .1 |
| F03 — `supabase/tests/09_integration_privileges.test.sql` | Modificado | 2 | II.11, pgTAP .1 |
| F04 — `supabase/tests/10_demo_closure.test.sql` | Modificado | 2 | II.11, pgTAP .1 |
| F05 — `scripts/run-pgtap.mjs` | Modificado | 4 | II.11, runner .1 |
| F06 — `src/modules/integrations/db/worker-api.ts` | Modificado | 6 | II.11, adaptador .1 |
| F07 — `src/modules/integrations/repository/sync-calls.ts` | Nuevo | 6 | II.11 .1; ubicación sugerida autorizada por la spec |
| F08 — `src/modules/integrations/lifecycle.ts` | Modificado | 6 | II.11, lifecycle .1 |
| F09 — `tests/unit/meta-lifecycle.test.ts` | Modificado | 3, 8 | II.11 .1/.2 |
| F10 — `tests/app/meta-lifecycle.test.ts` | Modificado | 3 | II.11 .1 |
| F11 — `tests/app/integrations-worker-api-client.test.ts` | Modificado | 3 | II.11, adaptador .1 |
| F12 — `src/modules/integrations/meta/insights.ts` | Nuevo | 10, 11, 13, 15 | II.11, extracción .2, fijación de Q-04 .3; parser y precedencia de resultados de sync, cubiertos por la suite unitaria de Insights (T-28) |
| F13 — `src/modules/integrations/meta/entities.ts` | Nuevo | 10 | II.11, extracción .2 |
| F14 — `tests/unit/meta-insights.test.ts` | Nuevo | 8, 13, 14 | II.11, pruebas .2; casos de contratos y acción de la spec |
| F15 — `tests/app/meta-sync.test.ts` | Nuevo | 9 | II.11, pruebas .2 |
| F16 — `tests/app/meta-precision.test.ts` | Nuevo | 9 | II.11, pruebas .2 |
| F17 — `src/modules/integrations/actions.ts` | Modificado | 15 | II.11, acción .3 |
| F18 — `src/app/(app)/app/integraciones/page.tsx` | Modificado | 13, 15 | II.11, directorio Integraciones .3 |
| F19 — `src/app/(app)/app/integraciones/meta-tarjeta.tsx` | Modificado | 15 | II.11, directorio Integraciones .3 |
| F20 — `src/app/(app)/app/integraciones/meta-sync-control.tsx` | Nuevo | 15 | II.11, directorio Integraciones .3 |
| F21 — `tests/component/integraciones-meta-sync.test.tsx` | Nuevo | 14 | II.11, pruebas .3 |
| F22 — `docs/SECURITY.md` | Modificado por propiedades verificadas | 16, 20 | II.11, documentación .3 |
| F23 — `docs/ARCHITECTURE.md` | Modificado por propiedades verificadas | 16, 20 | II.11, documentación .3 |
| F24 — `docs/FASES/FASE1/M03a/acta-meta.md` | Modificado | 16 | II.11, acta ampliada .3 |
| F25 — `docs/FASES/FASE1/M16c/spec.md` | Estado aprobado; Q-04 en .3 | 0, 13, 20 | Ficha de Parte I; II.11 .3 |
| F26 — `docs/FASES/FASE1/M16c/plan.md` | Nuevo | Preparación y auditoría | Parte I, plan único |
| F27 — `docs/FASES/FASE1/meta_first/sesiones/M16c.md` | Nuevo | Todos | Seguimiento de Parte II |
| F28 — `docs/HALLAZGOS.md` | Modificado según evidencia | Todos | Seguimiento de Parte II |
| F29 — `docs/PROJECT_STATE.md` | Modificado por estado o bloqueo | 0, 7, 12, 20 | Seguimiento de Parte II |
| F30 — `tests/unit/meta-oauth.test.ts`; F31 — `tests/component/integraciones-meta-aviso.test.tsx`; F32 — `tests/component/app-paginas-sesion.test.tsx` | Modificados | 17 | D-M16c-06 (M16c-Q-02), decisión del usuario del 2026-11-08 |

Los informes de auditoría, implementación y QA se generan mediante sus solicitudes correspondientes. No se crean specs, planes ni sesiones separados por etapa.

## Pasos

En esta tabla, `C-NN` significa `M16c-C-NN` y `T-NN`, `M16c-T-NN`. Los resultados esperados completos de cada caso siguen siendo los de la spec.

### Etapa M16c.1 — Persistencia, privilegios y lifecycle

| # | Acción | Archivos | Criterios y casos que cubre | Verificación del paso |
|---|---|---|---|---|
| 0 | **Entrada.** Confirmar spec y plan aprobados, hash auditado, G-VR01 y solicitud explícita de ejecución. Registrar Git, SHA base y cambios preexistentes. Trabajar en `mf/M16c`, preservando esos cambios. Ejecutar la verificación de base y las guardas del desechable antes de implementar. | F25, F27–F29 | C-22; CB-01 a CB-06; T-33 | Estados y hashes comprobados; `git status --short --branch`; suites de base registradas. Si falta aprobación, configuración o dependencia, detenerse. No leer `.env.local`. |
| 1 | **Fijar contratos antes del SQL.** Adoptar las siete tablas, `meta_sync_summary`, payloads, firmas y resultados definidos en la spec. Registrar la correspondencia SQL → adaptador → repositorio y los errores PX009/PX010. Mantener actor/empresa primero, autorización → cerrojo de empresa → conexión → run, y reloj real después de los bloqueos. | F27; diseño de F01/F06/F07 | C-01, C-02, C-03, C-04, C-05, C-06, C-17; CA-58/59 | Revisión contra las tablas de diseño de la spec: firmas, orden de argumentos, estados, grants y tipos sin decisiones pendientes ni cambios de alcance. |
| 2 | **RED SQL.** Escribir primero pgTAP de aislamiento, catálogo exacto, integridad, posesión, idempotencia, cobertura, precisión, reloj, inmutabilidad, purga y cascadas. Extender 09 y 10; conservar sus controles existentes. Preparar fixtures sintéticos y rollback. Replicar en SQL los positivos y negativos decimales de T-14. | F02–F04 | C-01 a C-10, C-14 a C-17, C-20. **T-01, T-03, T-05, T-06, T-10, T-11, T-14, T-15, T-24, T-25, T-31, T-36, T-37, T-38.** CA-39/41/42/43/43b/44/44b/45/46/58/59; CA-67/68 | `npm run test:policies`: registrar RED atribuible a contratos nuevos ausentes, separado de cualquier fallo de infraestructura. Los controles de privilegios deben detectar el grant indebido aislado; no basta con que falle otra propiedad del rol. |
| 3 | **RED TypeScript y cliente real.** Agregar pruebas de nuevas llamadas estáticas, validación estricta de envoltorios, errores redactados y persistencia obligatoria de lifecycle. Agregar concurrencia real y espera de bloqueo hasta vencer el lease. La aserción de `last_error` va antes del cambio de lifecycle. | F09–F11 | C-03, C-04, C-14, C-17, C-19. **T-04, T-21, T-26.** CA-39/58/59 | Ejecutar las suites filtradas de lifecycle y cliente real. Registrar RED específico; configuración inválida detiene la corrida y no cuenta como RED de comportamiento. |
| 4 | **Implementar 0016 y soporte del runner.** Crear tablas, claves compuestas, checks, RLS forzada, revocaciones, inmutabilidad, resumen y RPC. Crear `start_sync_run`, `publish_snapshot`, `fail_sync_run`, `record_connection_error`; reemplazar `purge_connection` conservando firma y resultado. Crear el helper privado de integridad. Normalizar atributos del rol preservando contraseña y grants. El runner prueba los bloques reales sobre roles sintéticos y revierte sus cambios. | F01, F05 | Todos los contratos y casos SQL del paso 2; H-E1-27/35/36 | Revisar migración y diff antes de aplicarla. Catálogo de `worker_api` exacto: las doce operaciones actuales más cuatro nuevas. Helper INVOKER sin EXECUTE público; T-14 de pgTAP 09 conserva su prohibición sin excepciones. |
| 5 | **Usuario: aplicar 0016 al desechable.** Detener la corrida cuando la migración esté preparada. El usuario ejecuta `npm run db:push:test` después de `npm run db:check:test`. Si falta configuración, la carga fuera del chat. | F27 | C-02, C-17, C-22; CB-03/04/06 | Confirmar 0016 en el historial del desechable, guarda correcta y `npm run test:policies` completo en verde. Una segunda ejecución de push no debe reaplicar 0016. |
| 6 | **GREEN del adaptador y lifecycle.** Ampliar allowlist/casts y traducción PX009/PX010. Crear los cuatro envoltorios `server-only` con Zod estricto. `applyConnectionFailure` llama a `recordConnectionError` en la rama unchanged; generación/estado cambiados devuelven unchanged sin sobrescribir, otras indisponibilidades se propagan con error fijo. Sync usará exclusivamente `failSyncRun`. | F06–F08 | C-14, C-17, C-19; T-04, T-21, T-26; H-E1-22 | Suites del paso 3 en verde, operaciones anteriores conservadas, argumentos arbitrarios rechazados y respuestas con claves extra rechazadas. Sin errores originales, DETAIL ni HINT en resultados o logs. |
| 7 | **Control y commit de .1.** Ejecutar las cuatro verificaciones completas. Probar además `npm run test:app` del SHA base de `main` contra el desechable con 0016 aplicada, en un checkout aislado: (a) crearlo sin tocar el árbol de trabajo, con `git worktree add <directorio fuera del repositorio> <SHA base>`; (b) instalar dependencias en él con `npm ci`; (c) **detenerse**: el usuario deja disponible en ese checkout la configuración del desechable, fuera del chat, sin que el asistente la lea, copie ni muestre; (d) cuando confirme, ejecutar allí `npm run db:check:test` y, solo si apunta al desechable, `npm run test:app`; (e) el usuario retira la configuración del checkout y después se elimina con `git worktree remove <directorio>`, sin `--force`; si git lo rechaza, detenerse y pedir al usuario que lo elimine. Registrar evidencia y pedir al usuario el commit de etapa. | F27–F29 | C-22; **T-33**; compatibilidad D-M16c-03; CB-01 a CB-06 | Suites completas en verde y compatibilidad del código base acreditada: `git -C <directorio> rev-parse HEAD` igual al SHA base, guarda del desechable correcta y `test:app` en verde sin skips requeridos. Configuración ausente o inválida es NO EJECUTADO (CB-06), no compatibilidad. `git worktree list` sin el checkout al terminar. Registrar que `test:policies` del antiguo `main` tiene catálogo incompatible con 0016 y no se usa para revertirla. Usuario hace commit en `mf/M16c`; comprobar SHA y árbol limpio. **Reanudación: paso 8.** |

El paso 4 implementa íntegramente los contratos de la spec: proyección pública construida por SQL, importes y conteos como texto, snapshots históricos conservados, sustitución completa de cobertura y distinción entre página recibida y página validada. La excepción de reloj de `fail_sync_run` guarda la hora de la base únicamente para el snapshot fallido; conserva la petición original para idempotencia y nunca publica cobertura.

### Etapa M16c.2 — Extracción y orquestación

| # | Acción | Archivos | Criterios y casos que cubre | Verificación del paso |
|---|---|---|---|---|
| 8 | **RED unitario.** Escribir pruebas del catálogo, normalización específica de cuenta, precisión, acciones/variantes, atribución, metadata histórica, cuatro niveles, fechas locales, paginación, límites, reintentos, presupuesto y resultados cerrados. Probar fetch y consumo lento del body. Ejecutar la regresión existente del listado de cuentas. | F09, F14 | C-08 a C-13, C-18 a C-21. **T-12, T-14, T-16, T-17, T-18, T-19, T-20, T-28, T-29, T-30, T-32, T-36, T-37.** CA-41/42/43b/44/44b/47/47b/56/57/60 | `npm run test:unit -- tests/unit/meta-insights.test.ts`; `npm run test:unit -- tests/unit/meta-lifecycle.test.ts`. RED específico para lo nuevo; CA-60 permanece verde como regresión, sin reimplementarlo. |
| 9 | **RED de integración.** Crear las suites con Meta simulada y PostgreSQL/Data API reales del desechable. Cubrir cuatro niveles vacíos, fallo intermedio, presencia/null/cero, aislamiento, precisión completa, errores persistidos y carreras con disconnect/reauth/purge. Los fixtures usan los helpers existentes, sin editarlos. | F15, F16 | C-01, C-02, C-06, C-07, C-09, C-14, C-15, C-16, C-18, C-19. **T-02, T-07, T-08, T-09, T-13, T-22, T-23, T-35.** CA-39/42/43/44b/45/46/59 | Suites filtradas en RED por comportamiento faltante. JWT para aserciones de aislamiento; rol real para las operaciones privilegiadas. Limpieza de fixtures comprobada, sin skips requeridos. |
| 10 | **GREEN de normalización y extracción.** Implementar contratos y `extractMetaLevel`. Extraer account → campaign → adset → ad, con catálogo explícito, parámetros y ventana local de la spec. Recuperar inventario y ancestros sin filtro de activos; referencias faltantes por raíz Graph con `ids`, hasta 50 por petición. Validar cada página entera antes de acumularla. | F12, F13 | C-07 a C-12, C-19, C-20; T-12, T-14, T-16, T-17, T-18, T-29, T-30, T-36, T-37; CA-41/42/43/43b/44/44b/47/47b | Casos unitarios correspondientes en verde. URLs reconstruidas con `graphUrl`; `paging.next` solo indica continuidad y se descarta. Metadatos faltantes, duplicados o valores presentes malformados impiden completar el nivel. |
| 11 | **GREEN de orquestación y lecturas.** Implementar `syncMetaInsights`, lectores JWT y DTO estrictos de las tres RPC. Resolver K01 y conexión en servidor; iniciar run, leer credencial y cotejar estado/generación antes de Graph y de cada llamada nueva. Publicar o fallar por nivel mediante el repositorio, con presupuesto global, reserva SQL y reintento idéntico de escritura ambigua. | F12 | C-01, C-03 a C-07, C-10, C-13 a C-15, C-18, C-19; T-02, T-07, T-08, T-09, T-13, T-19, T-20, T-22, T-23, T-28, T-29, T-35, T-37; CA-39/42/45/46/56/57/58/59 | Suites de los pasos 8 y 9 en verde. Barreras reales impiden llamadas posteriores y reinserción tras purga. Un primer fallo se lee sin cobertura previa; lease vencido se deriva sin escribir. Solo cuatro niveles completos producen completed. |
| 12 | **Control y commit de .2.** Ejecutar suites completas, revisar precisión, aislamiento y logs, consolidar evidencia y detenerse para el commit del usuario. | F27–F29 | C-21, C-22; T-32, **T-33**; CB-01 a CB-06 | Cuatro verificaciones completas en verde; commit del usuario en `mf/M16c`, SHA registrado y árbol limpio. **Reanudación: paso 13.** |

Decisiones obligatorias de los pasos 10 y 11:

- Las métricas permanecen `string|null`; únicamente contadores técnicos y duraciones usan `number`. SQL vuelve a validar identidad, jerarquía y números.
- La cuenta acepta exclusivamente las dos representaciones previstas y conserva sus dígitos. IDs de campaign/adset/ad siguen su contrato separado.
- Cada nivel congela su propio `fetched_at` antes de su primera petición; las duraciones usan reloj monotónico. No se reutiliza metadata de otro run.
- Reintentos Graph: solo temporary/transport, máximo dos, esperas de 500/1000 ms y siempre dentro del presupuesto. Rate limit y reauth detienen los niveles restantes.
- Un 22023 de publicación pasa a `failSyncRun` con payload vacío, cero páginas validadas, own_error y detención del resto. No se corrige el contenido para aparentar éxito.
- Después de una escritura SQL ambigua, conservar ID y petición para un único reintento idéntico; sin confirmación, devolver `no_confirmada` y no extraer nuevamente.
- Las lecturas distinguen `never`, running, expired y connection_changed sin acceder a tablas ocultas. Los límites proceden del resumen público, con 28 días cuando no hay resumen.

### Etapa M16c.3 — Acción, UI y validación real

| # | Acción | Archivos | Criterios y casos que cubre | Verificación del paso |
|---|---|---|---|---|
| 13 | **Fijar Q-04 antes de publicar.** El usuario acredita la duración efectiva disponible en Vercel. Registrar un perfil numérico único en la spec: ventana inicial 28 días, máximos de páginas, metadata, entidades y payload, duración, reserva y lease. Justificar cada cota técnica y probar sus bordes antes de adoptar los valores. Configurar `maxDuration` como literal de página conforme a la documentación local de Next. | F12, F14, F18, F25, F27 | C-11, C-13, C-22; T-16, T-19, T-20, T-34; CA-47b/56/57 | Duración por debajo del límite efectivo con margen; reserva para dos intentos SQL incluyendo conexión y consulta, y tiempo de respuesta. Lease según fórmula de la spec. Si no alcanza, detenerse y registrar hallazgo; no introducir workers ni cambiar timeouts silenciosamente. |
| 14 | **RED de acción y UI.** Agregar pruebas del botón active, pendiente, selectores opacos, cuatro resultados por nivel, cobertura anterior, primer fallo, metadata escapada y declaración manual. Completar pruebas de parser y precedencia de resultados, incluida query repetida/desconocida. | F14, F21 | C-07, C-18, C-19, C-20. **T-27, T-28**; CA-46/58 | `npm run test:component -- tests/component/integraciones-meta-sync.test.tsx` y suite unitaria de Insights en RED específico. Una query de éxito no puede reemplazar el estado persistido. |
| 15 | **GREEN de acción y presentación.** Implementar en F12 `meta/insights.ts` el parser de la query `sync` y la precedencia de resultados; no crear ni modificar `meta/outcomes.ts`. Crear `sincronizarMeta():Promise<never>` sin argumentos de negocio. Revalidar layout y redirigir fuera de catch. Leer resumen, catálogo y cobertura con JWT; validar nivel/entidad en servidor. Mostrar presencia, campos, unidad/moneda, atribución, metadata capturada, frescura y captura parcial. Mantener las nuevas props de la tarjeta opcionales. | F12, F17–F20 | C-01, C-07, C-18, C-19, C-20; T-27, T-28, T-35; CA-43/43b/44/46/58 | Pruebas nuevas en verde, incluida la suite unitaria de Insights del paso 14, y pruebas existentes de la tarjeta sin cambios. Needs_reauth permite lectura con aviso, sin iniciar sync; disconnected no muestra datos. Pendings de un run vencido o cambiado muestran «Sin resultado confirmado». |
| 16 | **Documentación y comunicación previa.** Actualizar únicamente propiedades que pasan a existir y están probadas. Ampliar en el acta la excepción de la cuenta en rutas a Insights y edges de metadata. El usuario comunica el alcance ampliado al dueño y registra conformidad redactada. Contrastar cada hipótesis OAuth de H-E1-117 con la evidencia histórica de VR-01, sin ensayos OAuth nuevos. | F22–F24, F27, F28 | C-19, C-22; T-29, T-34; CA-26/40; D-M16c-04 | Comunicación acreditada antes de la captura. SECURITY no duplica grants/TTL; ARCHITECTURE describe lo existente y mantiene el chat como previsto. Hipótesis sin evidencia quedan pendientes con asignación. |
| 17 | **Validación previa a publicación y commit.** Ejecutar las cuatro verificaciones completas, revisar diff y archivos no rastreados, registrar resultados y detenerse para el commit del usuario de la implementación .3 en `mf/M16c`. | F27–F29 | C-22; T-33; CB-01 a CB-06 | Suites completas en verde y commit identificado. G-SYNC continúa pendiente del despliegue, prueba real y aprobación. |
| 18 | **Usuario: migración de app y publicación, en ese orden.** Verificar destino con `npm run db:check` y pendientes con `npm run db:preview`. El usuario ejecuta `npm run db:push` en app y confirma 0016 en el historial. Solo después integra `mf/M16c` en `main` y hace push, que despliega Vercel. | F27 | C-22; T-34; D-M16c-03 | Registrar instante de aplicación de 0016 anterior al push/despliegue; comprobar versión desplegada y duración efectiva. Revisar Runtime Logs antes del ensayo: la consulta con IDs de entidades no debe quedar expuesta. Sin suites ni fixtures en app. |
| 19 | **Usuario: sincronización real coordinada.** Ejecutar desde la UI con la conexión legítima existente, después de la comunicación y publicación verificadas. Contrastar los cuatro niveles, duración y límites. | F27, F28 | C-11, C-13, C-18, C-19, C-22; **T-34**; CA-41/42/47/56; M16c-H-01/02/03/07 | Evidencia redactada con conteos, campos presentes, páginas, llamadas, duración y resultado de cada nivel. Con filas, revisar campos y tipos del catálogo. Con cuatro niveles completos y cero filas, aplicar D-M16c-02 sin acreditar ceros ni validación de campos. Registrar además, sin valores sensibles: la diferencia entre `started_at` y el reloj local de la ejecución (H-07), y cualquier 22023 por reloj como hallazgo; si Graph aceptó la atribución unificada y `action_report_time` en los cuatro niveles y si la metadata expuso la configuración efectiva o quedó `known=false` (H-02); si se recuperaron inventario y ancestros sin filtro de activos o qué nivel quedó incompleto por metadata (H-03). Lo que una respuesta vacía no permite verificar queda como no verificado, con su motivo. |
| 20 | **Cierre de .3 y gate.** Consolidar matriz de aceptación, controles y ensayo real. Registrar estado de H-E1-22/27/35/36, seguimiento de H-E1-117/189 y estado de M16c-H-01 a H-08 y Ruta H-04 (verificada, no verificada con motivo, o hallazgo). Documentar el cierre y detenerse para que el usuario comitee el seguimiento posterior al despliegue. Las revisiones finales cubren M16c completa sobre el último commit. El usuario aprueba G-SYNC solo con evidencia suficiente. | F22, F23, F25, F27–F29 | **C-01 a C-22; T-01 a T-38**, como consolidación de los pasos anteriores; todos los CA heredados; CB-01 a CB-06 | Evidencia vinculada a comandos y commits reales, árbol limpio y revisiones finales correspondientes. G-SYNC queda pendiente si falta una prueba requerida, sincronización real o aprobación. Solo tras su aprobación se registra M25a.1 como habilitada; no se inicia. |

La UI conserva los ocho resultados y textos exactos de la spec. La precedencia es: requiere_reauth → conexion_cambio → no_confirmada → en_curso → estado del run. El aviso manual también conserva su texto exacto.

## Verificación final

Estos comandos se ejecutan completos al cerrar **cada etapa**, después de aplicar 0016 al desechable:

```text
npm run verify
npm run db:check:test
npm run test:policies
npm run test:app
git diff --check
git status --short --branch
```

Para TDD se usan, según los pasos:

```text
npm run test:unit -- tests/unit/meta-lifecycle.test.ts
npm run test:unit -- tests/unit/meta-insights.test.ts
npm run test:app -- tests/app/meta-lifecycle.test.ts
npm run test:app -- tests/app/integrations-worker-api-client.test.ts
npm run test:app -- tests/app/meta-sync.test.ts
npm run test:app -- tests/app/meta-precision.test.ts
npm run test:component -- tests/component/integraciones-meta-sync.test.tsx
```

Los comandos filtrados no reemplazan las suites completas. La compatibilidad adicional de .1 ejecuta `npm run test:app` desde el SHA base registrado de `main`, en un checkout aislado y contra el desechable migrado, con el procedimiento del paso 7: el usuario aporta la configuración y el asistente nunca la lee, copia ni muestra.

**CB-06:** setup fallido, prueba requerida skipped o ensayo real ausente significa **NO EJECUTADO**, control/gate pendiente. Las omisiones opt-in ajenas se identifican por archivo y motivo. No se afirma «cero omitidas» sin comprobarlo.

La sesión registra por etapa comandos, exit codes, resultados, conteos reales, limpieza, limitaciones y SHA. Las pruebas de reloj usan fixtures administrativos históricos dentro de rollback; el flag de captura parcial se calcula mediante publicación, no se inserta como resultado esperado.

T-32 es regresión existente; T-33 es checklist y T-34 evidencia externa: no corresponde TDD. Los restantes comportamientos nuevos tienen pruebas anteriores a su implementación.

## Intervenciones del usuario y acciones reservadas

| Paso | Acción del usuario | Verificación posterior |
|---|---|---|
| Antes de 0 | Aprobar el plan auditado y dejar visible la aprobación de la spec actual; solicitar ejecución | Estados, hashes y solicitud comprobados |
| 0, 5 o cualquier bloqueo de configuración | Reactivar el desechable o cargar variables fuera del chat | Guardas, conexión del rol y suites requeridas ejecutadas |
| 7 | Dejar la configuración del desechable en el checkout aislado del SHA base, fuera del chat; al terminar, retirarla y, si git rechaza la eliminación, eliminar el checkout | `npm run db:check:test` en el checkout apunta al desechable; `test:app` del SHA base ejecutado; `git worktree list` sin el checkout |
| 5 | `npm run db:push:test` | 0016 en historial del desechable y pgTAP completo en verde |
| 7 y 12 | Commit de cada etapa en `mf/M16c` | SHA registrado, control completo y árbol limpio antes de avanzar |
| 13 | Acreditar/configurar el límite efectivo de Vercel | Q-04 documentado, pruebas de límites y comprobación posterior al despliegue |
| 16 | Comunicar ampliación al dueño y registrar conformidad | Evidencia anterior a la primera captura ampliada |
| 17 | Commit de implementación .3 | Suites completas en verde y SHA listo para publicación |
| 18 | `db:check`, `db:preview`, `db:push` en app; después integración en `main`, push y despliegue | Historial y orden temporal acreditados; versión y duración desplegadas comprobadas |
| 19 | Coordinar y ejecutar la sincronización real | Resultado redactado de los cuatro niveles y contraste con Q-04 |
| 20 | Commit documental de cierre y aprobación de G-SYNC | Evidencia consolidada, revisiones sobre último commit y estado actualizado |

El asistente no realiza commits, push, despliegues ni migraciones remotas. Cada pausa se reanuda desde el paso pendiente, sin exigir una nueva solicitud de microfase ni una aprobación intermedia de etapa.

## Migraciones

- Crear únicamente **0016_meta_insights.sql**; pgTAP nuevo **13_meta_insights.test.sql**.
- No modificar 0001–0015. Si 0016 ya existe al comenzar, detenerse y resolver la colisión documentalmente.
- Aplicar primero al desechable y acreditar compatibilidad antes de app. Las etapas .2 y .3 no agregan migraciones.
- `purge_connection` conserva firma, booleano e idempotencia; anula el puntero antes de eliminar los datos nuevos.
- Una corrección posterior a la aplicación requiere una migración nueva con el siguiente número disponible y autorización de alcance. No editar ni eliminar 0016 aplicada.
- Ante publicación anticipada por error, registrar hallazgo y pedir al usuario aplicar 0016 inmediatamente, según D-M16c-03; no revertirla para ocultar el incidente.
- Durante la rama abierta, las verificaciones de políticas que necesitan el catálogo nuevo usan `mf/M16c` o esperan. No se desmigra el desechable para ejecutar el catálogo antiguo.

## Riesgos

- **Tiempo disponible:** el cliente actual contempla hasta 10 s de conexión y 15 s de consulta SQL. Q-04 debe reservar dos intentos de finalización y respuesta. El límite efectivo de Vercel es una entrada externa obligatoria del paso 13.
- **Timeout HTTP y body:** T-20 debe acreditar ambos usando el cliente existente con timeout recortado por petición. Si exige modificar el cliente fuera del alcance autorizado, detenerse y registrar **REQUIERE CAMBIO EN LA RUTA** en la spec única.
- **Cuenta vacía:** no permite validar campos, tipos ni holgura con actividad. H-E1-189 permanece como riesgo aceptado temporal si G-SYNC cierra con cero filas; se valida en la primera captura con filas.
- **Cambios de formato de Meta:** campos presentes inválidos fallan; ausentes quedan no informados. Un campo siempre ausente en la primera captura con filas genera hallazgo.
- **Reloj, bloqueos y respuesta ambigua:** los pasos 2, 3, 8 y 11 prueban el tratamiento específico; no se amplía tolerancia ni se repite extracción silenciosamente.
- **Cambios simultáneos en `main`:** actualizar la rama de M16c desde `main`, nunca arrastrar M16c a `main` antes de 0016 en app. Repetir controles afectados por los cambios.
- **Entorno de build:** si reaparece H-E1-191, registrar bloqueo de entorno y repetir el comando exacto en un entorno permitido. Un build alternativo no sustituye `npm run verify`.

Toda contradicción, archivo adicional, fallo de guarda/aislamiento o dos iteraciones de corrección sin converger detiene la corrida. Los hallazgos nuevos reciben ID estable, impacto, evidencia y asignación.

## Qué no se hace

No se implementan chat, agregaciones por período, workers, cron, colas, renovación de lease, OAuth alternativo, nuevas cuentas/proveedores ni escrituras publicitarias. No se genera gasto ni se busca otra cuenta para obtener datos.

No se suman jerarquías, ventanas de atribución, reach, frecuencia ni tasas para inventar totales. No se transforma ausencia en cero ni metadata capturada en estado histórico.

Se reutilizan sin editar cliente/URLs/clasificación Meta, tenant, repositorios de credenciales y conexiones y llamadas lifecycle existentes. Tampoco se modifican configuración general de Next, helpers de pruebas ni las pruebas existentes de la tarjeta.

Esta planificación no implementa código, ejecuta migraciones ni publica cambios.
