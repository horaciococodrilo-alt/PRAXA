# M27a — Plan de implementación

**Estado:** APROBADO

Estados posibles: `BORRADOR` → `APROBADO`. Solo el usuario pasa este plan a `APROBADO`, después de una auditoría APROBABLE.

**Spec base:** `docs/FASES/FASE1/M27a/spec.md`, aprobada por el usuario después de `spec-audit-6.md` APROBABLE en el fork (hash allí: `bdb7f168987f2c27a7460b50b34bd1d4510aed0b`). Tras los ajustes de integración del 2026-11-17, hash de contenido: `39af60cd6ed06ba7a9cc3ff023eeda69bf84edb2` (se excluye únicamente `**Estado:**`).

**Integración (2026-11-17).** El plan se aprobó en un fork; el usuario dio por válida esa aprobación y autorizó solo ajustes de integración, sin nueva auditoría: base `7d14ca9` (M16f y M25b cerrados), `H-E1-274` en lugar de `H-E1-270`, la empresa demo (`H-E1-273`) en los archivos y la coordinación con M16f reducida a reconfirmar numeración y destino. Detalle en la [enmienda](../meta_first/revisiones/enmienda-rfm-cohortes-audiencias-2026-11-17.md).

**Hash de contenido de este plan.** Se calcula sin la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M27a/plan.md | git hash-object --stdin
```

**Rama de trabajo:** `mf/M27a`. No crear otra microfase, rama funcional, gate ni commit durante esta preparación documental.

## Archivos

La lista concreta refina únicamente los grupos autorizados por II.14d y la spec aprobada. No se toca `package.json`, el lockfile, `worker-api.ts`, `analysis.ts`, `limits.ts`, OAuth, permisos externos ni migraciones existentes.

| Archivo | Nuevo o modificado | Paso | Autorizado por |
|---|---|---:|---|
| `src/modules/customer-insights/contract.ts` | Nuevo | 1 | II.14d, customer-insights |
| `src/modules/customer-insights/rules.ts` | Nuevo | 1, 5 | II.14d, customer-insights |
| `src/modules/customer-insights/proposals.ts` | Nuevo | 1, 5 | II.14d, customer-insights |
| `src/modules/customer-insights/monetary.ts` | Nuevo | 1, 3, 4 | II.14d, customer-insights |
| `src/modules/customer-insights/load.ts` | Nuevo | 5 | II.14d, customer-insights |
| `src/app/(app)/app/clientes/page.tsx` | Nuevo | 6 | II.14d, pantalla |
| `src/components/customer-insights/clientes.tsx` | Nuevo | 6 | II.14d, componentes propios |
| `src/components/customer-insights/clientes.module.css` | Nuevo | 6 | II.14d, componentes propios |
| `src/components/customer-insights/cohort-matrix.tsx` | Nuevo | 6 | II.14d, componentes propios |
| `src/components/customer-insights/cohort-evolution.tsx` | Nuevo | 6 | II.14d, componentes propios |
| `src/components/customer-insights/audience-proposals.tsx` | Nuevo | 6 | II.14d, componentes propios |
| `src/components/app/shell.tsx` | Modificado | 6 | II.14d, navegación |
| `src/modules/integrations/tiendanube/projection.ts` | Modificado | 3 | II.14d, insumos monetarios |
| `scripts/lib/demo-seed-sources.mjs` | Modificado solo para emitir los campos nuevos con montos string decimal | 3, 7 | II.14d, empresa demo |
| `src/modules/integrations/tiendanube/sync.ts` | Modificado | 3 | II.14d, insumos monetarios |
| `src/modules/integrations/tiendanube/repository.ts` | Modificado | 3 | II.14d, insumos monetarios |
| `supabase/migrations/0032_customer_insights.sql` | Nueva; siguiente número confirmado al redactar, sujeto a revalidación antes de implementar | 2 | II.14d, solo migraciones nuevas |
| `supabase/tests/21_customer_insights.test.sql` | Nuevo; siguiente prefijo confirmado al redactar, sujeto a revalidación | 2 | II.14d, suite SQL |
| `supabase/tests/09_integration_privileges.test.sql` | Modificado | 2, 7 | II.14d, regresión SQL |
| `supabase/tests/10_demo_closure.test.sql` | Modificado | 2, 7 | II.14d, regresión SQL |
| `supabase/tests/18_tiendanube.test.sql` | Modificado | 2, 3, 7 | II.14d, regresión SQL |
| `tests/unit/customer-insights-contract.test.ts` | Nuevo | 1 | II.14d, unit |
| `tests/unit/customer-insights-proposals.test.ts` | Nuevo | 1, 5 | II.14d, unit |
| `tests/unit/customer-insights-load.test.ts` | Nuevo | 5 | II.14d, unit |
| `tests/unit/customer-insights-monetary.test.ts` | Nuevo | 1, 3, 4 | II.14d, unit |
| `tests/unit/tiendanube-sync.test.ts` | Modificado solo con pruebas | 3, 7 | II.14d, regresión Tiendanube |
| `tests/unit/tiendanube-analysis.test.ts` | Modificado solo con pruebas | 7 | II.14d, regresión Tiendanube |
| `tests/unit/chat-tiendanube.test.ts` | Modificado solo con pruebas | 7 | II.14d, regresión de consumidor |
| `tests/unit/diagnostics-tiendanube.test.ts` | Modificado solo con pruebas | 7 | II.14d, regresión de consumidor |
| `tests/unit/no-privileged-credentials.test.ts` | Modificado solo con pruebas | 7 | II.14d, regresión de frontera |
| `tests/component/customer-insights.test.tsx` | Nuevo | 6 | II.14d, component |
| `tests/app/customer-insights.test.ts` | Nuevo | 5, 7 | II.14d, app |
| `tests/app/tiendanube-sync.test.ts` | Modificado solo con pruebas | 3, 7 | II.14d, regresión de publicación |
| `tests/app/tiendanube-data-api.test.ts` | Modificado solo con pruebas | 2, 7 | II.14d, regresión de privacidad |
| `docs/SECURITY.md` | Modificado solo si se materializa la nueva propiedad de privacidad/acceso prevista | 9 | II.14d y contrato documental |
| `docs/ARCHITECTURE.md` | Modificado para registrar el módulo, publicación y flujos que pasan a existir | 9 | II.14d y contrato documental |
| `docs/FASES/FASE1/M03a/acta-meta.md` | Modificado; requiere aprobación/comunicación del usuario antes de datos reales | 4, 9 | II.14d, acta |
| `docs/FASES/FASE1/meta_first/sesiones/M27a.md` | Nuevo después de la aprobación del plan; registra solo evidencia real | 9 | II.14d y seguimiento |
| `docs/HALLAZGOS.md` | Solo si surge un hallazgo nuevo; registrar ID, impacto, evidencia y asignación | 0, 7, 9 | Seguimiento autorizado |
| `docs/PROJECT_STATE.md` | Actualizar únicamente cuando cambie el gate/siguiente estado y tras aprobación visible | 9 | Seguimiento autorizado |
| `docs/FASES/FASE1/M27a/revisiones/*.md` | Solo si el usuario pide una revisión nueva (las auditorías del fork no se trajeron) | Auditoría | II.14d, artefactos de pipeline |

No se prevén archivos nuevos fuera de esta lista. Si la implementación requiere cambiar un archivo no listado, la firma de un RPC, una dependencia, scopes OAuth, el comportamiento de un consumidor anterior o un archivo de otra microfase, detenerse y resolver la autorización antes de editar. La migración `0032` y el test `21` son los siguientes disponibles en el árbol al redactar el plan; verificar de nuevo ambos números en el paso 0.

## Pasos

Las etapas son internas a M27a: una única microfase, una spec, este plan y el gate `G-SEGMENTOS-AUDIENCIAS`. En cada paso con comportamiento comprobable, primero se añaden o ajustan las pruebas y se observa el rojo; después se implementa y se demuestra el verde. No se ejecutan suites destructivas en paralelo ni contra `app`/producción.

| # | Acción | Archivos | Criterios y casos que cubre | Verificación del paso |
|---:|---|---|---|---|
| 0 | **Preflight y coordinación inicial.** Confirmar `mf/M27a`, preservar cambios/untracked existentes y registrar HEAD; comprobar en `PROJECT_STATE.md` `G-TIENDA` y la habilitación de M27a, que ningún otro trabajo en curso usa el mismo destino o número, y que el proyecto de prueba es desechable. Revalidar los números candidatos `0032`/`21` y la lista autorizada. Correr baseline y revisar requisitos de entorno sin leer ni imprimir secretos. Si una dependencia/gate no está cerrado, hay conflicto con M16f, el destino no es desechable o se requiere un archivo/cambio no autorizado, parar. | Sesión | §18.9; C-17, C-18; T-19; CB-02, CB-03, CB-04, CB-05 | `git status --short --branch`; confirmar rama; `npm run verify`; `npm run db:check:test`; `node scripts/chat-seed-test.mjs --check-demo` como línea base de la demo; cotejar G-TIENDA/condición de entrada y prefijos. No limpiar/revertir cambios ajenos ni hacer commit/push. |
| 1 | **Contratos, reglas y propuestas — TDD.** Primero pruebas rojas de esquemas Zod estrictos, `CurrencySelection`, `DefinitionCode`, ausencias, reglas/versiones y plantillas; luego contratos, reglas y propuestas. Rechazar claves extra, referencias ocultas/inexistentes, reglas que dependan de M cuando no está disponible y combinaciones incompatibles de unidad/definición. | Módulos `contract.ts`, `rules.ts`, `proposals.ts`, `monetary.ts`; unit tests | §18.1, §18.5–§18.8; C-02, C-03, C-09, C-11; T-02, T-03, T-10, T-11; CB-02 | `npm run test:unit`. Fixtures sintéticos con oráculos escritos manualmente; probar monedas disponibles/orden/default, tipos/ausencias, siete reglas, alto valor sin variedad/M y cero llamadas a Meta/LLM. |
| 2 | **Esquema, agregados y aislamiento — TDD SQL.** Añadir primero pgTAP rojo; después una sola migración nueva numerada como `0032` si sigue libre. Incluir snapshot por conexión/moneda, estados privados de dinero/identidad/líneas, procedencia de catálogo/rebuild, constraints, getter INVOKER, funciones privadas, RLS/grants, invalidación transaccional, backfill reanudable, publicación atómica, privacidad/purga y cálculo exacto de RFM/cohortes. Reemplazar funciones `worker_api` solo con mismas firmas/grants. No modificar `worker-api.ts`, casts ni migraciones existentes. | `0032_customer_insights.sql`; `21_customer_insights.test.sql`; regresiones SQL `09`, `10`, `18` | §18.1–§18.6, §18.9; C-01, C-02, C-05–C-08, C-12, C-13; T-01, T-02, T-06, T-07, T-08, T-09, T-13, T-14; CB-03, CB-04 | Antes de aplicar, revisar diffs y rollback transaccional en el destino desechable. El usuario verifica `npm run db:check:test` y ejecuta `npm run db:push:test` solo en ese destino. Después `npm run test:policies`; aserciones con roles/JWT, nunca `service_role`. Reconciliar cálculo contra fixtures con expectativas manuales y comprobar que el test falla antes de la implementación. |
| 3 | **Sincronización Tiendanube y calidad — TDD.** Pruebas primero; después extender proyección/sync/repositorio para los tres campos monetarios y estados de identidad/líneas, el estado de recorrido de catálogo y rebuild. Los valores M27a se extraen solo de strings JSON decimales estrictos; tokens numéricos, ausencias o diferencias inválidas dan `incomplete`/`null`, sin reutilizar conversiones heredadas. Conservar exacta la aridad RPC y los consumidores anteriores. Adaptar `demo-seed-sources.mjs` para que publique los campos nuevos con montos como string decimal. Ejecutar backfill completo reanudable sin borrar cobertura ni dataset de M16e. | `projection.ts`, `sync.ts`, `repository.ts`, `demo-seed-sources.mjs`; pruebas unit/app Tiendanube y `18_tiendanube.test.sql` | §18.2, §18.3, §18.5, §18.8, §18.9; C-04, C-05, C-10, C-12, C-17; T-05, T-06, T-12, T-13, T-16 | Rojo/verde con `npm run test:unit`, `npm run test:app` y `npm run test:policies` en el desechable. Incluir integración del JSON simulado desde `createTiendanubeHttpClient.getJson` hasta el parser: número JSON de alta precisión debe quedar `incomplete`/`null`; string decimal preserva dígitos. Verificar claves/validación RPC sin cambios de aridad ni de casts. Después de aplicar la migración en el desechable, `node scripts/chat-seed-test.mjs --check-demo` siembra, verifica y limpia sin errores. |
| 4 | **T-04 manual, obligatorio y temprano.** Solo después de que el lector estricto esté implementado y probado, y con el destino no productivo confirmado, el usuario autoriza la tienda sintética, configura callback/credenciales fuera del chat y prepara las transiciones indicadas en §3 de la spec. PRAXA solo hace GET. Conciliar cada caso y registrar versión de API, tipos/forma y `A_coincide | B_coincide | inconsistente`, sin payload, IDs ni montos reales; el usuario desconecta/desinstala y verifica purga. Si hace falta otra app, cambiar callback productivo o ampliar scopes/archivos, detenerse. Cualquier token JSON numérico necesario o evidencia ambigua selecciona C; no inferir precisión. | `monetary.ts`; `M03a/acta-meta.md` solo en borrador si hace falta prepararla; sesión de M27a | §18.2, §18.3, §18.9, §18.10; C-04, C-18; T-04; D-M27a-02/-09; CB-02/04/05/06 | Sin comando automatizado. Verificación manual por matriz, contra valores conocidos sintéticos y respuestas sin registrar cuerpos/secretos. T-04 se registra como ejecutado solo tras evidencia real. Antes de datos reales, el usuario aprueba y comunica el acta. Hasta resultado concluyente, `M27A_MONETARY_DEFINITION=null`; si C, Monetary queda indisponible y bloquea el gate, sin crear otra microfase. |
| 5 | **Loader server-only, calidad final y activación condicional — TDD.** Pruebas primero; implementar resolución de tenant/conexión vía contexto de servidor, moneda solo desde searchParams validado, lectura bajo JWT/RLS, estados ordenados y errores genéricos. Componer datos/propuestas desde agregados sanitizados. Activar exactamente A o B y la versión persistida solo si T-04 concluyente lo acredita; con C o evidencia pendiente mantener null y sin M/alto valor/propuestas dependientes. | `load.ts`, `monetary.ts`, `rules.ts`, `proposals.ts`; unit/app tests | §18.1, §18.6–§18.8; C-01, C-03, C-04, C-09, C-11, C-12, C-15; T-03, T-10, T-11, T-15; CB-02 | Rojo/verde con `npm run test:unit` y `npm run test:app` en entorno autorizado: entrada de tenant no aceptada, moneda disponible por RLS y orden determinista, status/absence sin colapsar y ninguna llamada externa. Rechazo genérico para selección no disponible sin consultar getter. |
| 6 | **Pantalla y privacidad visible — TDD.** Añadir pruebas de componente antes de la UI; implementar página con sesión propia, shell, distribución RFM, selector de moneda, tabla equivalente accesible para cohortes/evolución, propuestas y estados de frescura/calidad. Aplicar supresión a JSON, atributos, tooltips, gráficos, sumas y propuestas; sin identificadores, filtros nuevos ni acción sobre Meta. | Página, shell, componentes customer-insights; component tests | §18.4, §18.6–§18.8; C-06, C-08, C-09, C-10, C-14, C-15; T-07, T-09, T-10, T-11, T-14, T-15, T-18; CB-02 | `npm run test:component`, `npm run test:unit` y `npm run test:app`. Verificar casos de 0–4 con cero protegido, sin deducción por una segunda vista, selector teclado, responsive móvil/escritorio y recorrido visual manual solo con datos sintéticos. |
| 7 | **Regresiones, borrado y tamaño — TDD.** Añadir primero cobertura adversaria de privacidad, invalidación, concurrencia, datos antiguos y uso de credenciales; después cerrar adaptaciones de pruebas existentes. Medir sin truncar 10.000 pedidos/2.000 IDs/24 meses bajo presupuesto. Confirmar que no cambió el comportamiento de consumidores existentes (incluida la empresa demo) y que ningún payload/PII/importe llega a logs, LLM o Meta. | Pruebas unit/app/SQL autorizadas; componentes ya listados; sesión | §18.1–§18.9; C-01, C-05, C-08, C-11–C-18; T-01, T-06, T-09, T-12–T-17, T-19; CB-02–CB-06 | `npm run test:policies`; después `npm run test:app`; suites no destructivas secuenciales y solo en el desechable. `npm run db:check:test` antes de cada control con DB. Medición sintética bajo presupuesto, sin truncar. |
| 8 | **Revalidación sobre la base integrada.** M16f ya está integrado. Antes de cualquier control final o cierre, actualizar `mf/M27a` con lo que haya llegado a la rama de integración desde el paso 0 (por el usuario) y revalidar allí. Confirmar nuevamente rama/checkout `mf/M27a`, HEAD y cambios ajenos, lista de archivos, exclusividad del destino desechable y los siguientes números de migración/pgTAP. Repetir `db:check:test`, las suites integrales y `--check-demo` sobre esa base. Si hay conflicto, cambió una firma/archivo o se agotó el destino, esperar y detener el gate, sin tocar archivos de otra microfase ni inventar una integración. La integración/merge/rebase o publicación queda a cargo del usuario/equipo, no del asistente. | Sesión; base integrada y suites existentes | II.14d, coordinación y revalidación; C-17, C-18; T-19, T-20; CB-01, CB-03, CB-04, CB-05, CB-06 | Registrar commit/base y controles reales. `git status --short --branch`; `npm run db:check:test`; `npm run verify`; `npm run test:policies`; `npm run test:app`, secuencialmente y en el desechable exclusivo. Reconfirmar migración/pgTAP libres; cualquier fallo o prueba omitida detiene gate. |
| 9 | **Documentación, evidencia y salida del gate.** Documentar en `meta_first/sesiones/M27a.md` comandos/resultados realmente ejecutados, T-04 si ocurrió, reglas/versiones/cobertura, aislamiento, privacidad, ausencias y recorrido, sin secretos/PII/montos/IDs. Actualizar SECURITY/ARCHITECTURE solo por propiedades que hayan pasado a vigentes. Registrar hallazgos nuevos con ID e impacto; no cerrar H-E1-274 ni cambiar PROJECT_STATE hasta que el usuario apruebe el gate. Revisar diff y permisos; no publicar. | Acta, SECURITY/ARCHITECTURE condicionales, sesión M27a, HALLAZGOS/PROJECT_STATE condicionales | §18.9–§18.10; C-17, C-18; T-19, T-20; CB-01, CB-02, CB-05, CB-06 | Evidencia y diff revisados; `git diff --check`; `git status --short`; referencias exactas a resultados de pasos 7–8 sin inventarlos. Solo después de revisiones y QA, el usuario puede aprobar `G-SEGMENTOS-AUDIENCIAS`; Monetary no validado mantiene gate bloqueado. |

## Verificación final

Secuencia en destino desechable confirmado mediante `npm run db:check:test`, sin paralelo entre suites SQL/app destructivas:

1. `npm run test:unit`
2. `npm run test:component`
3. `npm run test:policies`
4. `npm run test:app`
5. `npm run verify`
6. `npm run db:check:test` antes de cada control con base; el usuario ejecuta `npm run db:push:test` solo después del ensayo reversible y las guardas.
7. Recorrido manual M27a-T-04 y M27a-T-18 cuando correspondan; registrar resultado solo tras ejecutar.

`npm run verify` cubre lint, typegen, typecheck, unit/component y build. Las pruebas app/policies y la conciliación T-04 siguen obligatorias aparte. No omitir suites exigidas por falta de configuración, acceso o tienda de prueba; registrar el bloqueo y no cerrar el gate. M27a-T-01 a T-20 se asignan explícitamente a los pasos 0–9. La revalidación del paso 8 ocurre sobre la base integrada y no se sustituye por el preflight del paso 0.

## Intervenciones del usuario y acciones reservadas

| Momento | Acción reservada al usuario | Verificación posterior |
|---|---|---|
| Paso 0 | Confirmar recursos exclusivos/desechables y que ningún otro trabajo comparte migración, prefijo o remoto. | `db:check:test` y revalidación de números/estado antes de cambios. |
| Paso 2 | Ejecutar `npm run db:push:test` únicamente en el proyecto desechable, después del ensayo reversible y de confirmar que la guarda lo identifica como test. | Historial de migraciones y versión aplicada; después el asistente ejecuta las suites autorizadas. |
| Paso 4 (T-04) | Autorizar tienda/entorno no productivo, configurar callback y secretos fuera del chat, preparar transiciones sintéticas y hacer la limpieza externa indicada. | Resultado redactado por caso y verificación de desconexión/purga; si no hay evidencia concluyente, C mantiene Monetary bloqueado. |
| Paso 8 | Integrar en `mf/M27a` lo que haya llegado a la rama de integración y hacer cualquier merge/rebase necesario. | El asistente revalida rama, estado, archivos, destino y numeración; si la integración no está disponible, espera y no cierra el gate. |
| Antes de cualquier dato real | Aprobar y comunicar la finalidad ampliada mediante el acta M03a. | Acta y comunicación registradas sin incluir datos sensibles. |
| Antes de PR/publicación | Commit, push, PR, despliegue y cualquier migración a `app` solo por el usuario y cuando lo solicite expresamente. No forman parte de los comandos del asistente en esta etapa. | Controles posteriores del pipeline; jamás ejecutar suites o fixtures contra `app`. |
| Gate | Aprobar visiblemente `G-SEGMENTOS-AUDIENCIAS` después de todas las auditorías, revisiones y QA. | `PROJECT_STATE.md` se actualiza solo entonces; Monetary no validado impide la aprobación. |

No se solicitarán secretos por chat ni se leerá `.env.local`. No se cambiarán scopes, callback productivo ni permisos externos para hacer pasar T-04.

## Migraciones

El árbol actual llega a `0031_ga4_diag.sql` y `supabase/tests/20_ga4.test.sql`; el plan propone `0032_customer_insights.sql` y `21_customer_insights.test.sql`, sujetos a confirmar que siguen libres. Reconfirmarlos tanto antes de implementarlos como al revalidar sobre la base integrada del paso 8. Aplicar únicamente migraciones nuevas. Ensayar cambios y rollback con `ROLLBACK` en el desechable antes de cualquier aplicación persistente. Si una migración ya aplicada requiere reversión, crear y auditar una nueva migración compensatoria con el siguiente número libre coordinado; nunca editar ni borrar un archivo aplicado. Los derivados M27a pueden reconstruirse desde Tiendanube, pero se respetan las excepciones expresas de purga/privacy de Tiendanube: no se afirma que esos borrados sean restaurables desde PRAXA.

## Riesgos

- **T-04 incierto o no ejecutable:** elegir C por la decisión aprobada; mantener la constante nula, no publicar M/alto_valor/propuestas dependientes y dejar el gate abierto. No ampliar alcance ni dividir M27a.
- **Interferencia de otro trabajo o numeración:** esperar y coordinar; no reservar un número alternativo, cambiar archivos compartidos ni tocar `worker-api.ts`.
- **Base integrada no disponible o distinta:** repetir el control del paso 8 antes de la verificación final; si no se puede integrar/revalidar con destino exclusivo y números libres, esperar, no cerrar el gate.
- **Precisión JSON:** solo strings decimales estrictos son utilizables para M27a; un token numérico o dato inválido bloquea calidad en vez de aproximarse.
- **Backfill y snapshot:** filas históricas quedan no verificadas; no publicar listo hasta rerelectura completa y siguiente incremental completo, sin borrar cobertura/dataset M16e.
- **Privacidad/residuo:** una prueba que permita deducir grupos protegidos o deje payload tras supresión/desconexión bloquea el gate.
- **Tamaño/tiempo:** si supera 15 s o requiere workers/cache compartida, detenerse y reabrir Q-01; no truncar ni cambiar el timeout silenciosamente.
- **Entorno/acta:** falta de desechable, permisos/tienda autorizados o acta antes de datos reales impide avanzar en el paso afectado.
- La microfase previsiblemente excede ocho horas; se organiza en etapas internas de implementación, sin crear submicrofases, gates ni aprobación adicional.

## Qué no se hace

No implementar ni habilitar Monetary durante la preparación documental; no ejecutar T-04 aquí; no modificar decisiones D-M27a-01 a D-M27a-09; no dividir M27a; no cambiar `client.ts`, `worker-api.ts`, `analysis.ts`, `limits.ts`, OAuth, scopes, proveedores previos o dependencias; no crear/exportar/sincronizar audiencias ni escribir en Tiendanube, Meta o GA4; no modificar migraciones existentes; no leer secretos, no usar datos reales sin acta aprobada/comunicada, no probar contra `app`/producción y no hacer commit, push, merge o despliegue.
