# MF_APP — implementation-review-2

- **Fecha:** 2026-10-11
- **Commit revisado:** `9d9d86e551622a49fbcfcb00f0f9bafa6dcf1d83` (rama `mf/MF_APP`)
- **Base formal (`git merge-base main HEAD`):** `80e5bf33c344da08f3648c0af10f7cfdbee2605e`. El
  `main` local está atrasado respecto de `origin/main` (`d83e288`, que ya incluye M06.3a).
- **Base de contenido usada:** `f4dc8ce15d21c564170c9eba1e74e1397393c058`
  (`git merge-base mf/M28.2a HEAD`), como pide la ficha y como hizo `implementation-review-1`.
  El rango `f4dc8ce..HEAD` tiene 112 archivos (+12587 −2062), 39 de ellos en
  `docs/praxa-app-diseno/`. Desde la revisión anterior (`7ef6a5a..HEAD`) cambiaron 16
  archivos: las correcciones R-02 a R-10, la corrida de `test:policies` y la documentación.

## Veredicto

**BLOQUEADO.**

Lo que bloqueaba `implementation-review-1` dentro de la microfase quedó resuelto:

- esta vez se pudieron ejecutar todas las suites y hacer las roturas;
- `test:policies` pasa con `0013` y `0014` aplicadas al proyecto de pruebas (R-01 anterior);
- las correcciones R-02 a R-10 están en el código y tienen pruebas que las verifican.

El bloqueo que queda es de la ruta y lo decide el usuario. `plan.md` sigue reservando `0013`
y `0014` para otras migraciones, y la ficha de M28.2a sigue dando de alta al dueño en
`/onboarding`. Además, `ARCHITECTURE.md` describe como existentes la ruta y las acciones del
onboarding, y `SECURITY.md` no menciona el bucket `avatars`. Está registrado en `H-E1-93`,
`H-E1-94` y `H-E1-96`, pero sin corregir.

