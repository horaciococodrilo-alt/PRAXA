# M16.2: selección de cuenta, ciclo de vida y reautorización de Meta (fase A)

## Qué cambia y por qué

- Pasa una conexión de Meta de `pending_selection` a `active`: lista las cuentas delegadas (paginadas), el dueño confirma cuenta, moneda y zona, y una consulta de prueba de Insights corre antes de `confirm_connection`. Nada del probe se guarda.
- Agrega vencimiento y purga perezosa y reanudable de pendientes, desconexión con revocación en Meta, reautorización con generación esperada y transiciones por clase de error (CA-39).
- `debug_token` y la revocación viajan como `GET` dentro de un `POST` por lote, sin credenciales en la URL de salida. Un preflight local (`scripts/meta-preflight.mjs`) verificó la vía por lote con resultado real `ok`.
- La tarjeta de Meta en `/app/integraciones` muestra el estado real (seis estados) y el chip, Inicio y Chat leen la conexión `active` por RLS.
- Es la fase A de una sola microfase: el alta del dueño y VR-01 necesitan la aplicación en producción y se hacen después del merge (fase B). No hay migraciones.

## Criterios y pruebas

| Criterios | Prueba que los cubre |
|---|---|
| C-01, C-02 (listado, paginación, descartes) | `tests/unit/meta-lifecycle.test.ts` T-01 a T-03 |
| C-03, C-26, C-27 (tarjeta, sin preselección, sin ids completos) | T-27, T-29 (unit y `tests/component/integraciones-meta-tarjeta.test.tsx`, `integraciones-meta-aviso.test.tsx`) |
| C-04, C-42 (elección resuelta en el servidor, clave ligada a la conexión) | T-06, T-07 |
| C-05, C-06, C-07, C-32 (probe, vencimiento, un reintento) | T-04, T-05, T-08, T-09, T-10; `tests/app/meta-lifecycle.test.ts` T-30, T-36 |
| C-08 a C-12, C-25 (purga, desconexión, cancelar) | T-11 a T-13, T-51; `tests/app/meta-lifecycle.test.ts` T-33 a T-35 |
| C-13, C-23, C-44 (texto de apps conectadas, reautorización, retención de copias) | T-28, T-50 (componente) |
| C-14, C-39, C-40 (lote, revocación, `debug_token`) | T-14, T-47 |
| C-15 a C-20, C-24, C-46 (reautorización, caso A y B, escritura ambigua) | T-15 a T-20, T-52; `tests/app/meta-lifecycle.test.ts` T-31, T-32 |
| C-21, C-22 (efecto por clase) | T-21, T-22; `tests/app/meta-lifecycle.test.ts` T-37 |
| C-28, C-29, C-30, C-31, C-45 (confinamiento, registros, textos, K01, identidad) | T-23 a T-26, T-51 |
| C-33, C-34 (guarda de `test:app`, verificaciones) | T-38 a T-41 |
| C-35 (documentos limitados al Diseño §17) | T-42 y revisión |
| C-38 (estado real compartido) | `tests/unit/app-data.test.ts` T-46 |
| C-41 (preflight) | `tests/unit/meta-preflight.test.ts` T-48, más el resultado real `ok` en la sesión |
| C-36, C-37 (VR-01, VD-01, recuperación) | Fase B (T-44, T-45) |

QA independiente (`qa-review-2.md`): 39 pruebas exploratorias temporales sin base de datos y 5 con base desechable, ya borradas. Dos hallazgos de severidad baja (Q-01 nombre de cuenta en blanco, Q-02 tarjeta pendiente sin cuentas y sin explicación) que no bloquean y quedan para registrar.

## Verificación (local, `HEAD` `5a4c49c`, código idéntico al revisado en `89a41b1`)

| Comando | Resultado |
|---|---|
| `npm run verify` | Exit 0: lint, typegen, typecheck, 26 archivos y 589/589 pruebas, build |
| `npm run test:policies` | Exit 0: 482 aserciones, 0 problemas |
| `npm run test:app` | Exit 0: 57 pasadas, 7 omitidas ajenas a Meta (3 de correo opt-in y 4 guardas inversas); `meta-lifecycle` y `meta-oauth` 19/19 sin omitidas |
| `npm run db:check:test` | Exit 0, destino desechable |
| Migraciones | Ninguna creada ni modificada; `db:push` no aplica |

## Requisitos pendientes

**Para el merge**
- Revisión de Codex sin bloqueantes.
- CI en verde (`verify.yml` corre `npm run verify`).
- Si se cambia cualquier archivo distinto de los informes de revisión antes del merge, repetir `/implementation-review` y `/qa-review`.

**Para cerrar el gate `G-VR01` (fase B, después del merge y del despliegue; acciones del usuario)**
- Despliegue verificado de la versión mergeada (idéntica a la revisada fuera de `docs` y `.claude`).
- `M03a` cerrada, `G-ACTA-META` aprobado, P-04 declarado y acta con el límite de copias de seguridad.
- VD-01: `Origin` coincidente y `303` hacia Meta con la cuenta sintética, sin conceder acceso.
- Alta del dueño y cierre del registro; VR-01 con revocación real `ok` y probe `ok`; cierre sin credencial pendiente.
- Aprobación explícita de `G-VR01`.

## Riesgos

- La revocación con un token de system user real solo se prueba en VR-01; el preflight cubre `debug_token` por lote con el token de la app.
- Escritura ambigua: si también falla la relectura, se revoca y puede quedar guardada una credencial ya inválida (límite declarado; se corrige sola en la próxima llamada).
- Q-02: con cero cuentas delegadas, el dueño verá una tarjeta pendiente sin explicación en el primer recorrido.
- El id completo de la cuenta puede verse en las subpeticiones de Insights del hosting, sin montos (se declara en el paso 16).

## Qué mirar primero

1. `src/modules/integrations/lifecycle.ts` (purga, confirmación, desconexión, reautorización, escritura ambigua).
2. `src/modules/integrations/meta/client.ts` (`postBatchGetJson`) y `revoke.ts`.
3. `src/modules/integrations/meta/oauth.ts` (purga al iniciar, camino `reauth`, caso B).
4. `src/app/(app)/app/integraciones/meta-tarjeta.tsx` y `page.tsx`.
5. `docs/SECURITY.md` y `docs/ARCHITECTURE.md` (solo controles y componentes que pasan de previstos a vigentes).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
