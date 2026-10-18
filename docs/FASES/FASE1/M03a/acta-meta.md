# Acta de datos reales de Meta y del chat

**Estado:** APROBADA — por el usuario el 2026-10-18 (`G-ACTA-META`).
**Alcance:** piloto de la ruta `meta_first`, con un dueño, una empresa y una cuenta publicitaria de Meta (spec `meta_first`, sección 1).
**Fuentes:** sección III.6 del [plan de la ruta](../meta_first/plan.md) (contenido mínimo), decisiones DEC-01 a DEC-21 y criterios citados de la [spec de la ruta](../meta_first/spec.md), y [`docs/SECURITY.md`](../../../SECURITY.md).

Este documento declara qué datos reales entran a PRAXA durante el piloto, para qué, dónde quedan, quién los ve, cuánto tiempo se conservan y cómo se borran. **No es un dictamen legal ni afirma el cumplimiento de ninguna norma.** Los puntos marcados con **[REVISIÓN PROFESIONAL]** requieren la evaluación de un profesional.

Ningún dato real entra al proyecto `app` antes de que el usuario apruebe esta acta: el gate `G-ACTA-META` habilita el primer dato real (plan, I.3 y II.8; spec, sección 13b).

## 1. Qué datos entran

| Dato | Dónde vive | Cómo se protege |
|---|---|---|
| Identificador de la cuenta publicitaria de Meta | Completo solo en la base (`integration_connections`) | Truncado en la interfaz, en las capturas y en la evidencia (CA-09b). Nunca aparece junto a datos de gasto (CA-40). Excepción declarada: la ruta de las peticiones a Insights (ver los límites abajo) |
| Identificador del negocio de Meta (`client_business_id`), moneda y zona horaria de la cuenta | Base (`integration_connections`) | Lectura bajo RLS, solo para los miembros de la empresa |
| Gasto e impresiones diarios | Base: snapshots, días y cobertura (a partir de `M16c`) | Lectura bajo RLS. Los snapshots son inmutables. El gasto se guarda como `numeric` y las impresiones como `bigint`, y salen como texto (CA-44b) |
| Token de Meta (system user) | Base, esquema `private`, cifrado con AES-256-GCM | La base lo entrega cifrado solo por `worker_api` al rol propio; lo descifra el servidor con el llavero, que no vive en la base (DEC-03, DEC-04). No aparece en logs, errores ni URLs (CA-26) |
| Intentos de autorización (OAuth) | Base | Se guardan solo los hashes del `state` y del nonce, nunca los valores. Se purgan de forma perezosa al vencer o consumirse (CA-38b) |
| Registro por consulta del chat (a partir de `M25a.1`) | Base, sin lectura para `authenticated` | La pregunta se guarda **redactada** (CA-66), con los nombres de las herramientas llamadas, el resultado, el motivo si no respondió, la fecha, la latencia, el modelo solicitado y el informado, la conexión a la que se refiere (o nula si no hay conexión) y el voto «útil» o «no útil». No se guardan respuestas ni cifras de herramientas (CA-62). La pregunta nunca va a los logs (CA-63) |
| Cuenta del dueño en Supabase Auth | Supabase Auth | Correo, contraseña, y nombre y apellido en los metadatos de la cuenta, gestionados por Supabase Auth. Según la inspección del esquema informada por el usuario, el estado de sesión contempla IP y user agent; la auditoría contempla IP. El detalle y sus límites se declaran abajo |

**Datos técnicos de Auth, según la inspección informada por el usuario el 2026-10-18:** `auth.sessions` contempla IP, user agent y estado de sesión; `auth.mfa_challenges`, IP; y `auth.refresh_tokens`, tokens de renovación y estado de revocación. Son datos internos gestionados por Supabase Auth, distintos del token de Meta. `auth.audit_log_entries` contempla IP y un payload, pero estaba vacía: no se confirmó el contenido efectivo del payload ni si está habilitada la escritura de auditoría en la base. Para `auth_logs`, el usuario informó campos de eventos, actor, contacto y datos técnicos de petición como `remote_addr`; no se acredita aquí su contenido real. Esta sesión no accedió al proyecto remoto ni a registros personales.

**Otros datos del dueño que la app ya guarda** (no son de Meta ni del chat, pero se declaran para que el acta sea completa): perfil de la empresa (nombre, rubro, país y moneda), contexto de la empresa (objetivos, problemas, restricciones y contexto adicional) y foto de perfil opcional en el bucket privado `avatars`.

**Límites declarados:**

- La redacción de la pregunta no detecta nombres, direcciones, DNI sueltos ni otros datos escritos en forma libre (CA-66). Por eso la pantalla del chat avisa que las preguntas se registran y para qué (CA-65).
- La pregunta redactada puede conservar montos y fechas que escribió el dueño (CA-62).
- Los logs del hosting registran la consulta de las peticiones entrantes: el `code` y el `state` del callback de OAuth quedan visibles para quien acceda a esos logs. Ambos son de un solo uso (`SECURITY.md`, sección 12).
- El identificador completo de la cuenta va en la ruta de las peticiones a Insights, así que puede verse si el hosting muestra esas subpeticiones. Esas rutas no llevan montos.

