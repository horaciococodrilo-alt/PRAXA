# M16.1: OAuth con Facebook Login for Business, probado contra Meta simulada

## Qué cambia y por qué

Implementa la autorización del dueño con Meta y el guardado cifrado de un token de system user, sin ninguna autorización real (T10; la real es VR-01, en M16.2). Agrega las rutas `POST /api/integraciones/meta/iniciar` y `GET /api/integraciones/meta/callback`, un cliente HTTP de Meta con clasificación de errores por código de Graph (CA-39) y redacción, la inspección del token (`debug_token`, `/me`) y la creación de la conexión en `pending_selection`. El callback consume el intento K02 en una sola sentencia antes de llamar a Meta, y ninguna URL de salida lleva secretos, códigos ni tokens. `/app/integraciones` muestra el resultado con una lista cerrada; "Conectar" sigue deshabilitado. Se actualizan `SECURITY.md`, `ARCHITECTURE.md`, `.env.example`, el comentario de `src/lib/env.ts` y `entorno.md`. Sin migraciones.

## Criterios y pruebas

Unitarias en `tests/unit/meta-oauth.test.ts`; de componente en `tests/component/integraciones-meta-aviso.test.tsx`; de aplicación en `tests/app/meta-oauth.test.ts`.

| Criterio | Qué exige | Pruebas |
|---|---|---|
| CA-28, C-02, C-08 | Intento con propósito; diálogo con `config_id`, `response_type=code`, sin `scope`; `reauth` si hay conexión viva | T-02, T-08, T-09, T-25, T-32 |
| CA-01, CA-02b, C-09 | Cookie `__Host-` `HttpOnly`, `Secure`, `SameSite=Lax`; a la base solo hashes | T-08, T-25 |
| CA-04, C-10 | Retorno en la allowlist antes de la base; vida del intento ≤ 9 min | T-08 |
| C-11 | Solo `POST` con `Origin` propio; sin sesión, empresa o configuración no crea intento | T-11 |
| CA-29, CA-03, C-13 | `state` ausente, desconocido, vencido, consumido, de otro actor o empresa, otro nonce → mismo rechazo, sin Meta | T-12, T-13, T-26 a T-31 |
| CA-29b (enmendada), C-21 | `initial` crea la pendiente; `reauth` valida conexión y generación sin canjear | T-21, T-25, T-33 |
| CA-30, C-12, C-16 | Canje en el servidor una vez; redirección limpia con `no-referrer` y cookie borrada | T-07, T-12, T-15, T-19, T-35 |
| CA-31, CA-32, C-17, C-18 | `debug_token` válido, de esta app, con `ads_read`, de system user; expiración real o `null` | T-17, T-18, T-34 |
| CA-33, C-20 | Callback repetido: una conexión, un canje | T-28 |
| CA-34, C-14, C-25 | Cancelación explicada en `/app/integraciones`; lista cerrada de avisos | T-14, T-22, T-23 |
| CA-35, C-19 | `pending_selection`, metadatos nulos, 30 min, credencial cifrada | T-25 |
| CA-39, C-05, C-06 | Clasificación por código, transporte y desconocido; nunca `asset_access` | T-05, T-06 |
| CA-09, CA-26, C-07, C-23 | Errores y registros sin tokens, códigos, secretos ni URLs | T-07, T-15 |
| `H-E1-24`, C-15 | Orden consumo → canje → inspección → `/me` → pendiente | T-16 |
| C-24 | Un reintento con la misma operación ante transporte o timeout | T-20 |
| C-31 (D-M16.1-08) | Canje y `debug_token` por `POST`; `/me` con `Bearer`; barreras antes de `fetch` | T-40, T-42 |
| C-01, C-03, C-04, C-30 | Versión única; configuración validada; `META_*` confinadas a un módulo `server-only` | T-01, T-03, T-04, T-41 |
| CB-06, C-26, C-28 | La suite de aplicación falla, no se salta; `verify` y `test:app` en verde | T-24, T-37, T-43 |

## Verificación

