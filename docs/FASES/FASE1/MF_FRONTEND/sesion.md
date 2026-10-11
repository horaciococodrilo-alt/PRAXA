# MF_FRONTEND — Sesión del 2026-10-09

Registro completo del trabajo: frontend público (landing y pantallas de acceso), QA,
correcciones e integración en `mf/M28.2a`. Alcance, criterios y decisiones resumidos en
[ficha.md](ficha.md); hallazgos `H-E1-73` a `H-E1-81` en
[HALLAZGOS.md](../../../HALLAZGOS.md).

Reglas respetadas durante toda la sesión: no se leyó `.env.local` ni otro archivo de
entorno, no se pidieron secretos, no se tocó el backend ni las migraciones, no se hizo push
ni despliegue, y contra el Supabase real solo se hicieron logins fallidos.

## 1. Pedido y punto de partida

El usuario pidió reproducir en el proyecto la landing aprobada de
`docs/landing-referencia/` (HTML estático con 4 variantes, corte en 768 px), dividida en
componentes, responsive con un solo DOM, tema claro/oscuro con tokens, animaciones de la
referencia, el chat arrancando al entrar en pantalla, el menú móvil implementado y sin el
bloque "MENÚ ABIERTO" de anotación. Criterios: capturas contra la referencia en 1320, 820 y
390 px en ambos temas, sin scroll horizontal, sin errores de consola, sin imágenes rotas,
Lighthouse de accesibilidad ≥ 95, un solo `<h1>`, y lint y pruebas en verde.

Estado del repositorio al empezar: rama `mf/M28.2a` (M28.2a en curso) con cambios sin
commitear en `docs/FASES/FASE1/M28.2a/plan.md`, `docs/HALLAZGOS.md` y
`docs/PROJECT_STATE.md`, y una landing a medio hacer sin commitear
(`src/components/landing-hero.tsx`, ~100 líneas en `globals.css`, Plus Jakarta en
`layout.tsx`, `public/logos/`, cambios en `page.tsx`).

## 2. Paso 0 — exploración

- **Stack:** Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, CSS Modules
  disponibles, `next/font` para tipografías, Vitest (`unit`, `component`, `app`).
  `npm run verify` = lint + typegen + typecheck + test + build.
- **Rutas:** existían `/login`, `/signup`, `/forgot-password`, `/reset-password` y
  `/verify-email`. No existían `/solicitar-acceso`, `/legal`, `/producto` ni `/seguridad`.
- **Primera entrega de la referencia, inutilizable:** 47 archivos sueltos con sufijo " (1)",
  sin `index.html`, sin README ni `assets/`, y con nombres que no correspondían al
  contenido (por ejemplo, `index (1).html` era un ícono SVG y `README (1).md` un PNG). Se
  frenó y se pidió reexportarla. La segunda entrega fue correcta: `index.html` (864 KB),
  `README.md` y `assets/`.

## 3. Análisis de la referencia

- Las 4 variantes están en el mismo archivo, cada una con su CSS scopeado (`.v-ld`, `.v-lm`,
  `.v-dd`, `.v-dm`) y la mayoría de los estilos inline. El tema lo fija un script con
  `data-theme` y `praxaTema()`, que se guarda en `localStorage` (`praxa-tema`).
- **Claro contra oscuro:** con colores y nombres de archivo normalizados, la estructura es
  idéntica. Solo cambian los colores y 18 imágenes `-osc` (más el avatar menta, el logo
  blanco, la variante de Tiendanube y el diagnóstico oscuro). Se extrajo el mapa
  claro→oscuro por rol: un mismo color claro pasa a distintos oscuros según dónde se usa;
  por ejemplo, el blanco es `#0F231F` en tarjetas y `#0A1714` en fondos de sección.
- **Escritorio contra móvil: el contenido es distinto, no solo la disposición.**
  - Barra superior solo en móvil.
  - Hero con 4 fuentes en columna y conector horizontal frente a 3 fuentes en fila.
  - Orden de secciones distinto.
  - Conversación del chat distinta.
  - Anuncios con tarjetas flotantes frente a una tabla.
  - Tres pasos y Seguridad solo en escritorio.
  - CTA y footer con textos distintos.

  Se planteó al usuario y se decidió la reproducción fiel (D-MF_FRONTEND-01).
