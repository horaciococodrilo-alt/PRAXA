# Entorno del piloto — M28.2a

Configuración operativa del entorno del piloto, sin valores. Fuente: `docs/FASES/FASE1/M28.2a/spec.md`
y `docs/FASES/FASE1/M28.2a/plan.md` (II.7, paso 9). Este documento no contiene secretos, tokens,
contraseñas, identificadores de cuenta/proyecto completos ni valores de variables de entorno.

## Estado del gate

`G-ENTORNO`: **aprobado** (aprobado por el usuario el 2026-10-11, sin capturas; paso 11).
Todos los pasos y casos tienen resultado. Los manuales se acreditan por declaración del usuario
caso por caso (2026-10-04 y 2026-10-11), sin capturas registradas: es la limitación principal
del expediente. `H-E1-71` está resuelto. `H-E1-72` (callbacks intermitentes) quedó resuelto por
observación del usuario, que confirmó que el error no volvió a ocurrir; la causa no se diagnosticó.
El usuario aceptó que la rama incluya MF_FRONTEND y MF_APP.

## Dominios elegidos (D-M28.2a-02)

| Uso | Dominio |
|---|---|
| App (Vercel) | `app.praxa.site` |
| Envíos SMTP (Auth) | `auth.praxa.site` |

DNS gestionado por el usuario en GoDaddy, sobre el dominio `praxa.site`.

## Checklist por paso (II.7)

| Paso | Acción | Responsable | Estado |
|---:|---|---|---|
| 1 | Proyecto Vercel conectado a `mf/M28.2a`, Node 24, dominio `app.praxa.site` por HTTPS | Usuario | `PASA` |
| 2 | Variables obligatorias cargadas (inventario abajo); llavero nuevo para el piloto | Usuario | `PASA` (declarado por el usuario el 2026-10-11) |
| 3 | `db:check`, `db:preview`, `db:push` sobre `app`; contraseña del rol fijada | Usuario | `PASA` (declarado por el usuario el 2026-10-11; historial hasta `0014`, ver abajo) |
| 4 | `worker_api` y `private` fuera de los esquemas expuestos por la Data API | Usuario | `PASA` (declarado por el usuario el 2026-10-11; sin captura registrada) |
| 5 | Site URL y redirecciones de Auth remoto; confirmación de email habilitada | Usuario | `PASA` (declarado por el usuario el 2026-10-11) |
| 6 | SMTP propio (Resend); SPF y DKIM verificados en `auth.praxa.site` | Usuario | `PASA` (declarado por el usuario el 2026-10-11; `H-E1-08` verificado) |
| 7 | Registro con dirección externa; login rechazado antes de confirmar; confirmación y login | Usuario | `PASA` (declarado por el usuario el 2026-10-11) |
| 8 | Registro público cerrado; alta con dirección nueva rechazada | Usuario | `PASA` (2026-10-04); cerrado otra vez después de la prueba del 2026-10-11, declarado por el usuario el 2026-10-11 |
| 8b | Recuperación completa con registro cerrado; contraseña anterior rechazada | Usuario | `PASA` (declarado por el usuario el 2026-10-11) |
| 8c | `/reset-password` sin sesión y `/auth/callback` sin parámetros | Usuario | `PASA` (declarado por el usuario el 2026-10-11) |
| 8d | `/app/integraciones` sin sesión, sin empresa y con empresa | Usuario | `PASA` (2026-10-04, con empresa sintética; 2026-10-11, con la app de MF_APP) |
| 9 | Esta documentación y enlaces a evidencia | Asistente | `PASA` |
| 10 | `npm run verify` y revisión de diff | Asistente | `PASA`: exit 0, 21 archivos y 343 pruebas, build; ver sesión |
| 11 | Aprobación visible de `G-ENTORNO` | Usuario | `PASA` (aprobado por el usuario el 2026-10-11, sin capturas) |

## Inventario de variables (II.7, paso 2)

Por nombre y estado únicamente; nunca por valor. Estado declarado por el usuario el 2026-10-11.

| Grupo | Variable | Destino | Estado |
|---|---|---|---|
| Auth público | `NEXT_PUBLIC_SUPABASE_URL` | Vercel (build y runtime) | `configurada por el usuario` |
| Auth público | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel (build y runtime) | `configurada por el usuario` |
| Auth público | `NEXT_PUBLIC_SITE_URL` | Vercel (build y runtime); `https://app.praxa.site` sin barra final | `configurada por el usuario` |
| Credenciales del conector | `PRAXA_CREDENTIAL_KEYS` | Vercel, solo servidor; llavero nuevo distinto del de pruebas | `configurada por el usuario` |
| Credenciales del conector | `PRAXA_CREDENTIAL_KEY_CURRENT` | Vercel, solo servidor | `configurada por el usuario` |
| Credenciales del conector | `PRAXA_INTEGRATIONS_DB_URL` | Vercel, solo servidor; rol `praxa_integrations.<ref>`, pooler 6543 | `configurada por el usuario` |
| Meta (diferida, no exigida para este gate) | `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_CONFIG_ID` | Antes de `M16.1` | `diferida` |
| Modelo (diferida, no exigida para este gate) | `DEEPINFRA_API_KEY` | En `M25a.2` | `diferida` |
| Excluidas (nunca en Vercel) | `SUPABASE_DB_URL`, `SUPABASE_TEST_*`, `PRAXA_INTEGRATIONS_TEST_DB_URL` | — | `ausentes` |

**Limitación declarada:** la verificación es por presencia del nombre en Vercel. No acredita validez
criptográfica del llavero (`PRAXA_CREDENTIAL_KEYS`/`_CURRENT`) ni conectividad efectiva del rol
(`PRAXA_INTEGRATIONS_DB_URL`) desde el runtime de Vercel.

