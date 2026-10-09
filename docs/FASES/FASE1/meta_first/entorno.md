# Entorno del piloto — M28.2a

Configuración operativa del entorno del piloto, sin valores. Fuente: `docs/FASES/FASE1/M28.2a/spec.md`
y `docs/FASES/FASE1/M28.2a/plan.md` (II.7, paso 9). Este documento no contiene secretos, tokens,
contraseñas, identificadores de cuenta/proyecto completos ni valores de variables de entorno.

## Estado del gate

`G-ENTORNO`: **pendiente**. El usuario informó el recorrido principal completo el 2026-10-04,
pero después reportó enlaces de correo que llegan intermitentemente a `link-missing-params`
(`H-E1-72`). Auth no está acreditado como confiable. Faltan diagnóstico, casos de borde,
evidencia remota redactada y aprobación visible. `H-E1-71` registra por separado el cambio de
dirección del onboarding.

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
| 2 | Variables obligatorias cargadas (inventario abajo); llavero nuevo para el piloto | Usuario / Asistente (inventario) | Informado por el usuario; inventario por cerrar |
| 3 | `db:check`, `db:preview`, `db:push` sobre `app`; contraseña del rol fijada | Usuario (asistente prepara/verifica) | Informado por el usuario; historial remoto por registrar |
| 4 | `worker_api` y `private` fuera de los esquemas expuestos por la Data API | Usuario | Informado por el usuario; captura redactada pendiente |
| 5 | Site URL y redirecciones de Auth remoto configuradas | Usuario | Configuración informada; callback intermitente (`H-E1-72`) |
| 6 | SMTP propio elegido/contratado; SPF y DKIM verificados en `auth.praxa.site` | Usuario | Informado por el usuario; DNS y entrega externa comprobados |
| 7 | Registro de prueba con dirección externa; confirmación recibida; login nuevo | Usuario | Un recorrido informado como exitoso; enlaces intermitentes (`H-E1-72`) |
| 8 | Registro público cerrado; alta con dirección nueva rechazada | Usuario | `PASA`, informado por el usuario |
| 8b | Recuperación de contraseña completa con registro cerrado | Usuario | Un recorrido informado como exitoso; enlaces intermitentes (`H-E1-72`) |
| 8c | `/reset-password` sin sesión y `/auth/callback` sin parámetros | Usuario | `NO EJECUTADO` |
| 8d | `/app/integraciones` sin sesión, sin empresa y con empresa sintética | Usuario | Acceso con empresa sintética informado; sin empresa por precisar |
| 9 | Esta documentación y enlaces a evidencia | Asistente | En curso |
| 10 | `npm run verify` y revisión de diff | Asistente | `PASA`: exit 0; 222 pruebas; diff en revisión |
| 11 | Aprobación visible de `G-ENTORNO` | Usuario | `NO EJECUTADO` |

## Inventario de variables (II.7, paso 2)

Por nombre y estado únicamente; nunca por valor.

| Grupo | Variable | Destino | Estado |
|---|---|---|---|
| Auth público | `NEXT_PUBLIC_SUPABASE_URL` | Vercel (build y runtime) | `pendiente` |
| Auth público | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel (build y runtime) | `pendiente` |
| Auth público | `NEXT_PUBLIC_SITE_URL` | Vercel (build y runtime); `https://app.praxa.site` sin barra final | `pendiente` |
| Credenciales del conector | `PRAXA_CREDENTIAL_KEYS` | Vercel, solo servidor; llavero nuevo distinto del de pruebas | `pendiente` |
| Credenciales del conector | `PRAXA_CREDENTIAL_KEY_CURRENT` | Vercel, solo servidor | `pendiente` |
| Credenciales del conector | `PRAXA_INTEGRATIONS_DB_URL` | Vercel, solo servidor; rol `praxa_integrations.<ref>`, pooler 6543 | `pendiente` |
| Meta (diferida, no exigida para este gate) | `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_CONFIG_ID` | Antes de `M16.1` | `diferida` |
| Modelo (diferida, no exigida para este gate) | `DEEPINFRA_API_KEY` | En `M25a.2` | `diferida` |
| Excluidas (nunca en Vercel) | `SUPABASE_DB_URL`, `SUPABASE_TEST_*`, `PRAXA_INTEGRATIONS_TEST_DB_URL` | — | `excluida, verificar ausencia` |