Aparte quedan dos hallazgos que se corrigen dentro de la microfase (R-01 media y R-02 baja).

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Alcance | BLOQUEO | **Archivos:** los del rango coinciden con la sección 16 de la sesión, más las correcciones de la §17: `app-paginas-sesion.test.tsx` nuevo y `diagnostico-data.test.ts` renombrado a `app-data.test.ts`. No hay archivos fuera de lo que describe la ficha. **De más:** nada. **Faltante:** nada de "Qué se construye". **Documentos transversales:** el cambio altera propiedades de `ARCHITECTURE.md`: la l. 32 lista la ruta `onboarding`, la l. 43 sus acciones, la l. 73 el módulo con consumidores y la l. 152 el onboarding y el contexto como usuarios de la empresa, y falta `app-data`. También altera `SECURITY.md`, que no tiene ninguna mención de Storage, avatar ni foto (comprobado con grep). Ninguno de los dos se tocó en el rango. Es lo que manda `AGENTS.md` (hallazgo, no edición fuera del plan): `H-E1-93` (completado por R-07) y `H-E1-96`. Igual depende de la corrección de la ruta. `PROJECT_STATE.md` solo registra estado: PASS. |
| 2 | Criterios | PASS con observación | Cada criterio verificable automáticamente tiene una prueba con una aserción pertinente que pasa (matriz abajo). Se cerraron los huecos que había dejado la revisión anterior: sesión por página (R-02), firma solo en la carpeta propia (R-03), integraciones desconectadas y redirección de `/onboarding` (R-04), y UPDATE entre usuarios en pgTAP (R-06). Quedan dos huecos: el destino del correo de registro (R-01) y el cálculo de `configuracionPendiente` (R-02). |
| 3 | Roturas en una copia aislada | PASS | Worktree `../praxa-review-MF_APP` del commit revisado, con `npm ci`. Las 3 roturas fueron detectadas por la prueba correspondiente y se restauraron con `git checkout`. El worktree se eliminó con `git worktree remove`. |
| 4 | Reejecución | PASS | `npm run verify`: exit 0. Lint y typecheck limpios, 22 archivos y 346 pruebas en verde, y `next build` compiló las 7 rutas de `/app`. `test:policies`: 13 archivos, 14 ejecuciones, 482/482 y 0 problemas. `11` dio 9/9 y `12` dio 12/12. `test:app`: 6 archivos, 37 en verde y 7 omitidas. Todo coincide con la sesión (§17 y §19). Las 7 omitidas necesitan el proyecto remoto o `SUPABASE_TEST_EMAIL_FLOWS=true`. Cuentan como no ejecutadas (CB-06), ver R-01. |
| 5 | Seguridad y reglas | PASS | Busqué en las líneas agregadas del rango `act_[0-9]{6,}`, JWT `eyJ…`, `sk_live/test`, `sb_secret`, `EAA…`, cadenas `postgres://usuario:clave@` y el identificador del proyecto de pruebas: 0 resultados. `service_role` y `.env.local` solo aparecen en texto de documentos que dicen que no se usaron. Los correos están en dominios reservados (`praxa.test`, `ejemplo.com`; R-09 anterior aplicado). **Migraciones:** `git diff --name-status -M` desde las dos bases solo muestra `A 0013` y `A 0014`, sin renombres ni modificaciones. **Tenant:** la empresa sale de la membresía bajo RLS (`getCurrentCompany`/`getEmpresa`); el cliente nunca aporta un id, y la rotura 1 lo confirma. K01 no se usa porque `ARCHITECTURE.md:72` lo reserva para el camino privilegiado y este camino va con el JWT del usuario. **Errores:** las Server Actions devuelven mensajes genéricos. `getEmpresa` y `getDiagnostico` lanzan con `error.message` hacia el límite de errores, igual que `service.ts`, que ya existía; en producción Next no muestra el texto. **`server-only`:** `app-data/index.ts` lo es, y las acciones son `'use server'`. El script de primer pintado del tema es una constante, sin datos del usuario. |
| 6 | Calidad funcional | PASS | Los caminos de error están implementados y probados: `0013` sin aplicar, alta con perfil fallido, respuesta perdida, reconciliación de la subida, borrado con Storage incierto, error de lectura de `reports`. La foto anterior solo se borra si está en la carpeta propia (R-08 anterior, con 2 pruebas). Se quitaron las ramas `sinBackend` (R-05 anterior). No hay `any`, `TODO` ni `FIXME`. El único `eslint-disable` (`ui.tsx:1`) está justificado. Se siguen los patrones existentes (`requireUserForAction`, RPC idempotente, RLS). |
| 7 | Evidencia | PASS con observación | La sesión registra los comandos y los conteos reales (§17: 22/346 y 37+7 omitidas; §19: 482/482), y los conteos coinciden con mi reejecución. Los desvíos (`H-E1-108`) están registrados, y el identificador del proyecto de pruebas está redactado. Los hallazgos tienen ID. `PROJECT_STATE.md` deja MF_APP en `VERIFICADO — PENDIENTE DE APROBACIÓN`, sin gate aprobado. **Observación:** la tabla "Pruebas" de la ficha marca como PASS `tests/app/email-flows.test.ts`, que se omite siempre (R-01). |
| 8 | Contradicciones | BLOQUEO | Con la ruta vigente: `plan.md:291`, `:634` (`0013_meta_insights.sql`), `:306` y `:663` (`0014_chat_queries.sql`) reservan números que ahora están tomados. `plan.md:464` dice que esas migraciones reemplazan `purge_connection`. `plan.md:551` y `:614` usan `/onboarding`, que ya no existe y redirige a `/app/perfil`. Todo está registrado (`H-E1-93`, `H-E1-94`, `H-E1-96`) con decisiones del usuario (D-MF_APP-07 y D-MF_APP-08), pero la ruta no se corrigió. No encontré contradicciones nuevas con `AGENTS.md`. |

## Matriz de criterios

