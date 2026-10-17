# M16.2 — Plan de implementación

**Estado:** BORRADOR

Solo el usuario pasa este plan a `APROBADO`, después de una auditoría APROBABLE.

**Spec base:** `docs/FASES/FASE1/M16.2/spec.md`, estado `APROBADA`.

**Hash de contenido de la spec:** `0b92d68f3042983fb37fd0339d9715071758cc7b`, coincidente con `spec-audit-4`, APROBABLE.

**Base inspeccionada:** `main`, commit `65404aa100788a4eab5e98dbcfa6c116c8fa0bc1`. Hay cambios documentales preexistentes en la ruta, hallazgos y carpeta de M16.2: se preservan.

**Objetivo:** completar selección, confirmación, reautorización, desconexión y purga de Meta; reflejar el estado real en la aplicación; completar el alta del dueño y VR-01.

**Hash de contenido de este plan**, una vez guardado, excluyendo la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M16.2/plan.md | git hash-object --stdin
```

## Estructura: una microfase, dos fases

M16.2 sigue siendo **una sola microfase** (D-M16.2-11). Se ejecuta en dos fases separadas por la revisión independiente y el merge, porque el alta del dueño y VR-01 solo se pueden hacer con la aplicación desplegada en producción y el pipeline exige revisar antes de mergear:

| Fase | Pasos | Qué termina | Quién la cierra |
|---|---|---|---|
| **A — Verificación técnica, antes del merge** | 0 a 13 | Estado `VERIFICADO — PENDIENTE DE APROBACIÓN` con `verify`, `test:policies`, `test:app` y el preflight real en verde | `/microfase M16.2` |
| **Entrega de la fase A** | E1 a E5 | La versión revisada queda en `main` y desplegada | El usuario, con `/implementation-review` y `/qa-review` |
| **B — Cierre del gate, después del merge** | 14 a 17 | Expediente de `G-VR01` completo | `/microfase M16.2` (segunda invocación) y el usuario |

`G-VR01` no se aprueba en la fase A. El estado `VERIFICADO — PENDIENTE DE APROBACIÓN` del final de la fase A es el que exigen `/implementation-review` y `/qa-review`; no significa que el gate esté listo. Para distinguirlos, el estado de `PROJECT_STATE.md` y de la sesión lleva una aclaración: «Fase A verificada; fase B pendiente».

### Cómo se resuelve cada regla del pipeline

| Regla del pipeline | Cómo la cumple este plan |
|---|---|
| `/microfase`: «si falta una acción obligatoria, la microfase queda `BLOQUEADO`» | Las acciones del usuario que dependen de un despliegue (14 a 17) están **fuera de la fase A**. La fase A solo contiene acciones que se pueden hacer antes del merge: el único paso del usuario es el preflight real (paso 11), que no necesita despliegue |
| `/implementation-review`: exige `VERIFICADO — PENDIENTE DE APROBACIÓN`, rama `mf/M16.2` y árbol limpio | La fase A termina en ese estado. En E1 el usuario commitea en `mf/M16.2`, incluidos los cambios documentales preexistentes (enmiendas de la ruta, spec, plan, `HALLAZGOS.md`) |
| `/qa-review` §5: para abrir el PR, «todas las verificaciones obligatorias de III.3 ejecutadas y en verde»; las acciones que «el plan ubica después del merge» se clasifican en el gate | Este plan ubica expresamente después del merge el alta del dueño y VR-01 (III.3), junto con VD-01, `G-ACTA-META` y P-04. Antes del PR se cumplen `verify`, `test:policies`, `test:app`, `db:check:test` y el preflight real. Ver «Requisitos por etapa» |
| `/microfase` §1 y §2: una dependencia sin aprobar frena la microfase, y la ficha de M16.2 lista `G-OAUTH`, `G-ACTA-META` y P-04 como dependencias | II.10 exige `G-ACTA-META` y P-04 solo para los pasos 10 a 12 de la ruta (alta y VR-01, pasos 15 y 16 de este plan), y `PROJECT_STATE.md` declara M16.2 «habilitada por `G-OAUTH`». Para la fase A rigen `G-OAUTH` y `G-ENTORNO`; `G-ACTA-META` y P-04 se verifican en el paso 14, antes de cualquier uso real. La contradicción se resuelve a favor de II.10 y de la spec |
| `/qa-review`: para el merge, revisión de Codex sin bloqueantes y CI en verde | E4 y E5. El merge ocurre solo con `implementation-review` APROBABLE y `qa-review` LISTO PARA PR sobre el mismo commit |
| `/qa-review` y `/implementation-review`: el commit revisado debe ser el de `HEAD` | Cualquier cambio de código posterior al commit revisado obliga a repetir ambas revisiones (ver «Si VR-01 exige cambios de código») |
| `/microfase`: operaciones prohibidas (`rebase`, `--force`, `reset --hard`, `branch -D`, push) | El usuario hace push y PR. Para retomar en la fase B, el usuario actualiza `mf/M16.2` con `git merge main`, sin rebase ni force |
| Precondición 8 de la ruta: los archivos de seguimiento no amplían el alcance ni aprueban gates | La evidencia de la fase B se registra solo en `HALLAZGOS.md`, `PROJECT_STATE.md` y `sesiones/M16.2.md`. El PR de cierre toca únicamente esos tres archivos |

### Requisitos por etapa

Es la clasificación que `/qa-review` §5 pide para M16.2. Es parte del plan.

| Etapa | Requisitos |
|---|---|
| **Para abrir el PR** (fase A) | C-01 a C-35, C-38 a C-42 y C-44 a C-46 en verde por sus casos T (C-36 y C-37 son de la fase B). `npm run verify`, `npm run test:policies`, `npm run test:app` y `npm run db:check:test` en verde, sin omitir `meta-lifecycle` ni `meta-oauth` (CB-06). Preflight real con `preflight: ok` registrado (paso 11). Documentación del paso 12 aplicada. Diff y archivos nuevos revisados (CB-01 a CB-06). `implementation-review` APROBABLE sobre el commit |
| **Para el merge** | `qa-review` LISTO PARA PR sobre ese mismo commit. Revisión de Codex sin bloqueantes. CI en verde |
| **Para cerrar `G-VR01`** (fase B) | Despliegue de la versión revisada verificado (14). `M03a` cerrada y `G-ACTA-META` aprobado; P-04 declarado (14). VD-01 satisfactoria (14). Alta del dueño con registro cerrado después (15). VR-01 completo (16: C-36, C-37, T-44, T-45). Cierre sin credencial real pendiente (17). Evidencia redactada. Aprobación explícita del usuario |

## Archivos

Los identificadores F01–F31 permiten referenciar los archivos en los pasos sin repetir sus rutas. La lista queda contenida en II.10 de la ruta más los archivos de seguimiento.

| Archivo | Nuevo o modificado | Paso | Autorizado por |
|---|---|---|---|
| F01 — `src/modules/integrations/meta/accounts.ts` | Nuevo | 2 | II.10.1 |
| F02 — `src/modules/integrations/meta/probe.ts` | Nuevo | 2 | II.10.3 |
| F03 — `src/modules/integrations/meta/revoke.ts` | Nuevo | 1 | II.10.6 |
| F04 — `src/modules/integrations/meta/errors.ts` | Modificado | 6–7 | II.10.5 y 7 |
| F05 — `src/modules/integrations/meta/api.ts` | Modificado | 1 | II.10.6 |
| F06 — `src/modules/integrations/meta/client.ts` | Modificado | 1 | II.10.6 |
| F07 — `src/modules/integrations/meta/tokens.ts` | Modificado | 1–2, 6 | II.10.1, 5 y 6 |
| F08 — `src/modules/integrations/meta/oauth.ts` | Modificado | 4, 6 | II.10.4 y 5 |
| F09 — `src/modules/integrations/meta/outcomes.ts` | Modificado | 4–6, 8 | II.10.2 y 6 |
| F10 — `src/modules/integrations/lifecycle.ts` | Nuevo | 4–7 | II.10.4 y 5 |
| F11 — `src/modules/integrations/actions.ts` | Nuevo | 5 | II.10.6 |
| F12 — `src/modules/integrations/repository/connections.ts` | Modificado | 3 | II.10.2 |
| F13 — `src/modules/integrations/repository/lifecycle-calls.ts` | Nuevo | 3 | II.10.4 |
| F14 — `src/app/(app)/app/integraciones/page.tsx` | Modificado | 8 | II.10.2 y 8 |
| F15 — `src/app/(app)/app/integraciones/meta-tarjeta.tsx` | Nuevo | 8 | II.10.2, 6 y 8 |
| F16 — `tests/unit/meta-lifecycle.test.ts` | Nuevo | 1–7 | II.10.9 |
| F17 — `tests/app/meta-lifecycle.test.ts` | Nuevo | 0, 9 | II.10.9 |
| F18 — `tests/unit/meta-oauth.test.ts` | Modificado | 1, 4, 6–7 | II.10.9a |
| F19 — `tests/app/meta-oauth.test.ts` | Modificado | 0–1, 4, 6, 9 | II.10.9a |
| F20 — `tests/component/integraciones-meta-aviso.test.tsx` | Modificado | 8 | II.10.9a |
| F21 — `tests/component/app-paginas-sesion.test.tsx` | Modificado, solo mocks | 8 | II.10.9a |
| F22 — `tests/component/integraciones-meta-tarjeta.test.tsx` | Nuevo | 8 | II.10.9a |
| F23 — `docs/SECURITY.md` | Modificado | 12 | II.10.9c |
| F24 — `docs/ARCHITECTURE.md` | Modificado | 12 | II.10.9c |
| F25 — `src/modules/app-data/index.ts` | Modificado | 8 | II.10.8 |
| F26 — `tests/unit/app-data.test.ts` | Modificado | 8 | II.10.8 |
| F27 — `scripts/meta-preflight.mjs` | Nuevo | 10 | II.10.9b |
| F28 — `tests/unit/meta-preflight.test.ts` | Nuevo | 10 | II.10.9b |
| F29 — `docs/HALLAZGOS.md` | Modificado | 0–17, cuando corresponda | Seguimiento |
| F30 — `docs/PROJECT_STATE.md` | Modificado | 0, bloqueos, 13, 17 | Seguimiento |
| F31 — `docs/FASES/FASE1/meta_first/sesiones/M16.2.md` | Nuevo | 0–17 | Seguimiento |

Las enmiendas de la ruta ya están presentes y aprobadas. II.10.9d se cumple comprobando su contenido; no requiere nuevos cambios en esos documentos. La aprobación y auditoría de spec/plan pertenecen al pipeline previo y no amplían los archivos de implementación.

## Pasos

En esta tabla, `C-NN` y `T-NN` significan `M16.2-C-NN` y `M16.2-T-NN`. Se cubren los **45 criterios operativos y 51 casos activos**. `C-43` y `T-49` están retirados; VD-01 permanece como verificación posterior al despliegue.

**Regla TDD:** escribir y ejecutar primero las pruebas del comportamiento, registrar el rojo esperado, implementar y obtener verde. Las pruebas de aplicación T-30 a T-38 se preparan en el paso 0, antes del código que ejercitan. Los pasos 1–8 y 10 agregan primero sus pruebas unitarias o de componente. No se considera rojo válido un fallo de configuración, aislamiento o permisos.

**Verificación por paso:** al cerrar cada paso de código (1 a 10), además de sus pruebas, `npm run typecheck` sin errores en `src/` y en las pruebas de ese paso. Los únicos errores admitidos son los de importación de `tests/app/meta-lifecycle.test.ts` (F17) y de `tests/app/meta-oauth.test.ts` (F19), preparados en el paso 0 antes de que existan los módulos que importan; desaparecen entre los pasos 4 y 7. Así una dependencia hacia un paso posterior se detecta en el paso donde ocurre y no en el 13. Vitest no chequea tipos: sin esta regla un tipo faltante pasaría en verde hasta el final.

Cada paso registra comandos, resultados y limitaciones en F31. F29 se actualiza solo ante hallazgos; F30, ante cambios de estado o bloqueos.

### Fase A — Verificación técnica (pasos 0 a 13)

| # | Acción | Archivos | Criterios y casos que cubre | Verificación del paso |
|---|---|---|---|---|
| **0** | **Precondiciones y preparación.** Revalidar hash, aprobación documental de spec, auditoría de spec y auditoría APROBABLE del plan con hashes coincidentes. Confirmar las dependencias de la fase A: `G-OAUTH` y `G-ENTORNO`, cerradas. `G-ACTA-META` y P-04 **no** se exigen en la fase A: II.10 los requiere solo para los pasos 10 a 12 de la ruta (alta del dueño y VR-01, pasos 15 y 16 de este plan) y `PROJECT_STATE.md` declara M16.2 «habilitada por `G-OAUTH`»; se verifican en el paso 14. Crear o retomar `mf/M16.2` desde la base que contiene M16.1, preservando cambios existentes; sin stash ni operaciones destructivas. Registrar `EN CURSO`. Validar destino desechable y preparar T-30 a T-38 con los helpers existentes, Meta simulada y guarda que falla ante configuración inválida. | F17, F19, F29–F31 | C-33; T-30 a T-38 preparados; CB-03, CB-04, CB-05, CB-06 | Rama y diff identificados; `npm run db:check:test` satisfactorio; guarda T-38 inspeccionada. Ejecutar la suite nueva y registrar rojo por ausencia de implementación, nunca por falta de configuración. Verificar II.10.9d y las aprobaciones de las enmiendas. |
| **1** | **Transporte por lote y revocación.** Escribir T-14/T-47 y adaptar los simuladores existentes antes del cambio. Agregar `revoke_token` a los parámetros prohibidos; implementar `postBatchGetJson` con una operación y allowlist `debug_token`/`oauth/revoke`. Cambiar únicamente el transporte de `inspectToken`; implementar `revokeToken`, sin reintentos ni excepciones hacia el llamador. Mantener timeout, guardas, `no-store` y rechazo de redirecciones. | F03, F05–F07, F16, F18–F19 | C-14, C-39, C-40; T-14, T-47; CA-26, CA-31, CA-39; H-03 pendiente de VR-01 | Unitarias verdes: URL externa sin consulta, secretos solo en cuerpo, validación del token conservada y clasificación exacta de respuestas externas/internas inválidas. El simulador rechaza revocación directa. |
| **2** | **Cuentas y probe.** Escribir T-01 a T-05. Agregar `fetchSystemUser` reutilizando `/me` y conservar `fetchClientBusinessId` como envoltorio. Implementar listado, validación K03, deduplicación y descartes. Paginar exclusivamente por cursor: 100 cuentas por página, máximo 10; el listado incompleto no habilita selección. Implementar probe con los parámetros de §5, máximo 5 páginas y resumen sin valores. | F01–F02, F07, F16 | C-01, C-02, C-06; T-01 a T-05; CA-08, CA-35, CA-37, CA-40, CA-60, CA-26 | Unitarias verifican consultas exactas, múltiples páginas, límites, datos inválidos, respuesta vacía válida y errores. Nunca se sigue ni registra `paging.next`; el resumen no contiene gasto ni impresiones. |
| **3** | **Lectura y funciones de ciclo de vida.** Probar primero argumentos y respuestas de los adaptadores. Agregar `readConnectionRecord` con cliente del usuario, RLS, K01 y validación del registro completo. Crear los cinco envoltorios de §8: confirmación, marcado de reautorización, bloqueo, purga y listado de purgas. Validar moneda/zona antes de confirmar y todas las columnas SQL antes de proyectar la respuesta. Reutilizar el cliente y repositorio de credenciales existentes. | F12–F13, F16 | C-02, C-05, C-07, C-21, C-31; soporte de T-06, T-09, T-21; CA-08, CA-09, CA-37 | Unitarias de adaptadores verdes con K01 inválido, respuesta inválida, errores SQL y respuestas válidas. Ninguna escritura directa ni uso de `service_role`; ninguna migración modificada. |
| **4** | **Purga y desconexión.** Escribir T-11 a T-13, la parte de desconexión de T-51 y la parte de T-25 y T-50 que fija el texto de `desconectado` (con la oración de las copias de seguridad) y de `desconexion_en_curso`. Agregar en `outcomes.ts` esos dos resultados, que `disconnect` necesita para compilar, y ampliar `MetaOAuthDeps` con `readConnection` y con un `log` que acepte `MetaOAuthLogEvent` y `MetaLifecycleLogEvent` (spec §13), sin cambiar el registro por defecto. Implementar `LifecycleDeps`, registro cerrado y `runLazyPurge`: máximo 5 conexiones, bloqueo → lectura/revocación → purga. Continuar con la siguiente conexión tras un fallo y conservar `remaining`. Implementar `disconnect`: si falla `beginDisconnect`, no purgar. Integrar purga antes de leer la conexión viva en `handleMetaStart`, siempre pasando sus dependencias inyectadas. Una pendiente vigente sigue dando `pendiente_vigente`. | F08–F10, F16, F18–F19 | C-08 a C-12, C-25, C-30 parcial, C-44 parcial, C-45; T-11 a T-13, T-25 parcial, T-50 parcial, T-51 parcial; CA-07, CA-08, CA-37b, CA-38, DEC-09, DEC-17 | Unitarias verifican orden, límite, reanudación, falta de credencial/configuración, fallo de revocación y persistencia de la purga pendiente. El espía prueba que nunca se crea un cliente Meta real cuando se inyectaron dependencias simuladas. `npm run typecheck` sin errores en `src/`: `disconnect`, el `log` ampliado y los dos resultados nuevos compilan en este paso. |
| **5** | **Estado, selección y acciones.** Escribir T-06 a T-10, T-26 y las variantes correspondientes de T-51. Implementar `loadMetaCardState` y `confirmAccount` según §9.3: `selectionKey = SHA-256(connectionId:accountId)`, nuevo listado del servidor, probe antes de confirmar y un único reintento por transporte/timeout con argumentos idénticos. No purgar dentro de la confirmación. Agregar los resultados de la selección (`conectado`, `cuenta_invalida`, `prueba_fallida`, `pendiente_vencida`, `conexion_cambio`) y las dos Server Actions de §10; construir K01 internamente y ejecutar `redirect` fuera del `try`. | F09–F11, F16 | C-03 a C-05, C-07, C-27, C-30 a C-32, C-42, C-45; T-06 a T-10, T-26, T-51 parcial; CA-35, CA-36, CA-37, CA-37b, CA-40, CA-09b | Unitarias verdes: clave inválida/cruzada, campos extra ignorados, probe fallido, vencimiento servidor/base, reenvío del formulario y errores de autenticación. Una pendiente con credencial ilegible conserva la opción de cancelar. `NEXT_REDIRECT` no queda capturado. |
| **6** | **Reautorización y recuperación.** Escribir T-15 a T-20, T-25, T-52 y las variantes de reautorización de T-51. Mover el canje a `tokens` y el mapeo compartido a `errors`; definir `ReauthDeps` sin exportar `Resolved` ni crear un ciclo de imports. Completar consumo → validación de conexión/generación → canje → inspección → `/me` → listado → reemplazo preparado. Agregar `reautorizado` y `cuenta_no_delegada` y retirar `reautorizacion_no_disponible`. Implementar casos A/B y `resolveAmbiguousWrite` para `initial` y `reauth`, con las tres resoluciones de §11. | F04, F07–F10, F16, F18–F19 | C-15 a C-20, C-24, C-30, C-32, C-45, C-46; T-15 a T-20, T-25, T-51 parcial, T-52; CA-29b, CA-37c, CA-38c, CA-26 | Unitarias verifican todas las traducciones de errores, una sola revocación tras rechazo confirmado y reintento con la misma operación cifrada. Tras dos fallos de transporte se relee: coincidencia → éxito sin revocar; ausencia/diferencia/error de lectura → una revocación y `error`. Ningún token ni hash aparece en logs. |
| **7** | **Efectos y registros.** Escribir T-21 a T-24. Implementar `connectionEffectFor`, textos de reautorización y `applyConnectionFailure`: generación esperada y mensaje redactado para las clases admitidas; el resto solo registra su clase. Consolidar los eventos de ciclo de vida y `motivo` cerrado del callback, sin duplicar líneas. Verificar confinamiento de secretos y módulos de servidor. | F04, F08, F10, F16, F18 | C-21, C-22, C-28, C-29; T-21 a T-24; CA-09, CA-26, CA-39, CA-40 | Tabla de nueve clases verde; `asset_access` continúa sin asignación automática. Carreras devuelven `unchanged` donde lo fija la spec. Inspección de todas las líneas capturadas y guardas existentes verdes. Persistencia de las clases sin transición sigue asignada a M16c. |
| **8** | **Tarjeta y estado compartido.** Escribir T-27 a T-29, T-46 y la parte UI de T-50. Construir `MetaTarjeta` como componente de servidor con los seis estados, selección sin preselección, cancelación, reautorización y desconexión. Reutilizar estilos/componentes existentes. Mantener la comprobación de sesión antes de leer datos. Cambiar `getIntegraciones` a lectura RLS sin `cache`: Meta conectada solo en `active`; fallos → `false`. Incorporar textos exactos de §14–15, incluida la advertencia de copias. | F09, F14–F15, F20–F22, F25–F26 | C-03, C-13, C-23, C-26, C-27, C-30, C-38, C-44; T-27 a T-29, T-46, T-50; CA-28, CA-29, CA-36, CA-38, CA-38b, CA-39, CA-40 | Unitarias y componentes verdes: seis estados, una cuenta sin seleccionar, formularios POST y ausencia de identificadores completos en HTML. `app-paginas-sesion` conserva todas sus aserciones y siete pantallas; solo incorpora mocks. Orden y copias de integraciones conservados; GA/Tiendanube siguen desconectadas. |
| **9** | **Integración con base desechable.** Ejecutar en verde T-30 a T-38 preparados antes del código. Usar el flujo OAuth para crear pendientes y conexiones; intercalar desconexión mediante funciones de ciclo de vida con K01 sintético. Cubrir desconexión parcial y completa durante confirmación/reautorización, incluida la respuesta `not_authorized` tras purgar. Adaptar T-32/T-33 de M16.1 al comportamiento nuevo. | F17, F19; correcciones solo en archivos anteriores autorizados | C-02, C-05, C-07, C-08, C-10 a C-12, C-15, C-17, C-18, C-21, C-24, C-25, C-33; T-30 a T-38; CA-35, CA-37, CA-37c, CA-38, CA-38c, CA-39, CA-08 | `db:check:test` válido y pruebas app verdes. Comprobar estado mediante RLS y credenciales mediante `worker_api`; ninguna escritura tardía reactiva/reinserta. Cerrar cliente y limpiar fixtures, sin pendientes de limpieza. No adelantar vencimientos mediante acceso administrativo. |
| **10** | **Preflight operativo (código).** Escribir T-48 antes del script. Implementar `runPreflight({ env, fetch, log })` y ejecución solo como módulo principal: una petición, timeout, versión coincidente con el cliente y salida de campos cerrados. No agregar dependencias ni scripts de npm. | F27–F28 | C-28, C-41; T-48; CA-26 | Prueba unitaria con `fetch` simulado: éxito, configuración ausente, error Graph, HTTP, red y salida sin datos sensibles. Se comprueban código de salida y número de peticiones. El script real se ejecuta recién en el paso 11. |
| **11** | **Preflight real del usuario.** Se hace en la fase A, antes de las revisiones: si Graph rechaza el lote, hay que cambiar código y conviene saberlo antes de revisar. El asistente entrega el script ya probado. El usuario lo ejecuta localmente con su configuración y aporta únicamente la línea JSON prevista. | F31 | C-41; T-48 acredita el script, no la llamada real; H-S-23, H-E1-114/116 | Registrar `preflight: ok` y el resultado real. Con `fallido` o `sin_configuracion`, el estado es `BLOQUEADO`: se reabre D-M16.2-03 por la vía de spec/plan (grill), sin tocar la fase B ni pedir revisiones. |
| **12** | **Documentación y hallazgos.** Aplicar exclusivamente Diseño §17: controles de ciclo de vida vigentes, límites de revocación/purga, protección de logs, preflight local y transporte por lote; reflejar componentes existentes y dependencia `app-data` → `integrations`. Comprobar que la ruta ya asigna a M16c la persistencia de H-E1-22 y la prueba durante sincronización. Registrar el comentario SQL desactualizado como informativo, sin modificar la migración. | F23–F24, F29, F31 | C-35; T-42; CB-03, CB-05; II.10.9c y 9d | Diff documental limitado al diseño y contrato de AGENTS: sin TTL, catálogo de funciones, conteos ni resultados volátiles. Hallazgos referencian evidencia; no se cierra la parte real de H-E1-114/116/117 antes de VR-01. |
| **13** | **Verificación técnica completa y cierre de la fase A.** Ejecutar los comandos de «Verificación final». Auditar archivos, registros, fixtures y diff; comprobar la matriz completa criterio → caso → resultado. Registrar omitidas ajenas por archivo y motivo. Dejar en la sesión y en `PROJECT_STATE.md` el estado `VERIFICADO — PENDIENTE DE APROBACIÓN` con la aclaración «fase A verificada; fase B pendiente; `G-VR01` no aprobado», y anotar las acciones pendientes de la fase B. | F29–F31; lectura del diff completo | C-29, C-33, C-34; T-39 a T-43; CB-01 a CB-06; CA-26, CA-40 | `verify`, `test:policies` y `test:app` verdes. Regresiones pgTAP 08/09/09b/10 verdes, sin modificaciones. Ningún caso obligatorio omitido. Todos los archivos modificados pertenecen a la tabla. Preflight real en `ok`. Siguiente paso indicado al usuario: E1. |

### Entrega de la fase A (no son pasos de `/microfase`)

| # | Quién | Acción | Verificación |
|---|---|---|---|
| **E1** | Usuario | Commitear en `mf/M16.2`, incluidos los cambios documentales preexistentes, para dejar el árbol limpio | `git status --porcelain` sin cambios, salvo informes de revisión |
| **E2** | Usuario | `/implementation-review M16.2` | `implementation-review-N` APROBABLE, con el commit revisado **R** y su base registrados |
| **E3** | Usuario | `/qa-review M16.2` | LISTO PARA PR sobre el mismo **R**; `pr.md` con los requisitos por etapa de este plan |
| **E4** | Usuario | Push, PR con `pr.md`, revisión de Codex y CI | Codex sin bloqueantes y CI en verde |
| **E5** | Usuario | Merge a `main` | Commit de `main` **D** que incorpora el trabajo de `mf/M16.2` |

Si E2, E3 o E4 devuelven cambios, se vuelve a `/microfase M16.2` para corregir en la fase A y se repiten las revisiones sobre el nuevo commit.

### Fase B — Cierre del gate (pasos 14 a 17)

Antes de empezar, el usuario deja `mf/M16.2` actualizada con el `main` posterior al merge (`git switch mf/M16.2` y `git merge main`; sin `rebase` ni `--force`) y vuelve a invocar `/microfase M16.2`. La microfase retoma por su sesión y valida otra vez hashes y aprobaciones, sin pedirlas de nuevo si ya constan. Estado `EN CURSO` mientras corre la fase B.

**Versión que se despliega.** Es **D**, el commit de `main` posterior al merge, cuyo código es idéntico al **R** revisado en E2 y E3. No se despliega la rama `mf/M16.2` ni ningún commit no revisado. El paso 14 lo comprueba antes de cualquier uso real.

| # | Acción | Archivos | Criterios y casos que cubre | Verificación del paso |
|---|---|---|---|---|
| **14** | **Despliegue verificado, acta y VD-01.** (a) Verificar que **D** tiene el mismo código que **R**. (b) El usuario confirma el despliegue de producción de **D** en estado `Ready`. (c) Verificar `G-ACTA-META` y P-04 y que el acta declare el límite de copias de CA-38b; el acta la produce `M03a`, una microfase aparte que el usuario solicita por su cuenta (puede correr en paralelo durante la fase A o las revisiones) y que este plan no ejecuta; (c) puede verificarse después de (b) y (d), pero siempre antes del paso 15. (d) El usuario ejecuta VD-01 con la cuenta sintética conservada de M28.2a, deteniéndose en Meta sin autorizar. | F29–F31 | C-36, C-44; T-50, parte del acta; P-04, CA-38b; VD-01/H-S-22 | (a) `git diff --stat R D -- . ':(exclude)docs' ':(exclude).claude'` sin ninguna salida: todo archivo versionado fuera de la documentación y de la configuración del asistente (incluidos `public/`, `.github/`, `.nvmrc` y los archivos de configuración) es idéntico al revisado; con diferencias, `BLOQUEADO`: la versión desplegada no es la revisada. (b) Deployment de producción de **D** `Ready`; se registra el hash corto. (c) Aprobación del acta y declaración de P-04 registradas. (d) VD-01: `Origin` coincidente, HTTP 303 y host Meta. Cualquier otro resultado bloquea el alta. |
| **15** | **Alta del dueño — II.10.10.** El usuario abre temporalmente el registro; el dueño se registra, confirma correo, entra a Mi perfil y crea/completa su empresa en Configuración. El usuario cierra inmediatamente el registro. | F31; F30 si hay bloqueo | C-36; T-44, alta; DEC-18, P-04 | Declaración del recorrido y de un alta nueva rechazada después del cierre, sin correo, nombre ni identificadores en evidencia. |
| **16** | **VR-01 — II.10.11.** Usuario y dueño ejecutan §18: cancelar el diálogo → autorizar → cancelar la pendiente y comprobar revocación → volver a autorizar → elegir y confirmar cuenta. Capturar únicamente resultados cerrados y resumen del probe. Medir páginas, llamadas y duración para Q-04. Declarar en la sesión que el id completo de la cuenta puede verse en la ruta de las peticiones de Insights si el hosting muestra las subpeticiones (trampa 7). | F29–F31 | C-36, C-37; T-44, T-45; VR-01, P-05, CA-31, CA-35 a CA-40; H-01, H-02, H-03 | `cancelado`, `pendiente`, `desconectado` con revocación `ok`, y finalmente `conectado` con probe `ok`. Resolver/registrar las hipótesis de §18 y H-S-16 a H-S-20/H-S-23. La sesión contiene la declaración de la trampa 7, sin el id. Ante rechazo de forma o prerrequisito incumplido, detenerse y aplicar recuperación documentada; si exige código, ver el procedimiento de abajo. |
| **17** | **Cierre — II.10.12.** Dejar conexión `active`; si se interrumpe el recorrido, cancelar la pendiente y comprobar la purga, sin dejarla pendiente a propósito. Completar evidencia, hallazgos y estado en los tres archivos de seguimiento. Preparar el PR de cierre: solo `HALLAZGOS.md`, `PROJECT_STATE.md` y `sesiones/M16.2.md`. Presentar el expediente de `G-VR01`. Solo el usuario aprueba el gate. | F29–F31 | C-36, C-37; T-43 a T-45; CA-37b, CA-38, DEC-17, CB-02, CB-05, CB-06 | Estado final visible y evidencia redactada completa. `git diff --name-only main...mf/M16.2` lista únicamente esos tres archivos. Si falta una prueba o intervención obligatoria: `BLOQUEADO`. Si todo está verificado: `VERIFICADO — PENDIENTE DE APROBACIÓN` para el gate. Tras la aprobación explícita del usuario se registra `G-VR01` y recién entonces `M16c` queda habilitada. |

### Si VR-01 (o VD-01) exige cambios de código

La versión desplegada **D** no se parchea en caliente ni se edita `main` directamente. El procedimiento es:

1. **Detener** el recorrido. No se vuelve a autorizar con datos reales. Registrar un hallazgo con ID estable (qué paso falló, impacto y evidencia redactada).
2. **Dejar limpio el estado real** con la versión desplegada: si quedó una pendiente o una conexión creada por la prueba, el dueño la cancela o la desconecta desde la tarjeta. Si la revocación falló o no se puede comprobar, el dueño quita a Praxa de las apps conectadas de su negocio (trampa 1). El registro de usuarios sigue cerrado. No queda una credencial real pendiente a propósito (II.10.12).
3. **Clasificar la causa:**
   - *Sin código* (configuración de Meta, rol de tester, datos del dueño): se corrige afuera, se registra, y se retoma en el paso que falló. No cambia la versión desplegada.
   - *Spec o plan incorrectos* (una contradicción, algo imposible, un dato que resultó falso): `BLOQUEADO`. Vuelve a grill o plan mode y a auditoría, como pide `/microfase`.
   - *Migración o archivo fuera de la tabla*: condición de parada de III.9. Se detiene y se replantea el alcance.
   - *Código dentro de los archivos F01–F31*: sigue el paso 4.
4. **Corrección con las mismas reglas de la fase A**, en `mf/M16.2` actualizada con `main`: primero una prueba que reproduce el defecto en rojo, después la corrección, y verde en `verify`, `test:policies` y `test:app`. Si el cambio toca el transporte por lote, se repite el preflight real (paso 11). El asistente no hace commit ni push.
5. **Repetir la entrega:** E1 a E5 sobre el commit nuevo. Cambió el commit, así que `/implementation-review` y `/qa-review` se corren de nuevo y los informes anteriores dejan de valer para ese cambio. El merge produce una versión **D'** y el usuario la despliega.
6. **Repetir de la fase B lo que corresponda a D':** el paso 14 completo (identidad de la versión y VD-01 si el cambio toca `iniciar`, la tarjeta o la página). No se repite el alta (15): el dueño ya existe y el registro sigue cerrado. Se repite **el guion completo de VR-01** (§18, pasos 2 a 5). La evidencia de una versión anterior no se arrastra al expediente de `G-VR01`: cada resultado que el expediente cita corresponde a la versión final desplegada.
7. **Límite:** dos iteraciones de corrección sin converger son una condición de parada de III.9. Se detiene y se reporta.

## Interfaces y comportamiento fijados por la spec

Se conservan las firmas, tipos y resultados de Diseño §§2b–13 y §20: `MetaHttpClient.postBatchGetJson`, `SystemUser`, `DelegatedAccounts`, `ProbeSummary`, `RevokeResult`, `LifecycleDeps`, `MetaCardState`, `ReauthDeps`, `ReauthResult`, `DisconnectOutcome` y las expectativas/resoluciones de escritura ambigua. No se agregan endpoints, contratos SQL ni variables de entorno.

La proyección a `MetaCardState` excluye también el UUID de conexión, aunque el DTO interno de K03 lo incluya. El navegador solo entrega `cuenta`; actor, empresa, conexión, cuenta externa, moneda y zona se resuelven o revalidan en el servidor.

## Verificación final (paso 13)

Ejecutar desde la raíz del repositorio, en `mf/M16.2`:

```bash
npm run test:unit
npm run test:component
npm run db:check:test
npm run test:policies
npm run test:app
npm run verify
git diff --check
git diff --stat
```

- `verify` incluye lint, typegen, typecheck, unitarias, componentes y build; no sustituye pgTAP ni `test:app`.
- `meta-lifecycle` y `meta-oauth` deben ejecutarse sin omisiones. Una prueba requerida omitida por configuración es **no ejecutada y bloquea** —CB-06—. Las opt-in ajenas se documentan individualmente.
- Si Vitest no carga las suites desde Git Bash (H-E1-20), repetir con `powershell -NoProfile -Command "npm run …"` antes de concluir que algo falla. Un fallo del entorno es bloqueo, no un resultado.
- T-38 comprueba la guarda; T-39/T-41 son corridas de cierre; T-40 es regresión existente; T-42/T-43 son revisión documental y del diff; T-44/T-45 son el recorrido/procedimiento manual de la fase B. No requieren provocar un rojo artificial.
- El vencimiento SQL se acredita con pgTAP 09b y las unitarias previstas. No se modifican tablas mediante `service_role` para fabricar ese estado en `test:app`.
- T-43 revisa también archivos nuevos, que no aparecen en un diff ordinario mientras permanezcan sin seguimiento. Buscar los patrones de la spec y reportar ubicaciones/cantidades redactadas, sin imprimir coincidencias sensibles.
- La evidencia final contiene una fila por criterio y caso activo con paso, comando o intervención, resultado real y limitación. VD-01 se registra separadamente. Las filas de la fase B (C-36, C-37, T-44, T-45) quedan pendientes hasta el paso 17 y así se marcan.
- Ninguna suite automatizada ni fixture se ejecuta contra `app`. VR-01 conserva el carácter de recorrido manual expresamente requerido por la ruta.

## Intervenciones del usuario y acciones reservadas

| Paso | Acción reservada | Verificación posterior |
|---|---|---|
| Antes de 0 | Aprobar el plan después de su auditoría APROBABLE | Estado documental correcto y hashes coincidentes; no se atribuye aprobación al asistente |
| 0 o 9, si falta configuración | Configurar el destino desechable y su rol fuera del chat | `db:check:test` y guarda de la suite satisfactorios; no se solicitan valores |
| 11 (fase A) | Ejecutar `node --env-file=.env.local scripts/meta-preflight.mjs` desde la raíz del repositorio | Una línea cerrada con `preflight: ok`; el asistente no lee `.env.local` ni ejecuta esta llamada real |
| E1 a E5 | Commit, `/implementation-review`, `/qa-review`, push, PR, Codex, CI y merge | Informes APROBABLE y LISTO PARA PR sobre el mismo commit **R**; CI en verde; commit **D** identificado |
| Entre E5 y 14 | Actualizar `mf/M16.2` con `main` (`git merge main`) y volver a invocar `/microfase M16.2` | Rama al día; la sesión retoma en el paso 14 |
| En paralelo, antes de 14 | Solicitar y cerrar `M03a` (acta); aprobar `G-ACTA-META` y confirmar P-04 | `PROJECT_STATE.md` con `G-ACTA-META` aprobado; acta con el límite de copias; declaración de tester aceptado y control total |
| 14 | Confirmar el despliegue de producción de **D** | Deployment `Ready` y hash coincidente con **D** |
| 14 | Ejecutar VD-01 | Solo registrar coincidencia de Origin, estado HTTP y host Meta; sin URL completa, cabeceras, cookies ni capturas de Network |
| 15 | Abrir y cerrar el registro; acompañar al dueño | Registro completado y posterior alta rechazada |
| 16–17 | Autorización, selección, cancelación y eventual recuperación en Meta | Resultados cerrados, revocación y probe; estado final activo o purgado |
| 17 | Commit y PR de cierre con los tres archivos de seguimiento | `git diff --name-only` limitado a esos tres archivos; CI en verde |
| 17 | Aprobar `G-VR01` tras la evidencia | Registro explícito de aprobación; recién entonces M16c queda habilitada |
| 0 y 13 | **`db:push` al proyecto `app`: no aplica** | Confirmar ausencia de migraciones nuevas o modificadas; no se ejecuta |
| 0 y 13 | **`db:push:test`: no aplica** | Confirmar ausencia de migraciones. Si falta una migración previa en pruebas, detenerse y asignar al usuario la reparación del entorno; luego repetir guarda y suites |

Cada intervención obligatoria pendiente deja bloqueado el paso dependiente. No se solicita nuevamente una aprobación que ya esté acreditada.

## Migraciones

**No hay migraciones en M16.2.** Se reutilizan las funciones de `0012`; la secuencia inspeccionada termina en `0014`. `0015` corresponde a M16c según la ruta y no se consume aquí.

No se modifica ninguna migración ni prueba pgTAP existente. Si aparece una necesidad real de esquema, se detiene la implementación y se replantea el alcance. Cualquier reversión de esquema requeriría otra migración nueva, nunca editar una aplicada.

## Riesgos

- **Lote no aceptado por Meta:** el preflight real del paso 11 reduce el riesgo para `debug_token` antes de las revisiones; la revocación con token de system user se verifica recién en el paso 16. No hay fallback con secretos en URL.
- **Orden de revisión y despliegue:** el código llega a producción solo después de `implementation-review` y `qa-review` sobre el mismo commit. Un cambio posterior a esos informes obliga a repetirlos; no se despliega nada no revisado.
- **Cambios de código descubiertos en VR-01:** se corrigen por el procedimiento de la fase B, con revisiones nuevas y recorrido repetido. Cuesta tiempo del dueño; es el precio de no tener código sin revisar con datos reales.
- **Escritura ambigua:** paso 6/T-52 distingue escritura aplicada, no aplicada e ilegible. Se conserva el límite aprobado: si también falla la relectura, se revoca y puede quedar guardada una credencial inválida.
- **Purga incompleta:** paso 4 limita trabajo y permite reanudación. Revocar fallidamente no impide destruir la credencial local; tampoco equivale a desinstalar la app del negocio.
- **Diferencias Meta/Intl/PostgreSQL:** pasos 2, 5 y 16 validan cuenta, moneda y zona sin inventarlas. Una discrepancia se registra y bloquea el recorrido correspondiente.
- **Efectos al abrir Integraciones y estado compartido:** pasos 4/8 mantienen purga acotada, página dinámica sin nuevo `loading.tsx`, lectura de `app-data` sin caché ni efectos y degradación segura.
- **Evidencia sensible o perdida:** pasos 7, 13 y 16 usan campos cerrados y copian pronto los logs redactados. No se incluyen valores de Insights, secretos ni identificadores completos. El id completo de la cuenta puede verse en las subpeticiones de Insights del hosting, sin montos; el paso 16 lo declara en la sesión (trampa 7) y el plan no promete controlar los registros del proveedor.
- **Dependencia externa `M03a`:** `G-ACTA-META` requiere una microfase que este plan no ejecuta. Si no está cerrada, los pasos 15 y 16 quedan `BLOQUEADOS`: el despliegue y VD-01 no manejan datos reales y pueden completarse. No afecta la fase A ni las revisiones.
- **Tamaño del corte:** se conserva una sola microfase por D-M16.2-11; las dos fases y las etapas verificables no crean microfases nuevas.
- Se aplican las paradas de III.9: contradicción, archivo fuera de alcance, migración existente, intervención necesaria, gate/prerrequisito pendiente, prueba obligatoria omitida, fallo de aislamiento/privilegios o dos correcciones sin converger.

## Qué no se hace

- Implementar este plan durante su preparación.
- Sincronización persistente, snapshots, cobertura, ejecuciones, botón de sincronización o fijación de Q-04.
- Persistencia de clases de error sin transición ni pruebas durante sincronización: corresponden a M16c.
- Modificar K01–K04, cifrado, cliente `worker_api`, repositorios existentes de credenciales/intentos, rutas OAuth, proxy, configuración de pruebas o dependencias.
- Nuevas páginas, estilos compartidos, `loading.tsx`, variables de entorno o cambios en Google Analytics/Tiendanube.
- Desplegar la rama `mf/M16.2` o cualquier commit no revisado (la opción de desplegar antes de revisar fue descartada por el usuario).
- Modificar los skills del pipeline: las contradicciones se resuelven en este plan.
- Reabrir decisiones aprobadas, dividir la microfase, implementar M03a/M16c, ejecutar acciones externas reservadas o aprobar gates por iniciativa del asistente.

## Auditorías del plan

| Ronda | Informe | Veredicto | Estado |
|---|---|---|---|
| 1 | `revisiones/plan-audit-1.md` (hash auditado `48dfdd92…`) | APROBABLE | Superada por la ronda 2 |
| 2 | `revisiones/plan-audit-2.md` (hash auditado `48dfdd92…`) | REQUIERE CAMBIOS | P-01: plan reordenado en dos fases con entrega E1 a E5, versión desplegada **D**, tabla de reglas del pipeline, requisitos por etapa y procedimiento si VR-01 exige código. P-02: declaración de la trampa 7 en el paso 16. P-03: `M03a` nombrada en el paso 14 y en las intervenciones. P-04: encabezado actualizado, rutas relativas y comando idéntico al de la spec. El preflight real pasó al paso 11 y se renumeraron los pasos 11 a 13. Reauditar esta versión (ronda 3) |
| 3 | `revisiones/plan-audit-3.md` (hash auditado `46136991…`) | REQUIERE CAMBIOS | P-05: `outcomes.ts` y la ampliación de `MetaOAuthDeps` pasan al paso 4 y se agrega la regla de `typecheck` por paso. P-06: la comprobación D = R compara todo salvo `docs` y `.claude`. P-07: el paso 0 y la tabla del pipeline aclaran que `G-ACTA-META` y P-04 no se exigen en la fase A, y el paso 14 los verifica antes del paso 15. Reauditar esta versión (ronda 4) |
