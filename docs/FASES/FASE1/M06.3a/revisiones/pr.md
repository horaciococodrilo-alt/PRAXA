# M06.3a: cifrado de credenciales y cliente acotado de `worker_api`

## Qué cambia

Se incorporan llavero versionado y AES-256-GCM con AAD de empresa, conexión y proveedor. El repositorio de credenciales usa un cliente `pg` `server-only` del rol `praxa_integrations`, con guardas de destino y TLS, errores redactados y recifrado al leer. `pg` pasa a dependencia de producción. Se documenta la excepción acotada y se amplían las pruebas de seguridad, destino y acceso real al proyecto desechable.

## Criterios y pruebas

| Criterio | Prueba |
|---|---|
| CA-21 | T-31–T-34 |
| CA-23, CA-11b | T-03, T-04, T-08, T-34 |
| CA-24 | T-06–T-09, T-34 |
| CA-25 | T-10–T-16, T-35, T-36, T-44 |
| CA-26 | T-17, T-20, T-25, T-26, T-53 |
| CA-27 | T-21 |
| CB-01–CB-06 | T-24, T-27–T-40; `verify`, `test:app` |
| C-01–C-04 | T-01–T-11 |
| C-05–C-06 | T-12–T-16, T-35, T-36, T-41 |
| C-07–C-08 | T-17, T-18, T-21, T-53 |
| C-09–C-10 | T-19, T-20, T-51 |
| C-11–C-12 | T-21, T-28, T-40 |
| C-13–C-14 | T-22–T-24, T-27, T-49 |
| C-15–C-17 | T-25, T-26, T-29, T-30 |
| C-18–C-20 | T-31–T-39, T-41, T-43 |
| C-21–C-23 | T-36, T-42–T-46, T-51, T-52 |
| C-24–C-26 | T-22, T-31, T-47–T-50 |
| C-27 | T-51–T-53 |

## Verificación

- `npm run verify`: exit 0, 197/197 pruebas unitarias/de componentes y build.
- `npm run db:check:test`: exit 0, destino desechable verificado.
- `npm run test:app`: exit 0, 37 pasadas y 7 omitidas ajenas a M06.3a; la suite del rol se ejecutó completa.
- QA exploratorio: 3/3 sondas de destino/TLS pasadas, temporales borrados.
- `npm ci --dry-run --offline`: exit 0. Sin cambios ni archivos nuevos en `supabase/`.

## Riesgos y pendientes

La función SQL de recifrado conserva el límite de estado documentado en `H-E1-37`; el repositorio evita recifrar conexiones desconectadas. Las pruebas app usan el proyecto desechable y su configuración local; CI Linux ejecuta solo `verify` y queda por confirmar en el PR. Después de revisión de Codex y CI, el usuario debe aprobar visiblemente `G-CRYPTO` antes de habilitar M28.2a. No hay despliegue ni migración en esta microfase.

## Cómo revisarlo

Empezar por `src/modules/integrations/crypto/` y `src/modules/integrations/repository/credentials.ts`; seguir con `src/modules/integrations/db/worker-api.ts`, `scripts/lib/sql-target.mjs` y las suites `tests/unit/credential-crypto.test.ts`, `tests/unit/sql-test-target.test.ts` y `tests/app/integrations-worker-api-client.test.ts`. La evidencia completa está en `qa-review-5.md` y en la sesión M06.3a.
