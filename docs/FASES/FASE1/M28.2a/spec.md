# M28.2a — Spec de la microfase

**Estado:** APROBADA

Estados posibles: `BORRADOR` → `APROBADA`. Solo el usuario pasa una spec a `APROBADA`, después de una auditoría APROBABLE.

**Hash de contenido.** Se calcula excluyendo la línea de estado, como en la plantilla:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M28.2a/spec.md | git hash-object --stdin
```

**Entrada:** `G-CRYPTO` aprobado en `docs/PROJECT_STATE.md:20`; M28.2a habilitada, sin empezar. No hay dependencia pendiente. Q-01 a Q-03 quedaron resueltas en el grill confirmado por el usuario el 2026-10-03. El proveedor SMTP se elige en II.7, paso 6; no es una pregunta pendiente de diseño. Este documento no aprueba `G-ENTORNO` ni ejecuta acciones de cuenta.

## Fuentes

- `AGENTS.md`: jerarquía, contrato de ejecución y documental, seguridad operativa y condiciones de parada.
- `docs/_templates/mf-spec.md`: estructura de este documento.
- `docs/PROJECT_STATE.md:19` (`G-DB-META`), `docs/PROJECT_STATE.md:20` (`G-CRYPTO`) y `docs/PROJECT_STATE.md:24` (M28.2a habilitada).
- `docs/FASES/FASE1/meta_first/plan.md`: Parte I, Enmienda 1, mapa y gates, ficha M28.2a (líneas 225–238); Parte II, II.7 completa (pasos 1–9, incluido 8b, y aclaraciones autorizadas en el grill del 2026-10-03); III.2, III.3 y III.9. II.7 cubre exclusivamente **M28.2a**.
- `docs/FASES/FASE1/meta_first/spec.md`: DEC-03, DEC-07, DEC-08, DEC-18; P-06; secciones 5, 5b y 13b; CB-01 a CB-06. La ficha no asigna ningún CA numerado: sus tres condiciones de aceptación se conservan abajo sin inventar IDs de la ruta.
- `docs/HALLAZGOS.md:357`: H-E1-08; `:395`: H-E1-23 como antecedente sobre suites opt-in.
- `docs/SECURITY.md`: secciones 2, 3, 4, 6, 11 y 12. `docs/ARCHITECTURE.md`: esquemas, roles y caminos A y B.
- Evidencia previa: `docs/FASES/FASE1/meta_first/sesiones/M06.1a-M06.2a.md` y `docs/FASES/FASE1/meta_first/sesiones/M06.3a.md`, en particular cierre de G-CRYPTO (línea 467) y última verificación local (línea 683, dentro de la sección que comienza en 656). Las entradas históricas pendientes no sustituyen el estado vigente de PROJECT_STATE. El cierre de G-CRYPTO fue decisión del usuario, sin revisión de implementación ni QA final sobre el HEAD cerrado; se conserva esa limitación.
- Código y configuración: archivos de la tabla de contexto, `src/lib/supabase/{client,server}.ts`, `src/modules/identity/session.ts`, `src/modules/company/service.ts`, `src/modules/onboarding/repository.ts`, `scripts/lib/{env,target}.mjs`, `supabase/migrations/0012_integrations.sql`, `package.json`, `vitest.config.mts` y `tests/app/email-flows.test.ts`.
- Commit base: `d3db802017b8367edba40e0a6ca9641167edb771`. Árbol limpio al comenzar la expansión, 2026-10-03. Referencias de línea recontrastadas al corregir A-03 sobre `7b2a30f96f12284b5339b7591a8ce16d29a26555`; la auditoría preexistente sin seguimiento se preserva.
- Fuentes oficiales consultadas el 2026-10-03: [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [redirecciones](https://supabase.com/docs/guides/auth/redirect-urls), [uso de Vercel](https://vercel.com/docs/limits/fair-use-guidelines), [changelog](https://supabase.com/changelog), cambios de [plantillas de email](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier) y [exposición de tablas](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically). El índice `.md` no se pudo obtener por tipo de contenido; se consultó el HTML y los cambios pertinentes.

## Objetivo

Tener una URL pública estable, con la base, la autenticación y el email funcionando, antes de registrar la redirección de Meta (DEC-07, DEC-08, DEC-18). Corte de hasta 8 horas de implementación; las esperas de cuentas, DNS y decisiones quedan como intervenciones pendientes.

## Alcance

1. Guiar al usuario para crear el proyecto Vercel conectado al repositorio y fijar el dominio HTTPS.
2. Documentar y verificar, sin valores, las variables requeridas por II.7 y las exclusiones del despliegue. Aplicar D-M28.2a-01 y declarar la limitación de la verificación por presencia.
3. Preparar la comprobación de destino y acompañar la aplicación por el usuario de las migraciones pendientes hasta `0012` en `app`, con la evidencia previa del proyecto de pruebas. El usuario fija la contraseña de `praxa_integrations` en `app`.
4. Verificar con evidencia redactada que `worker_api` y `private` no están expuestos por la Data API y que Auth remoto usa el dominio del piloto.
5. Guiar la configuración de SMTP propio con SPF y DKIM; verificar confirmación de una dirección externa al equipo, login, cierre de registro y recuperación completa con registro cerrado.
6. Verificar `/app/integraciones` por HTTPS con la sesión de prueba y la precondición de empresa descrita abajo, bajo la excepción manual de D-M28.2a-03.
7. Ejecutar `npm run verify` durante la implementación, completar el checklist y documentar entorno y evidencia. Solo entonces presentar `G-ENTORNO` para aprobación; habilita M16.1, sin iniciarla automáticamente.

## Fuera de alcance

- Código nuevo, cambios de Auth, nuevas pruebas automatizadas, migraciones nuevas o modificaciones de las existentes, cambios de dependencias o de `supabase/config.toml`.
- Conectar Meta, registrar su callback en la cuenta, resolver P-01 a P-05, ejecutar VR-01, sincronizar Insights o implementar chat. La cuenta del dueño y sus datos corresponden a M16.2, después de G-ACTA-META.
- Abrir onboarding público permanente, implementar un worker, usar el proyecto desechable como piloto o cargar credenciales administrativas en Vercel.
- Ensayar suites automatizadas contra `app`, modificar políticas/RLS o desactivar TLS para hacer funcionar el despliegue. Cualquier reparación de código exige detenerse y asignar el fallo antes de ampliar el alcance.

## Contexto verificado en el código

| Qué | Dónde (archivo:línea) | Qué implica para esta microfase |
|---|---|---|
| Node requerido y comandos existentes | `package.json:6`, `package.json:14`, `package.json:26` | Node 24; `verify` encadena lint, typegen, typecheck, unit/component y build. |
| Proyectos separados de Vitest | `vitest.config.mts:29`, `vitest.config.mts:37`, `vitest.config.mts:50`; `package.json:14`, `package.json:17`, `package.json:18` | `app` no se ejecuta con `verify`; pgTAP tiene script independiente. |
| Variables públicas se leen con referencias estáticas; ausencia no rompe necesariamente el build | `src/lib/env.ts:33`, `src/lib/env.ts:59` | Un build exitoso no acredita Auth; `getSiteUrl(): string` cae a localhost si falta la variable. |
| Registro manda callback con destino onboarding | `src/app/(auth)/signup/page.tsx:32`, `src/app/(auth)/signup/page.tsx:36` | `signUp` usa `/auth/callback?next=%2Fonboarding`; la confirmación debe llegar y abrirse. |
| Recuperación manda callback distinto | `src/app/(auth)/forgot-password/page.tsx:26` | `resetPasswordForEmail` usa `/auth/callback?next=%2Freset-password`. |
| Cambio de contraseña requiere sesión; luego cierra sesión | `src/app/(auth)/reset-password/page.tsx:29`, `:41`, `:50` | Ocho caracteres como mínimo, confirmación coincidente, regreso a `/login?notice=password-updated`. |
| Login real con correo y contraseña | `src/app/(auth)/login/page.tsx:31` | Verificar sesión nueva, no solo una sesión persistente del callback. |
| Callback ya admite PKCE y OTP | `src/app/auth/callback/route.ts:18`, `src/app/auth/callback/route.ts:28`, `src/app/auth/callback/route.ts:34`, `src/app/auth/callback/route.ts:40`, `src/app/auth/callback/route.ts:46` | `GET(NextRequest)`: `exchangeCodeForSession` o `verifyOtp`; errores `link-invalid`, `link-missing-params`, `server-error` hacia `/verify-email`. No requiere nueva ruta. |
| Sesión y empresa protegen el shell | `src/app/(app)/app/layout.tsx:32`, `src/app/(app)/app/layout.tsx:36`, `src/modules/company/service.ts:29`, `src/modules/identity/session.ts:21` | Sin sesión va al login; sin empresa va a onboarding. Identidad por `getClaims`, empresa bajo RLS. |
| Integraciones es una pantalla vacía | `src/app/(app)/app/integraciones/page.tsx:11`, `:25`; `src/modules/onboarding/repository.ts:140` | No hace llamadas Meta ni ejercita `worker_api`; el contexto activo puede ser nulo. No confundir esta pantalla con un conector funcionando. |
| Configuración local no acredita dashboard remoto | `supabase/config.toml:7`, `:24`, `:169`, `:173`, `:186`, `:238` | Verificar remotamente exposición, Site URL, redirecciones, confirmación y cierre de registro. |
| Migración existente crea esquema, rol sin contraseña y tablas | `supabase/migrations/0012_integrations.sql:108`, `:201`, `:277`, `:359`, `:407` | Reutilizar `worker_api`, `praxa_integrations`, `public.integration_connections`, `public.oauth_attempts`, `private.integration_credentials`. No editar SQL. |
| `db:check` valida coherencia de referencias | `scripts/check-target.mjs:15`, `scripts/lib/target.mjs:194` | No prueba conexión, contraseña, SQL aplicado ni acceso del rol. Redactar referencias impresas. |
| Push aplica todas las pendientes y registra historial | `scripts/db-push.mjs:9`, `:27`, `:41` | El usuario usa el wrapper; no pegar `0012` en SQL Editor ni asumir que solo aplicará ese archivo. |
| Contrato estricto de URL del rol | `src/modules/integrations/db/worker-api.ts:108`; `src/modules/integrations/db/connection-url.mjs:15`, `:68`, `:80`, `:86`, `:99`, `:110` | Usuario `praxa_integrations.<ref>`, shared transaction pooler en 6543, contraseña codificada, base explícita y ninguna query ni fragmento. TLS lo configura el módulo. |
| Llavero concreto | `src/modules/integrations/crypto/keyring.ts:43` | `parseCredentialKeyring(keys, current): CredentialKeyring`: pares separados por coma, versión positiva sin duplicados, base64 canónico de 32 bytes, versión actual presente. |
| Pruebas de correo no leen la casilla | `tests/app/email-flows.test.ts:15`, `:26`, `:41`, `:54` | Opt-in `SUPABASE_TEST_EMAIL_FLOWS`; no reemplaza recepción/apertura manual. Un retorno por rate limit no acredita entregabilidad. |

## Diseño concreto

### Secuencia y configuración

Antes de ejecutar: comprobar Git, aprobación de esta spec y dependencias; aplicar D-M28.2a-01 a D-M28.2a-03. La confirmación del grill autoriza la edición documental; no aprueba la spec ni inicia la microfase. El asistente no inspecciona `.env.local`. Los scripts existentes pueden consumir configuración durante su uso autorizado; sus valores nunca se copian a la evidencia.

**II.7, paso 1.** El usuario crea/conecta Vercel y configura el origen estable elegido en D-M28.2a-02. La compra del dominio y su DNS fueron informados por el usuario; el funcionamiento se verifica durante la implementación. Usar el proyecto Supabase `app`, no el desechable. Mantener Node compatible con `package.json` (24). Configurar antes del build las variables públicas; después de cambiarlas el usuario vuelve a desplegar. No crear `vercel.json` ni alterar la aplicación para este corte.

**II.7, paso 2.** Inventario por nombre, destino y estado (`pendiente`, `configurada por el usuario`, `verificada`), nunca por valor. Para G-ENTORNO se verifican por presencia, lo que no acredita validez criptográfica del llavero ni conectividad efectiva del rol en Vercel. El usuario genera un llavero nuevo para el piloto, distinto del de pruebas, y lo declara sin mostrar secretos. Los recorridos manuales de Auth siguen siendo obligatorios:

| Grupo | Variables | Destino y condición |
|---|---|---|
| Auth público | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` | Vercel del piloto; URL y clave del mismo proyecto `app`. Site URL es el origen HTTPS fijo sin barra final: el código concatena `/auth/callback`. |
| Credenciales del conector | `PRAXA_CREDENTIAL_KEYS`, `PRAXA_CREDENTIAL_KEY_CURRENT`, `PRAXA_INTEGRATIONS_DB_URL` | Solo servidor Vercel; llavero nuevo y distinto del de pruebas. Verificación por presencia con la limitación anterior. Contratos exactos en la tabla de contexto. El usuario compara privadamente la referencia de la URL del rol con `app`; `db:check` no comprueba esta variable de runtime. |
| Meta | `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_CONFIG_ID` | Solo servidor; cargar antes de M16.1 según II.7.2 actualizado y D-M28.2a-01. No exigidas para G-ENTORNO; no inventar valores ni dar por registrado el callback. |
| Modelo | `DEEPINFRA_API_KEY` | Solo servidor; cargar en M25a.2 según II.7.2 actualizado y III.2. No exigida para G-ENTORNO. |
| Excluidas | `SUPABASE_DB_URL`, todas las `SUPABASE_TEST_*`, `PRAXA_INTEGRATIONS_TEST_DB_URL` | Nunca Vercel. La URL administrativa se usa solo por el usuario para migrar; variables de pruebas solo en el entorno desechable. No sustituir el rol por `service_role`. |

