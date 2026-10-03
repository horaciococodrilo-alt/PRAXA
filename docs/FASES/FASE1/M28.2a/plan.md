# M28.2a — Plan de implementación

**Estado:** BORRADOR

Estados posibles: `BORRADOR` → `APROBADO`. Solo el usuario pasa un plan a `APROBADO`, y solo después de una auditoría APROBABLE.

**Spec base:** `docs/FASES/FASE1/M28.2a/spec.md`, aprobada por el usuario, con hash de contenido sin línea de estado `7517041448d9579977406bf7c8cd6d39a954e922`. Ver la fórmula en `docs/_templates/mf-spec.md`. Coincide con `revisiones/spec-audit-2.md`, APROBABLE. La tercera auditoría consigna un hash diferente; no se usa como referencia de identidad del contenido.

**Base inspeccionada:** `7b2a30f96f12284b5339b7591a8ce16d29a26555`, con modificaciones preexistentes en ambas specs y auditorías sin seguimiento. Se preservan. Las menciones internas antiguas a BORRADOR no sustituyen la aprobación explícita del usuario.

**Objetivo:** disponer de `https://app.praxa.site`, con base, Auth y correo funcionando, y reunir evidencia para aprobar `G-ENTORNO`. El corte mantiene el límite de ocho horas de implementación; las esperas externas quedan registradas como intervenciones pendientes.

**Hash de contenido de este plan.** Se calcula sin la línea de estado:

```bash
grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/M28.2a/plan.md | git hash-object --stdin
```

## Archivos

Esta lista es el alcance de archivos de la microfase. Está contenida en la tabla de la Parte II de la ruta, más los archivos de seguimiento.

Abreviaturas utilizadas en los pasos: **E** = entorno; **S** = sesión; **P** = estado del proyecto; **H** = hallazgos.

| Archivo | Nuevo o modificado | Paso | Autorizado por |
|---|---|---|---|
| `docs/FASES/FASE1/M28.2a/plan.md` | Nuevo | Preparación; inventario de capturas en 9 | Pedido del usuario; plantilla `mf-plan.md`; seguimiento |
| `docs/FASES/FASE1/meta_first/entorno.md` — E | Nuevo | 0–10 | II.7.9; evidencia de cierre de la ficha |
| `docs/FASES/FASE1/meta_first/sesiones/M28.2a.md` — S | Nuevo | Todos | III.3; AGENTS, protocolo 6 |
| Capturas redactadas de M28.2a, como anexos de seguimiento | Nuevas; rutas concretas incorporadas a esta tabla en 9 al disponer de ellas | 1–9 | Evidencia gráfica exigida por ficha y spec |
| `docs/PROJECT_STATE.md` — P | Modificado únicamente ante cambio de estado, bloqueo o gate | 0, 11; bloqueos | Contrato documental de AGENTS |
| `docs/HALLAZGOS.md` — H | Modificado al verificar H-E1-08 o registrar un hallazgo real | 7–11; fallos | II.7.7; AGENTS, protocolo 9 |

No se fijan nombres de capturas inexistentes: la spec exige inventariar sus rutas reales en el paso 9. Esta excepción solo comprende evidencia gráfica redactada, no otros archivos.

No hay cambios de APIs, tipos, interfaces, código, configuración versionada ni dependencias. SECURITY y ARCHITECTURE son fuentes de consulta.

## Pasos

En la tabla, `C-xx` y `T-xx` significan `M28.2a-C-xx` y `M28.2a-T-xx`.

**TDD:** no corresponde un ciclo RED–GREEN de código: la spec excluye implementación y pruebas automatizadas nuevas. Se prepara primero la matriz de comprobaciones y después se configura y verifica cada comportamiento. Una infraestructura ausente es `NO EJECUTADO`, no un RED válido. Si aparece un defecto de código, se registra y asigna antes de autorizar otro alcance.

