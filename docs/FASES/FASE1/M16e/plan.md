# M16e — Plan de implementación

**Estado:** BORRADOR

**Spec base:** `docs/FASES/FASE1/M16e/spec.md`, APROBADA; hash de contenido, excluida la línea de estado: `9a4eb6f7fa0540591aca327dda3430f1e0f6d153`.

**Hash de contenido de este plan.** Se calcula sin la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M16e/plan.md | git hash-object --stdin
```

## Archivos

II.14b de la ruta incluye `src/modules/integrations/lifecycle.ts` y `actions.ts` desde la enmienda que el usuario aprobó el 2026-11-14 al corregir `plan-audit-1` (P-01).

| Archivo | Nuevo o modificado | Paso | Autorizado por |
|---|---|---:|---|
| `docs/FASES/FASE1/meta_first/plan.md`; `docs/FASES/FASE1/M16e/plan.md`; `docs/FASES/FASE1/M16e/revisiones/` | Modificado, nuevo y evidencia de auditoría | 0–14 | II.14b |
| `docs/FASES/FASE1/M03a/acta-meta.md`; `docs/FASES/FASE1/meta_first/entorno.md`; `.env.example`; `scripts/tiendanube-preflight.mjs` | Modificados/nuevo | 0, 3 | II.14b |
| `docs/SECURITY.md`; `docs/ARCHITECTURE.md`; `docs/HALLAZGOS.md`; `docs/PROJECT_STATE.md`; `docs/FASES/FASE1/meta_first/sesiones/M16e.md` | Seguimiento y cambios estructurales autorizados | 0–14 | II.14b |
| `supabase/migrations/0023_tiendanube.sql`; `supabase/migrations/0024_tiendanube_diag.sql` | Nuevos, sujetos a confirmar que `0022` sigue siendo el último número | 1, 11 | II.14b |
| `supabase/tests/18_tiendanube.test.sql`; `08_integration_isolation.test.sql`, `09_integration_privileges.test.sql`, `09b_integration_lifecycle.test.sql`, `10_demo_closure.test.sql`, `15_chat_queries.test.sql`, `17_meta_diagnostics.test.sql` | Nuevo/modificados | 1, 5, 11 | II.14b |
| `src/modules/integrations/contract/{primitives,oauth-attempt,connection,credential}.ts`; `db/worker-api.ts`; `repository/{connections,credentials,attempts,lifecycle-calls}.ts`; `meta/oauth.ts` | Modificados | 1, 4 | II.14b |
| `src/modules/integrations/{lifecycle,actions}.ts` | Modificados | 4–5 | II.14b (enmienda P-01) |
| `src/modules/integrations/tiendanube/{config,client,errors,limits,oauth,projection,repository,sync,privacy,analysis}.ts` | Nuevos | 4–8 | II.14b |
| `src/app/api/integraciones/tiendanube/{iniciar,callback,privacidad/store-redact,privacidad/customer-redact,privacidad/data-request}/route.ts` | Nuevos | 4–7 | II.14b |
| `src/app/(app)/app/integraciones/{page,tiendanube-tarjeta,guia-integraciones}.tsx`; `src/app/(app)/app/integraciones/{tiendanube-tarjeta,guia-integraciones}.module.css`; `src/modules/app-data/{index,types}.ts` | Modificados/nuevos | 8 | II.14b («pantalla en `src/app/(app)/app/integraciones/`», P-02) |
| `src/modules/chat/{limits,llm,orchestrator,output-schema,prompt,render}.ts`; `src/modules/chat/tools/{schema,execute,results,tiendanube}.ts`; `src/app/(app)/app/chat/page.tsx`; `src/components/app/chat.tsx` | Modificados/nuevo | 11 | II.14b |
| `src/modules/diagnostics/{actions,compose,contract,eligibility,evidence,index,orchestrator,pdf,repository,validate}.ts`; `src/components/app/{diagnostico.tsx,diagnostico.module.css}` | Modificados | 11 | II.14b |
| Pruebas de Tiendanube en `tests/{unit,app,component}/`; regresiones afectadas de Meta, chat, diagnóstico y `app-data` en esas mismas carpetas; `tests/eval/{chat-eval,diagnostics-eval}.test.ts` y sus fixtures, solo para T-13 | Nuevas/modificadas | 1–12 | II.14b |

`AGENTS.md` y `meta_first/spec.md` ya contienen las enmiendas de Tiendanube y se verifican sin volver a editarlos. No se prevén dependencias nuevas ni cambios en `package.json`. Si aparece un archivo necesario fuera de esta tabla, se detiene la implementación y se corrige la ruta y el plan antes de tocarlo.

## Decisiones del usuario sobre el plan

| ID | Decisión | Fecha |
|---|---|---|
| DP-01 | Se suman a II.14b `src/modules/integrations/lifecycle.ts` y `actions.ts` (`plan-audit-1`, P-01) | 2026-11-14 |
| DP-02 | La instrucción para desinstalar va en la «Guía de integraciones»: un modal con dos páginas, «Conectar» y «Desconectar», con el estilo de la imagen del usuario. La desconexión de Tiendanube enlaza a «Desconectar» (`plan-audit-1`, P-02) | 2026-11-14 |

## Pasos

En cada etapa, escribir primero los casos automatizables, observar el fallo esperado, implementar y repetirlos hasta que pasen. Al cerrar cada etapa, ejecutar `npm run db:check:test`, `npm run verify`, `npm run test:policies` y `npm run test:app` completos; registrar resultados y omisiones en la sesión. No avanzar con pruebas requeridas en rojo.

| # | Acción | Archivos | Criterios y casos que cubre | Verificación del paso |
|---:|---|---|---|---|
| 0 | Ampliar el acta para Tiendanube, DeepInfra y Anthropic. Auditar el plan. El usuario aprueba plan y acta antes de la primera línea de código. Comprobar otra vez Git, `G-DIAG`, número de migración y guías pertinentes de Next 16.4.2. | Documentación del primer bloque | CB-02–CB-06; §17.7–17.9 | Auditoría APROBABLE, aprobaciones registradas y árbol inicial preservado. |
| 1 | **Etapa .1, pruebas primero:** agregar pgTAP y pruebas de contrato para coexistencia, RLS, grants exactos, proveedor en K02–K04, supresión de celdas menores a cinco y purga. Implementar migración 1 y adaptar contratos, repositorios y `worker-api`. Conservar la semántica de Meta. | Migración 1; pgTAP 08–10 y 18; integración | C-01, C-08, C-13; T-01, T-07; CA-05, CA-11c, CA-18, CA-28, CA-38c, INV-01/04 | Fallo previo reproducido; migración inspeccionada; matriz de privilegios del encabezado igual al pgTAP. |
| 2 | El usuario ejecuta `npm run db:push:test` para la migración 1, solo tras `npm run db:check:test`. El asistente comprueba historial de migraciones del desechable y corre el control completo de .1. El usuario hace el commit de etapa. | Migración 1; sesión | C-01, C-08; T-01, T-07, T-09 | `0023` aplicada una vez; suites completas verdes; commit identificado. |
| 3 | Antes de .2, el usuario crea la única app en el Portal con los tres permisos de lectura, callback y webhooks de `app`; confirma H-04 y H-10, carga variables fuera del chat y ejecuta el preflight redactado. Si no puede instalarse sin homologación, detener M16e. | Preflight; `.env.example`; entorno; sesión | C-02, C-10; T-02, T-10 | Presencia y forma de variables sin mostrar valores; H-04/H-10 registrados. |
| 4 | **Etapa .2, pruebas primero:** OAuth de un uso, navegador/actor/empresa/proveedor vinculados, callback limpio, cancelación, scopes exactos, confirmación de tienda/zona/moneda, cifrado con AAD y reautorización de la misma tienda. Hacer que `runLazyPurge` revoque solo Meta; agregar desconexión de Tiendanube sin revocación remota. | Integración; rutas iniciar/callback; acciones | C-02, C-03; T-02, T-03; CA-37c, CA-38, DEC-09/17 | Replay y generación vieja rechazados; token de Tiendanube nunca enviado a Meta; control completo de .2 y commit del usuario. |
| 5 | **Etapa .3, pruebas primero:** cliente HTTP de solo lectura, proyección mínima en memoria y clasificación de cada error. Implementar backfill mensual reanudable, subdivisión por 10.000, incremental con una hora de solapamiento, catálogo completo, posesión por lease/generación y publicación atómica de estado vigente y agregados. Mantener `TN_COLLECTED_AMOUNT_ENABLED = false`. Una prueba del cliente comprueba que `GET /orders` pide `payment_status=any` y que `partially_paid` y `partially_refunded` se clasifican localmente (trampa de la spec). | Módulo Tiendanube; RPC de migración 1; pruebas | C-04, C-05, C-07, C-10; T-04, T-05, T-10, T-14; §17.1–17.6 | Fixtures con importes esperados, dos monedas y cambio horario; cobertura parcial hasta backfill más primer incremental; ningún campo descartado persiste. |
| 6 | **Etapa .3, pruebas primero:** handlers firmados de 64 KB y RPC de privacidad. `store_redact` marca, quita credencial y borra por tandas reanudables; `customer/redact` marca pedidos, luego borra y recalcula; `data_request` solo acusa. Probar interrupciones, duplicados, dos empresas, conexión reinstalada, sincronización en vuelo y recuperación perezosa. | Privacidad; rutas webhook; migración 1; pruebas | C-06, C-08; T-06, T-07; CA-38c/67/68; excepción INV-01 | Cero filas tras borrado completo, sin reimportación de pedidos marcados; errores/logs redactados. El control completo de .3 va al final del paso 7. |
| 7 | Medir con fixtures en el desechable páginas, ventanas, reintentos, paso de 240 s y tandas de hasta 5.000 filas. Ajustar únicamente los presupuestos configurables previstos por la spec y registrar sus valores finales. | Límites; pruebas; sesión | C-04, C-06; T-04, T-06 | Cada llamada de privacidad queda holgadamente por debajo de 2 s; una ejecución incompleta nunca acredita cobertura. Control completo de .3 con los valores finales y commit del usuario (P-04). |
| 8 | **Etapa .4, pruebas primero:** tarjeta de conexión, salud, sincronización manual, cobertura, ventas, cohortes y ranking por unidades. Inicio y menú leen estado real; la pantalla distingue vacío, cero, parcial y «menos de 5». Ningún texto rotula una cifra como «ingreso neto» (trampa de la spec). **Guía de integraciones (P-02):** el botón «Ver guía de integraciones», hoy deshabilitado, abre un modal con el estilo de la imagen del usuario y dos páginas que se eligen arriba: «Conectar» (pasos numerados para conectar Meta y Tiendanube) y «Desconectar» (qué borra PRAXA al desconectar y cómo desinstalar la app desde el administrador de Tiendanube y quitar el acceso en Meta). Los textos describen lo que hace PRAXA de verdad: la sincronización es manual, desde la tarjeta, sin promesas de «tiempo real». La desconexión de Tiendanube muestra un enlace que abre la guía en «Desconectar». Cumple la instrucción de desinstalación de la spec (§1, «Desconexión»). | Pantalla Integraciones; guía; `app-data`; pruebas de componente | C-03, C-07, C-13, C-15; T-05, T-08; CA-52 | Pruebas de componente/unitarias: el modal abre, cierra con «Entendido» y con Escape, cambia de página, devuelve el foco al botón y la desconexión de Tiendanube lo abre en «Desconectar». Ningún texto dice «ingreso neto». Control completo de .4 y commit del usuario. |
| 9 | **Primera publicación, acción del usuario:** push de los commits .1–.4, integración en `main`, `db:push` de migración 1 en el proyecto `app` y despliegue del código de .1–.4. | Sesión | C-14; CB-04 | Verificar commit remoto, historial `0023` de `app`, versión desplegada y que OAuth/webhooks apuntan a esa versión. Publicar no aprueba el gate. El asistente le recuerda al usuario que el dueño no conecte su tienda hasta el paso 14, cuando se le comunica el acta (trampa de la spec). |
| 10 | Prueba manual T-15 en `app` con cuenta y empresa sintéticas de DEC-18 y tienda de demostración: OAuth, `GET /store`, sincronización y reembolso. Desinstalar **con la conexión activa**; verificar firma real de `store_redact`, cero filas y ausencia de conexión. Registrar H-05, H-06 y H-09 sin valores ni IDs. H-05 fallida bloquea la etapa; H-06 no verificada mantiene deshabilitado el monto cobrado. | Sesión; hallazgos si corresponde | C-06, C-14; T-15 | Recorrido redactado y purga comprobada; ninguna suite automatizada contra `app`. |
| 11 | **Etapa .5, pruebas primero:** agregar cuatro herramientas cerradas al chat, selección de herramientas por fuente activa, abstención y conexión del registro según §6; bloques desde SQL. Añadir sección de tienda de 28 días al diagnóstico, evidencia solo agregada, dos zonas visibles, PDF y compatibilidad v1/v2. Implementar migración 2 solo para `diagnostic_reports`. | Chat; diagnóstico; pgTAP 15/17; migración 2; pruebas | C-08, C-11, C-12, C-13, C-15; T-11, T-12; CA-52/62/70, §12 y §16 | Fixtures iguales a SQL; ninguna celda oculta o ID llega al modelo; informe v1 previo sigue legible; v2 exige `store_connection_id`; desconexión lo borra. |
| 12 | El usuario ejecuta `npm run db:push:test` para migración 2. El asistente verifica historial y control completo de .5. Preparar costo estimado y ejecutar T-13 solo si el usuario da OK expreso; su omisión no bloquea el gate. El usuario hace el commit de etapa. | Migración 2; sesión; eval si se autoriza | C-11, C-12; T-09, T-11, T-12, T-13 opcional | `0024` aplicada una vez; suites requeridas verdes; T-13 se registra como ejecutada u opcional no ejecutada. |
| 13 | **Segunda publicación, acción del usuario:** push, integración en `main`, `db:push` de migración 2 en `app` y despliegue. | Sesión | C-12; T-12; CB-03–CB-06 | Verificar commit remoto, historial `0024`, versión publicada y lectura de un informe v1 existente. |
| 14 | El usuario comunica al dueño el acta aprobada y obtiene autorización de su tienda. Hacer el recorrido real redactado con al menos un pedido pagado y un cambio posterior; comprobar campos, cobertura y privacidad sin copiar valores. Ejecutar verificación final, cerrar H-E1-236/237 solo con evidencia, y presentar `G-TIENDA` al usuario. | Sesión; acta; seguridad/arquitectura; hallazgos/estado | C-01–C-15; T-08, T-09; CB-01–CB-06; §17 completo | `G-TIENDA` queda pendiente si faltan filas, permisos, comunicación, pruebas o aprobación expresa. No iniciar M16f. |

## Verificación final

Ejecutar en cada control de etapa `npm run db:check:test`, `npm run verify`, `npm run test:policies`, `npm run test:app` y `git diff --check`. Revisar `git diff --name-only` contra la tabla, grants y RLS, ausencia de secretos/PII, migraciones antiguas intactas, respuestas sintéticas esperadas y resultados reales de cada comando. `npm run test:eval` corresponde solo a T-13 con costo informado y OK previo.

La sesión de cierre registra tabla de campos extraídos y descartados, matriz de privilegios, páginas/ventanas y conciliación, mediciones de presupuestos, casos de privacidad, publicaciones y recorridos redactados. Una prueba requerida omitida equivale a no ejecutada.

## Intervenciones del usuario y acciones reservadas

| Paso | Acción del usuario | Verificación posterior |
|---:|---|---|
| 0 | Aprobar el plan tras auditoría APROBABLE y el acta ampliada | Aprobaciones y versiones documentales registradas antes del código |
| 2, 12 | Ejecutar `npm run db:push:test` para cada migración, después de `db:check:test` | Historial del desechable y suites completas |
| 3 | Crear la app, confirmar instalación sin homologación y H-10; cargar variables en `.env.local` y Vercel sin comunicarlas en el chat | Preflight redactado y configuración de Portal comprobada |
| 2, 4, 7, 8, 12 | Hacer commit al terminar cada etapa | Commit y control técnico de la etapa registrados |
| 9, 13 | Hacer push, integrar en `main`, aplicar `db:push` en `app` y desplegar cada publicación | Commit remoto, historial de migraciones y versión publicada |
| 10 | Preparar tienda de demostración y coordinar la prueba manual; desinstalar al final | T-15 y cero datos de la tienda |
| 12, opcional | Autorizar costo de T-13 | Resultado de evaluación o constancia de no ejecución opcional |
| 14 | Comunicar el acta al dueño, obtener autorización, coordinar recorrido real y decidir `G-TIENDA` | Declaración de comunicación y evidencia redactada del recorrido |

## Migraciones

La última migración observada es `0022`; al iniciar se confirma la secuencia y se usan `0023_tiendanube.sql` y `0024_tiendanube_diag.sql` si sigue libre. Ninguna migración existente se edita. Una corrección posterior a `db:push` se hace con una migración nueva, añadida antes al alcance aprobado.

- **Migración 1:** ampliar el enum; reemplazar el índice vivo por `(company_id, provider)`; discriminar scopes, tipo de token y expiración por proveedor; migrar las credenciales existentes como Meta sin alterar su material cifrado. Añadir tablas privadas de pedidos, líneas, clientes mínimos, productos, variantes, ejecuciones y supresiones, y agregados públicos con RLS forzada. Mantener `purge_connection(uuid,uuid,uuid)` y extenderla a hijos de Tiendanube.
- **Firmas existentes que cambian:** `create_oauth_attempt` y `consume_oauth_attempt` reciben `p_provider public.integration_provider` después de `p_company_id`; `create_pending_connection` recibe el mismo parámetro después de `p_connection_id`; `list_pending_purges(uuid,uuid)` añade `provider` a su resultado. Retirar las firmas antiguas y sus grants en la misma migración. `confirm_connection` y `replace_credential` conservan firma, pero validan proveedor, intento y credencial en SQL.
- **RPC nuevas de escritura:** `tn_start_sync(uuid,uuid,uuid,integer,uuid,uuid,timestamptz)`, `tn_publish_orders(uuid,uuid,uuid,integer,uuid,uuid,jsonb,jsonb,jsonb)`, `tn_publish_catalog(uuid,uuid,uuid,integer,uuid,uuid,jsonb,jsonb,boolean)`, `tn_finish_sync(uuid,uuid,uuid,integer,uuid,uuid,timestamptz,boolean)` y `tn_fail_sync(uuid,uuid,uuid,integer,uuid,uuid,text,text)`. Las seis primeras posiciones representan actor, empresa, conexión, generación, ejecución y lease. Los JSONB admiten solo la proyección cerrada de la spec y se validan también en SQL. Usar los errores existentes de posesión; cualquier código nuevo comienza en `PX012`.
- **Privacidad:** `worker_api.tn_privacy_store_redact(text,integer)` y `worker_api.tn_privacy_customer_redact(text,text,text[])` devuelven únicamente `marked`, `more` o `done`, sin actor ni datos. Solo `praxa_integrations` puede ejecutarlas. Publicación y privacidad comparten el bloqueo de empresa.
- **Lecturas:** `public.get_tn_sync_status(uuid)`, `get_tn_sales(uuid,date,date,text)`, `get_tn_product_units(uuid,date,date,integer)` y `get_tn_cohorts(uuid,date,date,integer)` son `SECURITY INVOKER`. Devuelven agregados, cobertura, definición y fecha de extracción; ventas separan moneda, cohortes devuelven marcas de ocultamiento y ningún resultado expone IDs externos.
- **Migración 2:** admitir exclusivamente las parejas `(1, 'meta-diag-1')` y `(2, 'meta-tn-diag-1')`; añadir `store_connection_id` obligatorio solo para v2, FK compuesta con cascada y política de lectura que oculte v2 al dejar de estar vigente la conexión. Conservar informes v1 legibles.

La reversión operativa de un despliegue detiene nuevas sincronizaciones y conserva datos para inspección. Revertir esquema o privilegios se hace mediante otra migración aprobada, nunca modificando `0023` o `0024`.

## Riesgos

H-04 impide comenzar .2 si la app propia requiere homologación. Si en el paso 10 `GET /store` falla con los tres permisos (H-05), no se avanza a la etapa .5 y se decide con el usuario, sin pedir permisos de escritura. H-06 mantiene oculto el monto cobrado hasta verificar reembolsos. La prueba real sin filas no acredita C-09. Los reintentos agotados de privacidad pueden dejar datos ocultos y sin credencial hasta la siguiente purga perezosa, riesgo ya aceptado en la spec. Registrar cualquier contradicción o necesidad de archivo adicional como hallazgo y detener el corte antes de ampliar el alcance.

## Qué no se hace

No se implementa M16f, cron, worker, escrituras de negocio en Tiendanube, distribución pública, atribución de ventas a Meta, unión individual de compradores y visitas, ranking por importe ni exportación ante `customers/data_request`. No se ejecutan suites automatizadas en `app`; allí solo se hacen los recorridos manuales expresamente aprobados.
