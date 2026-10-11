# MF_APP — implementation-review-1

- **Fecha:** 2026-10-11
- **Commit revisado:** `7ef6a5abd7fd416bb62c1b51f8d5c29564bf53c6` (rama `mf/MF_APP`)
- **Base formal (`git merge-base main HEAD`):** `80e5bf33c344da08f3648c0af10f7cfdbee2605e`
- **Base de contenido usada:** `f4dc8ce15d21c564170c9eba1e74e1397393c058` (`mf/M28.2a`). La ficha
  de MF_APP lo pide así porque el merge-base con `main` trae también M06.3a, M28.2a y
  MF_FRONTEND. El rango revisado es `f4dc8ce..7ef6a5a`: 5 commits y 110 archivos, 39 de ellos
  en `docs/praxa-app-diseno/`.
- **Ubicación del informe:** `MF_APP/revisiones/`, igual que `MF_FRONTEND/revisiones/` (otra
  microfase fuera de la ruta y con carpeta propia).

## Veredicto

**BLOQUEADO.**

1. **Entorno.** En esta sesión no tuve permiso para ejecutar comandos: `npm run verify`,
   `npx vitest`, `node …/vitest.mjs` y `git worktree add` quedaron todos rechazados con "This
   command requires approval", y la sesión no es interactiva. Por eso no pude repetir ninguna
   prueba (ítem 4) ni hacer las roturas en una copia aislada (ítem 3). No intenté rodear el
   bloqueo.
2. **Pendiente del usuario.** `npm run test:policies` (pgTAP `11` y `12`) no se ejecutó, ni en
   la sesión ni en esta revisión. Esas pruebas son la única evidencia del aislamiento de `0013` y
   `0014`.
3. **Pendiente de la ruta.** `0013` y `0014` contradicen el plan vigente, y el onboarding
   eliminado también. `SECURITY.md` y `ARCHITECTURE.md` no reflejan el cambio. Todo esto está
   registrado (`H-E1-93`, `H-E1-94`, `H-E1-96`), pero exige una corrección de la ruta que decide
   el usuario.

