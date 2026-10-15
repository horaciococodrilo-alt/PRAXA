# M16.1 — Plan de implementación

**Estado:** APROBADA

Estados posibles: `BORRADOR` → `APROBADO`. Solo el usuario pasa un plan a `APROBADO`, y solo después de una auditoría APROBABLE.

**Spec base:** `docs/FASES/FASE1/M16.1/spec.md`, con hash de contenido `5617217350930db2d1a54c8a26269b4220efe59f`. Ver la fórmula en `docs/_templates/mf-spec.md`.

**Hash de contenido de este plan.** Se calcula sin la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M16.1/plan.md | git hash-object --stdin
```

## Archivos

Esta lista es el alcance de archivos de la microfase. Los archivos de implementación proceden de II.9 de la ruta; los restantes son los archivos de seguimiento autorizados por las precondiciones 8 y 9 de la Parte II.

| Archivo | Nuevo o modificado | Paso | Autorizado por |
|---|---|---:|---|
| `src/modules/integrations/meta/api.ts` | Nuevo | 5 | II.9.1 |
| `src/modules/integrations/meta/errors.ts` | Nuevo | 5 | II.9.2 |
| `src/modules/integrations/meta/client.ts` | Nuevo | 5 | II.9.2 |
| `src/modules/integrations/meta/tokens.ts` | Nuevo | 5 | II.9.6 |
| `src/modules/integrations/meta/oauth.ts` | Nuevo | 6–7 | II.9.3–5, 7 |
| `src/modules/integrations/meta/outcomes.ts` | Nuevo | 5 | II.9.9; ubicación dentro del módulo |
| `src/modules/integrations/repository/attempts.ts` | Nuevo | 6–7 | II.9.3–4 |
| `src/modules/integrations/repository/connections.ts` | Nuevo | 6–7 | II.9.7 |
| `src/app/api/integraciones/meta/iniciar/route.ts` | Nuevo | 6 | II.9.3 |
| `src/app/api/integraciones/meta/callback/route.ts` | Nuevo | 7 | II.9.4 |
| `src/app/(app)/app/integraciones/page.tsx` | Modificado | 8 | II.9.9 |
| `tests/unit/meta-oauth.test.ts` | Nuevo | 2 | II.9.8 |
| `tests/component/integraciones-meta-aviso.test.tsx` | Nuevo | 3 | II.9.9 |
| `tests/app/meta-oauth.test.ts` | Nuevo | 4 | II.9.8 |
| `docs/SECURITY.md` | Modificado | 9 | II.9.10 |
| `docs/ARCHITECTURE.md` | Modificado | 9 | II.9.10 |
| `.env.example` | Modificado | 9 | II.9.10 |
| `src/lib/env.ts` | Modificado | 9 | II.9.10 |
| `docs/FASES/FASE1/meta_first/entorno.md` | Modificado | 9 | II.9.10 |
| `docs/HALLAZGOS.md` | Modificado | 11 | Seguimiento, precondición 8 de la Parte II |
| `docs/PROJECT_STATE.md` | Modificado solo tras aprobar `G-OAUTH` | 15 | Seguimiento, precondición 8 de la Parte II |
| `docs/FASES/FASE1/meta_first/sesiones/M16.1.md` | Nuevo | 11–15 | Seguimiento, precondición 8 de la Parte II |
| `docs/FASES/FASE1/M16.1/plan.md` y `revisiones/*.md` | Nuevo | 1 | Pipeline, precondición 9 de la Parte II |

## Pasos

Las pruebas nuevas se escriben y se observan fallar **antes** de implementar el comportamiento (TDD). Sus fallos iniciales deben deberse a módulos ausentes o al comportamiento pendiente, nunca a sintaxis incorrecta de la prueba.

Quedan fuera de TDD, porque no son pruebas nuevas de comportamiento: T-24 (guarda de `beforeAll`; se verifica por inspección del patrón y por la corrida con la configuración presente), T-36 (regresión de las guardas `no-privileged-credentials` y `no-secrets-in-tree`), T-38 y T-39 (revisión manual del diff y de la documentación) y T-43 (corrida de cierre). T-37 sí sigue el orden prueba, luego código: las rutas inexistentes lo hacen fallar.

Los casos que dependen de código de un paso posterior no se exigen en verde antes de ese paso. Cada paso de implementación indica qué casos deben quedar en verde y cuáles siguen rojos hasta el paso que los cumple.

En la columna de cobertura, `C-NN` y `T-NN` abrevian `M16.1-C-NN` y `M16.1-T-NN`; los rangos son inclusivos.

| # | Acción | Archivos | Criterios y casos que cubre | Verificación del paso |
|---:|---|---|---|---|
| 1 | Comprobar `git status`, preservar los cambios existentes y crear o retomar la rama `mf/M16.1` (`git switch -c mf/M16.1` si no existe; los cambios sin commitear viajan con la rama). Confirmar que la spec está `APROBADA`, `G-ENTORNO`, P-01 a P-03 y la aprobación visible de la Enmienda M16.1 en los encabezados de la ruta. Revisar las guías pertinentes de Next 16 para Route Handlers, `NextRequest`/`NextResponse` y `searchParams` antes de programar. | Spec y plan M16.1 | Condiciones de entrada; CB-03, CB-04 | Registrar el estado inicial y la rama. Detenerse si la enmienda sigue documentalmente pendiente. No sobrescribir cambios preexistentes. El asistente no hace commit ni push durante la microfase. |
| 2 | Escribir las pruebas unitarias con Meta simulada para configuración, URLs, clasificación, cliente HTTP, repositorios, inicio, callback, tokens, resultados y barreras de URLs. | `tests/unit/meta-oauth.test.ts` | M16.1-T-01, T-02, T-03, T-04, T-05, T-06, T-07, T-08, T-09, T-10, T-11, T-12, T-13, T-14, T-15, T-16, T-17, T-18, T-19, T-20, T-21, T-22, T-40, T-41, T-42 | `npm run test:unit`: rojo esperado por ausencia de módulos o comportamiento; conservar el motivo de fallo. |
| 3 | Escribir la prueba del aviso de integraciones, conservando la comprobación de sesión previa a leer `searchParams`. | `tests/component/integraciones-meta-aviso.test.tsx` | M16.1-T-23; M16.1-C-25; CA-29, CA-34 | `npm run test:component`: rojo esperado por el aviso ausente; sin fallos de sintaxis. |
| 4 | Comprobar primero el destino desechable y escribir la suite de aplicación. La guarda de `beforeAll` debe fallar ante configuración ausente o inválida, sin saltar pruebas; usar el cliente autenticado para las aserciones RLS y el rol de pruebas para `worker_api`. | `tests/app/meta-oauth.test.ts` | M16.1-T-24, T-25, T-26, T-27, T-28, T-29, T-30, T-31, T-32, T-33, T-34, T-35; M16.1-C-26; CB-04, CB-06 | `npm run db:check:test` antes de cualquier prueba remota. Con destino válido, `npm run test:app` da rojo esperado por implementación ausente. No usar `PRAXA_INTEGRATIONS_DB_URL` en la suite. |
| 5 | Implementar `api.ts`, `errors.ts`, `client.ts`, `tokens.ts` y `outcomes.ts`: versión y construcción de URLs únicas, lectura validada de las cuatro `META_*`, errores de texto fijo, clasificación por código Graph, timeout y barreras de URLs, inspección del token y lista cerrada de resultados con su parseo (necesaria para las rutas de los pasos 6 y 7). Canje y `debug_token` usarán exclusivamente `POST` con formulario; `/me` usará bearer en encabezado. | `meta/api.ts`, `errors.ts`, `client.ts`, `tokens.ts`, `outcomes.ts` | M16.1-C-01, C-03, C-05, C-06, C-07, C-17 (parte de `tokens.ts`), C-18, C-25 (parseo y textos), C-31; T-01, T-03, T-05, T-06, T-07 (redacción de errores), T-17 (parte de `tokens.ts`), T-18, T-22, T-41, T-42; CA-09, CA-26, CA-31, CA-32, CA-39 | Dejar en verde los casos listados. Siguen rojos hasta los pasos 6 y 7: T-02 (paso 6), T-04, T-07 (canje), T-17 (mapeo del callback) y T-40 (paso 7). Confirmar que ningún texto libre de Meta, URL o secreto quede en errores, y que un rechazo de URL ocurra antes de `fetch`. |
| 6 | Implementar lectura de conexión bajo RLS, creación de intentos por `worker_api`, `buildAuthorizationUrl` y `POST /iniciar`. Generar `state` y nonce independientes de 32 bytes, guardar solo hashes, emitir la cookie `__Host-`, validar `return_path` antes de la base y distinguir `initial`, `reauth` y pendiente. Exigir `Origin` propio. | Repositorios, `oauth.ts`, ruta `iniciar` | M16.1-C-02, C-08, C-09, C-10, C-11, C-22; T-02, T-08–T-11; CA-01, CA-02b, CA-02c, CA-04, CA-28 | T-02 y T-08–T-11 verdes; inicio sin `Origin` devuelve 403 sin construir K01; una pendiente no crea otro intento. T-32 (suite de aplicación) necesita el callback y se cierra en el paso 7. |
| 7 | Implementar `GET /callback`: construir K01, consumir atómicamente con hash de cookie, borrar cookie y redirigir a URL limpia. Para `initial`, seguir estrictamente consumo → canje (`exchangeCodeForToken`) → inspección → `/me` → operación preparada de credencial cifrada; reintentar solo una vez la misma operación preparada ante transporte/timeout. Para `reauth`, comprobar conexión y generación sin llamar a Meta ni reemplazar credencial. | Repositorios, `oauth.ts`, ruta `callback` | M16.1-C-04, C-12, C-13, C-14, C-15, C-16, C-17 (mapeo del callback), C-19, C-20, C-21, C-23, C-24; T-04, T-07 (canje), T-12–T-16, T-17 (mapeo del callback), T-19–T-21, T-25–T-35, T-40; CA-29, CA-29b, CA-30, CA-33, CA-34, CA-35 | Todo `tests/unit/meta-oauth.test.ts` en verde y la suite de aplicación (`tests/app/meta-oauth.test.ts`) en verde. Confirmar rechazo uniforme, un solo canje ante replay, orden de llamadas, credencial descifrable solo por el camino previsto y ausencia de datos sensibles en respuesta y logs propios. |
| 8 | Implementar el aviso del resultado en `/app/integraciones`, después de `requireAppSession`, con la lista cerrada del paso 5. Mantener “Conectar” deshabilitado. | Página de integraciones | M16.1-C-25 (aviso en la página); T-23; CA-29, CA-34 | `npm run test:component` verde, incluida `app-paginas-sesion.test.tsx`; valores desconocidos o repetidos no muestran aviso. |
| 9 | Actualizar únicamente la documentación y configuración indicadas en el Diseño §11: controles OAuth vigentes, límite de los logs entrantes del hosting, componentes existentes, cuatro nombres `META_*` sin valores, comentario de `env.ts` e inventario de entorno. | Cinco archivos de II.9.10 | M16.1-C-29; T-39; CA-26, CA-30 | Revisar el diff de esos cinco archivos. `SECURITY.md` y `ARCHITECTURE.md` conservan su contrato documental y no reciben TTL, nombres de funciones ni conteos. |
| 10 | Ejecutar la verificación completa y revisar el árbol. | Todos los archivos del corte | M16.1-C-27, C-28, C-30; T-36, T-37, T-38, T-39, T-40, T-41, T-42, T-43; CB-01, CB-02, CB-03, CB-04, CB-06 | `npm run db:check:test`, `npm run test:unit`, `npm run test:component`, `npm run test:app`, `npm run verify`; todos verdes. En `test:app`, cada caso de `meta-oauth.test.ts` se ejecuta; registrar por archivo las omisiones opt-in ajenas y sus motivos. Revisar `git diff --stat`, patrones de secretos y que no haya cambios en migraciones ni pgTAP. |
| 11 | Registrar comandos, resultados, conteos y límites en la sesión. Actualizar los hallazgos existentes según evidencia y dar ID estable, impacto y asignación a los nuevos; dejar explícitas las hipótesis para VR-01 de M16.2. | Sesión M16.1, `HALLAZGOS.md` | CB-02, CB-05; T-38, T-39, T-43 | Evidencia redactada, sin valores de entorno, identificadores reales ni autorización real. No cerrar `G-OAUTH` con una prueba requerida omitida o fallida. |
| 12 | Comprobar que `db:push:test` no aplica: M16.1 no crea migración ni pgTAP. No ejecutarlo. | Ninguno | CB-03, CB-04 | Diff y lista de archivos sin cambios bajo `supabase/migrations/` y `supabase/tests/`. |
| 13 | Comprobar que `db:push` al proyecto app no aplica. No ejecutarlo. | Ninguno | CB-03, CB-04 | Misma comprobación de ausencia de migración; dejarla asentada en la sesión. |
| 14 | Tras las verificaciones locales, reservar al usuario el commit en `mf/M16.1`, el merge y el push, y luego el despliegue activado en Vercel. El asistente no los ejecuta. Verificar el despliegue sin iniciar OAuth real. | Sesión M16.1 | M16.1-C-11, C-25, C-30; D-M16.1-06 | Registrar referencia publicada y estado `Ready` sin datos sensibles. En producción, `GET /api/integraciones/meta/iniciar` da 405, `POST` sin `Origin` da 403 y “Conectar” sigue deshabilitado. |
| 15 | Presentar evidencia y pedir al usuario la aprobación de `G-OAUTH`; solo entonces registrar cierre y siguiente habilitada. | `PROJECT_STATE.md`, sesión M16.1 | CB-01–CB-06; condición para avanzar | `G-OAUTH` aprobado de forma visible, evidencia completa y ningún bloqueo pendiente asignado silenciosamente a M16.1. No iniciar M16.2. |

## Verificación final

Comandos de `package.json` y III.3:

```bash
npm run db:check:test
npm run test:unit
npm run test:component
npm run test:app
npm run verify
```

`npm run verify` incluye lint, typegen, typecheck, pruebas unitarias y de componente, y build; **no** incluye `test:app`. Por eso `npm run test:app` es un gate separado y obligatorio. El build debe mostrar ambas rutas Meta como dinámicas. La revisión final también comprueba que `no-privileged-credentials` y `no-secrets-in-tree` siguen verdes y que el diff no contiene secretos ni identificadores reales.

## Intervenciones del usuario y acciones reservadas

| Paso | Acción reservada | Verificación posterior |
|---|---|---|
| 1 | Aprobación visible de la Enmienda M16.1 en los encabezados de `plan.md` y `spec.md` de la ruta, confirmada por el usuario al planificar. La spec de M16.1 ya está `APROBADA`. P-01 a P-03 y las variables de Production constan como declaradas cumplidas, sin copiar valores. | Encabezados de la ruta coherentes y declaración registrada con su límite: la presencia de variables y la configuración de Meta no se prueban desde el repositorio. La actualización de los encabezados de la ruta la hace el usuario, previa y externa a los archivos de M16.1. |
| 12 | `db:push:test`: ninguna acción del usuario en M16.1. | Ausencia de migraciones y pgTAP nuevos o modificados. |
| 13 | `db:push` al proyecto app: ninguna acción del usuario en M16.1. | Ausencia de migraciones nuevas. |
| 14 | Usuario: merge y push; después, despliegue del piloto. | Referencia publicada, Vercel `Ready` y comprobaciones HTTP/UI del paso 14, sin autorización real. |
| 15 | Usuario: aprobación visible de `G-OAUTH`. | Estado actualizado en `PROJECT_STATE.md` solo después de aprobar. |

## Migraciones

No hay migraciones ni reversión de esquema en M16.1. No se modifican las existentes.

## Riesgos

- Los encabezados de la ruta marcan la Enmienda M16.1 como pendiente de aprobación visible, pese a la confirmación del usuario al planificar. La spec de M16.1 ya está `APROBADA`. La implementación se detiene en el paso 1 hasta que el usuario deje visible esa aprobación.
- El hosting puede registrar `code` y `state` de la petición **entrante** al callback; `SECURITY.md` debe declarar ese límite. Las URLs **salientes** a Meta no llevarán código, tokens ni secreto.
- La aceptación real por Meta del `POST` para canje y `debug_token`, y del bearer para `/me`, queda para VR-01 en M16.2.
- Una pendiente vencida sin purga puede seguir impidiendo otro inicio; su ciclo de vida corresponde a M16.2.

## Qué no se hace

No se autoriza ninguna cuenta real, no se habilita “Conectar”, no se implementan selección de cuenta, purga, revocación, reemplazo de credencial en `reauth`, Insights ni cambios de base. Tampoco se modifican archivos fuera de II.9 y los de seguimiento autorizados.