- Observación técnica: en la referencia el estilo inline gana sobre las media queries. Por
  eso, a 820 px las tarjetas flotantes de Anuncios conservan su ancho fijo, y eso se
  reprodujo.

## 4. Preparación

- La landing anterior sin commitear quedó en el stash
  `landing-wip previo (reemplazado por feat/landing)`.
- Se creó la rama `feat/landing` desde `main` (`80e5bf3`) en un worktree aparte,
  `C:\Users\Simon\dev\PRAXA-landing`, para no mezclar con M28.2a. Se corrió `npm ci`.
- Se leyó la guía de Next 16 sobre el parpadeo antes de la hidratación
  (`preventing-flash-before-hydration.md`), la de `next/font` y la de convenciones de archivos.
- Herramientas de verificación (`playwright-core` y `lighthouse`) instaladas en una carpeta
  temporal fuera del proyecto, usando el Chrome instalado. **No se agregaron dependencias al
  proyecto.**

## 5. Implementación de la landing

Archivos en `src/components/landing/` y `src/app/page.tsx`.

- **Raíz y tema (`theme.tsx`):** `LandingRoot` aplica las tipografías, los tokens y
  `data-theme`. Un script inline corre antes de pintar (patrón de la guía de Next) y fija el
  tema guardado o el del sistema, más `data-js`. Un efecto de cliente cubre las navegaciones
  del lado del cliente y define `praxaTema()`. Sin JavaScript se ve la versión clara.
- **Tokens (`landing.module.css`):** se nombran por rol, no por color (`--lp-card`,
  `--lp-section-alt`, `--lp-divider`…). Las sombras se reescriben con un factor 2,4 en oscuro
  (con una excepción documentada en el diagnóstico).
  - Reset de modelo de caja con especificidad cero: la referencia usa `content-box` y el
    preflight de Tailwind fuerza `border-box`, lo que daba 2 px de diferencia en botones
    con borde.
  - Interlineado normal, como el navegador por defecto.
- **Visibilidad por variante:** utilidades `soloEsc`/`soloMov` (corte en 768 px) y
  `soloClaro`/`soloOscuro`. `ThemedImg` renderiza las dos imágenes con carga diferida, así que
  la del tema inactivo no se descarga.
- **Un solo `<h1>`**, con estilos distintos por ancho; los textos que cambian por ancho van
  en `span` alternados.
- **Orden móvil con CSS `order`.** Anuncios no tiene elementos con foco, así que no altera el
  orden de tabulación.
- **Animaciones:** las de entrada, el carrusel, los cables del conector y el resaltado del
  hero se copiaron con sus tiempos.
  - El fondo de puntos del hero (unos 260 KB inline en la referencia) se extrajo a SVG
    propios con su animación. Se sirve con un `<img>` diferido por ancho (el oculto no se
    descarga) dentro de un `<picture>` que, con `prefers-reduced-motion`, elige una versión
    quieta.
  - Movimiento reducido: igual que la referencia.
- **Chat (`arranque.tsx`):** IntersectionObserver con umbral 0,4 sobre el primer mensaje
  visible; hasta entonces las animaciones están en pausa por CSS. Desvío deliberado de la
  referencia, informado: las barras del gráfico también esperan, para crecer junto con la
  respuesta.
- **Menú móvil (`nav.tsx`):** diálogo con las dos acciones de la anotación, `aria-expanded`,
  cierre con Esc, tocando afuera y con su botón, foco contenido y devuelto al botón. El panel
  se renderiza fuera del header, porque su `backdrop-filter` hacía que `position: fixed` se
  midiera contra el header.
- **Enlaces:** "Crear cuenta" → `/signup` e "Iniciar sesión" → `/login`. En el footer
  queda solo Contacto (`mailto:`). Las rutas inexistentes se quitaron.