## Migraciones (II.7, paso 3)

| Dato | Valor |
|---|---|
| Historial objetivo en `app` | hasta `0012_integrations.sql` (spec). Con MF_APP, hasta `0014_profile_photos.sql` |
| Verificado previamente en el proyecto de pruebas | Sí: `sesiones/M06.1a-M06.2a.md`, `sesiones/M06.3a.md` y, para `0013`/`0014`, `test:policies` 482/482 (sesión de MF_APP, §19) |
| Resultado en `app` | Aplicado hasta `0014` (declarado por el usuario el 2026-10-11) |
| Contraseña del rol `praxa_integrations` en `app` | Fijada (declarado por el usuario el 2026-10-11) |

## Data API — exposición de esquemas (II.7, paso 4)

| Esquema | Debe estar expuesto | Estado observado |
|---|---|---|
| `worker_api` | No | No expuesto (declarado por el usuario el 2026-10-11) |
| `private` | No | No expuesto (declarado por el usuario el 2026-10-11) |

## Auth remoto (II.7, paso 5)

| Configuración | Valor esperado | Estado |
|---|---|---|
| Site URL | `https://app.praxa.site` (sin barra final) | Configurada (declarado por el usuario el 2026-10-11) |
| Redirección 1 | `https://app.praxa.site/auth/callback?next=%2Fapp%2Fperfil` (desde MF_APP) | Configurada (declarado por el usuario el 2026-10-11) |
| Redirección 1 (anterior) | `https://app.praxa.site/auth/callback?next=%2Fonboarding` | Se conserva para correos viejos; `/onboarding` redirige a Mi perfil |
| Redirección 2 | `https://app.praxa.site/auth/callback?next=%2Freset-password` | Configurada (declarado por el usuario el 2026-10-11) |
| Confirmación de email | Habilitada | Habilitada (declarado por el usuario el 2026-10-11) |
| Registro público (`Allow new users to sign up`) | Cerrado salvo durante un alta prevista | Cerrado (declarado por el usuario el 2026-10-11) |

## SMTP (II.7, paso 6)

| Dato | Estado |
|---|---|
| Proveedor elegido | Resend (informado el 2026-10-04) |
| SPF verificado en `auth.praxa.site` | Verificado (declarado por el usuario el 2026-10-11) |
| DKIM verificado en `auth.praxa.site` | Verificado (declarado por el usuario el 2026-10-11) |
| DMARC (recomendado, no requisito del gate) | Sin informar |
| SMTP configurado en Supabase Auth | Configurado (declarado por el usuario el 2026-10-11) |

## Matriz de casos (M28.2a-T-01 a T-11)

| Caso | Criterios | Resultado | Evidencia |
|---|---|---|---|
| T-01 | C-01 | `PASA` | HTTPS en `app.praxa.site`; sin sesión exige login; con sesión renderiza Integraciones (usuario, 2026-10-04 y 2026-10-11). Sin empresa ya no redirige: enmienda del plan de M28.2a |
| T-02 | C-02 | `PASA` | Inventario de arriba, por nombre, declarado por el usuario el 2026-10-11; límite de verificación por presencia registrado |
| T-03 | C-02, C-03 | `PASA` | Historial hasta `0014` y contraseña del rol, declarado por el usuario el 2026-10-11; `0013`/`0014` probadas antes en el proyecto de pruebas |
| T-04 | C-04 | `PASA` | `worker_api` y `private` no expuestos, declarado por el usuario el 2026-10-11; sin captura |
| T-05 | C-05 | `PASA` | Enlaces de confirmación y recuperación aterrizan en el destino correcto (usuario, 2026-10-11). `H-E1-72` resuelto por observación del usuario |
| T-06 | C-06, C-07 | `PASA` | SMTP con SPF y DKIM; login rechazado antes de confirmar; confirmación y login nuevo (declarado por el usuario el 2026-10-11) |
| T-07 | C-08 | `PASA` | Registro cerrado y alta nueva rechazada (usuario, 2026-10-04); cerrado de nuevo, declarado por el usuario el 2026-10-11 |
| T-08 | C-09 | `PASA` | Recuperación completa; contraseña anterior rechazada (declarado por el usuario el 2026-10-11) |
| T-09 | C-05, C-09 | `PASA` | `/reset-password` sin sesión no cambia la contraseña; `/auth/callback` sin parámetros muestra el enlace incompleto (declarado por el usuario el 2026-10-11) |
| T-10 | C-10 | `PASA` | `npm run verify` exit 0 (21 archivos, 343 pruebas, build) sobre `30bbae4`, con el mismo código publicado |
| T-11 | C-02, C-03, C-10 | `PASA` con observación | `git diff --check` sin problemas en código, migraciones, pruebas ni documentos de fase. Solo hay espacios finales en los HTML de referencia exportados (`docs/landing-referencia/`, `docs/praxa-app-diseno/`), que no se editan. Ninguna migración existente cambió (solo `A 0013`, `A 0014`). La rama trae además MF_FRONTEND y MF_APP, integradas por decisión del usuario |

## Capturas redactadas

Índice de ubicaciones de evidencia gráfica, conforme a la spec enmendada (P-03). Las capturas se
conservan fuera del repositorio.

- No se registró ninguna captura. Los pasos manuales se acreditan por declaración del usuario
  (ver "Estado del gate").

## Hallazgos relacionados

- `H-E1-08`: verificado (confirmación recibida en casilla externa con SMTP propio).
- `H-E1-71`: resuelto el 2026-10-11 con MF_APP y la confirmación del usuario.
- `H-E1-72`: algunos enlaces de Auth terminaron en `link-missing-params` (2026-10-04). Resuelto
  por observación del usuario (2026-10-11): no volvió a ocurrir. Causa no diagnosticada.