| Criterio | Prueba | Aserción verifica el criterio | Resultado |
|---|---|---|---|
| Capturas a 1320 px | Ninguna automatizada (medición manual, sesión §4) | — | No reproducible en la revisión |
| Tokens como variables CSS y componentes | Lectura de `app.module.css`, `ui.tsx` y `shell.tsx` | — (estructural) | Cumplido por lectura |
| Integraciones "NO CONECTADO" (D-MF_APP-03 y D-MF_APP-12) | `app-data` › "ninguna está conectada: Meta Ads, Google Analytics y Tiendanube, en ese orden" y "devuelve copias…" | Sí | PASS |
| Uso en cero | `app-pantallas` › Uso y costos (con `usoEnCero`) | Sí | PASS |
| Sin campana ni ítems extra | `app-pantallas` › AppShell › "marca la sección actual…" | Sí (sin botón de notificaciones y sin Ventas, Marketing ni Productos) | PASS |
| Accesibilidad | Pruebas de ARIA: menú móvil, aviso, listbox y alertas. Lighthouse fue manual | Parcial (Lighthouse no es reproducible) | PASS en lo automatizado |
| Sin scroll horizontal | Ninguna automatizada | — | No reproducible |
| Compila, lint y pruebas | `npm run verify` | Sí | PASS (exit 0) |
| Cada página revalida la sesión antes de leer datos | `app-paginas-sesion` (descubre las páginas del árbol y exige que sean exactamente 7, que llamen a `requireAppSession` con su ruta y que no lean datos antes) | Sí | PASS (8/8) |
| La empresa sale de la membresía, nunca del cliente | `company-actions` › "usa la empresa del usuario aunque el cliente mande otro id" | Sí | PASS |
| Configuración en una sola sentencia (`H-E1-97`) | `company-actions` › "guarda el nombre y los demás campos en una sola actualización" | Sí | PASS |
| Valor fuera de la lista (`H-E1-101`) | `company-actions` (3 casos de rechazo y 1 que conserva el valor); componente › "un rubro guardado…" | Sí | PASS |
| Sin `0013` se guarda el nombre y se avisa | `company-actions` › "si 0013 todavía no está aplicada…" | Sí | PASS |
| Guardado parcial tras el alta | `company-actions` › 2 casos | Sí | PASS |
| Nombre y apellido solo en metadatos, sin tocar el correo | `identity-actions` › "guarda nombre y apellido…" | Sí | PASS |
| La ruta de la foto queda en la carpeta propia | `identity-actions` › "rechaza una ruta fuera de la carpeta propia…" (5 casos) | Sí | PASS |
| Solo se borra una foto anterior de la carpeta propia (R-08) | `identity-actions` › "al reemplazar, no borra…" y "al eliminar, quita la referencia pero no borra…" | Sí | PASS |
| Solo se firma una foto de la carpeta propia (R-03) | `app-data` › "firma la foto de la carpeta propia" y "no firma una ruta fuera…" (2 casos, incluido el prefijo `x<uuid>/`) | Sí | PASS |
| Eliminar foto: primero la referencia (`H-E1-99`, `H-E1-105`) | `identity-actions` (orden con `invocationCallOrder` y 3 errores); componente (falla sin respuesta) | Sí | PASS |
| Reconciliar la subida (`H-E1-98`) | `app-pantallas` › Mi perfil (4 casos) | Sí | PASS |
| JPG o PNG y hasta 5 MB en la pantalla | `app-pantallas` › "rechaza %s sin subir nada" | Sí | PASS |
| Bucket privado, 5 MB, JPG/PNG y aislamiento por carpeta | pgTAP `12_profile_photos`: SELECT, INSERT, DELETE y UPDATE entre usuarios, más el WITH CHECK al mover | Sí | PASS (12/12) |
| Perfil de la empresa con dueño y aislamiento | pgTAP `11_company_profile` | Sí | PASS (9/9) |
| Destino por defecto `DESTINO_TRAS_ENTRAR` (`H-E1-104`) en el login y el proxy | `safe-next` (rechazos y constante), `proxy-session-cookies` (`location` = `/app/perfil`) | Sí | PASS |
| El correo de registro lleva a Mi perfil | `tests/app/email-flows.test.ts` (según la ficha) | **No**: la prueba arma su propio `emailRedirectTo` en lugar de ejercitar `signup/page.tsx`, y además se omite (R-01) | **No ejecutada** |
| `/onboarding` → `/app/perfil` (`H-E1-102`) | `app-data` › "/onboarding lleva a Mi perfil, de forma temporal" | Sí (`permanent: false`) | PASS |
| El enlace de contraseña pasa por `/auth/callback` hacia `/reset-password` | `password-recovery` | Sí (`redirectTo` exacto) | PASS |
| Diagnóstico desde `reports` (`H-E1-103`) | `app-data` › `getDiagnostico` (3 casos) | Sí | PASS |
| Configuración con punto rojo hasta completar la empresa | Componente › "Aviso de Configuración" (con la prop dada) | Parcial: `configuracionPendiente()` no tiene prueba propia (R-02) | PASS en lo probado |
| Tema con fundido y guardado en el navegador | Componente › "el tema cambia el de toda la app…" | Sí | PASS |