También hay hallazgos que se corrigen dentro de la microfase (R-01 a R-08): huecos de cobertura,
código muerto y una prueba pgTAP que podría abortar. Hay que corregirlos antes de la próxima
revisión, aunque se resuelva el bloqueo.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Alcance | BLOQUEO | **Archivos:** los 110 archivos del rango coinciden con la sección 16 de la sesión y con lo que la ficha dice que se construye. Los archivos que la ficha no nombra (`next.config.ts`, `globals.css`, `public/app/robot-praxa.png`) tienen respaldo en D-MF_APP-05 y D-MF_APP-20 (`H-E1-102`). MF_APP no tiene un plan con tabla de archivos porque está fuera de la ruta. **De más:** nada. Tema, móvil, foto y cambio de contraseña tienen cada uno su decisión D-MF_APP. **Faltante:** nada. Están las 7 rutas, se borraron `contexto` y `reportes`, existen el shell y los componentes, la capa `app-data`, las 4 Server Actions, `0013`/`0014` con pgTAP `11`/`12`, `DESTINO_TRAS_ENTRAR`, la redirección de `/onboarding` y `recovery.ts`. **Documentos transversales:** no reflejan el cambio. `SECURITY.md` no menciona Storage ni la foto (activo y frontera nuevos). `ARCHITECTURE.md:32,43,73,152` sigue describiendo como existentes la ruta y las acciones del onboarding y `/app/contexto`, y no menciona `app-data`. AGENTS.md prohíbe editar fuera del plan, así que corresponde el hallazgo. `H-E1-96` cubre la foto; ver R-07 para la parte del onboarding. `PROJECT_STATE.md` solo registra estado: PASS. |
| 2 | Criterios | FAIL | Hay pruebas con aserciones pertinentes para tenant, ruta de la foto, destino por defecto, Configuración y Diagnóstico (matriz abajo). Faltan pruebas para la verificación de sesión en cada página, la firma de la foto solo en la carpeta propia, las integraciones en "NO CONECTADO" y la redirección de `/onboarding` (R-02 a R-04). No pude confirmar que ninguna prueba pasa (ítem 4). |
| 3 | Roturas en una copia aislada | BLOQUEO | Sin permiso para `git worktree add` ni para ejecutar Vitest. Para cada rotura dejo la predicción por lectura del código; ninguna está probada. |
| 4 | Reejecución | BLOQUEO | Las cuatro formas de ejecutar pruebas pidieron aprobación. La sesión dice que `verify` salió con exit 0 (21 archivos, 330 pruebas) y que `unit`+`component`+`app` dieron 27 archivos, 367 en verde y 7 omitidas. No lo pude comparar. |
| 5 | Seguridad y reglas | PASS | La búsqueda por patrón (`act_[0-9]{6,}`, JWT `eyJ…`, `sk_live/test`, `sb_secret`, `EAA…`, `service_role`, `.env.local`) en los archivos del rango solo encontró menciones textuales en `sesion.md`, que dicen que no se usaron. Ninguna migración existente cambió: `git diff --name-status -M` sobre `supabase/migrations` solo muestra `A 0013` y `A 0014`. La empresa se resuelve en el servidor por membresía y bajo RLS (`getCurrentCompany`/`getEmpresa`); ningún `company_id` llega del cliente. K01 no se usa porque está reservado para el camino de integraciones (`ARCHITECTURE.md:72`), igual que en el código previo. Los mensajes de las Server Actions son genéricos. `app-data/index.ts` es `server-only` y las acciones son `'use server'`. Observaciones bajas: R-08 y R-09. |
| 6 | Calidad funcional | FAIL | Los caminos de error están implementados: falta de `0013`, guardado parcial, respuesta perdida en la subida o el borrado de la foto, error de lectura en Diagnóstico. No hay `any` explícitos, `TODO` ni `FIXME`. Pero `perfil.tsx` tiene ramas `sinBackend` inalcanzables (R-05). |
| 7 | Evidencia | PASS | La sesión registra los pasos, los conteos, los desvíos (cambios hechos fuera de la conversación, `H-E1-108`) y lo que no se verificó. Los hallazgos nuevos tienen ID (`H-E1-93` a `H-E1-108`). `PROJECT_STATE.md` deja a MF_APP en `VERIFICADO — PENDIENTE DE APROBACIÓN`, sin gate aprobado. Observación baja: R-10. |
| 8 | Contradicciones | BLOQUEO | Con el plan de la ruta: `plan.md:291` reserva `0013` para la ingesta de Meta, `plan.md:306` reserva `0014` para el chat, `plan.md:464` dice que esas migraciones reemplazan `purge_connection`, y `plan.md:614` hace el alta del dueño en `/onboarding`. Las cuatro están registradas (`H-E1-93`, `H-E1-94`, `H-E1-96`) y el usuario decidió (D-MF_APP-07 y D-MF_APP-08), pero el plan no se corrigió. |

## Matriz de criterios

Criterios de la ficha (pedido del usuario) y criterios operativos de la sección "Qué se
construye" y de las decisiones.