**II.7, paso 3.** Consultar evidencia de `0012` en pruebas y de G-CRYPTO. El usuario ejecuta `npm run db:check`; si el destino no coincide con `app`, detener. Puede inspeccionar pendientes con el script existente `npm run db:preview` antes de `npm run db:push`, ambos sobre `app` y ejecutados por él. Registrar nombres de migraciones y resultado redactado, sin cadenas de conexión. Si aparecen pendientes inesperadas o historial inconsistente, no reparar historial ni aplicar SQL manualmente. El usuario fija fuera del repositorio la contraseña del rol y carga la URL conforme al contrato existente. No acreditar conectividad del rol por un build ni por `db:check`.

**II.7, pasos 4 y 5.** El usuario comprueba en el dashboard remoto que `worker_api` y `private` quedan fuera de los esquemas expuestos. Configura Site URL con el origen fijo y las redirecciones exactas que emite el código: origen + `/auth/callback?next=%2Fonboarding` y origen + `/auth/callback?next=%2Freset-password`. Revisar el comportamiento efectivo de ambos enlaces; no agregar comodines generales de previews como solución automática. Mantener confirmación de email habilitada. La guía oficial recomienda rutas exactas y advierte revisar las plantillas cuando se usa `redirectTo`. [Redirecciones de Supabase](https://supabase.com/docs/guides/auth/redirect-urls).

**II.7, paso 6.** El usuario elige/contrata el proveedor SMTP en este paso, verifica con SPF y DKIM el dominio de envío elegido en D-M28.2a-02 y configura host, puerto, remitente, usuario y contraseña en Supabase Auth. DMARC se recomienda por decisión del usuario, sin añadirlo como requisito de G-ENTORNO. Si la entregabilidad externa falla por la extensión, registrar el hallazgo antes de M16.1 con evidencia; no atribuir la causa a la extensión sin diagnóstico. La falta de entregabilidad impide acreditar el caso obligatorio. Solo se registra presencia y verificación. La documentación confirma que el SMTP por defecto restringe destinatarios al equipo y actualmente limita a dos mensajes por hora; no sirve como evidencia para P-06. [SMTP de Supabase](https://supabase.com/docs/guides/auth/auth-smtp). Los cambios de plantillas de nuevos proyectos Free con SMTP predeterminado no justifican omitir SMTP propio. [Cambio de plantillas](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).

**II.7, pasos 7, 8 y 8b, bajo D-M28.2a-03.** Abrir el registro solo durante la comprobación exigida en este corte. Usar una casilla controlada por el usuario que no sea miembro del equipo Supabase, no la cuenta del dueño. Registrar el alta, recibir y abrir confirmación, cerrar sesión e iniciar una nueva. Cerrar registro inmediatamente y comprobar con otra dirección no registrada que Auth rechaza el alta. No alcanza con ocultar `/signup`. Con el registro cerrado, pedir recuperación para la cuenta confirmada, recibir y abrir el enlace en el navegador del flujo, cambiar contraseña, comprobar regreso al login y entrar con la nueva. No registrar contraseñas, correo completo, enlaces de email, cookies ni parámetros de callback.

Para la comprobación HTTPS de Integraciones, la cuenta debe tener una empresa creada mediante el onboarding existente, con datos sintéticos. No hace falta activar un contexto para que la página renderice. Esta preparación está autorizada por la excepción acotada de II.7 y D-M28.2a-03: no ejecutar fixtures ni asignar membresías manualmente en `app`. Exigir la pantalla autenticada con su estado vacío; una redirección a login/onboarding, un 404 o un 500 no acreditan el resultado positivo. No conectar Meta. La cuenta y la empresa sintética se conservan, se documentan sin datos personales y se eliminan con CA-67 al cierre del piloto; no se borran al terminar esta comprobación.

Si el usuario cambia de marca, la migración de dominio debe completarse antes del alta del dueño en M16.2. Se registra la condición acordada; no se inicia una migración ni se altera el alcance actual.

### Evidencia de cierre y gate

**II.7, paso 9.** `entorno.md` será la fuente de configuración operativa sin valores: proveedor y entorno elegidos, checklist por pasos, inventario de nombres de variables, estado de migraciones, configuración de Auth/SMTP y referencias a capturas redactadas. Las capturas deberán ocultar secretos, identificadores de proyectos/cuentas, correos y URLs con tokens antes de incorporarse. No fijar nombres de imágenes hasta contar con capturas; sus rutas concretas se listarán en el plan de implementación bajo el paso 9.

La sesión registra commit verificado, fecha, operador, comandos exactos, códigos de salida, resultados observados, omitidos y límites. Cada caso manual tendrá resultado `PASA`, `FALLA` o `NO EJECUTADO` y referencia a evidencia redactada. El usuario realiza las acciones de cuenta y email; el asistente verifica evidencia, sin afirmar que observó un paso que solo fue informado.

`G-ENTORNO` requiere todos los criterios y pruebas obligatorios, D-M28.2a-01 a D-M28.2a-03 aplicadas (incluida la elección/configuración de SMTP en el paso 6), H-E1-08 verificado y aprobación visible del usuario. No equivale a VR-01, G-ACTA-META ni a prueba del cliente SQL del rol en Vercel. Ningún resultado se presupone por haber escrito esta spec.

## Archivos previstos

La expansión creó este `spec.md`; el grill actualizó este documento y II.7 de `meta_first/plan.md`. La corrección solicitada de A-01 alinea DEC-18 en `meta_first/spec.md` con la excepción ya aprobada, junto con su intervención de Auth y la referencia en CB-04. La tabla corresponde a la futura implementación:

| Archivo | Nuevo o modificado | Para qué | Autorizado por |
|---|---|---|---|
| `docs/FASES/FASE1/meta_first/entorno.md` | Nuevo | Checklist, configuración sin valores y evidencia gráfica redactada referenciada | II.7, paso 9; evidencia de cierre de Parte I |
| `docs/FASES/FASE1/meta_first/sesiones/M28.2a.md` | Nuevo | Comandos y resultados reales, limitaciones y aprobación | III.3; AGENTS, protocolo 6 y contrato documental |
| `docs/PROJECT_STATE.md` | Modificado solo al cambiar estado/gate | Estado operativo y siguiente habilitada | AGENTS, contrato documental; cierre II.7 |
| `docs/HALLAZGOS.md` | Modificado al verificar H-E1-08 o registrar hallazgos | Estado/asignación con evidencia enlazada | AGENTS, protocolo 9; II.7, paso 7 |

Ningún archivo de producto está autorizado por II.7. SECURITY y ARCHITECTURE se consultan; verificar configuración remota no cambia por sí mismo el modelo ya documentado. Si fuera necesario cambiar una propiedad transversal, marcar **REQUIERE CAMBIO EN LA RUTA** antes de editar esos documentos.

## Criterios de aceptación

### Heredados de la ruta

| ID de la ruta | Qué exige (resumen fiel) |
|---|---|
| Ficha M28.2a, aceptación 1 (sin CA numerado) | Una dirección ajena al equipo Supabase recibe el email de confirmación de un registro de prueba. |
| Ficha M28.2a, aceptación 2 (sin CA numerado) | El login funciona sobre el dominio del piloto. |
| Ficha M28.2a, aceptación 3 (sin CA numerado) | `/app/integraciones` responde por HTTPS. |

Además rigen DEC-07, DEC-08, DEC-18, P-06 y CB-01 a CB-06; no se presentan como CA nuevos ni como criterios de OAuth/chat.

### Operativos de esta microfase

| ID | Criterio verificable | Traza a (CA, DEC o trampa de la ruta) |
|---|---|---|
| M28.2a-C-01 | Proyecto Vercel y origen fijo HTTPS configurados; Integraciones renderiza autenticada sin error con empresa sintética autorizada por D-M28.2a-03. | Aceptación 3; DEC-07; II.7.1 |
| M28.2a-C-02 | Inventario del gate completo según D-M28.2a-01, verificado por presencia con la limitación declarada; llavero nuevo distinto del de pruebas confirmado por el usuario, variables públicas coherentes con `app`, servidor sin credenciales administrativas ni de pruebas. | DEC-03/07; II.7.2; CB-02 |
| M28.2a-C-03 | Destino `app` comprobado, historial incluye `0012` aplicada por el usuario y contraseña del rol configurada; no se cambió ninguna migración. | DEC-07; II.7.3; CB-03 |
| M28.2a-C-04 | Captura redactada demuestra que ni `worker_api` ni `private` están expuestos en la Data API del proyecto remoto. Si cualquiera aparece expuesto, el criterio falla. | DEC-03; II.7.4 |
| M28.2a-C-05 | Site URL y ambos callbacks de Auth usan el origen fijo, sin retorno a localhost ni pérdida del destino de recuperación. | DEC-07/18; II.7.5 y 8b |
| M28.2a-C-06 | SMTP propio activo, SPF y DKIM verificados, confirmación recibida y abierta por dirección externa al equipo. | Aceptación 1; DEC-18; P-06; H-E1-08 |
| M28.2a-C-07 | Cuenta confirmada inicia sesión nueva en el dominio; cuenta aún sin confirmar no inicia sesión. | Aceptación 2; DEC-18 |
| M28.2a-C-08 | Registro público cerrado tras la comprobación; intento con dirección nueva rechazado. | DEC-18; II.7.8 |
| M28.2a-C-09 | Con registro cerrado se completa pedido, recepción, enlace y cambio de contraseña; nueva contraseña permite login, anterior se rechaza. | P-06; II.7.8b |
| M28.2a-C-10 | `npm run verify` termina exitoso y evidencia/checklist son completos, redactados y distinguen no ejecutado de aprobado. | II.7.9; III.3; CB-01/02/05/06 |

## Casos de prueba

Los casos manuales no tienen script npm: se ejecutan en navegador/dashboard por el usuario y se documentan. Son configuración, sin ciclo TDD de código nuevo. La ausencia de infraestructura no se cuenta como RED ni como PASS.

| ID | Criterios | Tipo (unit, component, app, pgTAP, manual) | Comando | Resultado esperado | ¿Falla sin la implementación? |
|---|---|---|---|---|---|
| M28.2a-T-01 | C-01 | manual | Sin comando npm; dominio + `/app/integraciones` | HTTPS válido; sin sesión exige login; con sesión y empresa autorizada renderiza Integraciones. Sin empresa redirige a onboarding y aún no acredita positivo. | No aplica TDD; sin despliegue/configuración no acredita. |
| M28.2a-T-02 | C-02 | manual | Sin comando npm; checklist Vercel | Presencia por nombre, correspondencia privada con `app`, exclusiones ausentes; llavero nuevo y distinto del de pruebas declarado por el usuario; límite de verificación por presencia registrado; Meta/DeepInfra no se exigen en este gate. | No aplica TDD; configuración incompleta falla checklist. |
| M28.2a-T-03 | C-03 | manual | Usuario: `npm run db:check`, `npm run db:push`; opcional antes del push: `npm run db:preview` | Destino correcto e historial aplicado hasta `0012`, contraseña establecida. Ante destino inválido se detiene, sin forzarlo ni cambiar variables para provocar fallos. | No aplica TDD; check aislado no acredita aplicación. |
| M28.2a-T-04 | C-04 | manual | Sin comando npm; Data API remota | Lista de esquemas no incluye `worker_api` ni `private`; si aparece cualquiera de los dos, FAIL, no invocar RPC como rodeo. | No aplica TDD; config local no basta. |
| M28.2a-T-05 | C-05 | manual | Sin comando npm; abrir enlaces de T-06 y T-08 | Ambos aterrizan en el dominio y destino correctos, sin errores del callback. | No aplica TDD; callbacks mal configurados fallan. |
| M28.2a-T-06 | C-06, C-07 | manual | Sin comando npm; `/signup`, casilla externa y `/login` | SMTP/SPF/DKIM verificados; antes de confirmar no permite login; email llega, enlace confirma, sesión nueva funciona. Dirección del equipo no es caso válido. | No aplica TDD; sin SMTP externo no se acredita P-06. |
| M28.2a-T-07 | C-08 | manual | Sin comando npm; cerrar registro y repetir `/signup` con dirección nueva | Rechazo de Auth; no se crea una cuenta utilizable. | No aplica TDD; con registro abierto falla. |
| M28.2a-T-08 | C-09 | manual | Sin comando npm; `/forgot-password` → email → `/reset-password` → `/login` | Registro permanece cerrado, cambio completo, logout y login nuevo exitoso; contraseña anterior rechazada. | No aplica TDD; mensaje de envío solo no acredita recuperación. |
| M28.2a-T-09 | C-05, C-09 | manual | Sin comando npm; `/reset-password` sin sesión y callback sin parámetros | No cambia contraseña sin sesión; callback incompleto va a `/verify-email` con `link-missing-params`. No se fabrican tokens ni se exponen enlaces reales. | No aplica TDD; verifica comportamiento existente en el entorno. |
| M28.2a-T-10 | C-10 | unit, component | `npm run verify` | Lint, typegen, typecheck, suites unit/component y build completos, exit 0; no cuenta suites no ejecutadas. | No aplica TDD; puede pasar antes de configurar Vercel, por eso no reemplaza manuales. |
| M28.2a-T-11 | C-02, C-03, C-10 | manual | `git diff --check` y revisión de checklist/diff | Solo archivos previstos; evidencia sin valores sensibles; comandos y resultados reales; migraciones intactas; preguntas resueltas antes de cerrar. | No aplica TDD; revisión documental. |

## Verificación

Obligatorio para implementar, según III.3: `npm run verify` y checklist manual completo, incluido registro externo. II.7 añade `npm run db:check` y `npm run db:push` ejecutados por el usuario. No ejecutar esos comandos durante esta expansión documental.

`verify` usa los scripts reales de `package.json`: `lint`, `typegen`, `typecheck`, `test` (unit/component) y `build`. No corre `test:app` ni `test:policies`. III.3 no exige esas suites para M28.2a; no se añade `test:app` por asociación temática con email. Si se solicita una comprobación adicional, solo contra el proyecto desechable y con alcance explícito. Las pruebas opt-in de email no demuestran que se recibió/abrió un correo ni sustituyen P-06.

Por CB-06, cualquier caso obligatorio omitido por falta de casilla, dominio, SMTP, configuración o autorización mantiene G-ENTORNO pendiente. Capturar códigos de salida y resultados, nunca deducirlos de archivos existentes ni de una corrida anterior. No mostrar salida cruda con referencias de proyecto de `db:check` o URLs de error de herramientas externas.

Aplicar III.9: detener ante contradicción, archivo fuera de alcance, migración que deba alterarse, intervención del usuario pendiente, dependencia abierta, dato real sin G-ACTA-META, prerrequisito incumplido, prueba requerida omitida, fallo de aislamiento/privilegios/guardas o dos iteraciones sin converger. Diagnosticar y asignar el fallo; no improvisar una corrección en este corte.

## Intervenciones del usuario y acciones reservadas

| Paso | Qué hace el usuario | Cómo se verifica después |
|---|---|---|
| Antes de ejecutar | Aprueba la spec tras auditoría; decisiones del grill ya confirmadas | Decisiones registradas y aprobación visible |
| II.7.1–2 | Crea Vercel, configura el dominio elegido, DNS y variables, genera llavero nuevo distinto del de pruebas; despliega | HTTPS y checklist de nombres, sin valores |
| II.7.3 | Verifica destino, aplica migraciones con los scripts indicados y fija contraseña del rol en `app` | Resultados redactados e historial remoto |
| II.7.4–5 | Verifica exposición y configura Auth remoto | Capturas redactadas y callbacks observados |
| II.7.6 | Elige/contrata/configura SMTP y SPF/DKIM; considera la recomendación DMARC | Estado verificado del dominio y configuración sin credenciales |
| II.7.7–8b | Maneja casilla externa, alta de prueba autorizada, cierre de registro y recuperación | T-06 a T-09; nunca entrega contraseña o enlace en chat |
| Fin | Aprueba G-ENTORNO con evidencia completa | PROJECT_STATE enlaza sesión; M16.1 habilitada |
| Reservadas | Push de Git, despliegue, `npm run db:push` a `app` y `npm run db:push:test` | Solo el usuario los ejecuta; el último no es necesario salvo intervención posterior expresamente acordada |

El asistente guía, verifica y documenta; no ejecuta acciones de cuenta. No hay autorización de commit, publicación ni ejecución de la microfase por el solo pedido de expandir su spec.

## Trampas y riesgos

- Probar con una casilla del equipo puede pasar usando SMTP por defecto y dejar H-E1-08 intacto. Se requiere dirección externa y recepción efectiva.
- El mensaje de `/forgot-password` es deliberadamente genérico: no prueba ni existencia de cuenta ni llegada del correo. Abrir el enlace, cambiar y volver a iniciar sesión son obligatorios.
- Un build verde puede existir sin variables de Auth; el código las lee de forma perezosa. Cambiar una variable pública requiere reconstruir el despliegue usado para verificar.
- `supabase/config.toml` local no configura el Auth remoto; tampoco acredita por sí mismo los esquemas expuestos.
- `db:check` no conecta. `db:push` aplica todas las pendientes y su historial evita reaplicar; no reemplazarlo por pegar SQL.
- La pantalla vacía de Integraciones no prueba credenciales SQL ni llamadas externas. No agregar un endpoint de diagnóstico o consultar credenciales para simular esa evidencia.
- DEC-08 ya decide Hobby con riesgo declarado: no reabrir esa decisión automáticamente. La guía vigente sigue restringiendo Hobby a uso personal no comercial; una reconsideración corresponde al usuario. [Vercel Fair Use](https://vercel.com/docs/limits/fair-use-guidelines). La disponibilidad actual de la prueba Pro mencionada por la ruta queda como hipótesis, no como beneficio garantizado.
- El cambio de exposición automática de tablas no equivale a RLS: los grants explícitos existentes se conservan; un fallo de permisos exige diagnóstico, no grants ad hoc. [Cambio de Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
- La excepción de II.7 y D-M28.2a-03 solo autoriza el recorrido manual acordado en `app`; no habilita suites ni fixtures contra ese proyecto.

## Decisiones de la microfase

Decisiones confirmadas por el usuario al cerrar el grill. DEC-07 y DEC-08 se mantienen; DEC-18 incorpora la excepción de registro ya aprobada en D-M28.2a-03, sin reabrir la decisión. La spec sigue en BORRADOR hasta su auditoría y aprobación posterior. II.7 incorpora las aclaraciones autorizadas y enlaza esta sección para los dominios elegidos.

| ID | Decisión | Motivo | Decidió | Fecha |
|---|---|---|---|---|
| D-M28.2a-01 | Q-01, opción B: G-ENTORNO exige Auth público, `PRAXA_CREDENTIAL_KEYS`, `PRAXA_CREDENTIAL_KEY_CURRENT` y `PRAXA_INTEGRATIONS_DB_URL`, verificadas por presencia con la limitación declarada. Llavero nuevo para el piloto, distinto del de pruebas. Meta antes de M16.1; DeepInfra en M25a.2. Se autoriza ajustar II.7.2. | Conservar el orden de preparación de servicios y distinguir configuración presente de funcionamiento probado. | Usuario, grill confirmado | 2026-10-03 |
| D-M28.2a-02 | Q-02: dominio `praxa.site`, comprado según el usuario, DNS en GoDaddy. App en `app.praxa.site`; envíos desde `auth.praxa.site`. Proveedor SMTP pendiente de elección en II.7, paso 6. SPF y DKIM obligatorios; DMARC recomendado. Si falla entregabilidad externa por la extensión, registrar hallazgo antes de M16.1. Si cambia la marca, migrar dominio antes del alta del dueño en M16.2. | Fijar los dominios del piloto y el momento de elección de SMTP; condicionar cambios de dominio sin iniciarlos ahora. | Usuario, grill confirmado | 2026-10-03 |
| D-M28.2a-03 | Q-03, opción A: excepción acotada en II.7 para el recorrido manual del usuario en `app`, con casilla externa y empresa sintética creada por onboarding; ninguna suite ni fixture contra `app`. Conservar cuenta y empresa, documentarlas sin datos personales y eliminarlas con CA-67 al cierre del piloto. | Cumplir la aceptación del entorno real sin habilitar pruebas automatizadas contra producción ni adelantar el alta del dueño. | Usuario, grill confirmado | 2026-10-03 |

## Supuestos e hipótesis

- **HIPÓTESIS H-M28.2a-01:** existe acceso administrativo operativo a Vercel, `app` y DNS. El usuario informó la compra y gestión DNS del dominio (D-M28.2a-02); no se comprobó en cuentas externas. Verificar accesos antes del paso correspondiente. El proveedor SMTP no se presupone existente: se elige en el paso 6.
- **HIPÓTESIS H-M28.2a-02:** el dominio elegido permite el recorrido Auth completo con plantillas remotas compatibles. Verificar en pasos 5–8b, incluyendo cookies y redirecciones. Abrir el enlace en el navegador donde se inició el flujo evita asumir que PKCE funciona entre dispositivos.
- **HIPÓTESIS H-M28.2a-03:** estado actual del historial de `app`, contraseña del rol y variables desplegadas son los previstos. Verificar por el usuario en pasos 2–4; no se consultaron cuentas ni entornos remotos en esta expansión.
- **HIPÓTESIS H-M28.2a-04:** disponibilidad de la prueba Pro de 14 días citada en II.7 y estado actual del plan Free/pausas del proyecto. Si el usuario reconsidera DEC-08, comprobar oferta y condiciones oficiales al contratar; no dependen de ello los criterios técnicos del corte.
- P-06 permanece pendiente de comprobación real aunque la documentación oficial confirme la restricción del SMTP por defecto. La recuperación con registro cerrado solo se considera verificada al completar T-08.

## Preguntas abiertas

No quedan preguntas abiertas de diseño del grill. Se conserva la trazabilidad de los IDs originales:

| ID | Estado | Resolución |
|---|---|---|
| M28.2a-Q-01 | Resuelta | D-M28.2a-01; calendario y verificación por presencia incorporados a II.7, paso 2. |
| M28.2a-Q-02 | Resuelta | D-M28.2a-02; dominios elegidos y elección de SMTP reservada expresamente para II.7, paso 6. |
| M28.2a-Q-03 | Resuelta | D-M28.2a-03; excepción manual y conservación hasta CA-67 incorporadas a II.7. |

Elegir y configurar el proveedor SMTP sigue siendo una intervención necesaria para ejecutar el paso 6 y cerrar G-ENTORNO; no bloquea la auditoría de esta spec.

## Hallazgos relacionados

- **H-E1-08**, asignado a M28.2a, pendiente: el SMTP predeterminado no habilita el registro del dueño. Cerrar únicamente con la evidencia real de correo externo exigida, enlazando entorno/sesión en HALLAZGOS durante implementación.
- **H-E1-23**, asignado a corrección futura de la ruta, no a este corte: antecedente de CB-06 y suites opt-in. Aquí se enumera la matriz obligatoria explícitamente; no se reescribe CB-06 ni se cierra ese hallazgo.
- Q-01 a Q-03 quedaron resueltas en el grill y sus aclaraciones autorizadas se incorporaron a II.7. No se registra un hallazgo de entregabilidad hipotético: si ocurre el fallo acordado en D-M28.2a-02, se registra con evidencia antes de M16.1. No se cerró H-E1-08 ni se modificó HALLAZGOS en esta edición documental.

## Auditorías

[spec-audit-1.md](revisiones/spec-audit-1.md): **REQUIERE CAMBIOS**, sobre el commit `7b2a30f` y el hash de contenido indicado en el informe. Se conserva su veredicto histórico.

Correcciones documentales del 2026-10-03, pendientes de nueva auditoría:

| Hallazgo | Corrección aplicada | Verificación |
|---|---|---|
| A-01 | DEC-18 de la spec general incorpora la ventana manual de registro ya aprobada; se alinea la intervención de Auth y CB-04 enlaza esa excepción. | Contraste con II.7 y D-M28.2a-03; sin cambiar la cuenta, el entorno, la retención ni las acciones reservadas decididas en el grill. |
| A-02 | Alcance, C-04 y T-04 comprueban tanto `worker_api` como `private`, con fallo si cualquiera está expuesto. | Coherencia con Diseño concreto, II.7 pasos 4–5. |
| A-03 | Referencias de Fuentes y Contexto verificadas contra el árbol vigente; corregidas las citas de estado, scripts, URL del rol y pruebas de correo, y precisadas las restantes. | Lectura de las líneas citadas y revisión documental del diff. No se ejecutaron pruebas funcionales en esta corrección. |

Siguiente paso: repetir `$spec-auditor M28.2a`. La spec permanece BORRADOR y G-ENTORNO pendiente; esta corrección no emite un veredicto APROBABLE.