- **Tipografías:** Manrope y JetBrains Mono con `next/font/google`, autoalojadas.
- **Imágenes:** `<img>` en un único helper (`img.tsx`) con la excepción de lint documentada.

## 6. Verificación de la landing

Método: capturas de página completa de la referencia y de la implementación en 1320, 820 y
390 px, en claro y oscuro, con movimiento reducido y recorrido previo de la página. Se midió
la posición y altura de cada sección, el porcentaje de píxeles distintos por sección
(umbral 24/255 por canal), mapas de diferencias y zoom 3× donde hizo falta.

Resultado final, sobre el build de producción:

| Ancho y tema | Hero | Anuncios | Herramientas | Chat | Diagnóstico | Pasos | Seguridad | CTA | Footer |
|---|---|---|---|---|---|---|---|---|---|
| 1320 claro | 1,29 % | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % | 0,46 % | 0 % |
| 1320 oscuro | 1,41 % | 0,18 % | 0 % | 0 % | 0 % | 0 % | 0 % | 0,46 % | 0 % |
| 820 claro | 1,96 % | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % | 0,74 % | 0 % |
| 820 oscuro | 1,77 % | 0,19 % | 0 % | 0 % | 0 % | 0 % | 0 % | 0,74 % | 0 % |
| 390 claro | 0,56 % | 0 % | 0 % | 0 % | 0 % | — | — | 0,76 % | 5,85 % |
| 390 oscuro | 0,56 % | 0 % | 0 % | 0 % | 0 % | — | — | 0,75 % | 5,35 % |

Explicación de cada diferencia:

- **Hero y CTA:** el botón "Crear cuenta" es más angosto que "Solicitar acceso"
  (D-MF_FRONTEND-04). En el hero se suma una diferencia de suavizado: la referencia carga
  Manrope desde Google y dibuja el texto chico con suavizado subpíxel, y acá sale en escala
  de grises; algunas flechas del fondo varían apenas de brillo. Las posiciones coinciden al
  milésimo de píxel y solo se nota con zoom 3×.
- **Anuncios en oscuro:** el botón "Comprar" blanco (D-MF_FRONTEND-06), confirmado con
  recorte.
- **Footer móvil:** mide 175 px en lugar de 207, porque quedó solo Contacto (D-MF_FRONTEND-05).
- **Tres pasos y Seguridad** no existen en la referencia móvil.

Correcciones surgidas de esta verificación:

- Modelo de caja (2 px en botones con borde).
- Tarjetas de preguntas estiradas en móvil.
- Ancho fijo de las tarjetas flotantes a 820 px.
- El `<picture>` del fondo pedía y cancelaba el SVG angosto en escritorio, y se reemplazó.
- Con movimiento reducido, el fondo como imagen de fondo seguía animado, y se agregó la
  versión quieta.
- `setState` sincrónico dentro de un efecto (error de lint).

## 7. Ajustes pedidos sobre la landing

- "7 de 7 días" centrado bajo Cobertura, en escritorio y móvil.
- Botón "Comprar" del anuncio blanco con texto oscuro en ambos temas (antes, en oscuro, era
  del color de la barra).

## 8. Pantallas de acceso

Referencias: dos capturas en `docs/landing-referencia/assets/` (Iniciar sesión y Crear
cuenta, solo escritorio y en oscuro). Decisiones en D-MF_FRONTEND-07.

- **Componentes (`src/components/auth/`):**
  - `AuthSplit`: el formulario va primero en el DOM y la presentación queda a la izquierda,
    oculta por debajo de 960 px.
  - `AuthCard`: el título es el único `<h1>`.
  - `AuthField`: `label` con `htmlFor` y ayuda por `aria-describedby`. La primera versión
    envolvía el control con el `label`, y el botón "Mostrar" y la ayuda pasaban a formar parte
    del nombre accesible; lo detectó una prueba en navegador.
  - `TextInput` con ícono, `PasswordInput` con ojo (Iniciar sesión) o texto "Mostrar"
    (Crear cuenta), `SubmitButton`, `Notice` (`alert` o `status`), íconos de Lucide (ISC) y
    los paneles de presentación.
