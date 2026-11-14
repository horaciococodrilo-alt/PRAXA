# Acta de datos reales de Meta y del chat

**Enmienda de alcance:** autorizada expresamente por el usuario el 2026-11-06 al pedir resolver e integrar los datos ampliados antes de M16c. La comunicación al dueño sobre el alcance ampliado se acredita antes de la primera sincronización ampliada; no se presume realizada por esta autorización.

**Enmienda de desgloses (DEC-23):** aprobada por el usuario el 2026-11-08 (`H-E1-202`). La sincronización de ese día devolvió 0 filas, así que todavía no entraron datos reales de estas categorías.

**Ampliación M25a para el modelo:** preparada para nueva aprobación del usuario. Hasta esa aprobación y la declaración de comunicación al dueño, no se envían datos reales al modelo. La aprobación histórica de esta acta y la conformidad anterior sobre desgloses no acreditan esta ampliación.

**Ampliación M26a para el diagnóstico con Anthropic:** **aprobada expresamente por el usuario el 2026-11-14**, solo en las propiedades del diagnóstico (lo pendiente del chat, `H-E1-204`, queda fuera). Con esta aprobación rigen las excepciones de reversibilidad y de retención de `meta_first/spec.md` §16. La comunicación al dueño de la sección 9 sigue pendiente: hasta que el usuario la declare, no se genera un diagnóstico con datos reales.

**Estado de aprobación histórica:** ver [`docs/PROJECT_STATE.md`](../../../PROJECT_STATE.md); la evidencia histórica está en la [sesión de M03a](../meta_first/sesiones/M03a.md).
**Alcance:** piloto de la ruta `meta_first`, con un dueño, una empresa y una cuenta publicitaria de Meta (spec `meta_first`, sección 1).
**Fuentes:** sección III.6 del [plan de la ruta](../meta_first/plan.md) (contenido mínimo), decisiones DEC-01 a DEC-22 y criterios citados de la [spec de la ruta](../meta_first/spec.md), y [`docs/SECURITY.md`](../../../SECURITY.md).

Este documento declara qué datos reales entran a PRAXA durante el piloto, para qué, dónde quedan, quién los ve, cuánto tiempo se conservan y cómo se borran. **No es un dictamen legal ni afirma el cumplimiento de ninguna norma.** Los puntos marcados con **[REVISIÓN PROFESIONAL]** requieren la evaluación de un profesional.

Ningún dato real entra al proyecto `app` antes de que el usuario apruebe esta acta: el gate `G-ACTA-META` habilita el primer dato real (plan, I.3 y II.8; spec, sección 13b).

## 1. Qué datos entran