## Roturas

| Criterio | Rotura | Prueba que la detectó | Probada en worktree |
|---|---|---|---|
| Tenant desde el servidor | `company/actions.ts:95`: `.eq('id', (input as { company_id?: string }).company_id ?? empresa.id)` | `company-actions` › "usa la empresa del usuario aunque el cliente mande otro id" (1 de 15 falló) | Sí |
| Aislamiento de la foto (servidor) | `identity/actions.ts:74`: se quitó `\|\| !ruta.startsWith(\`${usuario.id}/\`)` | `identity-actions` › "rechaza una ruta fuera de la carpeta propia…" con `11111111-…/ajena.png` (1 de 19 falló) | Sí |
| Sesión en cada página antes de leer datos | `configuracion/page.tsx`: `getEmpresa()` pasó a ir antes de `requireAppSession` | `app-paginas-sesion` › "/app/configuracion verifica la sesión con su ruta antes de leer datos" (1 de 8 falló) | Sí |
| Aislamiento por carpeta en Storage (RLS de `0014`) | — | pgTAP `12` | No: necesita la base de pruebas y sus variables de entorno |

Antes de romper, las tres pruebas pasaron en el worktree (42/42). La primera corrida en frío,
justo después de `npm ci`, informó "1 error" de carga sin fallos de aserción. Las dos
siguientes, sin cambios, dieron 3/3 archivos en verde. Es coherente con `H-E1-108`.

## Comandos reejecutados

| Comando | Resultado |
|---|---|
| `git branch --show-current` | `mf/MF_APP` |
| Comando de árbol limpio del paso 1 (al inicio y al final) | Sin salida |
| `git rev-parse HEAD` / `git merge-base main HEAD` | `9d9d86e…` / `80e5bf3…` |
| `git merge-base mf/M28.2a HEAD` | `f4dc8ce…` |
| `git diff --stat -M f4dc8ce HEAD` | 112 archivos, +12587 −2062 |
| `git diff --stat -M 7ef6a5a HEAD` | 16 archivos (correcciones posteriores a la revisión 1) |
| `git diff --name-status -M {f4dc8ce,80e5bf3} HEAD -- supabase/migrations` | `A 0013_company_profile.sql`, `A 0014_profile_photos.sql` |
| `npm run verify` | exit 0. Lint, typegen y typecheck limpios, 22 archivos y 346/346 en verde, y build OK |
| `npm run test:policies` | 13 archivos, 14 ejecuciones, 482 aserciones y 0 problemas |
| `npm run test:app` | 6 archivos, 37 en verde y 7 omitidas: 3 de `email-flows` (opt-in), `concurrency`, `onboarding`, `integrations-data-api` e `isolation` (sin el proyecto remoto) |
| `git worktree add --detach ../praxa-review-MF_APP 9d9d86e…` + `npm ci` | OK |
| Vitest de las 3 pruebas objetivo en el worktree (sin cambios) | 42/42 (la primera corrida en frío dio un error de carga transitorio) |
| Roturas 1 a 3 | Detectadas (ver la tabla de roturas) |
| `git worktree remove ../praxa-review-MF_APP` | OK. `git worktree list` ya no la muestra |
| Búsquedas por patrón (secretos, `act_`, `service_role`, `.env.local`, correos, identificador del proyecto) | Sin resultados en las líneas agregadas del rango (detalle en el ítem 5) |

## Hallazgos