## 2. Para qué

Para la demostración del piloto con el dueño y para aprender qué pregunta y si las respuestas le sirven. En concreto:

- los datos de Meta permiten mostrar el gasto y las impresiones diarios y responder en el chat;
- el registro por consulta permite medir qué se pregunta, si se respondió y si fue útil (DEC-10, DEC-13).

El host del modelo no entrena con los datos (DEC-15). PRAXA no escribe sobre Meta: el permiso objetivo es solo `ads_read` (spec, sección 2). El operador se compromete a no vender los datos ni combinarlos con los de otros clientes (confirmación del usuario del 2026-10-18).

## 3. Quién accede

| Quién | A qué | Cómo |
|---|---|---|
| El dueño | A sus propios datos | A través de la aplicación, con su sesión. **No** ve el registro por consulta del chat (CA-64) |
| El operador (el usuario que administra el piloto) | A todo, incluido el registro por consulta | Desde el dashboard de Supabase y los logs del hosting. Administra el despliegue y la base: con el llavero del despliegue podría descifrar la credencial, y no lo hace como parte de la operación (límite declarado en `SECURITY.md`, secciones 4 y 6) |
| La cuenta sintética de prueba de `M28.2a` | Solo a su propia empresa sintética, sin datos reales | Se conserva en el proyecto `app` por DEC-18. El aislamiento por empresa, aplicado en la base con RLS, la separa de los datos del dueño |

No hay otros usuarios ni empresas en el piloto.

## 4. Terceros que tratan datos

| Tercero | Qué recibe o guarda | Ubicación | Observaciones |
|---|---|---|---|
| Meta | Es el origen de los datos de la cuenta publicitaria | — | Además de las lecturas, PRAXA envía el canje del código y la inspección del token. La única operación que cambia estado en Meta es la revocación del propio token |
| Supabase | Base de datos, autenticación y almacenamiento de la foto | Oregon, EE. UU. (`us-west-2`) | Plan Free hasta VR-01 y Pro cuando el dueño use el piloto sin acompañamiento (DEC-08). Con Pro, copias de seguridad nocturnas durante 7 días |
| Vercel | Hosting de la aplicación y sus logs de ejecución | Washington D. C./Virginia, EE. UU. (`iad1`, `us-east-1`) | Los logs no contienen la pregunta del chat (CA-63) ni tokens; sí la consulta de las peticiones entrantes y la ruta de las subpeticiones (sección 1) |
| DeepInfra | La pregunta redactada y las cifras de gasto e impresiones que el chat le pasa al modelo (a partir de `M25a.2`) | EE. UU. | No entrena con los datos ni los guarda en disco, pero se reserva registrar porciones de las solicitudes para depuración o seguridad (DEC-15, riesgo aceptado) |
| Resend (SMTP) | El correo del dueño, para confirmar el registro y recuperar la contraseña | São Paulo, Brasil (`sa-east-1`), región de envío informada | Configurado sobre el dominio del piloto con SPF y DKIM (DEC-18) |

Las regiones fueron informadas por el usuario el 2026-10-18; no se verificaron desde los dashboards en esta sesión. La región de envío de Resend no acredita la ubicación de todos sus registros y subprocesadores.

## 5. Retención

| Qué | Cuánto tiempo | Fuente |
|---|---|---|
| Conexión pendiente sin confirmar | Vence a los 30 minutos y se purga en la siguiente visita o inicio, con intento de revocación en Meta. Hasta que el dueño vuelve, la credencial cifrada sigue en la base | DEC-17, CA-37b |
| Intentos de autorización vencidos o consumidos | Se purgan de forma perezosa | CA-38b |
| Datos de una conexión (credencial, snapshots, observaciones, ejecuciones y registros del chat de esa conexión) | Mientras la conexión está viva. Al desconectar se borran | DEC-09, CA-38 |
| Snapshots reemplazados | Se conservan mientras la conexión está viva, porque son la procedencia de las respuestas | CA-38b |
| Registro por consulta del chat | Sin plazo propio. Los de una conexión se borran al desconectarla; los que no tienen conexión, solo al cerrar el piloto | DEC-12, CA-62, CA-65 |
| Todo lo del dueño, y la cuenta y la empresa sintéticas | Hasta el fin del piloto, cuando se ejecuta el cierre | DEC-12, DEC-18, DEC-20, CA-67 |
| Copias de seguridad del proveedor | Con Supabase Pro, hasta 7 días después del borrado | CA-38b |

«Borrar» alcanza a la **base activa**. Con Supabase Pro, un dato borrado puede seguir hasta 7 días en las copias nocturnas; en el plan Free las copias no se pueden descargar. Es un límite declarado y no se mitiga (CA-38b). Según la información aportada por el usuario el 2026-10-18, los runtime logs del plan Hobby de Vercel duran 1 hora; los build logs se conservan indefinidamente por deployment. No se confirmó uso de Drains. Los logs de los demás terceros siguen sus propios plazos; no se confirmó un plazo específico para `auth_logs` de Supabase. La auditoría almacenada en Postgres no debe confundirse con esos logs: no se acreditó una purga automática ni que el cierre de CA-67 la elimine.