| Dato | Dónde vive | Cómo se protege |
|---|---|---|
| Identificador de la cuenta publicitaria de Meta | Completo solo en la base (`integration_connections`) | Truncado en la interfaz, en las capturas y en la evidencia (CA-09b). Nunca aparece junto a datos de gasto (CA-40). Excepción declarada: la ruta de las peticiones de lectura a Meta de la cuenta, Insights y edges de metadata (ver los límites abajo) |
| Identificador del negocio de Meta (`client_business_id`), moneda y zona horaria de la cuenta | Base (`integration_connections`) | Lectura bajo RLS, solo para los miembros de la empresa |
| Datos diarios de rendimiento y resultados de Meta por cuenta, campaña, conjunto y anuncio; metadata de entidades y atribución | Base: snapshots, filas y cobertura, a partir de los cortes de M16c | Catálogo único y reglas en [§11 de la spec](../meta_first/spec.md#11-sincronización-manual-m16c). Valores exactos y snapshots inmutables; lectura bajo RLS, sin JSON crudo. Los IDs completos permanecen en la base; los nombres pueden contener texto libre del anunciante y se minimizan en salidas |
| Desgloses diarios de Meta por edad y género, país y región, de cuenta y campaña: gasto, impresiones, clics y tasas, y acciones salvo en región | Base: snapshots, filas, cobertura y estado propios (DEC-23) | Son agregados de Meta, sin personas identificadas, y sus valores son estimados. Meta no documenta un mínimo por grupo: un grupo chico puede representar a pocas personas. Lectura bajo RLS, sin IDs externos. Para una pregunta sobre un desglose, el modelo recibe solo la dimensión, entidad, período y métrica pedidos, agregados por segmento y con un tope de filas; no recibe el snapshot completo |
| Token de Meta (system user) | Base, esquema `private`, cifrado con AES-256-GCM | La base lo entrega cifrado solo por `worker_api` al rol propio; lo descifra el servidor con el llavero, que no vive en la base (DEC-03, DEC-04). No aparece en logs, errores ni URLs (CA-26) |
| Intentos de autorización (OAuth) | Base | Se guardan solo los hashes del `state` y del nonce, nunca los valores. Se purgan de forma perezosa al vencer o consumirse (CA-38b) |
| Registro por consulta del chat (`M25a`) | Base, sin lectura para `authenticated` | La pregunta se guarda **redactada** (CA-66), con los nombres de las herramientas llamadas, el resultado, el motivo si no respondió, la fecha, la latencia, el modelo solicitado y el informado, la conexión a la que se refiere (o nula si no hay conexión) y el voto «útil» o «no útil». No se guardan respuestas ni cifras de herramientas (CA-62). La pregunta nunca va a los logs (CA-63) |
| Turno del chat en curso (`M25a`) | Base, tabla técnica `private`, sin lectura directa para el dueño ni el rol de integraciones | Guarda temporalmente empresa, usuario, identificador del turno y vencimiento para impedir consultas simultáneas. No guarda pregunta, respuesta ni cifras. Se libera al terminar; si falla la liberación, vence por sí mismo |
| Objetivo del diagnóstico (`M26a`) | Base (`diagnostic_settings`), uno por empresa | El dueño lo elige de una lista del servidor; lectura bajo RLS solo para miembros |
| Informe del diagnóstico de Meta Ads (`M26a`) | Base (`diagnostic_reports`), uno por empresa | Guarda la evidencia citada y los totales de la cuenta, los nombres de las entidades destacadas, la salida validada del modelo, las fuentes web aceptadas, el modelo solicitado e informado y el uso. Sin identificador de cuenta, de negocio ni token. Lectura bajo RLS solo mientras exista una conexión vigente con ese identificador; tras desconectar queda oculto, no borrado |
| PDF del diagnóstico (`M26a`) | No se guarda: se arma al descargar y queda en el dispositivo del dueño | Sin identificador de cuenta ni token; con nombres de entidades y cifras. Un PDF descargado no se puede revocar |
| Reserva técnica del diagnóstico (`M26a`) | Base, tabla `private`, sin lectura para el dueño | Empresa, usuario, conexión, identificador de la solicitud y vencimiento, para impedir dos generaciones a la vez. Sin cifras ni textos; vence sola |
| Cuenta del dueño en Supabase Auth | Supabase Auth | Correo, contraseña, y nombre y apellido en los metadatos de la cuenta, gestionados por Supabase Auth. Según la inspección del esquema informada por el usuario, el estado de sesión contempla IP y user agent; la auditoría contempla IP. El detalle y sus límites se declaran abajo |
| Correos de confirmación y recuperación de Supabase Auth | Resend, por SMTP | Recibe la dirección de destino y el mensaje completo, incluido el enlace o código de un solo uso para confirmar la cuenta o recuperar el acceso. El contenido puede consultarse desde el servicio de envío durante su retención; no se guardan esos valores en la documentación ni en la evidencia |

**Datos técnicos de Auth, según la inspección informada por el usuario el 2026-10-18:** `auth.sessions` contempla IP, user agent y estado de sesión; `auth.mfa_challenges`, IP; y `auth.refresh_tokens`, tokens de renovación y estado de revocación. Son datos internos gestionados por Supabase Auth, distintos del token de Meta. `auth.audit_log_entries` contempla IP y un payload, pero estaba vacía: no se confirmó el contenido efectivo del payload ni si está habilitada la escritura de auditoría en la base. Para `auth_logs`, el usuario informó campos de eventos, actor, contacto y datos técnicos de petición como `remote_addr`; no se acredita aquí su contenido real. Esta sesión no accedió al proyecto remoto ni a registros personales.

**Otros datos del dueño que la app ya guarda** (no son de Meta ni del chat, pero se declaran para que el acta sea completa): perfil de la empresa (nombre, rubro, país y moneda), contexto de la empresa (objetivos, problemas, restricciones y contexto adicional) y foto de perfil opcional en el bucket privado `avatars`.

**Límites declarados:**

- La redacción de la pregunta no detecta nombres, direcciones, DNI sueltos ni otros datos escritos en forma libre (CA-66). Por eso la pantalla del chat avisa que las preguntas se registran y para qué (CA-65).
- La pregunta redactada puede conservar montos y fechas que escribió el dueño (CA-62).
- El modelo recibe hasta tres preguntas anteriores de la sesión, redactadas otra vez y con cada candidato numérico reemplazado por `[CIFRA]`, más la última aclaración pendiente si no contiene cifras ni excede el límite. Llegan del navegador como datos no confiables; no se persisten ni se envían respuestas anteriores. Un nombre de entidad puede contener texto libre. Los agregados por segmento no tienen un tamaño mínimo garantizado; un grupo chico puede representar a pocas personas.
- Los logs del hosting registran la consulta de las peticiones entrantes: el `code` y el `state` del callback de OAuth quedan visibles para quien acceda a esos logs. Ambos son de un solo uso (`SECURITY.md`, sección 12).
- El identificador completo de la cuenta va en la ruta de las peticiones de lectura a Meta de la cuenta (Insights y edges de metadata), así que puede verse si el hosting muestra esas subpeticiones. Esas rutas no llevan montos. Los IDs de campaña, conjunto y anuncio no van en la ruta: las referencias faltantes se piden por la raíz de Graph, con los IDs en la consulta.

## 2. Para qué

Para la demostración del piloto con el dueño y para aprender qué pregunta y si las respuestas le sirven. En concreto:

- los datos de Meta permiten mostrar rendimiento y resultados por nivel del catálogo de §11 y responder en el chat con procedencia y atribución; no se demuestra rentabilidad real con estos datos;
- los desgloses permiten analizar el rendimiento por edad, género y lugar; el chat puede consultar los agregados pertinentes y presentarlos con la advertencia de estimación, una vez completada la aprobación y la publicación;
- el registro por consulta permite medir qué se pregunta, si se respondió y si fue útil (DEC-10, DEC-13);
- el diagnóstico de Meta Ads (`M26a`) resume 28 días de rendimiento con cifras calculadas por PRAXA, interpretaciones de Claude rotuladas como tales y hasta tres oportunidades sugeridas, con un PDF descargable; el retorno es el atribuido por Meta, no la ganancia;
- el arriendo técnico impide dos turnos simultáneos del mismo usuario; el voto permite marcar una respuesta registrada como útil o no útil;
- la cuenta de Supabase Auth permite al dueño ingresar y recuperar el acceso; el perfil y el contexto de la empresa permiten configurar y describir su negocio en la app; la foto opcional se muestra como avatar.

El host del modelo no entrena con los datos (DEC-15). PRAXA no escribe sobre Meta: el permiso objetivo es solo `ads_read` (spec, sección 2). El operador se compromete a no vender los datos ni combinarlos con los de otros clientes (confirmación del usuario del 2026-10-18).

## 3. Quién accede

| Quién | A qué | Cómo |
|---|---|---|
| El dueño | A sus propios datos | A través de la aplicación, con su sesión, y de los correos de Auth enviados a su casilla. **No** ve el registro por consulta del chat (CA-64) |
| El operador (el usuario que administra el piloto) | A todo, incluido el registro por consulta y los correos enviados por Resend | Desde los dashboards de Supabase y Resend y los logs del hosting. Administra el despliegue y la base: con el llavero del despliegue podría descifrar la credencial, y no lo hace como parte de la operación (límite declarado en `SECURITY.md`, secciones 4 y 6) |
| La cuenta sintética de prueba de `M28.2a` | Solo a su propia empresa sintética, sin datos reales | Se conserva en el proyecto `app` por DEC-18. El aislamiento por empresa, aplicado en la base con RLS, la separa de los datos del dueño |

No hay otros usuarios ni empresas en el piloto.

## 4. Terceros que tratan datos

| Tercero | Qué recibe o guarda | Ubicación | Observaciones |
|---|---|---|---|
| Meta | Es el origen de los datos de la cuenta publicitaria | — | Además de las lecturas, PRAXA envía el canje del código y la inspección del token. La única operación que cambia estado en Meta es la revocación del propio token |
| Supabase | Base de datos, autenticación y almacenamiento de la foto | Oregon, EE. UU. (`us-west-2`) | Plan Free hasta VR-01 y Pro cuando el dueño use el piloto sin acompañamiento (DEC-08). Con Pro, copias de seguridad nocturnas durante 7 días |
| Vercel | Hosting de la aplicación y sus logs de ejecución | Washington D. C./Virginia, EE. UU. (`iad1`, `us-east-1`) | Los logs no contienen la pregunta del chat (CA-63) ni tokens; sí la consulta de las peticiones entrantes y la ruta de las subpeticiones (sección 1) |
| DeepInfra | La pregunta redactada; hasta tres preguntas anteriores redactadas de nuevo y sin cifras; la última aclaración pendiente admisible; resultados pertinentes de las herramientas del catálogo de §11, incluidos nombres de entidades cuando sean necesarios. En desgloses, solo dimensión, entidad, período y métrica pedidos y agregados por segmento con tope, nunca el snapshot completo | EE. UU. | El riesgo aceptado de DEC-15 sigue siendo que el proveedor pueda registrar porciones de solicitudes para depuración o seguridad; no se presupone su eliminación. Su [página de privacidad](https://docs.deepinfra.com/account/data-privacy), consultada el 2026-11-10, declara que no guarda entradas ni salidas en disco en inferencia ordinaria, no registra el contenido de las solicitudes y no entrena con esos datos. Esta declaración no rebaja el riesgo aceptado |
| Anthropic (`M26a`) | **Paso web:** solo país, rubro de la lista cerrada y un tema fijo; la búsqueda se restringe a los dominios aprobados por el usuario (`www.facebook.com` en `/business/help/`, `cace.org.ar`, `www.indec.gob.ar`). **Paso de informe:** moneda, zona, ventana, objetivo, cifras ya calculadas, estados de cobertura, alias de entidades con sus nombres capturados (truncados a 120 caracteres y marcados no confiables), el catálogo de tipos de acción y los extractos web validados. Nunca recibe el identificador de la cuenta ni del negocio, el nombre o el identificador de la empresa, el correo ni el token | EE. UU. (ubicación no verificada) | La página de retención de datos de la API de Anthropic, en la versión fechada 2026-07-01 que cita la spec de M26a, declara que entradas y salidas de la API se borran en el backend a los 30 días, salvo excepciones. El usuario aceptó esa retención para el piloto. La búsqueda web tiene costo por consulta |
| Resend (SMTP) | La dirección del dueño y el mensaje completo de confirmación o recuperación, con su enlace o código de un solo uso, además de los registros de entrega | Envío: São Paulo, Brasil (`sa-east-1`), según la región informada; almacenamiento de datos: EE. UU., según Resend | Plan Free informado por el usuario el 2026-10-18; configurado sobre el dominio del piloto con SPF y DKIM (DEC-18) |

Las regiones configuradas de Supabase y Vercel, y la región de envío de Resend, fueron informadas por el usuario el 2026-10-18; no se verificaron desde los dashboards en esta sesión. La [documentación de seguridad de Resend](https://resend.com/security), consultada el 2026-10-18, distingue esa región de envío del almacenamiento de sus datos en EE. UU. La ubicación de cada subprocesador no se verificó.

## 5. Retención

| Qué | Cuánto tiempo | Fuente |
|---|---|---|
| Conexión pendiente sin confirmar | Vence a los 30 minutos y se purga en la siguiente visita o inicio, con intento de revocación en Meta. Hasta que el dueño vuelve, la credencial cifrada sigue en la base | DEC-17, CA-37b |
| Intentos de autorización vencidos o consumidos | Se purgan de forma perezosa | CA-38b |
| Datos de una conexión (credencial, snapshots, desgloses, observaciones, ejecuciones y registros del chat de esa conexión) | Mientras la conexión está viva. Al desconectar se borran | DEC-09, CA-38 |
| Snapshots reemplazados | Se conservan mientras la conexión está viva, porque son la procedencia de las respuestas | CA-38b |
| Registro por consulta del chat | Sin plazo propio. Los de una conexión se borran al desconectarla; los que no tienen conexión, solo al cerrar el piloto | DEC-12, CA-62, CA-65 |
| Objetivo e informe del diagnóstico (`M26a`) | Uno por empresa. El informe se reemplaza y el anterior se **borra** de la base activa al publicar uno nuevo; se **conserva oculto** tras desconectar Meta y se borra al borrar la empresa. `purge_connection` no lo toca | `meta_first/spec.md` §16, spec de M26a §5 |
| Datos del diagnóstico en Anthropic | 30 días según la retención declarada por Anthropic para la API, salvo excepciones | Página de retención citada en la spec de M26a |
| Todo lo del dueño, y la cuenta y la empresa sintéticas | Hasta el fin del piloto, cuando se ejecuta el cierre | DEC-12, DEC-18, DEC-20, CA-67 |
| Copias de seguridad del proveedor | Con Supabase Pro, hasta 7 días después del borrado | CA-38b |
| Correos y logs de Resend | 30 días en el plan Free informado por el usuario; las copias de seguridad de Resend se conservan 7 días. No se afirma un plazo único de borrado tras una solicitud individual | [Resend, seguridad](https://resend.com/security) y [Resend, datos y retención](https://resend.com/security/gdpr), consultadas el 2026-10-18 |

«Borrar» alcanza a la **base activa**. Con Supabase Pro, un dato borrado puede seguir hasta 7 días en las copias nocturnas; en el plan Free las copias no se pueden descargar. Es un límite declarado y no se mitiga (CA-38b). Según la información aportada por el usuario el 2026-10-18, los runtime logs del plan Hobby de Vercel duran 1 hora; los build logs se conservan indefinidamente por deployment. No se confirmó uso de Drains. Los logs de terceros no especificados en la tabla siguen sus propios plazos; no se confirmó un plazo específico para `auth_logs` de Supabase. La auditoría almacenada en Postgres no debe confundirse con esos logs: no se acreditó una purga automática ni que el cierre de CA-67 la elimine.

El historial de Meta se puede volver a obtener reconectando y resincronizando: Meta sirve los totales hasta 37 meses hacia atrás, con los valores revisados que tenga en ese momento (CA-38b).

## 6. Baja y borrado

- **Desconectar Meta** desde la tarjeta de Integraciones borra la credencial y los datos de esa conexión de la base activa e intenta revocar el token en Meta. Si la revocación falla, la credencial local se destruye igual. Desconectar no quita a Praxa del negocio del dueño en Meta: para eso, el dueño debe entrar a la configuración de su negocio en Meta, a las integraciones o apps conectadas, y quitar a Praxa (CA-38).
- **Diagnóstico (`M26a`):** desconectar Meta **no** borra el informe del diagnóstico: queda oculto en la base hasta que se publique otro o se borre la empresa. Generar un diagnóstico nuevo borra el anterior de la base activa. Un PDF ya descargado no se puede borrar desde PRAXA.
- **Pedido de borrado de toda la información:** hoy la aplicación no tiene un flujo de baja de cuenta (`H-E1-06`). El dueño se lo pide al operador, que ejecuta el procedimiento de cierre de CA-67 en el orden obligatorio: desconectar Meta, borrar la empresa, borrar la carpeta del usuario en `avatars` (ampliación aprobada por el usuario el 2026-11-05), borrar el usuario de Supabase Auth, quitar al dueño como tester de la app de Meta y pedirle que quite la app de su negocio. Además de ese procedimiento sobre los datos de PRAXA, si hay correos de Auth del dueño aún dentro de la retención de Resend, el operador solicita a Resend su borrado anticipado y registra la respuesta sin incluir direcciones, enlaces ni códigos en la evidencia. Resend indica que se le puede pedir la eliminación de un mensaje específico antes del vencimiento, pero no publica aquí un plazo garantizado para esa solicitud. Al cerrar el piloto, el mismo procedimiento borra también la empresa, la carpeta de `avatars` y el usuario de la cuenta sintética de `M28.2a` (DEC-18).
- **Qué no se borra de inmediato:** los correos y logs que Resend conserve hasta que venza su plazo o atienda la solicitud de borrado anticipado, las copias de seguridad de los proveedores dentro de sus plazos, los logs de los demás terceros dentro de sus plazos y, en DeepInfra, las porciones que haya registrado para depuración o seguridad. El cierre local de CA-67 no acredita el borrado en Resend.
- **Canal para el pedido:** [horaciococodrilo@gmail.com](mailto:horaciococodrilo@gmail.com).

## 7. Transferencias internacionales

**[REVISIÓN PROFESIONAL]** Entre los destinos conocidos fuera de Argentina están DeepInfra, Anthropic (diagnóstico, `M26a`) y el almacenamiento de Resend en EE. UU., y Supabase y Vercel en las regiones de EE. UU. informadas por el usuario. Resend envía los correos desde la región de São Paulo informada. Esta lista no es exhaustiva: no se verificó la ubicación de cada subprocesador. La Ley 25.326 de Protección de Datos Personales y sus normas complementarias regulan la transferencia internacional de datos personales. Esta acta no evalúa si los países de destino o las condiciones de cada proveedor cumplen esas exigencias, ni qué consentimiento o instrumento hace falta. Por decisión expresa del usuario del 2026-10-18, no se realiza ni se agenda esa evaluación para este proyecto escolar. Se conserva la marca de revisión profesional como límite no evaluado, sin afirmar cumplimiento ni una exención por el carácter escolar. DEC-15 mantiene la evaluación antes de escalar para el host del modelo.

## 8. Incidentes

| Incidente | Qué hacer |
|---|---|
| Filtración de la clave de cifrado de credenciales | Rotarla con el procedimiento de CA-25 y de `SECURITY.md`, sección 6, que fija las condiciones para retirar la clave vieja; revocar los tokens en Meta y avisar al dueño |
| Filtración de la clave de DeepInfra | Rotarla en DeepInfra y en las variables del despliegue |
| Filtración de la clave de Anthropic | Rotarla en la consola de Anthropic y en las variables del despliegue; revisar el uso de la cuenta |
| Filtración de un token de Meta o del secreto de la app | Desconectar Meta (revoca y borra la credencial), rotar el secreto de la app en Meta, actualizar `META_APP_SECRET` en las variables del despliegue y avisar al dueño |
| Acceso indebido a la base o a los logs | Revisar los accesos del proyecto en Supabase y en Vercel, rotar las credenciales afectadas y avisar al dueño |

**[REVISIÓN PROFESIONAL]** Si existe una obligación legal de notificar incidentes a una autoridad o al titular de los datos, sus plazos y su forma no se evalúan acá.

## 9. Qué se le comunica al dueño y cómo

Antes de su alta en PRAXA, que es el primer dato real (paso 15 de la fase B de `M16.2`), en una conversación con el dueño, el operador le explica:

1. qué datos de Meta se leen y para qué, y qué datos de su cuenta de Auth, del perfil y contexto de la empresa y de la foto opcional se guardan para darle acceso y configurar y mostrar su información en la app (secciones 1 y 2);
2. quién accede y qué terceros intervienen, incluido que el modelo del chat está en EE. UU. y que Resend recibe y conserva el mensaje completo de Auth con su enlace o código de un solo uso (secciones 3 y 4);
3. que las preguntas del chat se registran redactadas, sin las respuestas, y que el operador puede verlas (CA-62, CA-64);
4. cuánto tiempo se conserva cada cosa: los correos y logs de Resend durante 30 días en el plan Free informado, las copias de Resend durante 7 días y el límite de hasta 7 días de las copias nocturnas de Supabase Pro; una solicitud de borrado anticipado a Resend no tiene un plazo garantizado aquí (secciones 5 y 6);
5. cómo desconectar Meta, cómo quitar a Praxa desde su negocio en Meta y cómo pedir el borrado de todo (sección 6).

Además, la pantalla del chat avisa que las preguntas se registran y para qué (CA-65), y la desconexión declara el límite de las copias de seguridad (CA-38b).

El operador se compromete a mantener esta conversación antes del alta del dueño (confirmación del usuario del 2026-10-18). La confirmación del compromiso no acredita que la conversación ya haya ocurrido.

Antes de la primera sincronización ampliada, el operador explica al dueño las nuevas categorías y niveles de datos y que el modelo recibirá los resultados pertinentes y, cuando corresponda, nombres de entidades. Registra esa comunicación y la conformidad del dueño sin datos personales ni cifras en la evidencia de M16c.3. La comunicación histórica sobre gasto e impresiones no acredita este paso nuevo.

Lo mismo vale para los desgloses (DEC-23): el usuario declaró el 2026-11-08 la conformidad del dueño para estos datos, sin evidencia adjunta. **Antes de que el modelo reciba datos reales**, el operador debe explicarle al dueño esta ampliación: qué resultados minimizados de Meta, incluidos agregados por edad, género y lugar, y qué preguntas anteriores o aclaración pendiente viajarán a DeepInfra; que se registra la pregunta redactada y un eventual voto, sin guardar la respuesta; el arriendo técnico del turno; el riesgo aceptado de retención de porciones por el host, aunque su página actual declare una práctica más restrictiva; y el límite de grupos pequeños sin mínimo garantizado. El usuario debe declarar que hizo esa comunicación, sin copiar mensajes, nombres, cifras ni identificadores a esta acta.

**Antes del primer diagnóstico con datos reales (`M26a`)**, el operador explica al dueño: que el diagnóstico envía a Anthropic, en EE. UU., las cifras ya calculadas y los nombres de campañas, conjuntos y anuncios, y que una búsqueda web separada envía solo el país, el rubro y un tema fijo; que Anthropic declara conservar entradas y salidas 30 días; que el informe se conserva oculto tras desconectar Meta y se borra al generar otro o al borrar la empresa; que un PDF descargado no se puede revocar; y que las interpretaciones de Claude pueden equivocarse. El usuario declara esa comunicación sin copiar mensajes, nombres, cifras ni identificadores a esta acta.

## 10. Aprobación

Solo el usuario aprueba esta acta. El estado de `G-ACTA-META` y la versión a la que aplica se registran en [`docs/PROJECT_STATE.md`](../../../PROJECT_STATE.md); la [sesión de M03a](../meta_first/sesiones/M03a.md) conserva la evidencia de cada aprobación.

La ampliación M25a descrita arriba está **pendiente de nueva aprobación expresa del usuario y de su declaración de comunicación al dueño**. La aprobación histórica no se extiende automáticamente a los nuevos flujos hacia DeepInfra.

La ampliación M26a (diagnóstico con Anthropic) fue **aprobada por el usuario el 2026-11-14**, solo en sus propiedades. Falta su declaración de comunicación al dueño (sección 9): sin ella no se genera un diagnóstico con datos reales.