- **Layout `(auth)`:** reutiliza `LandingRoot`, con logo arriba y fondo liso.
- **Páginas:** las 5 cambian solo el marcado. Recuperar acceso, Nueva contraseña y
  Verificación se diseñaron con los mismos componentes en una tarjeta centrada.
- **Verificación:** se vieron sin `.env.local` con un build hecho con valores públicos
  ficticios (`https://example.invalid`). Resultado: 30 combinaciones (5 pantallas × 3 anchos
  × 2 temas) con un solo `<h1>`, sin scroll horizontal ni errores; Lighthouse de accesibilidad
  100 en las 10 combinaciones de pantalla y tema.
- **Ajuste posterior:** el panel de Crear cuenta quedó sin tarjeta, igual que en Iniciar sesión.

## 9. Correo ya registrado (`H-E1-73`)

El usuario observó que Crear cuenta con un correo existente decía "Revisá tu correo" sin
enviar nada. Es la protección de Supabase contra la enumeración de cuentas: no envía correo
ni devuelve error, y devuelve un usuario sin identidades. Se ofreció mantener un mensaje
neutro, o avisar aceptando el riesgo, y el usuario eligió avisar.

- Se detecta un usuario sin identidades o `user_already_exists`, y se muestra "Ese correo ya
  tiene una cuenta" con enlaces para iniciar sesión o recuperar la contraseña.
- Riesgo aceptado: `SECURITY.md`, sección 12, y `H-E1-73`.
- Prueba de componente con Supabase simulado para tres casos.

## 10. QA funcional

Alcance acordado (D-MF_FRONTEND-09): contra el Supabase real, solo logins fallidos; el
registro, la recuperación, el correo sin confirmar, los límites y los errores se simularon
interceptando la red en un navegador real, con el formato real de las respuestas de Supabase
(`code` numérico y `error_code`). Se recorrieron:

- **Landing:** todos los enlaces y botones, el menú móvil y la consola.
- **Validaciones de formulario:** campos vacíos y correos mal formados; mayúsculas y
  espacios; contraseñas con ñ, emoji y espacios.
- **Botones y teclado:** mostrar/ocultar, Enter, estado de carga y doble clic.
- **Mensajes de Supabase:** los mensajes de error y los avisos de la URL (`?notice=`,
  `?error=` con contenido basura o HTML).
- **Redirecciones:** destinos maliciosos en `?next=`, rutas privadas sin sesión, el callback
  sin parámetros y rutas inexistentes.
- **Móvil:** tamaño de letra de los campos y scroll horizontal.

Primera corrida: 63 OK, 10 FALLA, 9 observaciones. Problemas reales encontrados:

| Problema | Origen | Resolución |
|---|---|---|
| Redirección abierta: `/login?next=/\dominio` llevaba a un dominio externo tras autenticar (reproducido) | Validación de `next` del login en `main` | `H-E1-74`. Al integrar resultó duplicado de `H-E1-49`, ya corregido en M28.2a |
| Errores de Supabase en inglés (límite de correos, contraseña débil, correo rechazado) y mensaje engañoso ante demasiados intentos | Páginas de acceso de `main` | `src/components/auth/errors.ts`: mensajes propios por `code` y 429; lo desconocido usa un genérico en castellano |
| Contraseña de solo espacios aceptada | Idem | `passwordProblem()` en Crear cuenta y Nueva contraseña |
| Campos de 14,5 px en móvil: el iPhone hace zoom al enfocarlos | Diseño de MF_FRONTEND | 16 px en móvil |
| 404 genérica de Next, sin estilo y con el título viejo | Proyecto | `src/app/not-found.tsx` |
| Tras el login se volvía a `/app` y no a la sección pedida | Proxy inactivo (`H-E1-75`) | Proxy en `src/` |

Las fallas de la primera corrida que eran errores del propio script (simulaciones con el
formato equivocado, conteos mal planteados) se corrigieron en el script; no se cuentan como
defectos.

## 11. Proxy inactivo (`H-E1-75`)