**Limitación declarada:** la verificación es por presencia del nombre en Vercel. No acredita validez
criptográfica del llavero (`PRAXA_CREDENTIAL_KEYS`/`_CURRENT`) ni conectividad efectiva del rol
(`PRAXA_INTEGRATIONS_DB_URL`) desde el runtime de Vercel.

## Migraciones (II.7, paso 3)

| Dato | Valor |
|---|---|
| Historial objetivo en `app` | hasta `0012_integrations.sql` |
| Verificado previamente en el proyecto de pruebas | Sí — `sesiones/M06.1a-M06.2a.md`, `sesiones/M06.3a.md` |
| Resultado en `app` | `NO EJECUTADO` |
| Contraseña del rol `praxa_integrations` en `app` | `NO EJECUTADO` |

## Data API — exposición de esquemas (II.7, paso 4)

| Esquema | Debe estar expuesto | Estado observado |
|---|---|---|
| `worker_api` | No | `NO EJECUTADO` |
| `private` | No | `NO EJECUTADO` |

## Auth remoto (II.7, paso 5)

| Configuración | Valor esperado | Estado |
|---|---|---|
| Site URL | `https://app.praxa.site` (sin barra final) | `NO EJECUTADO` |
| Redirección 1 | `https://app.praxa.site/auth/callback?next=%2Fonboarding` | `NO EJECUTADO` |
| Redirección 2 | `https://app.praxa.site/auth/callback?next=%2Freset-password` | `NO EJECUTADO` |
| Confirmación de email | Habilitada | `NO EJECUTADO` |

## SMTP (II.7, paso 6)

| Dato | Estado |
|---|---|
| Proveedor elegido | `NO EJECUTADO` |
| SPF verificado en `auth.praxa.site` | `NO EJECUTADO` |
| DKIM verificado en `auth.praxa.site` | `NO EJECUTADO` |
| DMARC (recomendado, no requisito del gate) | `NO EJECUTADO` |
| SMTP configurado en Supabase Auth | `NO EJECUTADO` |

## Matriz de casos (M28.2a-T-01 a T-11)

| Caso | Criterios | Resultado | Evidencia |
|---|---|---|---|
| T-01 | C-01 | `NO EJECUTADO` | — |
| T-02 | C-02 | `NO EJECUTADO` | — |
| T-03 | C-02, C-03 | `NO EJECUTADO` | — |
| T-04 | C-04 | `NO EJECUTADO` | — |
| T-05 | C-05 | `NO EJECUTADO` | — |
| T-06 | C-06, C-07 | `NO EJECUTADO` | — |
| T-07 | C-08 | `NO EJECUTADO` | — |
| T-08 | C-09 | `NO EJECUTADO` | — |
| T-09 | C-05, C-09 | `NO EJECUTADO` | — |
| T-10 | C-10 | `NO EJECUTADO` | — |
| T-11 | C-02, C-03, C-10 | `NO EJECUTADO` | — |

## Capturas redactadas

Índice de ubicaciones de evidencia gráfica, conforme a la spec enmendada (P-03). Las capturas se
conservan fuera del repositorio, en una ubicación accesible y verificable durante la revisión. Se
completa a medida que existan, con enlace desde cada caso de la sesión.

- (vacío — se completa durante la implementación)

## Hallazgos relacionados

- `H-E1-08`, asignado a M28.2a: verificado por la recepción y apertura de la confirmación en una casilla externa, según el usuario; ver sesión de M28.2a. Los demás pasos de T-06 se evalúan por separado.
- `H-E1-71`: onboarding desplegado desactualizado frente a la dirección del producto; requiere corrección de la ruta antes del alta del dueño.
- `H-E1-72`: algunos enlaces de Auth terminan en `link-missing-params`; diagnóstico pendiente.