El historial de Meta se puede volver a obtener reconectando y resincronizando: Meta sirve los totales hasta 37 meses hacia atrás, con los valores revisados que tenga en ese momento (CA-38b).

## 6. Baja y borrado

- **Desconectar Meta** desde la tarjeta de Integraciones borra la credencial y los datos de esa conexión de la base activa e intenta revocar el token en Meta. Si la revocación falla, la credencial local se destruye igual. Desconectar no quita a Praxa del negocio del dueño en Meta: para eso, el dueño debe entrar a la configuración de su negocio en Meta, a las integraciones o apps conectadas, y quitar a Praxa (CA-38).
- **Pedido de borrado de toda la información:** hoy la aplicación no tiene un flujo de baja de cuenta (`H-E1-06`). El dueño se lo pide al operador, que ejecuta el procedimiento de cierre de CA-67 en el orden obligatorio: desconectar Meta, borrar la empresa, borrar la carpeta del usuario en `avatars` (paso de la ampliación de CA-67 que sigue pendiente de aprobación), borrar el usuario de Supabase Auth, quitar al dueño como tester de la app de Meta y pedirle que quite la app de su negocio. Al cerrar el piloto, el mismo procedimiento borra también la empresa, la carpeta de `avatars` y el usuario de la cuenta sintética de `M28.2a` (DEC-18).
- **Qué no se borra:** las copias de seguridad del proveedor dentro de su plazo, los logs de los terceros dentro de sus plazos y, en DeepInfra, las porciones que haya registrado para depuración o seguridad.
- **Canal para el pedido:** [horaciococodrilo@gmail.com](mailto:horaciococodrilo@gmail.com).

## 7. Transferencias internacionales

**[REVISIÓN PROFESIONAL]** Los datos se tratan en servidores de terceros fuera de Argentina, al menos DeepInfra (EE. UU.) y, según su región, Supabase, Vercel y Resend. La Ley 25.326 de Protección de Datos Personales y sus normas complementarias regulan la transferencia internacional de datos personales. Esta acta no evalúa si los países de destino o las condiciones de cada proveedor cumplen esas exigencias, ni qué consentimiento o instrumento hace falta. Por decisión expresa del usuario del 2026-10-18, no se realiza ni se agenda esa evaluación para este proyecto escolar. Se conserva la marca de revisión profesional como límite no evaluado, sin afirmar cumplimiento ni una exención por el carácter escolar. DEC-15 mantiene la evaluación antes de escalar para el host del modelo.

## 8. Incidentes

| Incidente | Qué hacer |
|---|---|
| Filtración de la clave de cifrado de credenciales | Rotarla con el procedimiento de CA-25 y de `SECURITY.md`, sección 6, que fija las condiciones para retirar la clave vieja; revocar los tokens en Meta y avisar al dueño |
| Filtración de la clave de DeepInfra | Rotarla en DeepInfra y en las variables del despliegue |
| Filtración de un token de Meta o del secreto de la app | Desconectar Meta (revoca y borra la credencial), rotar el secreto de la app en Meta, actualizar `META_APP_SECRET` en las variables del despliegue y avisar al dueño |
| Acceso indebido a la base o a los logs | Revisar los accesos del proyecto en Supabase y en Vercel, rotar las credenciales afectadas y avisar al dueño |

**[REVISIÓN PROFESIONAL]** Si existe una obligación legal de notificar incidentes a una autoridad o al titular de los datos, sus plazos y su forma no se evalúan acá.

## 9. Qué se le comunica al dueño y cómo

Antes de su alta en PRAXA, que es el primer dato real (paso 15 de la fase B de `M16.2`), en una conversación con el dueño, el operador le explica:

1. qué datos de Meta se leen y para qué (secciones 1 y 2);
2. quién accede y qué terceros intervienen, incluido que el modelo del chat está en EE. UU. (secciones 3 y 4);
3. que las preguntas del chat se registran redactadas, sin las respuestas, y que el operador puede verlas (CA-62, CA-64);
4. cuánto tiempo se conserva cada cosa y el límite de las copias de seguridad de hasta 7 días (sección 5);
5. cómo desconectar Meta, cómo quitar a Praxa desde su negocio en Meta y cómo pedir el borrado de todo (sección 6).

Además, la pantalla del chat avisa que las preguntas se registran y para qué (CA-65), y la desconexión declara el límite de las copias de seguridad (CA-38b).

El operador se compromete a mantener esta conversación antes del alta del dueño (confirmación del usuario del 2026-10-18). La confirmación del compromiso no acredita que la conversación ya haya ocurrido.

## 10. Aprobación

| Campo | Valor |
|---|---|
| Aprobado por | Usuario, mediante aprobación explícita en el chat |
| Fecha | 2026-10-18 |
| Gate | `G-ACTA-META`, aprobado |

Solo el usuario aprueba esta acta. La aprobación se registra en `docs/PROJECT_STATE.md`.