| Criterio | Prueba | Aserción verifica el criterio | Resultado |
|---|---|---|---|
| Capturas a 1320 px | Ninguna automatizada (medición manual, sesión §4) | — | No reproducible en la revisión |
| Tokens como variables CSS y componentes | Revisión estática (`app.module.css`, `ui.tsx`, `shell.tsx`) | — (estructural) | Cumplido por lectura |
| Mock en cero o vacío; integraciones "NO CONECTADO" | `UsoCostos` con `usoEnCero` (componente). Ninguna sobre `INTEGRACIONES_BASE` | Parcial: el uso en cero sí; las integraciones desconectadas no (R-04) | No ejecutada |
| Sin campana ni ítems extra | `app-pantallas` › AppShell › "marca la sección actual…" (l. 71-76) | Sí | No ejecutada |
| Accesibilidad | Pruebas de ARIA (menú móvil, aviso, listbox, alertas); Lighthouse manual | Parcial (Lighthouse no es reproducible) | No ejecutada |
| Sin scroll horizontal | Ninguna automatizada | — | No reproducible |
| Compila, lint y pruebas | `npm run verify` | Sí | **No ejecutado (BLOQUEO)** |
| Cada página revalida la sesión | Ninguna | — (R-02) | Por lectura: las 7 páginas llaman a `requireAppSession` y el layout a `requireUser` |
| La empresa sale de la membresía, nunca del cliente | `company-actions` › "usa la empresa del usuario aunque el cliente mande otro id" | Sí (`eq('id','c-1')` con `id` y `company_id` ajenos en la entrada) | No ejecutada |
| Configuración en una sola sentencia (`H-E1-97`) | `company-actions` › "guarda el nombre y los demás campos en una sola actualización" | Sí | No ejecutada |
| Valor fuera de la lista (`H-E1-101`) | `company-actions` › "rechaza una opción…" y "conserva un valor guardado…"; componente › "un rubro guardado…" | Sí | No ejecutada |
| Sin `0013` se guarda solo el nombre y se avisa | `company-actions` › "si 0013 todavía no está aplicada…" | Sí | No ejecutada |
| Nombre y apellido solo en metadatos, sin tocar el correo | `identity-actions` › "guarda nombre y apellido…" | Sí | No ejecutada |
| La ruta de la foto queda en la carpeta propia | `identity-actions` › "rechaza una ruta fuera de la carpeta propia…" | Sí (incluye un UUID ajeno, `..`, `.gif` y `?x=1`) | No ejecutada |
| Solo se firma una foto de la carpeta propia (`getUsuario`) | Ninguna | — (R-03) | — |
| Eliminar foto: primero la referencia (`H-E1-99`, `H-E1-105`) | `identity-actions` › "eliminar quita la referencia…" y 3 casos de error; componente › "si Eliminar foto falla sin respuesta…" | Sí (`invocationCallOrder`) | No ejecutada |
| Reconciliar la subida (`H-E1-98`) | Componente › 4 casos (l. 479-530) | Sí | No ejecutada |
| JPG o PNG y hasta 5 MB en la pantalla | Componente › "rechaza %s sin subir nada" | Sí | No ejecutada |
| Bucket privado, 5 MB, solo JPG/PNG; aislamiento por carpeta | pgTAP `12_profile_photos` | Sí para SELECT, INSERT y DELETE. **No para UPDATE** (R-06) | **No ejecutada (usuario)** |
| Perfil de la empresa con dueño y aislamiento | pgTAP `11_company_profile` | Sí | **No ejecutada (usuario)** |
| Destino por defecto `DESTINO_TRAS_ENTRAR` (`H-E1-104`) | `safe-next` (rechazos y constante), `proxy-session-cookies` (`location` = `/app/perfil`) | Sí | No ejecutada |
| `/onboarding` → `/app/perfil` (`H-E1-102`) | Ninguna automatizada (solo `curl` en la sesión) | — (R-04) | — |
| Enlace de contraseña por `/auth/callback` a `/reset-password` | `password-recovery` | Sí (`redirectTo` exacto) | No ejecutada |
| Diagnóstico desde `reports` (`H-E1-103`) | `diagnostico-data` (3 casos) | Sí | No ejecutada |
| Configuración: punto rojo hasta completar la empresa | Componente › "Aviso de Configuración" (con la prop). `configuracionPendiente()` sin prueba propia | Parcial | No ejecutada |
| Tema con fundido y guardado en el navegador | Componente › "el tema cambia el de toda la app…" | Sí | No ejecutada |

## Roturas

| Criterio | Rotura | Prueba que la detectaría | Probada en worktree |
|---|---|---|---|
| Aislamiento de la foto (servidor) | Quitar `!ruta.startsWith(\`${usuario.id}/\`)` en `identity/actions.ts:74` | `identity-actions` › caso `11111111-…/ajena.png`: la ruta sigue pasando `RUTA_FOTO` y solo esa condición la rechaza. Predicción: **detectada** | No. Sin permiso para `git worktree add` ni para Vitest |
| Tenant desde el servidor | Usar `input.company_id` en lugar de `empresa.id` en `company/actions.ts:95` | `company-actions` › "usa la empresa del usuario…" (`eq('id','c-1')`). Predicción: **detectada** | No (mismo motivo) |
| Firma solo en la carpeta propia | Quitar `ruta.startsWith(\`${sesion.id}/\`)` en `app-data/index.ts:45` | **Ninguna.** Predicción: **no detectada**. RLS (`avatars_select_own`) sigue protegiendo, pero esta defensa en profundidad no tiene prueba (R-03) | No (mismo motivo) |

