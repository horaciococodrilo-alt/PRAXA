# MF_APP — App web: pantallas de `/app`

## Estado

`PASS` — cerrada el 2026-10-11 por decisión del usuario, sin `/implementation-review`
APROBABLE ni `/qa-review`. `implementation-review-2` dio BLOQUEADO solo por la ruta sin
corregir, y esa corrección se hizo después (sesión §20). El código pasó `verify`,
`test:policies` y las roturas. Rama `mf/MF_APP` (antes `feat/app`), creada desde `mf/M28.2a`
en `f4dc8ce` e integrada en `mf/M28.2a` por avance rápido. Sin push.

Trabajo **fuera de la ruta `meta_first`**: no figura en la Parte I del plan, no tiene gate de
la ruta y no habilita ni bloquea microfases. Lo pidió el usuario directamente, igual que
[MF_FRONTEND](../MF_FRONTEND/ficha.md).

**Base de revisión: `f4dc8ce`, no `git merge-base main HEAD`.** El merge-base con `main`
(`80e5bf3`) traería también M06.3a, M28.2a y MF_FRONTEND, que no son de esta microfase. Las
skills `/implementation-review` y `/qa-review` usan el merge-base por defecto: revisar
`f4dc8ce..HEAD` es una adaptación que decide el usuario al invocarlas.

## Objetivo

1. Implementar con fidelidad el diseño de la app web de `docs/praxa-app-diseno/` (fuente de
   verdad visual): siete pantallas bajo `/app` con su shell, tokens y componentes.
2. Conectar lo que ya existe en Supabase (usuario y empresa) y dejar el resto como mock en
   cero, con un punto de enchufe por dato.
3. Aplicar los ajustes que el usuario pidió durante la revisión en vivo: tema, onboarding,
   perfil, foto, contraseña, integraciones y versión móvil.

## Spec

### Qué se construye

- **Rutas** (`src/app/(app)/app/`): Inicio (`/app`), Chat, Diagnóstico, Uso y costos,
  Integraciones, Configuración y Mi perfil. Cada página revalida la sesión. Se borran
  `/app/contexto` y `/app/reportes`.
- **Shell y componentes** (`src/components/app/`): `AppShell` con barra lateral, avatar arriba
  a la derecha y cajón móvil; `NavItem` con aviso (punto rojo); botones, campos, `Badge`,
  `StatusChip`, `Card`, `KpiCard`, `BarChart`, desplegable propio (patrón listbox) e íconos.
  Tokens del diseño como variables CSS, con tema oscuro (por defecto) y claro.
- **Capa de datos** (`src/modules/app-data/`): contrato de tipos y funciones `get…()`. Reales:
  usuario (correo, alta, nombre, apellido y foto desde Auth y Storage), empresa (nombre,
  rubro, país y moneda) y la existencia de un diagnóstico (`reports`). Mock: integraciones
  (todas desconectadas) y uso de la IA (en cero).
- **Server Actions:** `guardarPerfilEmpresa` (crea la empresa si falta y guarda los cuatro
  datos en una sola sentencia), `guardarNombreUsuario`, `guardarFotoPerfil` y
  `eliminarFotoPerfil`. Todas revalidan la identidad; la empresa se resuelve por membresía.
- **Base de datos:** `0013_company_profile.sql` (columnas `industry`, `country`, `currency` de
  `companies`) y `0014_profile_photos.sql` (bucket privado `avatars` y sus políticas), con sus
  pruebas pgTAP `11` y `12`.
- **Acceso:** se elimina el onboarding. Después de entrar o confirmar la cuenta se va a Mi
  perfil (`DESTINO_TRAS_ENTRAR`); `/onboarding` redirige ahí. "Cambiar contraseña" y
  "Recuperar acceso" comparten el envío del enlace (`src/components/auth/recovery.ts`).

### Criterios de aceptación (pedido del usuario)

| Criterio | Resultado |
|---|---|
| Capturas contra las referencias a 1320 px | 0 % a 0,55 % de píxeles distintos en tema oscuro; diferencias explicadas en la sesión |
| Tokens como variables CSS y componentes del diseño | Cumplido (`src/components/app/`) |
| Datos mock en cero o vacíos; integraciones "NO CONECTADO" | Cumplido (`src/modules/app-data/mock.ts`) |
| Sin campana ni ítems de menú extra | Cumplido |
| Accesibilidad | Lighthouse 100 en las 7 pantallas, en oscuro, claro y móvil |
| Sin scroll horizontal | Cumplido a 390, 768, 820, 1024 y 1320 px |
| Compila y pasa lint y pruebas | Ver la sección 12 de la [sesión](sesion.md) |

## Decisiones del usuario