| ID | Severidad | Archivo:línea | Problema | Evidencia | Corrección propuesta |
|---|---|---|---|---|---|
| R-01 | media | `docs/FASES/FASE1/MF_APP/ficha.md:104`; `src/app/(auth)/signup/page.tsx:52` | La ficha marca PASS para `tests/app/email-flows.test.ts` ("destino del enlace de registro"), pero esa prueba se omite en todas las corridas: necesita `SUPABASE_TEST_EMAIL_FLOWS=true`. Tampoco verificaría el criterio, porque llama a `signUp` con un `emailRedirectTo` escrito en la propia prueba y no ejercita `signup/page.tsx`. Ninguna prueba ejecutada comprueba que el registro use `DESTINO_TRAS_ENTRAR`. Si vuelve a `/onboarding`, nada falla (la redirección de `H-E1-102` lo disimula). | `test:app`: los 3 casos de `email-flows` aparecen como `↓`. Grep de `emailRedirectTo` en `tests/`: solo aparece el literal de `email-flows.test.ts:51`. `signup-page.test.tsx` no comprueba los argumentos de `signUp`. | Agregar a `tests/component/signup-page.test.tsx` una aserción sobre los argumentos de `signUp`: `options.emailRedirectTo` termina en `/auth/callback?next=%2Fapp%2Fperfil`. En la ficha, marcar `email-flows` como "omitida (opt-in)" y no como PASS (CB-06). |
| R-02 | baja | `src/modules/app-data/index.ts:82-84` | `configuracionPendiente()` decide el punto rojo de Configuración, un criterio de D-MF_APP-07, y no tiene prueba propia. La prueba de componente recibe el valor ya calculado, y `app-paginas-sesion` lo simula. Si se reduce a `!empresa`, nada falla. | Grep de `configuracionPendiente` en `tests/`: solo aparece en el mock de `app-paginas-sesion.test.tsx:25`. | Prueba unitaria en `app-data.test.ts`: `null` → `true`; sin rubro, país o moneda (cada caso) → `true`; completa → `false`. |

Los hallazgos R-01 a R-10 de `implementation-review-1` quedan verificados así:

- **R-01:** `test:policies` en verde.
- **R-02, R-03, R-04, R-06 y R-08:** las pruebas existen, verifican lo pedido y pasan. Para
  R-02 y R-08 lo confirman además las roturas 3 y 2.
- **R-05:** `perfil.tsx` ya no usa `isSupabaseConfigured`.
- **R-07:** `H-E1-93` enumera las líneas de `ARCHITECTURE.md`.
- **R-09:** los correos están en `praxa.test`.
- **R-10:** `H-E1-97` a `H-E1-99` dicen "Resuelto en MF_APP".

## Pendientes del usuario

1. **Corrección de la ruta** (`H-E1-93`, `H-E1-94`, `H-E1-96`). Incluye:
   - renumerar las migraciones previstas en `plan.md` (`:291`, `:306`, `:464`, `:634` y `:663`);
   - reemplazar el alta por `/onboarding` (`:551` y `:614`);
   - actualizar `ARCHITECTURE.md` (l. 32, 43, 73 y 152, más `app-data`);
   - actualizar `SECURITY.md` (el bucket `avatars` como activo y la subida directa desde el
     navegador como frontera).

   Es lo único que bloquea el veredicto. Si el usuario decide que, como dice la ficha
   ("Condición para avanzar"), esa corrección solo condiciona `G-ENTORNO` y no la integración
   de MF_APP, puede registrarlo así. La decisión le corresponde a él, no a esta revisión.
2. Aplicar `0013` y `0014` al piloto.
3. Probar con una cuenta y una casilla reales: nombre, foto, cambio de contraseña y registro
   → confirmación → Mi perfil. Si se habilita `SUPABASE_TEST_EMAIL_FLOWS=true`, eso cubre en
   parte R-01 contra el proyecto de pruebas.
4. Decidir la verificación del contenido de la foto (opción 1 de la sesión, §9).
5. Borrar el worktree `C:\Users\Simon\dev\PRAXA-app-qa` que quedó de la sesión de
   implementación (§14). No lo creó esta revisión y no se tocó.

## Confirmaciones finales

- `git rev-parse HEAD`: sigue en `9d9d86e551622a49fbcfcb00f0f9bafa6dcf1d83`.
- Comando de árbol limpio del paso 1: sin salida. Este informe queda excluido por
  `docs/FASES/FASE1/*/revisiones/*`.
- Worktree temporal `../praxa-review-MF_APP`: eliminado. `git worktree list` solo muestra el
  repositorio y `PRAXA-app-qa`, que ya existía.