| # | Acción | Archivos | Criterios y casos que cubre | Verificación del paso |
|---|---|---|---|---|
| 0 | **Asistente:** comprobar Git, hash de spec, aprobación del plan, G-DB-META y G-CRYPTO. Preservar cambios existentes. Abrir E/S con matriz de casos inicialmente `NO EJECUTADO`; registrar comienzo en P. Consultar evidencia de `0012` en pruebas y limitación del cierre de G-CRYPTO. | E, S, P | C-03, C-10; T-03, T-11; CB-02/03/04/05/06 | Dependencias cerradas, alcance identificado y evidencia previa enlazada. No leer `.env.local`, ejecutar migraciones ni acceder a cuentas. |
| 1 | **Usuario:** crear/conectar Vercel al repositorio, configurar Node 24 y asignar `app.praxa.site` mediante DNS de GoDaddy. Conservar DEC-07/08. Identificar el commit que se desplegará. Si falta publicarlo en la rama conectada, el usuario realiza el push. | E, S | C-01; preparación T-01; DEC-07/08 | Repositorio, rama y commit de despliegue comprobados sin registrar identificadores de cuenta. DNS y certificado se acreditan al completar el despliegue del paso 2. |
| 2 | **Usuario:** cargar las seis variables obligatorias del gate, generar llavero nuevo para el piloto y excluir credenciales administrativas y de pruebas. Desplegar después de configurar las variables públicas; volver a desplegar tras cualquier cambio de ellas. **Asistente:** registrar inventario por nombre y estado. | E, S | C-01, C-02; T-02; parte de T-01 | Despliegue exitoso del commit previsto, HTTPS válido y checklist completo. Registrar declaración del llavero distinto del de pruebas y correspondencia privada con `app`. La presencia no acredita validez criptográfica ni conexión SQL. |
| 3 | **Usuario:** ejecutar `npm run db:check`; comprobar privadamente que el destino es `app`. Ejecutar `npm run db:preview` para inspeccionar pendientes y luego `npm run db:push`. Fijar fuera del repositorio la contraseña de `praxa_integrations` y completar su URL en Vercel; redesplegar si cambia. | E, S | C-02, C-03; T-02, T-03; CB-03 | Salidas y códigos redactados; historial remoto coherente hasta `0012`; contraseña configurada declarada por el usuario. Si no hay pendientes, registrar ese resultado sin reaplicar SQL. Detener ante destino incorrecto, pendientes inesperadas o historial inconsistente. |
| 3R | **Rama excepcional, no ejecución normal:** si la evidencia de pruebas resulta insuficiente o se requiere volver a aplicar migraciones al desechable, detener y registrar el bloqueo. Solo tras acordar expresamente esa intervención, el **usuario** ejecuta `npm run db:check:test` y `npm run db:push:test`. | S; P/H si corresponde | Precondición C-03/T-03; CB-04/05/06 | Destino desechable distinto de `app`, exit codes e historial redactados. El push no sustituye las suites que correspondan a la dependencia afectada. No continuar al paso 3 hasta resolverla; no repetir esta operación por rutina. |
| 4 | **Usuario:** verificar en el dashboard remoto la lista de esquemas expuestos por la Data API. | E, S | C-04; T-04; DEC-03 | Captura redactada demuestra ausencia de **ambos**, `worker_api` y `private`. Cualquiera expuesto implica FALLA; detener y diagnosticar, sin rodeos RPC ni cambios ad hoc de permisos. |
| 5 | **Usuario:** configurar Site URL, las dos redirecciones exactas y confirmación de email habilitada en Auth remoto. Revisar compatibilidad de plantillas con los enlaces emitidos por el código. | E, S | C-05; preparación T-05 y T-09; DEC-18 | Captura redactada de configuración. T-05 queda pendiente hasta observar ambos enlaces en 7 y 8b; la configuración por sí sola no lo aprueba. |
| 6 | **Usuario:** elegir y contratar proveedor SMTP, verificar `auth.praxa.site` con SPF/DKIM y configurar SMTP propio en Supabase. El asistente recomienda DMARC sin convertirlo en requisito. | E, S | Preparación C-06/T-06; P-06 | Proveedor registrado; SPF/DKIM verificados; configuración acreditada sin credenciales. No declarar entregabilidad hasta 7 y 8b. |
| 7 | **Usuario:** abrir registro solo para esta comprobación y registrar una casilla propia ajena al equipo Supabase, distinta de la cuenta del dueño. Intentar login antes de confirmar; recibir y abrir confirmación en el navegador del flujo; cerrar sesión e iniciar una nueva. | E, S; H al verificar H-E1-08 | C-05, C-06, C-07; T-05 —confirmación—, T-06; aceptaciones 1 y 2 de la ficha; P-06 | Antes de confirmar, login rechazado. Correo recibido y abierto; callback termina en el dominio y onboarding correctos; login nuevo funciona. Evidencia redactada. Cerrar H-E1-08 solo cuando se acredite la entrega externa requerida. |
| 8 | **Usuario:** cerrar inmediatamente el registro desde Auth y repetir `/signup` con otra dirección controlada no registrada. Ejecutar este cierre también si se interrumpe la comprobación anterior. | E, S | C-08; T-07; DEC-18 | Auth rechaza el alta y no crea una cuenta utilizable. Ocultar la pantalla de registro no acredita el caso. |
| 8b | **Usuario:** con registro cerrado, solicitar recuperación de la cuenta confirmada, recibir y abrir el correo en el navegador del flujo, establecer contraseña nueva válida y coincidente y completar el regreso al login. Intentar primero la contraseña anterior y luego la nueva. | E, S | C-05, C-09; T-05 —recuperación—, T-08; P-06 | Destino `/reset-password` correcto; cambio exitoso, cierre de sesión y llegada a `/login?notice=password-updated`. Contraseña anterior rechazada y nueva aceptada. Registro permanece cerrado. |
| 8c | **Usuario:** en un contexto sin sesión, intentar cambiar contraseña desde `/reset-password` y abrir `/auth/callback` sin parámetros. | E, S | C-05, C-09; T-09 | Cambio rechazado por ausencia de sesión; callback redirige a `/verify-email?error=link-missing-params`. No fabricar tokens ni compartir enlaces reales. |
| 8d | **Usuario:** comprobar `/app/integraciones` sin sesión y con sesión sin empresa. Crear después la empresa sintética mediante onboarding existente y volver a Integraciones autenticado. Conservar cuenta y empresa para su eliminación con CA-67. | E, S | C-01; T-01; aceptación 3 de la ficha; D-M28.2a-03, CB-04 | Sin sesión exige login; sin empresa conduce a onboarding. Con empresa muestra Integraciones y su estado vacío sobre HTTPS, sin 404/500. No hace falta activar un contexto. Registrar conservación sin datos personales. |
| 9 | **Asistente:** completar E con checklist II.7, inventario, migraciones, Auth/SMTP y evidencias; completar S con comandos, resultados y límites. Revisar las capturas ya redactadas, incorporar sus rutas concretas a la tabla de archivos de este plan y enlazarlas desde E. | E, S, plan y capturas; H si hay hallazgos | C-02, C-03, C-10; T-11; CB-02/03/05/06 | Cada T-01–T-11 tiene estado, referencia y responsable. Capturas sin secretos, referencias de proyecto/cuenta, correos completos, cookies ni tokens. Distinguir lo observado de lo informado por el usuario. |
| 10 | **Asistente:** ejecutar `npm run verify` sobre el código identificado y realizar revisión final de diff, archivos nuevos y migraciones. Registrar resultados reales. | S; E para completar checklist | C-10; T-10, T-11; CB-01/02/03/05/06 | Lint, typegen, typecheck, unit/component y build completos con exit 0. Diff dentro del alcance, migraciones intactas y evidencia redactada. Fallos diagnosticados y asignados; ninguna reparación de código en este corte. |
| 11 | **Asistente:** presentar expediente completo de G-ENTORNO. **Usuario:** aprobar visiblemente el gate. Después, actualizar P y registrar la aprobación en S. | P, S; H si corresponde | C-01–C-10; T-01–T-11; tres aceptaciones de la ficha; CB-06 | Todos los casos obligatorios pasan, H-E1-08 verificado y decisiones aplicadas. Solo entonces M28.2a queda cerrada y M16.1 habilitada, sin iniciarla. Sin aprobación, estado verificado y gate pendiente. |