| ID | Decisión |
|---|---|
| D-MF_APP-01 | Todas las pantallas bajo `/app`, con el stack existente (Next.js 16), no Vite. |
| D-MF_APP-02 | Borrar `/app/contexto` y `/app/reportes`. |
| D-MF_APP-03 | Integraciones mock: todas "NO CONECTADO". |
| D-MF_APP-04 | Identidad y empresa reales donde existan. |
| D-MF_APP-05 | El selector de tema funciona en toda la app, arranca en oscuro y el cambio es un fundido lento (1,2 s). |
| D-MF_APP-06 | Sin menús de tres puntos. "Conectar" y "Ver guía" sin acción por ahora (deshabilitados desde `H-E1-100`). |
| D-MF_APP-07 | Eliminar el onboarding por completo: después de crear cuenta o iniciar sesión se va a Mi perfil, y Configuración lleva un punto rojo hasta que la empresa esté completa (`H-E1-93`). |
| D-MF_APP-08 | Rubro, país y moneda en una migración nueva `0013`, corriendo la numeración de la ruta (`H-E1-94`). |
| D-MF_APP-09 | Los desplegables de Configuración usan el mismo componente que "Últimos 30 días". |
| D-MF_APP-10 | Chat: el globo se pone celeste al activarlo; las etiquetas de conector solo aparecen para los conectados; el subtítulo dice "con los datos de tu empresa". |
| D-MF_APP-11 | El avatar de arriba a la derecha está en todas las pantallas y es igual al de la barra lateral (círculo celeste o la foto), en los dos temas. |
| D-MF_APP-12 | Integraciones: Meta Ads, Google Analytics y Tiendanube (sin Google Ads). "Conectar" si no está conectada, "Configurar" si lo está. |
| D-MF_APP-13 | Mi perfil: "Guardar cambios" guarda nombre y apellido; se quita el campo Email y no se puede cambiar el correo. |
| D-MF_APP-14 | "Cambiar contraseña" manda un enlace al correo (mismo flujo que "Recuperar acceso"). Se deja el vencimiento por defecto de Supabase (1 h). |
| D-MF_APP-15 | Foto de perfil: subir (JPG o PNG, hasta 5 MB, desde la galería o los archivos) y eliminar (`H-E1-96`). |
| D-MF_APP-16 | Quitar el modo ejemplo sin sesión (`H-E1-95`). |
| D-MF_APP-17 | Versión móvil con menú hamburguesa (cajón lateral). |
| D-MF_APP-18 | Quitar la ✕ del cajón móvil: se cierra tocando afuera, eligiendo una sección o con Esc. |
| D-MF_APP-19 | Los hallazgos del QA de las pantallas de acceso no se registran. |
| D-MF_APP-20 | Aplicar las correcciones verificadas de `/code-review` (`H-E1-97` a `H-E1-105`). |
| D-MF_APP-21 | Documentar este trabajo como microfase propia, fuera de MF_FRONTEND. |
| D-MF_APP-22 | Cerrar MF_APP sin otra revisión de implementación ni QA, integrarla en `mf/M28.2a` y borrar la copia de trabajo. |
| D-MF_APP-23 | Después del cierre: verificar en el servidor el contenido de la foto (opción 1 de la sesión §9) y borrar el código del contexto declarado (`src/modules/onboarding/`). |

## Evidencia

Detalle completo, comandos y conteos: [sesion.md](sesion.md).

## Pruebas

| Prueba | Estado |
|---|---|
| `tests/component/app-pantallas.test.tsx` (shell, menú móvil, aviso, Configuración, Chat, Uso, Diagnóstico, Mi perfil) | PASS |
| `tests/unit/company-actions.test.ts` (`guardarPerfilEmpresa`) | PASS |
| `tests/unit/identity-actions.test.ts` (nombre y foto) | PASS |
| `tests/unit/password-recovery.test.ts` (envío del enlace) | PASS |
| `tests/unit/app-data.test.ts` (`reports`, firma de la foto, integraciones desconectadas, redirección de `/onboarding`) | PASS |
| `tests/component/app-paginas-sesion.test.tsx` (cada página verifica la sesión con su ruta) | PASS |
| `tests/unit/safe-next.test.ts` y `tests/unit/proxy-session-cookies.test.ts` (destino por defecto) | PASS |
| `tests/component/signup-page.test.tsx` (el enlace de confirmación lleva a `/auth/callback?next=%2Fapp%2Fperfil`) | PASS |
| `tests/app/email-flows.test.ts` | OMITIDA: es opcional y solo corre con `SUPABASE_TEST_EMAIL_FLOWS=true`. No ejercita la pantalla de registro |
| pgTAP `11_company_profile` (9/9) y `12_profile_photos` (12/12), con `0013` y `0014` aplicadas al proyecto de pruebas | PASS (`test:policies` 482/482, sesión §19) |
| Flujos con correos reales (cambio de contraseña, registro) y foto contra Storage real | PENDIENTE: requiere cuenta y casilla del usuario y `0013`/`0014` aplicadas |

## Condición para avanzar

No aplica a la ruta. Para integrarla en `mf/M28.2a`: `/implementation-review` APROBABLE,
`/qa-review` (`test:policies` ya está en verde). La corrección de la ruta pedida por `H-E1-93`,
`H-E1-94` y `H-E1-96` ya está hecha (plan `meta_first`, I.5; sesión §20).

## Dependencias

Ninguna de la ruta. Sale de `mf/M28.2a` y hereda de ahí MF_FRONTEND (pantallas de acceso y
`src/proxy.ts`), `safeNextPath` (`H-E1-49`, `H-E1-53`) y la guarda de credenciales
(`H-E1-58`).

## Intervención requerida del usuario

- Aplicar `0013` y `0014` al piloto (en el proyecto de pruebas ya están y `test:policies`
  pasa). Sin `0013`, Configuración guarda solo el nombre y lo avisa; sin `0014`, subir una foto
  da error.
- Probar con una cuenta y una casilla reales: cambiar nombre, subir, reemplazar y eliminar la
  foto, cambiar la contraseña por correo, y crear cuenta → confirmar → Mi perfil.
- Agregar `https://app.praxa.site/auth/callback?next=%2Fapp%2Fperfil` a las URLs de redirección
  de Auth del piloto. Sin ella, la confirmación del registro cae en la Site URL (enmienda del plan
  de M28.2a).

## Hallazgos

`H-E1-93` a `H-E1-108` en [HALLAZGOS.md](../../../HALLAZGOS.md).