`proxy.ts` estaba en la raíz del repositorio desde el primer commit, y la aplicación vive en
`src/app`. La documentación de Next 16 exige que esté al mismo nivel que `app`. Evidencia:

- `next build` no listaba el proxy.
- `/app/integraciones` sin sesión redirigía con `next=/app`, porque lo hacía el layout y no
  el proxy.

Con la decisión del usuario (D-MF_FRONTEND-11):

- Se movió a `src/proxy.ts` y se actualizaron `ARCHITECTURE.md`, `README.md` y la guarda de
  credenciales.
- Se agregó `tests/unit/proxy-location.test.ts`.
- Ahora el build lista `ƒ Proxy (Middleware)`, el proxy corre en cada pedido (15–25 ms en
  desarrollo) y cada sección redirige con su propia ruta en `next`.

Efecto colateral esperado: con sesión iniciada, `/login` y `/signup` redirigen a `/app`;
esa regla ya existía en el proxy pero nunca se aplicaba.

## 12. QA final

Sobre un build de producción nuevo, con la configuración real, en `feea396` (contenido
idéntico al `5a2a8be` posterior a la limpieza de la sección 14):

| Pasada | Resultado |
|---|---|
| Funcional (85 verificaciones) | 79 OK · 0 FALLA · 6 observaciones (`H-E1-79` y notas informativas) |
| Comportamiento de la landing | Chat en pausa hasta verse y después en marcha; tema del sistema, manual, persistente y automático; menú con Esc y foco; sin JavaScript, versión clara con contenido visible; movimiento reducido sin animaciones; consola limpia |
| Landing contra la referencia (6 combinaciones) | Tabla de la sección 6 |
| Pantallas de acceso (30 combinaciones) | 30/30 sin problemas |
| Lighthouse | Acceso: 100 en accesibilidad, buenas prácticas y SEO en las 20 corridas. Landing: accesibilidad 96 en claro (`H-E1-76`) y 100 en oscuro; rendimiento 98 en escritorio y 69/79 en móvil (`H-E1-77`). La 404 no la analiza Lighthouse (`ERRORED_DOCUMENT_REQUEST` ante un 404); axe-core: 0 violaciones y un `<h1>` |

`npm run verify` en `feat/landing`: 14 archivos, 187 pruebas y build.

## 13. Integración en `mf/M28.2a`

Pedido del usuario (D-MF_FRONTEND-12).

1. Los 3 archivos sin commitear de M28.2a se guardaron en el stash
   `M28.2a sin commitear (antes del merge de feat/landing)`, con una copia del diff aparte.
2. `git merge --no-ff feat/landing`, con conflictos en 6 archivos:
   - `src/lib/safe-next.ts` (añadido en las dos ramas): **M28.2a ya lo tenía** (`H-E1-49`,
     `H-E1-53`, revisado en M06.3a) y además cubre rutas que la normalización vuelve `//`. Se
     conservó esa versión; la de `feat/landing` era un duplicado.
   - `tests/unit/safe-next.test.ts`: pruebas de M28.2a más los casos del QA que siguen
     aplicando. Los de caracteres de control se descartaron: con esta implementación el
     navegador los elimina y la ruta queda interna.
   - `tests/unit/no-privileged-credentials.test.ts`: versión de M28.2a (`H-E1-58`), leyendo
     el proxy desde `src/`, más una prueba de que se revisa.
   - `src/app/auth/callback/route.ts`: el mismo cambio en las dos ramas; quedó un solo
     `import`.
   - `docs/ARCHITECTURE.md` y `docs/HALLAZGOS.md`: se conservaron las dos partes.
   - `src/proxy.ts` quedó idéntico al `proxy.ts` de M28.2a, solo cambia la ubicación.
3. `npm run verify` sobre el resultado: 16 archivos, 257 pruebas y build, con el proxy
   detectado.

## 14. Incidente: `env.local` versionado (`H-E1-81`)

Al documentar se encontraron en `feat/landing` dos commits que no eran de esta sesión:

- `agregue env`: agregaba un archivo `env.local`, sin el punto inicial, así que `.gitignore`
  no lo filtraba (19 líneas).