| Comando | Resultado |
|---|---|
| `npm run db:check:test` | Destino verificado (proyecto desechable) |
| `npm run verify` | exit 0: lint, typegen, typecheck, 23 archivos y 512 pruebas, build con las dos rutas Meta dinámicas (510 en las revisiones; +2 por las correcciones de abajo) |
| `npm run test:app` | exit 0: 8 archivos, 48 pasadas y 7 omitidas. `meta-oauth` 10/10 sin omitidas. Las omitidas son el opt-in de correo de `email-flows` (3) y los bloques `NO EJECUTADA` de `concurrency`, `integrations-data-api`, `isolation` y `onboarding` (1 cada uno), admitidas por CB-06 precisada |
| QA exploratoria | 100 casos de borde y negativos (78 unitarios, 18 de componente, 4 contra la base desechable), todos en verde y borrados después |

Detalle en `docs/FASES/FASE1/meta_first/sesiones/M16.1.md`, `revisiones/implementation-review-1.md`, `revisiones/implementation-review-2.md` y `revisiones/qa-review-1.md`.

## Correcciones después de las revisiones

Las revisiones de implementación (1 y 2, APROBABLE) y la de QA (LISTO PARA PR) se hicieron sobre `72ab922`. Un `/code-review` posterior trajo tres correcciones, cada una de las dos de comportamiento con su prueba unitaria:

1. El inicio exige que `META_REDIRECT_URI` sea del mismo origen que la petición. La cookie `__Host-` y la sesión son del host, así que un callback en otro host fallaba siempre, después de autorizar en Meta. Ahora responde `error` sin crear intento.
2. Un fallo inesperado después del consumo se registra en su etapa (`reauth` o `configuracion`) y no como `consumo`.
3. `tokens.ts` reutiliza el esquema de permisos del contrato K04 y quita un chequeo que nunca podía fallar.

Después de las correcciones, `verify` y `test:app` volvieron a pasar. Queda sin aplicar, a decidir antes de VR-01, agregar `method=GET` al `POST` de `debug_token` (`H-E1-116`).

## Requisitos para el merge

- Revisión de Codex sin bloqueantes.
- CI (`Verify`) en verde. La CI corre solo `npm run verify`; `test:app` se corrió localmente (arriba).

## Requisitos para el gate `G-OAUTH` (usuario)

1. Merge, push y despliegue en Vercel (`Ready`).
2. En producción, sin autorización real: `GET /api/integraciones/meta/iniciar` → 405, `POST` sin `Origin` → 403 y "Conectar" deshabilitado. Registrar en la sesión, redactado (guion en `qa-review-1.md`).
3. Confirmar que el asistente actualizó, a pedido del usuario, los encabezados de la ruta con la aprobación de la Enmienda M16.1.
4. Aprobar `G-OAUTH` de forma visible; después se actualiza `PROJECT_STATE.md`.

`db:push` y `db:push:test` no aplican: no hay migraciones.

## Riesgos

- **Exposición antes de M16.2.** Con las `META_*` en Production, el flujo es alcanzable con un `POST` del propio origen. La contención es operativa: ninguna autorización real hasta `M16.2` y `G-ACTA-META`, más "Conectar" deshabilitado.
- **Hipótesis sin verificar con Meta real** (`H-E1-116`, `H-E1-117`): `POST` en el canje y en `debug_token`, `Bearer` en `/me`, `redirect_uri` en el canje, `expires_at = 0`, parámetros de la cancelación. Se verifican en VR-01 (M16.2).
- **Sin recuperación de tokens huérfanos** (`H-E1-114`): si falla algo después de que el dueño autorizó, no hay revocación hasta M16.2.
- **Logs del hosting** (`H-E1-115`): Vercel puede registrar `code` y `state` de la petición entrante al callback. Límite declarado en `SECURITY.md` §12.

## Qué mirar primero

1. `src/modules/integrations/meta/oauth.ts`: orquestación de `iniciar` y `callback`, orden de llamadas y mapeo a resultados.
2. `src/modules/integrations/meta/client.ts` y `api.ts`: barreras de URLs de salida y configuración.
3. `src/modules/integrations/meta/errors.ts`: tabla CA-39 y textos fijos.
4. `src/modules/integrations/repository/attempts.ts` y `connections.ts`.
5. `tests/app/meta-oauth.test.ts`: recorrido contra la base desechable.
6. `docs/SECURITY.md` (INV-06, §4, §7, §12).
