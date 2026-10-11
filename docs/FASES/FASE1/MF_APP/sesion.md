# MF_APP — Sesión del 2026-10-10 al 2026-10-11

Registro completo del trabajo: la app web de `/app` según `docs/praxa-app-diseno/`, los
ajustes pedidos en la revisión en vivo, la versión móvil, el QA de las pantallas de acceso, la
revisión de código y sus correcciones. Alcance, criterios y decisiones resumidos en
[ficha.md](ficha.md); hallazgos `H-E1-93` a `H-E1-108` en
[HALLAZGOS.md](../../../HALLAZGOS.md).

Reglas respetadas durante toda la sesión: no se leyó `.env.local` ni otro archivo de entorno,
no se pidieron secretos, no se corrió `db:push` ni nada contra producción, no se modificaron
migraciones existentes (los cambios de esquema van en `0013` y `0014`, nuevas), no se usó
`service_role`, no se agregaron dependencias al proyecto, no se hizo push ni despliegue, y
contra el Supabase real solo se hicieron logins fallidos. No se crearon cuentas ni se
enviaron correos reales.

Las horas son de Argentina (UTC−3).

## 1. Pedido y punto de partida

El usuario pidió implementar con fidelidad el diseño de `docs/praxa-app-diseno/` (README,
`PANTALLAS.md`, `diseno/tokens.css`, `diseno/componentes.md`, capturas y HTML de referencia):

- tokens como variables CSS;
- componentes `AppShell`, `NavItem`, `Button`, `Field`, `Select`, `Badge`, `StatusChip`, `Card`,
  `KpiCard` y `BarChart`;
- las rutas `/app`, `/app/chat`, `/app/diagnostico`, `/app/uso-y-costos`,
  `/app/integraciones`, `/app/configuracion` y `/app/perfil`;
- una capa de datos mock en cero o vacía;
- sin campana ni ítems de menú extra;
- accesibilidad;
- comparación contra las capturas a 1320 px.

Al terminar, pidió qué quedó igual, qué difiere y por qué, y qué decisiones le tocan.

Estado del repositorio al empezar: rama `mf/M28.2a` en `f4dc8ce` (M28.2a en curso, con
MF_FRONTEND integrada), igual a `origin/mf/M28.2a`. Se creó la rama `feat/app` desde ahí. El
proyecto es Next.js 16 (App Router, Turbopack) con React 19, CSS Modules y la base de Tailwind
v4, no Vite.

## 2. Decisiones iniciales

Se preguntaron cuatro puntos antes de escribir código:

| Pregunta | Respuesta del usuario |
|---|---|
| ¿Dónde viven las pantallas? | Todas bajo `/app` (D-MF_APP-01) |
| ¿Qué pasa con `/app/contexto` y `/app/reportes`? | Borrarlas (D-MF_APP-02) |
| ¿Estado de las integraciones mock? | Todas "NO CONECTADO" (D-MF_APP-03) |
| ¿Usuario y empresa? | Reales donde existan (D-MF_APP-04) |

## 3. Implementación base (2026-10-10)

- **Shell y componentes** en `src/components/app/`: `shell.tsx` (barra lateral, `NavItem`,
  logo, avatar), `ui.tsx` (botones, `Card` polimórfica, `Field`, `Input`, `Badge`,
  `StatusChip`, `Avatar`, `PageHeader`, `TileIcon`, `KpiCard`), `bar-chart.tsx`, `icons.tsx` y
  `format.ts` (números en castellano de Argentina: `US$ 18,42`, `1.284`, `2,4 s`).
- **Tokens:** los de `tokens.css` como variables CSS en `app.module.css`. Se reusaron Manrope y
  JetBrains Mono de la landing.
- **Pantallas:** las siete rutas en `src/app/(app)/app/`. El layout revalida la sesión con
  `requireUser` y cada página lo vuelve a hacer con `requireAppSession`, porque las páginas se
  renderizan en paralelo con el layout.
- **Datos** (`src/modules/app-data/`): `types.ts` es el contrato de las pantallas. Real: correo,
  fecha de alta y nombre de la empresa. Mock (`mock.ts`): integraciones desconectadas, uso de
  la IA en cero y sin diagnóstico.
- **Borrados:** `/app/contexto`, `/app/reportes` y dos componentes sin uso (`app-nav.tsx` y
  `edit-context-button.tsx`).
- **Modo ejemplo:** para comparar contra el diseño sin crear cuentas se agregó
  `PRAXA_APP_EJEMPLO=diseno|vacio`, solo fuera de producción y sin sesión. Se registró como
  `H-E1-95` y después se quitó (sección 12).
- **Pruebas:** 21 nuevas de componente sobre los comportamientos de `PANTALLAS.md`; en total,
  281 en verde con `npm run verify`.