### Configuración exacta del paso 2

| Grupo | Nombres | Regla |
|---|---|---|
| Públicas obligatorias | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL` | URL/clave del mismo proyecto `app`; Site URL `https://app.praxa.site`, sin barra final; presentes antes del build |
| Servidor obligatorias | `PRAXA_CREDENTIAL_KEYS`, `PRAXA_CREDENTIAL_KEY_CURRENT`, `PRAXA_INTEGRATIONS_DB_URL` | Solo servidor; llavero nuevo distinto del desechable; verificación por presencia |
| Diferidas | `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_CONFIG_ID` | Carga antes de M16.1; no exigidas para G-ENTORNO |
| Diferida | `DEEPINFRA_API_KEY` | Carga en M25a.2 |
| Excluidas | `SUPABASE_DB_URL`, todas las `SUPABASE_TEST_*`, `PRAXA_INTEGRATIONS_TEST_DB_URL` | Nunca en Vercel; tampoco sustituir el rol acotado por `service_role` |

El usuario configura privadamente el llavero según el contrato existente: pares `versión:clave` separados por coma, versiones positivas únicas, claves base64 canónicas de 32 bytes y versión actual presente.

La URL del rol debe usar `praxa_integrations.<ref>` y el shared transaction pooler en puerto 6543, contraseña codificada, base explícita y ninguna query ni fragmento. TLS lo configura el módulo. El usuario compara privadamente su referencia con `app`: `db:check` no valida esta variable de runtime.

