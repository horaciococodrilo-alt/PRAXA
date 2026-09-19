# Baseline M04.2 — runtime, CI y autenticación

Fecha de apertura: 2026-09-17
Última actualización: 2026-09-19

Este documento registra evidencia real de M04.2. No contiene URLs privadas completas, claves, tokens, contraseñas ni valores de `.env.local`. Por decisión del usuario, el asistente no modifica, mueve, renombra, vacía ni borra `.env.local`; sólo el usuario lo edita manualmente.

## Versiones

| Componente | Valor observado |
|---|---|
| Node local | `v24.18.1` |
| npm local | `11.16.0` |
| `engines.node` | `>=24 <25` |
| `.nvmrc` | `24.18.1` |
| Next.js | `16.3.4` |
| Snapshot inicial de M04.2 | `702a2dc` |

## Pruebas de baseline

| ID | Prueba | Estado | Evidencia |
|---|---|---|---|
| T-M04.2-01 | `npm run verify` en el checkout principal | `PASS` | 2026-09-18, `C:\Users\Simon\dev\PRAXA`: lint, typegen y typecheck OK; 63 tests en 6 archivos; build OK con 14 rutas. Exit code 0. `.env.local` no tenía valores cargados. |
| T-M04.2-02 | Clon limpio: `npm ci` y `npm run verify` | `PENDING` | Se ejecutará con la copia de `.env.local` que contenga los valores reales, sin modificar el archivo del checkout principal. |
| T-M04.2-03 | Node, `engines.node` y `.nvmrc` compatibles | `PASS` | 2026-09-19: runtime local `v24.18.1`, `.nvmrc` `24.18.1` y `engines.node` `>=24 <25`; el pin pertenece al rango declarado. |
| T-M04.2-04 | `verify` ejecuta `typegen` antes de `typecheck` | `PASS` | 2026-09-19: el bloque `scripts` es idéntico al de `HEAD`; `verify` conserva `npm run lint && npm run typegen && npm run typecheck && npm run test && npm run build`. |
| T-M04.2-05 | `.env.local` ignorado y ausente de `git ls-files` | `PASS` | 2026-09-19: `git check-ignore -v .env.local` la atribuye a `.gitignore:35` (`.env*`) y `git ls-files -- .env.local` no devuelve rutas. `package-lock.json` permanece sin cambios. |
| T-M04.2-06 | Seis pasos manuales de Auth documentados | `PASS` | 2026-09-19: registro, verificación del correo, login, persistencia tras refresh, logout y segundo login documentados individualmente como `PASS`. La ausencia de `public.companies` quedó aislada en H-M04.2-02 para M06.1. |

## Autenticación manual

La base nueva no tendrá migraciones en M04.2. Estas pruebas cubren únicamente Supabase Auth; cualquier fallo posterior por ausencia de `public.companies` se registra en H-M04.2-02 y se asigna a M06.1.

| Paso | Estado | Evidencia | Asignación si falla |
|---|---|---|---|
| Registro | `PASS` | 2026-09-19: el alta fue aceptada y Supabase envió el correo de confirmación. | — |
| Verificación del correo | `PASS` | 2026-09-19: el enlace procesó el callback, creó la sesión y redirigió a `/onboarding`; el error posterior fue exclusivamente la ausencia esperada de `public.companies`. | — |
| Login | `PASS` | 2026-09-19: la primera cuenta confirmada aceptó las credenciales y abandonó `/login`; el error posterior fue exclusivamente la ausencia esperada de `public.companies`. | — |
| Refresh con sesión persistente | `PASS` | 2026-09-19: al recargar la ventana autenticada, la sesión persistió y la aplicación volvió al error esperado por ausencia de `public.companies`, sin redirigir a `/login`. | — |
| Logout | `PASS` | 2026-09-19: el `POST /auth/signout` cerró la sesión y la recarga permaneció en `/login`. El aviso de hidratación observado es independiente de Auth: la evidencia mostró el atributo `cz-shortcut-listen` inyectado en `<body>` por una extensión del navegador. | — |
| Segundo login | `PASS` | 2026-09-19: tras cerrar la sesión, las credenciales fueron aceptadas nuevamente; el error posterior fue la ausencia esperada de `public.companies`. El aviso simultáneo de hidratación correspondió al atributo inyectado por la extensión del navegador y no afectó Auth. | — |

## Hallazgos

### H-M04.2-01 — OneDrive impedía una verificación reproducible — `RESUELTO`

El checkout bajo OneDrive produjo tres incidentes en un día:

1. `EPERM` durante `npm ci`.
2. `EPERM: operation not permitted, open '.next\\trace'`, que bloqueó `next build` y por tanto T-M04.2-01.
3. Una carrera de sincronización durante la prueba de entorno que eliminó `.env.local`; no hubo pérdida de datos porque era una copia sin modificar de `.env.example` y el usuario la recreó.

Resolución elegida y ejecutada por el usuario el 2026-09-18: mover el repositorio a `C:\Users\Simon\dev\PRAXA` mediante `robocopy /E /MOVE`, excluyendo `node_modules` y `.next`, y ejecutar después `npm ci` en la ruta nueva. El asistente no movió el repositorio ni cambió la configuración de OneDrive.

Resultado: T-M04.2-01 pasó completamente en el checkout principal nuevo. La primera corrida posterior a `npm ci` completó lint, typegen y typecheck y dejó 54 tests aprobados, pero `tests/component/onboarding-wizard.test.tsx` falló con `Failed to start threads worker / Timeout waiting for worker to respond`; la cadena `&&` se detuvo antes del build. En el reintento inmediato, ese archivo ejecutó sus 9 tests en 8.8 s, la suite completó 63 tests en 6 archivos y `next build` generó 14 rutas.

Diagnóstico: timeout transitorio compatible con el antivirus escaneando `node_modules` recién instalado, no un fallo reproducible del proyecto. Después de un `npm ci` limpio, un primer timeout del worker de Vitest se registra y se reintenta una vez antes de clasificarlo como defecto.

El build exitoso reportó `Environments: .env.local`, por lo que Next lee el archivo, pero pasó con sus variables sin valores. Queda confirmado que las tres `NEXT_PUBLIC_*` no son requisito de compilación y el workflow no necesita secrets. La ejecución con los valores reales queda cubierta por T-M04.2-02 en el clon limpio.

### H-M04.2-02 — El proyecto nuevo no tendrá `public.companies`

M04.2 no aplica migraciones. La prueba manual puede validar registro, confirmación, login, persistencia, logout y segundo login, pero una redirección o página que consulte `public.companies` puede fallar porque la tabla todavía no existe.

Impacto: registrar el fallo real sin bloquear M04.2 y resolverlo en M06.1, cuando se aplique la cadena de migraciones corregida sobre la base limpia.

Evidencia observada el 2026-09-19: después de confirmar el correo, Auth completó el callback y la aplicación llegó a `OnboardingPage`. `getCurrentCompany` falló en `src/modules/company/service.ts:39` con `Could not find the table 'public.companies' in the schema cache`. Se clasifica como manifestación confirmada de H-M04.2-02, no como fallo de registro ni de verificación de correo.

## CI remoto

El workflow local se ejecuta en `push` y `pull_request` dirigidos a `main`, con cancelación de corridas superpuestas. La corrida remota se verificará después del push acordado; no se declarará verde hasta observar su resultado real.