- `a`: lo borraba.

Su contenido no se leyó. Ninguna rama remota contenía esos commits. Con la decisión del
usuario (D-MF_FRONTEND-13):

1. Se reaplicaron los commits posteriores sobre `0afd64e`, sin esos dos. El contenido de
   `feat/landing` quedó idéntico (`git diff` vacío contra el estado anterior).
2. `mf/M28.2a` volvió a `origin/mf/M28.2a` (`b09c10e`) y se rehízo el merge con las mismas
   resoluciones. El árbol resultante es idéntico al del merge anterior. Merge final:
   `2b4f5bb`.
3. `git log --all -- env.local` no devuelve nada. Los objetos viejos solo quedan en el reflog
   local, que no se publica.

Prevención pendiente de decisión: ignorar `env.local` y variantes sin punto en `.gitignore`.

## 15. Commits de `feat/landing` (después de la limpieza)

| Commit | Descripción |
|---|---|
| `d9c783b` | Base: assets, tokens claro/oscuro, tema y fuentes |
| `42b56cc` | Barra móvil con menú accesible |
| `992d849` | Hero con fuentes, conector animado y resultado |
| `6f53644` | Anuncios y página `/` |
| `454db5b` | Franja de herramientas |
| `b7073fd` | Chat de decisiones |
| `0a52d0d` | Diagnóstico |
| `c395159` | Tres pasos |
| `c08ff7b` | Seguridad |
| `47b08d8` | CTA final |
| `9f048bc` | Footer y orden móvil |
| `f3ca846` | Prueba del menú móvil |
| `5a5395b` | Arranque del chat sin `setState` en el efecto |
| `a384e22` | Fondo del hero por ancho y versión quieta |
| `9caac4b` | Cobertura centrada y botón Comprar |
| `a29eb6b` | Componentes de acceso |
| `1f45624` | Rediseño de las pantallas de acceso |
| `a4906bb` | Prueba de mostrar/ocultar contraseña |
| `0afd64e` | Crear cuenta sin tarjeta |
| `7ea7916` | Aviso de correo ya registrado (`H-E1-73`) |
| `08bcc7c` | Campos de 16 px en móvil |
| `39657ff` | Redirección abierta (`H-E1-74`) |
| `204b620` | Errores en castellano y contraseñas de solo espacios |
| `df954eb` | Página 404 |
| `7d5bf65` | Registro de `H-E1-74` y `H-E1-75` |
| `5a2a8be` | Proxy en `src/` (`H-E1-75`) |

Merge en `mf/M28.2a`: `2b4f5bb`. En total, 105 archivos tocados respecto de `main`, de los
cuales 52 son assets de `public/landing/` (48 de la referencia y 4 SVG del fondo del hero).

## 16. Limitaciones y pendientes

- **No verificado:** el ciclo con correos reales (confirmación, recuperación y llegada al
  onboarding) y la redirección de `/login` a `/app` con sesión iniciada. Requieren la casilla
  y una cuenta del usuario.
- **Observaciones del QA sin corregir:** `H-E1-79`.
- **Decisiones del usuario pendientes:** contraste en claro (`H-E1-76`), rendimiento móvil
  (`H-E1-77`), texto del CTA móvil (`H-E1-78`), estilo de "Falta configurar Supabase"
  (`H-E1-80`) y prevención de `H-E1-81`.
- **Relación con M28.2a:** el proxy activo cambia el manejo de cookies de sesión. Hay que
  revalidar `H-E1-72` (callbacks intermitentes) con el proxy funcionando.
- **Limpieza pendiente:**
  - el stash con la landing anterior
  - `docs/landing-referencia/`, que no está versionado (su inclusión es decisión del usuario)
  - el worktree `PRAXA-landing`, con su copia ignorada de `.env.local`
  - la rama `feat/landing`, una vez confirmada la integración
- **Herramientas de verificación no versionadas:** los scripts de capturas, diferencias, QA y
  Lighthouse vivieron en una carpeta temporal de la sesión.