### Redirecciones del paso 5

Site URL: `https://app.praxa.site`.

URLs autorizadas:

```text
https://app.praxa.site/auth/callback?next=%2Fonboarding
https://app.praxa.site/auth/callback?next=%2Freset-password
```

No agregar comodines generales de previews. Comprobar el destino efectivo al abrir ambos correos y revisar las plantillas si usan `redirectTo`, conforme a la [documentación de redirecciones de Supabase](https://supabase.com/docs/guides/auth/redirect-urls).

## Verificación final

Comandos obligatorios del asistente durante la implementación:

```text
git status --short
git rev-parse HEAD
npm run verify
git diff --check
git diff --name-only
git diff --cached --name-only
git diff --exit-code HEAD -- supabase/migrations/
```

Revisar también el contenido de archivos nuevos: `git diff` no incluye archivos sin seguimiento. Comparar contra el inventario inicial para preservar y distinguir los cambios preexistentes.

Comandos del usuario sobre `app`, en el paso 3:

```text
npm run db:check
npm run db:preview
npm run db:push
```

`db:preview` se adopta como inspección previa de pendientes. Registrar sus resultados, los del push y el historial remoto; un `db:check` exitoso solo acredita coherencia de destino.

`npm run verify` ejecuta los scripts existentes:

```text
lint → typegen → typecheck → test —unit/component— → build
```

No ejecutar `test:app` ni `test:policies` como parte de este corte. No reemplazar la recepción y apertura de correos por las pruebas opt-in existentes.

La sesión debe registrar fecha, operador, commit, comandos, códigos de salida, resultados y limitaciones. Todos los casos manuales usan `PASA`, `FALLA` o `NO EJECUTADO`. Un caso obligatorio omitido mantiene G-ENTORNO pendiente.

## Intervenciones del usuario y acciones reservadas

| Acción reservada | Paso | Verificación posterior |
|---|---|---|
| Aprobar este plan después de auditoría APROBABLE | Antes de 0 | Aprobación visible; no confundir con aprobación de la spec |
| Push de Git, si el commit requerido aún no está en la rama conectada | 1 | Commit remoto coincide con el seleccionado para Vercel; si ya está publicado, registrar que no fue necesario |
| Crear/configurar Vercel, dominio, DNS y variables; desplegar o redesplegar | 1–3 | Commit desplegado, build exitoso, variables por presencia y HTTPS |
| `npm run db:push` sobre `app` y contraseña del rol | 3 | Destino comprobado, resultado redactado e historial hasta `0012` |
| `npm run db:push:test`, exclusivamente si se acuerda la rama excepcional | 3R | Destino desechable, resultado e historial; comprobaciones de la dependencia que se haya reabierto |
| Configurar Data API, Auth, SMTP y DNS de correo | 4–6 | Capturas redactadas y comprobaciones funcionales posteriores |
| Gestionar casilla, contraseñas, altas y onboarding sintético | 7–8d | T-01 y T-05–T-09 con evidencia |
| Aprobar G-ENTORNO | 11 | Aprobación registrada antes de cerrar M28.2a y habilitar M16.1 |

El asistente guía y verifica; no ejecuta acciones de cuenta ni pide secretos. Si los permisos impiden otra operación necesaria, registra el comando bloqueado y su verificación posterior antes de reservarla al usuario.

## Migraciones

No se crea ninguna migración. El árbol actual termina en `0012_integrations.sql`; el paso 3 aplica mediante el wrapper las pendientes existentes hasta esa versión, previamente verificadas en el desechable.

No pegar la migración en SQL Editor, reparar historial improvisadamente, editar migraciones existentes ni crear un rol alternativo para eludir un fallo.

Una reversión de esquema exige una migración nueva y un alcance aprobado aparte. El siguiente número observado es `0013`, ya previsto por la ruta para trabajo posterior; no se consume en M28.2a y debe revalidarse antes de cualquier propuesta. No ejecutar borrados de cuenta o empresa sintética al cerrar este corte: corresponden a CA-67.

## Riesgos

- **Evidencia insuficiente:** un build exitoso, variables presentes o Integraciones renderizada no prueban conectividad del rol ni validez del llavero. Registrar expresamente esos límites.
- **Correo engañosamente positivo:** una casilla del equipo puede funcionar con SMTP predeterminado. Se exige una externa y recepción efectiva; el proveedor predeterminado restringe destinatarios al equipo. [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
- **Registro abierto:** cerrar inmediatamente tras la comprobación o ante interrupción. La recuperación debe ensayarse con registro cerrado.
- **Configuración remota desconocida:** accesos, DNS, historial y plantillas son hipótesis hasta su paso de verificación. La elección de proveedor SMTP sigue reservada al paso 6.
- **Fallo de entrega:** diagnosticar antes de atribuirlo a la extensión del dominio; registrar hallazgo y bloquear el gate. Si cambia la marca, completar la migración de dominio antes del alta del dueño en M16.2.
- **Desviación de alcance:** detener ante necesidad de modificar código, configuración versionada, migraciones o propiedades transversales. Si SECURITY o ARCHITECTURE requieren cambios, marcar **REQUIERE CAMBIO EN LA RUTA**.
- **Condiciones de parada:** aplicar III.9 y AGENTS ante contradicciones, dependencias abiertas, intervenciones pendientes, pruebas omitidas, fallos de privilegios/aislamiento/guardas o dos iteraciones sin converger. Registrar cada hallazgo real con ID estable, impacto, evidencia y asignación.
- **Decisiones conservadas:** mantener DEC-08 y la limitación documentada del cierre de G-CRYPTO; este plan no reabre esos gates ni promete una prueba gratuita de otro plan comercial.

## Qué no se hace

- Implementar código, APIs, tests nuevos, dependencias, `vercel.json` o cambios en `supabase/config.toml`.
- Ejecutar suites, fixtures o asignaciones manuales de membresía contra `app`.
- Leer `.env.local`, copiar secretos, enlaces de correo, cookies o identificadores privados.
- Conectar Meta, registrar su callback, ejecutar VR-01, resolver P-01–P-05 o adelantar la cuenta del dueño.
- Implementar worker, Insights o chat; cerrar H-E1-23.
- Hacer commit, push, despliegue o acciones de cuenta por parte del asistente.
- Aprobar automáticamente el plan o G-ENTORNO, ni iniciar la microfase sucesora.