## 4. Comparación contra el diseño

Captura a 1320 px, en tema oscuro, contra los HTML de referencia, medida en porcentaje de
píxeles distintos:

| Pantalla | Diferencia |
|---|---|
| Integraciones, Configuración, Perfil y Chat | 0 % |
| Uso y costos en cero | 0,1 % |
| Inicio | 0,11 % (0,36 % al final, por el avatar celeste de D-MF_APP-11) |
| Diagnóstico oscuro y claro | 0,55 % y 0,51 % |

Diferencias explicadas:

- **Chat buscando (1,96 %) y Uso y costos con números (1,54 %):** esas dos referencias son
  maquetas estáticas viejas, con otro selector y 31 barras de agosto. Contra las versiones
  interactivas (`AppChat` y `AppUsoCostosCero`) coinciden.
- **Ícono activo del menú en claro:** la referencia le pone un recuadro blanco por un efecto
  del CSS; no se copió porque `componentes.md` dice "sin recuadro detrás del ícono".
- **Colapsable del Diagnóstico:** la referencia tiene un `<h2>` dentro de un `<button>` (HTML
  inválido); se invirtió sin cambiar cómo se ve.
- **Enlaces a Mi perfil:** el nombre accesible incluye el texto visible (label-in-name).
- **Textos agregados** porque el diseño no los tenía: estado vacío del Diagnóstico ("Todavía
  no hay un diagnóstico." con "Ver integraciones"), "Sin definir" en Inicio y "Elegí una
  opción" en los desplegables.
- **Ajustes técnicos para igualar:** `box-sizing: content-box` en el documento del Diagnóstico
  y en las filas de Configuración (la base de Tailwind usa `border-box`), y selectores con
  doble clase donde CSS Modules empataba en especificidad.

Lighthouse de accesibilidad dio 100 en las siete pantallas, con un solo `<h1>`, sin scroll
horizontal, sin errores de consola y con el foco visible al navegar con teclado.

## 5. Segunda ronda: tema, integraciones y onboarding (2026-10-10 y 11)

Pedido del usuario: que el selector de tema funcione, quitar los menús de tres puntos de los
conectores, que Configuración aparezca aunque no haya nada conectado y eliminar el
onboarding. Respuestas a las preguntas que siguieron:

- **Onboarding:** después de crear cuenta o iniciar sesión se va directo a Mi perfil, y
  Configuración lleva un punto rojo abajo a la izquierda hasta completar la empresa
  (D-MF_APP-07).
- **Rubro, país y moneda:** migración nueva `0013`, corriendo la numeración de la ruta
  (D-MF_APP-08, `H-E1-94`).
- **Tema:** oscuro por defecto.

Implementación:

- **Tema** (`src/components/app/tema.tsx`): `useSyncExternalStore` sobre `localStorage`
  (`praxa-app-tema`) y un script de primer pintado para no parpadear. El tema claro se completó
  con la paleta de la landing, porque el diseño solo traía Diagnóstico en claro.
- **Onboarding eliminado:** la ruta `/onboarding`, el asistente, sus Server Actions y su prueba.
  El login, el registro (`emailRedirectTo`) y el proxy pasan a mandar a `/app/perfil`. Las
  tablas de contexto y `src/modules/onboarding/{repository,schema}.ts` quedan sin uso desde la
  interfaz (`H-E1-93`).
- **Configuración:** `guardarPerfilEmpresa` crea la empresa si falta (RPC idempotente
  `create_company_for_current_user`) y guarda los cuatro datos. Sin `0013` aplicada guarda solo
  el nombre y lo avisa. El punto rojo se calcula con `configuracionPendiente(empresa)` y se
  anuncia con `aria-describedby`.
- Resultado: 286 pruebas en verde.

## 6. Ajustes de la revisión en vivo (2026-10-11, madrugada)

En orden de pedido:

1. **Fundido del tema:** primero 0,7 s y después 1,2 s con curva suave, usando
   `document.startViewTransition`. La regla vive en `globals.css`, porque CSS Modules descarta
   los selectores globales. Con "reducir movimiento" el cambio es instantáneo.
2. **Punto rojo:** desaparece al guardar la empresa completa (`revalidatePath('/app', 'layout')`).
3. **Desplegables de Configuración:** el mismo componente que "Últimos 30 días"
   (`desplegable.tsx`, patrón listbox con teclado). Se quitó el `<select>` nativo.
4. **Globo del chat:** `aria-pressed`, celeste cuando está activo.
5. **Etiquetas de conector del chat:** solo para los conectados; hoy no aparece ninguna.
6. **Subtítulo del chat:** "Preguntá, analizá y tomá decisiones con los datos de tu empresa."
7. **Avatar arriba a la derecha:** presente en todas las pantallas (Integraciones y
   Configuración ganaron la barra superior y perdieron sus márgenes especiales) e igual en los
   dos temas; después, a pedido, el mismo círculo celeste que la barra lateral.
8. **Integraciones:** se quitó Google Ads y se agregó Tiendanube (logo de la landing, gris claro
   en oscuro y azul en claro, subtítulo "Ventas, productos y clientes."). "Conectar" si no está
   conectada y "Configurar" si lo está. Se observó que `PROJECT_STATE.md` marca la fuente
   Tiendanube como pospuesta: mostrarla está bien mientras el botón no conecte nada.

Pruebas: 289 y después 291 en verde.

## 7. Mi perfil: nombre, correo y contraseña

- **Guardar cambios** guarda nombre y apellido en los metadatos de Auth (`first_name`,
  `last_name`) con `guardarNombreUsuario`. Solo se usan para mostrar, nunca para permisos. Se
  quitó el campo Email: el correo se muestra como texto (D-MF_APP-13). 300 pruebas.
- **Cambiar contraseña:** se eligió el enlace al correo porque cambiarla exige acceso a la
  casilla, no solo una sesión abierta. Usa el mismo flujo que "Recuperar acceso", con el envío
  unificado en `src/components/auth/recovery.ts`; al guardar la nueva, `/reset-password`
  cierra todas las sesiones. Supabase guarda un único hash por usuario y lo reemplaza, así
  que la contraseña anterior no queda en ningún lado. 305 pruebas.
- **Vencimiento del enlace:** 1 h por defecto ("Email OTP Expiration" del panel;
  `otp_expiry = 3600` en `supabase/config.toml` solo aplica al entorno local). Es de un solo
  uso y un enlace nuevo invalida el anterior. Bajarlo a 10 minutos afectaría también la
  confirmación del registro. El usuario decidió dejarlo así (D-MF_APP-14).

## 8. Foto de perfil (`0014`)

- "Subir nueva foto" abre el selector del sistema (galería o cámara en el teléfono, archivos
  en la computadora). La pantalla valida JPG o PNG y hasta 5 MB antes de subir.
- El archivo va directo del navegador al bucket privado `avatars`, en la carpeta
  `<auth.uid()>/` y con un nombre aleatorio, porque el límite de cuerpo de las Server Actions es
  de alrededor de 1 MB. Después, `guardarFotoPerfil` valida la ruta (formato y carpeta propia),
  la guarda en `avatar_path` y borra la anterior.
- `0014_profile_photos.sql`: bucket no público con límite de 5 MB y tipos `image/jpeg` e
  `image/png` aplicados por Storage, más cuatro políticas sobre `storage.objects` acotadas a la
  carpeta propia. Prueba pgTAP `12_profile_photos.test.sql` (no ejecutada).
- La foto se muestra con una URL firmada de una hora en los cuatro avatares.
- Se registró `H-E1-96`: un activo y una frontera nuevos que `SECURITY.md` y `ARCHITECTURE.md`
  no describen, y otro número reservado de la ruta. Resultado: 319 pruebas.

## 9. Archivos maliciosos (análisis, sin cambios)

Ante la pregunta del usuario se analizó el riesgo:

- **Lo que ya lo frena:** solo JPG y PNG (SVG excluido a propósito), nada ejecuta el archivo,
  solo lo ve quien lo subió y el nombre lo genera la app.
- **Lo que queda abierto:** Storage confía en el tipo que declara quien sube; alguien que se
  saltee la pantalla podría subir otro contenido, visible solo para sí mismo.
- **Privacidad:** las fotos pueden traer metadatos EXIF (por ejemplo, ubicación GPS).

Opciones propuestas, de menor a mayor:

1. Verificar los primeros bytes en `guardarFotoPerfil`, sin dependencias nuevas.
2. Regenerar la imagen en el servidor (`sharp`), que también borra los metadatos.
3. Antivirus.

Se recomendó la 1. **El usuario no la confirmó: queda como decisión pendiente.**

## 10. Versión móvil (D-MF_APP-17)

Antes, en un teléfono las siete pantallas se salían hacia el costado. Por debajo de 768 px:

- **Barra superior fija:** ☰ (con el punto rojo si falta completar la empresa), logo y avatar.
- **Menú:** la barra lateral pasa a ser un cajón con fondo, trampa de foco, Esc, bloqueo del
  scroll de fondo y cierre al elegir una sección.
- **Pantallas:** las grillas pasan a una columna con márgenes de 16 px, y el gráfico de costos
  muestra una fecha de cada dos.
- **Configuración en tablets:** la tarjeta se salía de la pantalla. Se corrigió con
  `width: min(819px, calc(100% - …))`; en escritorio mantiene los 819 px del diseño.

Verificado sin scroll horizontal a 390, 768, 820 y 1024 px, y con Lighthouse 100 en tamaño
teléfono. 322 pruebas.

## 11. QA de acceso y la ✕ del menú (2026-10-11)

- Con `playwright-cli` sobre el servidor del usuario (puerto 3000, con Supabase) se corrieron
  75 chequeos de iniciar sesión, crear cuenta, recuperar acceso, nueva contraseña, verificación,
  páginas protegidas sin sesión y celular. Contra Supabase real solo hubo un login fallido; el
  resto se simuló.
- No hubo fallas funcionales ni de seguridad. Las observaciones fueron el título genérico de la
  pestaña, el correo que no pasa a "Recuperar acceso" (`H-E1-79`, ya registrado), "Bienvenido"
  en masculino y el destino ante un `next` inválido. El usuario decidió no registrarlas
  (D-MF_APP-19); la última se corrigió igual con `H-E1-104`.
- Se quitó la ✕ del cajón móvil (D-MF_APP-18). Verificado en el navegador: al abrir, el foco va
  a "Praxa, inicio"; Esc cierra y devuelve el foco; elegir Chat cierra. 36 pruebas de
  componente en verde y escritorio sin cambios.

## 12. `/code-review` y cambios en paralelo

El usuario corrió `/code-review` a las 12:03, que informó diez puntos. Además, entre las 12:07 y
las 13:11 se aplicaron cambios en el árbol de trabajo **fuera de esta conversación**. Quien
los hizo los registró como `H-E1-95` (se quitó el modo ejemplo), `H-E1-97` (Configuración en
una sola sentencia), `H-E1-98` (reconciliación de la subida de foto) y `H-E1-99` (orden del
borrado de la foto en el servidor). Esta sesión no los revirtió; las pruebas corrieron con
ellos incluidos.

Esta sesión verificó los diez puntos contra el código de ese momento:

| Punto | Resultado |
|---|---|
| 1. Errores sin manejar en la foto | La subida ya estaba corregida (`H-E1-98`). El borrado se corrigió en el cliente (`H-E1-105`). |
| 2. Ceros del mock como valores medidos | Sin cambios: es la pantalla `AppUsoCostosCero` del diseño (`H-E1-106`). |
| 3. "Conectar" y "Ver guía" sin acción | Deshabilitados con "Todavía no disponible" (`H-E1-100`). |
| 4. Dos escrituras no atómicas en Configuración | Ya estaba corregido (`H-E1-97`). |
| 5. Listas de opciones con `z.enum` | Se acepta el valor ya guardado y el error queda en castellano (`H-E1-101`). |
| 6. URL firmada en cada render | Sin cambios: solo rendimiento (`H-E1-107`). |
| 7. `/onboarding` sin redirección | Redirección a `/app/perfil` en `next.config.ts` (`H-E1-102`). |
| 8. Diagnóstico desde una constante | Consulta `reports` bajo RLS (`H-E1-103`). |
| 9. Destino por defecto inconsistente | Constante `DESTINO_TRAS_ENTRAR` (`H-E1-104`). |
| 10. Consulta de la empresa repetida | Descartado: dejó de ser triple con `H-E1-97`, y `select('*')` es deliberado para tolerar `0013` sin aplicar. |

Comprobación de `H-E1-102` contra el servidor local: `GET /onboarding` → `307` a `/app/perfil`.
Sin sesión, `/app/perfil` → `307` a `/login?next=%2Fapp%2Fperfil`.

## 13. Verificación final

Árbol de trabajo antes de los commits: `npm run verify` (lint, typegen, typecheck, pruebas
unitarias y de componente, y build). Resultado en la sección 15.

Lo que esta sesión **no** pudo verificar:

- `npm run test:policies` (pgTAP `11` y `12`): requiere el proyecto de pruebas de Supabase.
- `0013` y `0014` no están aplicadas al piloto; las aplica el usuario.
- Flujos con correo real: cambio de contraseña, registro y confirmación (`H-E1-72` puede
  interferir).
- Subir y eliminar la foto contra Storage real.

`H-E1-108`: durante la sesión Vitest falló varias veces en todos los archivos con "failed to
find the current suite/runner", sobre todo justo después de `tsc` o lint. Repetir la corrida
la hizo pasar sin cambios de código. No se encontró la causa.

## 14. Herramientas y entorno

- **Servidor propio de comparación:** el `next dev` del usuario en el puerto 3000 impedía otro
  en la misma carpeta. Por eso se usó el worktree temporal `C:\Users\Simon\dev\PRAXA-app-qa`
  (HEAD separado en `f4dc8ce`), espejado con `robocopy /MIR`, con `next dev` en el puerto 3100.
  Hay que borrarlo cuando el usuario lo indique.
- Capturas, medición de diferencias, Lighthouse y `playwright-cli` se instalaron en una carpeta
  temporal fuera del proyecto.

## 15. Commits y resultado de `npm run verify`

`npm run verify` sobre el árbol final (antes de commitear): **exit 0**. Lint y typecheck
limpios, 21 archivos y 330 pruebas en verde (proyectos `unit` y `component`), y `next build`
compiló. La corrida aparte de `unit`, `component` y `app` dio 27 archivos, con 367 pruebas en
verde y 7 omitidas.

A pedido del usuario, la rama `feat/app` se renombró a `mf/MF_APP` (las skills de revisión
exigen `mf/<ID>`) y el trabajo se dividió en commits sobre `f4dc8ce`, sin push:

| Commit | Contenido |
|---|---|
| `0ee64b2` | `docs:` referencia visual de la app (`docs/praxa-app-diseno/`) |
| `32e4c64` | `feat(db):` `0013`, `0014` y pgTAP `11` y `12` |
| `fa5d6ca` | `feat(app):` shell, componentes, pantallas, capa de datos, Server Actions y pruebas |
| `366d8bf` | `feat(auth):` sin onboarding, destino Mi perfil y redirección de `/onboarding` |
| siguiente | `docs:` ficha y sesión de MF_APP, hallazgos y estado |

Rango a revisar: `f4dc8ce..HEAD` (ver la ficha).

## 16. Archivos

**Nuevos:**

- `src/app/(app)/app/{chat,configuracion,diagnostico,perfil,uso-y-costos}/page.tsx`
- `src/components/app/` (23 archivos: shell, ui, íconos, formato, tema, desplegable,
  gráfico, logos de integraciones, pantallas y sus CSS Modules)
- `src/modules/app-data/{index,mock,types}.ts`
- `src/modules/company/{actions,profile-options}.ts`
- `src/modules/identity/actions.ts`
- `src/components/auth/recovery.ts`
- `supabase/migrations/0013_company_profile.sql`
- `supabase/migrations/0014_profile_photos.sql`
- `supabase/tests/11_company_profile.test.sql`
- `supabase/tests/12_profile_photos.test.sql`
- Pruebas: `tests/component/app-pantallas.test.tsx` y `tests/unit/{company-actions,identity-actions,password-recovery,app-data}.test.ts` y `tests/component/app-paginas-sesion.test.tsx`
- `public/app/robot-praxa.png`
- `docs/praxa-app-diseno/` (referencia del diseño; trae un correo de ejemplo del dominio
  `praxa.com`)

**Modificados:**

- `src/app/(app)/app/{layout,page,integraciones/page}.tsx`
- `src/app/(auth)/{login,signup,forgot-password}/page.tsx`
- `src/app/globals.css`
- `src/lib/safe-next.ts`
- `src/proxy.ts`
- `next.config.ts`
- `tests/app/email-flows.test.ts`
- `tests/unit/{proxy-session-cookies,safe-next}.test.ts`
- `docs/HALLAZGOS.md`
- `docs/PROJECT_STATE.md`

**Borrados:**

- `src/app/(app)/app/{contexto,reportes}/page.tsx`
- `src/app/onboarding/{layout,page}.tsx`
- `src/components/{app-nav,edit-context-button,onboarding-wizard}.tsx`
- `src/modules/onboarding/actions.ts`
- `tests/component/onboarding-wizard.test.tsx`

**No actualizados (decisión pendiente, `H-E1-96`):** `docs/SECURITY.md` y
`docs/ARCHITECTURE.md`.

## 17. Correcciones por `implementation-review-1` (2026-10-11)

La revisión ([implementation-review-1.md](revisiones/implementation-review-1.md)) dio
BLOQUEADO. Hubo tres motivos: no pudo ejecutar comandos, pgTAP sin correr (R-01) y la ruta
sin corregir. Además pidió R-02 a R-10 dentro de la microfase. Corregido a pedido del usuario:

| ID | Corrección |
|---|---|
| R-02 | `tests/component/app-paginas-sesion.test.tsx` descubre las páginas de `src/app/(app)/app/` y exige que cada una llame a `requireAppSession` con su ruta antes de leer datos. También exige que sean exactamente las siete. |
| R-03 | `tests/unit/app-data.test.ts` (antes `diagnostico-data.test.ts`) prueba que `getUsuario` firma la foto de la carpeta propia y no firma una ruta ajena ni una que solo empiece parecido. |
| R-04 | La misma prueba cubre que `getIntegraciones` devuelve Meta Ads, Google Analytics y Tiendanube desconectadas (y copias del mock), y que `next.config.ts` redirige `/onboarding` a `/app/perfil` de forma temporal. |
| R-05 | Se quitaron de `perfil.tsx` las ramas `sinBackend` (inalcanzables: el layout no monta las pantallas sin Supabase) y el mock de `@/lib/env` que quedó sin uso en las pruebas de pantalla. |
| R-06 | `12_profile_photos.test.sql` pasa de 9 a 12 aserciones. Prueba que otro usuario no puede modificar ni mover la foto de A y que A no puede moverla a otra carpeta (WITH CHECK de `avatars_update_own`). El DELETE de otro usuario ahora es una aserción (`results_eq` sobre las filas borradas) y no una sentencia suelta. Antes habilita `storage.allow_delete_query` en la transacción para que, si Storage trae el trigger que rechaza el DELETE directo, se pruebe la política y no aborte el archivo. **Sin ejecutar:** depende de R-01. |
| R-07 | `H-E1-93` ahora enumera lo que dejó de ser cierto en `ARCHITECTURE.md` (l. 32, 43, 73 y 152) y lo que falta describir (`app-data`, `/app` sin empresa obligatoria y el destino Mi perfil). |
| R-08 | `guardarFotoPerfil` y `eliminarFotoPerfil` solo borran la foto anterior si está en la carpeta del usuario (sale de metadatos que el usuario puede escribir). Dos pruebas nuevas en `identity-actions.test.ts`. |
| R-09 | El correo de ejemplo de `docs/praxa-app-diseno` (texto de `PANTALLAS.md` y de dos HTML de `AppPerfil`) pasó al dominio reservado `praxa.test`. Las capturas PNG de referencia lo siguen mostrando dibujado: no se editaron imágenes. |
| R-10 | `H-E1-97` a `H-E1-99` pasan a "Resuelto en MF_APP" con asignación MF_APP. |

**Roturas comprobadas en el árbol de trabajo** y revertidas con `git checkout` (los dos
archivos estaban sin cambios locales):

- Quitar `requireAppSession` de Integraciones hace fallar `/app/integraciones verifica la sesión…`.
- Quitar la guarda de carpeta de `getUsuario` hace fallar los dos casos `no firma una ruta fuera
  de la carpeta propia`.

**Verificación:** `npm run verify` dio exit 0, con lint y typecheck limpios, 22 archivos y 346
pruebas en verde (`unit` y `component`) y `next build` compilado. `vitest run --project app`
dio 6 archivos, con 37 pruebas en verde y 7 omitidas.

Siguen pendientes, fuera del alcance de la microfase:

- **R-01:** `npm run test:policies`, que corre el usuario.
- **Corrección de la ruta:** `H-E1-93`, `H-E1-94` y `H-E1-96`, que incluye `SECURITY.md` y
  `ARCHITECTURE.md`. La decide el usuario.

## 18. Primera corrida de `test:policies` y ensayo de `0013` y `0014` (2026-10-11)

El usuario corrió `npm run test:policies` contra el proyecto de pruebas (`<ref de pruebas>`) y
compartió la salida. Resultado: 13 archivos, 14 ejecuciones, 473 aserciones y 2 problemas.

- `01` a `10` (incluida la repetición de `09`): todo OK. Lo anterior a MF_APP no se rompió.
- `11_company_profile`: error SQL `column "industry" does not exist`.
- `12_profile_photos`: 5 de 12. Fallan la configuración del bucket (`NULL` en las tres columnas),
  la subida propia (`42501`, RLS) y las aserciones que dependen de ella.

**Diagnóstico:** el runner no aplica migraciones, solo prueba lo que ya tiene el proyecto. Las
dos fallas son las esperables con `0013` y `0014` sin aplicar: no existe la columna, no existe
el bucket `avatars` y, sin sus políticas, RLS rechaza la subida. No es un defecto de las
migraciones ni de las pruebas.

**Ensayo con rollback:** antes de aplicarlas se ensayó con el procedimiento de M06.1a-M06.2a.
El arnés temporal es `<scratchpad>/ensayo-0013-0014.mjs`, con el mismo guard de destino que
`run-pgtap.mjs` (solo el proyecto de pruebas desechable). En cada ensayo hace `BEGIN`, aplica la
migración tal cual está en el repo, corre la prueba sin su `begin`/`rollback` y termina con
`ROLLBACK`. No quedó nada persistente.

| Ensayo | Resultado |
|---|---|
| `0013` + `11_company_profile` | 9/9 OK |
| `0013` + `0014` + `12_profile_photos` | 12/12 OK, incluidos UPDATE y DELETE entre usuarios (R-06) |

El DELETE de la aserción 8 no abortó el archivo: la variable `storage.allow_delete_query` (o la
ausencia del trigger en esta versión de Storage) dejó probar la política.

**Pendiente del usuario:** `npm run db:check:test` → `npm run db:push:test` → `npm run
test:policies`, y registrar la salida sin la cadena de conexión. Recién después, aplicar al
piloto.

## 19. `0013` y `0014` en el proyecto de pruebas: `test:policies` en verde (2026-10-11)

El usuario aplicó `0013` y `0014` al proyecto de pruebas (`db:check:test` y `db:push:test`) y
avisó que todo salió bien. No compartió la salida de esos comandos. El asistente volvió a
correr `npm run test:policies` para dejar evidencia propia (sin la cadena de conexión):

```
Ejecutando 13 archivo(s) pgTAP contra el proyecto de pruebas <ref de pruebas>.
OK     01_tenant_isolation.test.sql  (34/34 aserciones)
OK     02_context_lifecycle.test.sql  (21/21 aserciones)
OK     03_privileges.test.sql  (35/35 aserciones)
OK     04_company_creation.test.sql  (12/12 aserciones)
OK     05_delete_carveout.test.sql  (9/9 aserciones)
OK     06_activation_integrity.test.sql  (18/18 aserciones)
OK     07_context_revision.test.sql  (16/16 aserciones)
OK     08_integration_isolation.test.sql  (26/26 aserciones)
OK     09_integration_privileges.test.sql  (57/57 aserciones)
OK     09_integration_privileges.test.sql (normalización con membresías sintéticas)  (57/57 aserciones)
OK     09b_integration_lifecycle.test.sql  (155/155 aserciones)
OK     10_demo_closure.test.sql  (21/21 aserciones)
OK     11_company_profile.test.sql  (9/9 aserciones)
OK     12_profile_photos.test.sql  (12/12 aserciones)
13 archivo(s), 14 ejecución(es), 482 aserción(es), 0 problema(s).
Todas las pruebas pgTAP pasaron.
```

Con esto queda resuelto R-01 de `implementation-review-1`. **Pendiente del usuario:** aplicar
`0013` y `0014` al piloto.

## 20. Corrección de la ruta y de `implementation-review-2` (2026-10-11)

`implementation-review-2` ([informe](revisiones/implementation-review-2.md)) dio BLOQUEADO
solo por la ruta sin corregir (ítems 1 y 8). El código pasó: `verify`, `test:policies`
482/482, `test:app` y tres roturas detectadas. Pidió además R-01 y R-02. El usuario pidió
actualizar los documentos con información vieja y corregir los hallazgos.

**Corrección de la ruta** (decisión del usuario, D-MF_APP-08 y esta sesión):

| Documento | Cambio |
|---|---|
| `meta_first/plan.md` | Sección nueva I.5. Migración de M16c `0013` → `0015` (pgTAP `11_meta_insights` → `13_meta_insights`). Migración de M25a.1 `0014` → `0016` (pgTAP `12_chat_queries` → `14_chat_queries`). `purge_connection` la reemplazan `0015` y `0016`. La excepción de II.7 y el paso 10 de M16.2 crean la empresa en Configuración, no en `/onboarding` |
| `M28.2a/plan.md` | Enmienda al principio: paso 8d desde Configuración, URL autorizada nueva `…/auth/callback?next=%2Fapp%2Fperfil` y siguiente número libre `0015`. La spec APROBADA no se editó, para no invalidar el hash que cita el plan; la enmienda y la sección I.5 de la ruta (primera en la jerarquía) mandan sobre su texto |
| `ARCHITECTURE.md` | Árbol: rutas sin onboarding, `components/app/` y `modules/app-data/`. Módulos: `onboarding` sin pantalla, `app-data` nuevo, y `identity` y `company` con perfil y foto. Camino interactivo: destino Mi perfil, `/app` sin empresa obligatoria, sesión verificada en cada página y subida directa de la foto a Storage. Concurrencia: "Contexto declarado" |
| `SECURITY.md` | Activo nuevo (foto, nombre y apellido). Frontera 8, navegador → Storage: RLS por carpeta, bucket privado, URLs firmadas y metadatos de Auth que nunca deciden acceso. Borrado de la foto en la sección 9. Riesgo abierto del tipo declarado y EXIF en la sección 12. Fuente pgTAP `12_profile_photos` |

`spec.md` de la ruta no menciona `0013`, `0014` ni `/onboarding` (su "onboarding público" es el
registro abierto a cualquier dueño, otro concepto): no cambia.

**Hallazgos de la revisión 2:**

| ID | Corrección |
|---|---|
| R-01 | `signup-page.test.tsx` comprueba los argumentos de `signUp`: `emailRedirectTo` = `…/auth/callback?next=%2Fapp%2Fperfil`. La ficha marca `email-flows` como omitida (opcional). |
| R-02 | `app-data.test.ts` prueba `configuracionPendiente`: sin empresa, sin rubro, sin país y sin moneda → pendiente; completa → no. |

**Roturas comprobadas** en el árbol de trabajo y revertidas con `git checkout`:

- Volver el registro a `/onboarding` hace fallar la prueba nueva de `signup-page`.
- Reducir `configuracionPendiente` a `!empresa` hace fallar los tres casos parciales.

**Verificación:** `npm run verify` exit 0 (22 archivos, 352 pruebas, build compilado).

**Hallazgo operativo:** el plan de M28.2a autorizaba en Supabase solo
`…/auth/callback?next=%2Fonboarding`. Desde MF_APP el registro pide `next=%2Fapp%2Fperfil`: si
esa URL no está en la lista del panel, la confirmación cae en la Site URL. Queda como
intervención del usuario (ficha y `PROJECT_STATE.md`).

**Sigue abierto en `H-E1-93`:** no hay pantalla para el contexto declarado (objetivos,
problemas y restricciones) que usa el contrato del reporte. `src/modules/onboarding/` y sus
tablas siguen existiendo sin uso desde la interfaz.

## 21. Cierre e integración (2026-10-11)

El usuario decidió no correr otra `/implementation-review` ni `/qa-review` y cerrar MF_APP
(D-MF_APP-22). Cierre:

- La ficha pasa a `PASS` y `PROJECT_STATE.md` la registra como cerrada fuera de la ruta,
  igual que MF_FRONTEND.
- **Integración:** `mf/M28.2a` era ancestro de `mf/MF_APP`, así que avanzó por avance rápido
  hasta el commit de este cierre. No hubo commit de merge ni cambios en el árbol de trabajo.
  Sin push: `origin/mf/M28.2a` sigue en `f4dc8ce`.
- **Copia de trabajo `PRAXA-app-qa`:** se cerró su `next dev` del puerto 3100 (el servidor del
  usuario en el puerto 3000 no se tocó) y se quitó de la lista de worktrees de Git. La carpeta
  `C:\Users\Simon\dev\PRAXA-app-qa` no se pudo borrar (un archivo bloqueado y sin permiso
  para forzarlo): la borra el usuario a mano. No tiene nada que no esté commiteado.

Pendientes del usuario: los de la ficha (piloto, URL de redirección, pruebas con cuenta real
y decisiones abiertas).

## 22. Después del cierre: contenido de la foto y código del contexto (2026-10-11)

Por pedido del usuario (D-MF_APP-23), sobre `mf/M28.2a`:

- **Contenido de la foto** (opción 1 de §9). `guardarFotoPerfil` descarga el archivo recién
  subido y mira sus primeros bytes. Si no empiezan como un JPG (`FF D8 FF`) o un PNG
  (`89 50 4E 47 0D 0A 1A 0A`), no lo registra, lo borra de Storage y responde "El archivo no
  es una foto JPG o PNG válida.". Si no puede leerlo, no lo registra ni lo borra, y la pantalla
  reconcilia como ante cualquier error. Acepta cualquiera de las dos firmas aunque no
  coincida con la extensión, para no rechazar un PNG legítimo guardado como `.jpg`. No agrega
  dependencias. Pruebas nuevas: JPG aceptado; texto, ejecutable, archivo vacío y GIF
  rechazados (con borrado de la subida); lectura fallida. Rotura comprobada: con la
  verificación anulada fallan los 4 casos de rechazo.
- **Código del contexto declarado.** Se borraron `src/modules/onboarding/schema.ts`,
  `src/modules/onboarding/repository.ts` y `tests/unit/onboarding-schema.test.ts`: ningún
  archivo los usaba desde que se quitó el onboarding. `reporting/contract/versions.ts` ya no
  remite a ese módulo. Las tablas y funciones del contexto siguen en la base (quitarlas exige
  una migración nueva), con sus pgTAP y `tests/app/onboarding.test.ts`, que prueba la base y
  no el módulo.
- **Documentos:**
  - `SECURITY.md`: el riesgo del tipo declarado pasa a "verificado por cabecera, sin regenerar".
  - `ARCHITECTURE.md`: sin el módulo; el contexto existe solo en la base; la foto se verifica.
  - `H-E1-93` y `H-E1-96` actualizados.
  - `PROJECT_STATE.md`: sin la decisión pendiente.

**Verificación:** `npm run verify` exit 0 (21 archivos, 343 pruebas: salen las del módulo de
contexto borrado y entran las de la foto; build compilado).