## Comandos

| Comando | Resultado |
|---|---|
| `git branch --show-current` | `mf/MF_APP` |
| Comando de árbol limpio del paso 1 | Sin salida (limpio) |
| `git rev-parse HEAD` / `git merge-base main HEAD` | `7ef6a5a…` / `80e5bf3…` |
| `git merge-base mf/M28.2a HEAD` | `f4dc8ce…` |
| `git diff --stat -M f4dc8ce HEAD` | 110 archivos, +12159 −2062 |
| `git diff --name-status -M f4dc8ce HEAD -- supabase/migrations` | `A 0013_company_profile.sql`, `A 0014_profile_photos.sql` |
| `npm run verify` (dos formas) | **No ejecutado:** "This command requires approval" |
| `npx vitest run --project unit tests/unit/safe-next.test.ts` | **No ejecutado:** ídem |
| `node node_modules/vitest/vitest.mjs run …` | **No ejecutado:** ídem |
| `git worktree add --detach ../praxa-review-MF_APP 7ef6a5a…` | **No ejecutado:** ídem. No se creó ningún worktree |
| Búsqueda de secretos y de correos (Grep) | Sin secretos. Correos solo en dominios de prueba (`praxa.test`, `ejemplo.com`) y uno en `docs/praxa-app-diseno` (R-09) |

## Hallazgos

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-01 | alta | `supabase/tests/11_company_profile.test.sql`, `supabase/tests/12_profile_photos.test.sql` | Las únicas pruebas del aislamiento de `0013` y `0014` nunca se ejecutaron. | Ficha, "Pruebas": PENDIENTE. Sesión §13. Tampoco en esta revisión. | El usuario corre `npm run test:policies` contra el proyecto de pruebas y registra el resultado en la sesión. |
| R-02 | media | `src/app/(app)/app/*/page.tsx` | Ninguna prueba exige que cada página llame a `requireAppSession`. El código explica que las páginas se renderizan en paralelo con el layout, así que el chequeo del layout no las protege. Si una página nueva o editada lo pierde, nada falla. | Grep de `requireAppSession` en `tests/`: sin resultados. | Agregar una prueba unitaria que importe cada página con `requireAppSession` simulado para que lance, y que compruebe que la página lo llama con su ruta. |
| R-03 | media | `src/modules/app-data/index.ts:45` | La guarda que firma solo rutas de la carpeta propia no tiene prueba. Quitarla no rompe nada (rotura 3). | Grep de `getUsuario` y `createSignedUrl` en `tests/`: sin resultados. | Prueba unitaria de `getUsuario` con un `avatar_path` ajeno en los metadatos: `createSignedUrl` no se llama y `fotoUrl` es `null`. |
| R-04 | media | `src/modules/app-data/mock.ts:10`, `next.config.ts:7` | Dos criterios sin prueba automatizada: que todas las integraciones del mock estén desconectadas (criterio de la ficha y D-MF_APP-03) y la redirección `/onboarding` → `/app/perfil` (`H-E1-102`, solo verificada con `curl`). | Grep de `INTEGRACIONES_BASE`, `getIntegraciones` y `redirects` en `tests/`: sin resultados. | Prueba de `getIntegraciones()` (las tres, en el orden de D-MF_APP-12, con `conectada: false`) y prueba de `nextConfig.redirects()` (fuente, destino y `permanent: false`). |
| R-05 | baja | `src/components/app/perfil.tsx:65,77-81,164-166,181-184` | Las ramas `sinBackend` son código muerto, probablemente un resto del modo ejemplo (`H-E1-95`). El layout de `/app` devuelve `ConfigurationMissing` sin renderizar los hijos cuando Supabase no está configurado, así que `Perfil` nunca se monta con `sinBackend = true`. | `layout.tsx:26-31`. Es el único uso de `isSupabaseConfigured` en `src/components/app/`. | Quitar las ramas y la importación de `isSupabaseConfigured`. |
| R-06 | media | `supabase/tests/12_profile_photos.test.sql` | (a) La política `avatars_update_own` no tiene prueba: falta comprobar que A no puede mover un objeto a la carpeta de B ni modificar uno ajeno. (b) **PLAUSIBLE:** la l. 69 hace `delete from storage.objects` por SQL sin `lives_ok`/`throws_ok`. Las versiones recientes de Supabase Storage traen un trigger que rechaza el DELETE directo sobre `storage.objects`. Si el proyecto de pruebas lo tiene, el archivo entero aborta en lugar de probar el aislamiento. No se pudo comprobar. | Lectura del archivo. En el repositorio no hay otras pruebas que borren de `storage.objects`. | (a) Agregar `throws_ok`/`is` para UPDATE entre usuarios. (b) Al correr `test:policies`, comprobar ese DELETE. Si falla por el trigger, envolverlo y probar el aislamiento del borrado con un `is` sobre la visibilidad, o con el mecanismo que Storage habilite para pruebas. |
| R-07 | media | `docs/HALLAZGOS.md` (`H-E1-93`) | El hallazgo del onboarding solo cita como afectados la ficha de M28.2a y el contrato del reporte. No nombra las propiedades de `ARCHITECTURE.md` que dejaron de ser ciertas: l. 32 (ruta `onboarding`), l. 43 (acciones del onboarding), l. 73 y l. 152 (onboarding y contexto como consumidores existentes). Tampoco nombra el módulo nuevo `app-data`, ni que `/app` ya no exige empresa. `H-E1-96` solo cubre la foto. | `ARCHITECTURE.md:32,43,73,152`. | Completar `H-E1-93` (o abrir un hallazgo nuevo) con esa lista, para que la corrección de la ruta incluya esos puntos de `ARCHITECTURE.md`. |
| R-08 | baja | `src/modules/identity/actions.ts:84,105` | `guardarFotoPerfil` y `eliminarFotoPerfil` borran `anterior`, que sale de `user_metadata` (el usuario lo puede escribir), sin comprobar que esté en su carpeta. Hoy lo protege `avatars_delete_own` (RLS), pero eso depende de pgTAP sin ejecutar (R-01). | Lectura del código. | Borrar `anterior` solo si empieza con `${usuario.id}/`, igual que hace `getUsuario`. |
| R-09 | baja | `docs/praxa-app-diseno/PANTALLAS.md:53` y 3 HTML de referencia | Hay un correo de ejemplo con el dominio `praxa.com`, que no es de prueba (no es `.test` ni `.example`) y podría ser de un tercero. La sesión lo menciona, pero no lo registra como hallazgo. | Grep de direcciones de correo. | Cambiarlo por un dominio reservado (`ejemplo.com` o `praxa.test`), o que el usuario confirme que es aceptable. |
| R-10 | baja | `docs/HALLAZGOS.md` (`H-E1-97` a `H-E1-99`) | El estado dice "Resuelto en árbol de trabajo", pero los cambios ya están en `fa5d6ca`/`366d8bf`. La asignación dice "app web (`feat/app`)" y no MF_APP. | Tabla de hallazgos. | Cambiar a "Resuelto en MF_APP", como `H-E1-100` a `H-E1-105`. |

## Pendientes del usuario

1. **Permitir la ejecución en una nueva revisión** (`npm`, `npx`/`node` para Vitest y
   `git worktree`), o correr `npm run verify` y pegar en la sesión el resultado sin secretos.
   Sin eso los ítems 3 y 4 no se pueden cerrar.
2. **Correr `npm run test:policies`** contra el proyecto de pruebas (R-01, R-06 b).
3. **Corregir la ruta** por `H-E1-93`, `H-E1-94` y `H-E1-96`: renumerar las migraciones previstas
   en `plan.md` (incluido `purge_connection`), reemplazar el alta por `/onboarding` del paso 10
   de M28.2a, y actualizar `SECURITY.md` y `ARCHITECTURE.md` con lo de R-07.
4. Las decisiones que ya figuran en la ficha: aplicar `0013`/`0014` al piloto, verificar el
   contenido de la foto y probar los flujos con una cuenta y una casilla reales.

## Confirmaciones finales

- `git rev-parse HEAD`: sigue en `7ef6a5abd7fd416bb62c1b51f8d5c29564bf53c6`.
- Comando de árbol limpio del paso 1: sin salida (este informe está excluido por
  `docs/FASES/FASE1/*/revisiones/*`).
- Worktree temporal: no se creó (el comando fue rechazado), así que no hay nada que eliminar.
