# Roadmap de microfases del MVP de PRAXA — versión 2.3

Versión 2.3 — 2026-09-21. Reformula, sin cambiar su información ni alcance, la versión 2.2 como una especificación operativa para asistentes de IA. Conserva el cierre `PASS` de M00, la selección empírica de Rama A, H-M00-01, las correcciones de M04 y las decisiones aprobadas antes de iniciar M05.1.

## Contrato de ejecución para asistentes de IA

Este documento es la especificación operativa vigente del proyecto. El asistente debe usarlo para determinar qué puede ejecutar, qué evidencia debe producir, qué condición debe cumplir antes de avanzar y qué acciones están reservadas al usuario.

### Roles

- **Asistente de IA:** inspecciona el estado real del repositorio, implementa únicamente la microfase solicitada, ejecuta las verificaciones indicadas, registra evidencia reproducible y comunica cualquier bloqueo o contradicción.
- **Usuario:** realiza exclusivamente las acciones indicadas en `Intervención requerida del usuario`, en especial las relacionadas con cuentas externas, secretos, decisiones de negocio y aprobaciones visibles. El asistente nunca debe pedir que se peguen secretos en el chat.

### Protocolo obligatorio

1. Leer las instrucciones vigentes del repositorio antes de actuar, incluidas `AGENTS.md` y las referencias que éste exija para los archivos que vayan a modificarse.
2. Ejecutar una sola microfase por vez y sólo cuando el usuario la solicite. No iniciar automáticamente la microfase siguiente.
3. Antes de modificar archivos, comprobar el estado de Git, las dependencias de la microfase y su condición de entrada. Preservar cambios preexistentes del usuario.
4. Tratar `Implementación requerida` y `Procedimiento del asistente` como alcance obligatorio. No ampliar ni reducir ese alcance sin una decisión explícita del usuario.
5. Verificar el resultado con `Pruebas` y `Criterio de aceptación`. La mera existencia de código o configuración no constituye evidencia de funcionamiento.
6. Registrar la evidencia indicada en `Evidencia de cierre`, con comandos, resultados y limitaciones pertinentes, sin exponer claves, tokens, contraseñas ni valores de archivos de entorno.
7. Detenerse cuando sea necesaria una acción de `Intervención requerida del usuario`; explicar exactamente qué debe hacer el usuario sin ejecutar esa acción en su nombre, salvo autorización expresa y segura.
8. No declarar una microfase cerrada ni habilitar sus sucesoras hasta cumplir `Condición para avanzar`. Un fallo debe quedar diagnosticado y asignado a una microfase concreta.
9. Registrar cada hallazgo nuevo con un ID estable, impacto, evidencia y microfase asignada. No convertir un hallazgo en ampliación silenciosa del alcance.
10. Al terminar, informar el estado del gate, los archivos modificados, las verificaciones ejecutadas y cualquier pendiente. No hacer commit, push, despliegue ni otra publicación salvo que el usuario lo solicite.

## Reglas de este roadmap

- Cada sección es una microfase independiente y revisable de **hasta 8 horas de implementación**. Es un límite de tamaño del corte, no una estimación ni una asignación de tiempo al usuario.
- Todas las microfases usan la misma plantilla operativa: ID, objetivo, implementación requerida, procedimiento del asistente, evidencia de cierre, aceptación, pruebas, condición para avanzar, dependencias y eventual intervención del usuario.
- El usuario no implementa código. Su intervención se limita a autorizar cuentas, aportar contexto, decidir alcance y validar entregas visibles cuando la microfase lo indique.
- Los IDs con punto, por ejemplo `M07.2`, son subdivisiones del ID estable original.
- `M10b`, `M19a`, `M19b`, `M24a` y `M24b` son IDs nuevos estables solicitados en esta revisión.

## Contratos corregidos antes de ejecutar

### Dos productos posibles, no una versión completa y otra incompleta

| Rama | Producto | Promesa |
|---|---|---|
| **A** | `ads_catalog` | Diagnosticar desalineaciones entre inversión publicitaria, medición, catálogo y stock usando Tiendanube, GA4 y Meta. |
| **B** | `commerce_reliability` | Auditar la confiabilidad de la medición y los riesgos observables del catálogo usando Tiendanube y GA4. No habla de eficiencia publicitaria, gasto desperdiciado ni presupuesto. |

M00 terminó en `PASS` el 2026-09-20 y habilitó `product_variant=ads_catalog` (Rama A). M03 debe formalizar esa selección completa, sus datos y H-M00-01. Rama B no se describe como Rama A con detectores faltantes: tiene otra promesa, criterios de aceptación, navegación, textos y alcance analítico.

### Contrato de los dos reportes

K16 incorpora:

- `report_kind: reliability | catalog`;
- `product_variant: ads_catalog | commerce_reliability`;
- `window_start`, `window_end`, `window_days` y `minimum_window_days`;
- `coverage_mode: observed | reconstructed_biased | mixed`;
- `narration_mode: template | llm`;
- `status: partial | ready | failed`;
- restricción única por `analysis_run_id + report_kind`.

Reglas de publicación:

| `report_kind` | Ventana mínima | Fuentes y condición |
|---|---:|---|
| `reliability` | 28 días consecutivos | Superposición completa Tiendanube + GA4. En Rama A, los controles Meta de M19b se agregan sólo si su propia cobertura pasa; no retrasan el reporte base TN+GA4. |
| `catalog` | 28 días de pedidos + snapshot actual de catálogo | Puede usar stock reconstruido por M10b con `coverage_mode=reconstructed_biased`. Cualquier afirmación sobre publicado/despublicado exige al menos 7 días de observación directa de M12; de lo contrario queda `not_evaluable`. |

Los reportes no se mezclan en una sola entrega. Cada uno tiene publicación, aceptación y UI propias.

---

## Fase 0 — Validación de fuentes, datos y producto

**Condición de cierre:** acceso Meta clasificado, cobertura piloto medida, consultas GA4 verificadas y `product_variant` aprobado.

### M00 — Experimento de acceso a Meta — CERRADA `PASS`

| Campo | Contenido |
|---|---|
| **ID** | `M00` — cerrada `PASS` el 2026-09-20 |
| **Objetivo** | Determinar si la cuenta publicitaria piloto puede leerse sin depender de una aprobación futura. |
| **Implementación requerida** | Spike aislado de OAuth y consulta mínima de cuenta e insights, con log redactado. |
| **Procedimiento del asistente** | Configurar app y redirect; autorizar tester; consultar cuenta, moneda, zona e insights; registrar permisos y error; clasificar. |
| **Evidencia de cierre** | Evidencia redactada de OAuth, cuenta piloto e insights diarios reales; los dos payloads JSON crudos se conservan sin tokens. |
| **Criterio de aceptación** | Cumplido: OAuth completado por el usuario piloto, `ads_read` concedido, cuenta `act_715300545590091` (“MILK KIDS”), moneda ARS, zona `America/Los_Angeles` y siete filas reales de insights entre 2026-09-13 y 2026-09-19. |
| **Pruebas** | `me/adaccounts` devolvió la cuenta esperada; `/insights?date_preset=last_7d&time_increment=1` devolvió spend e impressions reales; cero tokens en la evidencia. |
| **Condición para avanzar** | `PASS`: fija Rama A candidata para el acta M03 y habilita M16.1, M16.2, M19b y D02. |
| **Dependencias / habilita** | — / `M03`, `M16.1` o `M16b` |
| **Intervención requerida del usuario** | Identificar la cuenta, ser agregado como tester y completar una autorización. |

Resultado empírico: Meta permitió leer una cuenta publicitaria de terceros con `ads_read`, sin App Review y sin portfolio empresarial verificado, cuando el dueño otorgó acceso mediante Business Manager. Esto cierra la contradicción documental que motivó M00; no amplía los permisos más allá de la cuenta autorizada.

#### H-M00-01 — La cuenta Meta usa una zona horaria distinta

La cuenta `act_715300545590091` reporta gasto diario en `America/Los_Angeles`, no en `America/Buenos_Aires`. Tiendanube y GA4 pueden cerrar sus días en otra zona; unir etiquetas de fecha sin normalizar desplaza ventanas cuatro o cinco horas y puede mover gasto real entre días. Con aproximadamente ARS 30.000 diarios, el efecto es material.

Asignación: M03 debe declarar la zona canónica y la política de comparación; el detector de consistencia de zona horaria del Bloque 0 debe preservar la zona de cada fuente, convertir límites de ventana por instante y abstenerse ante una alineación desconocida. Ignorarlo produciría cruces gasto–pedido incorrectos aunque cada fuente fuera internamente válida.

### M01.1 — Inventario y saneamiento de la muestra piloto

| Campo | Contenido |
|---|---|
| **ID** | `M01.1` — ≤8 h |
| **Objetivo** | Obtener una muestra utilizable sin PII. |
| **Implementación requerida** | Manifiesto de archivos/campos, escáner de PII y perfil de períodos, nulos y duplicados. |
| **Procedimiento del asistente** | Inventariar fuentes; seleccionar mínimo; redactar PII; medir períodos y volumen; conciliar totales básicos. |
| **Evidencia de cierre** | Muestra saneada y manifiesto reproducible. |
| **Criterio de aceptación** | No contiene email, teléfono ni domicilio y sus totales coinciden con el origen. |
| **Pruebas** | PII inyectada; campo obligatorio faltante; duplicado; período vacío. |
| **Condición para avanzar** | La muestra saneada habilita M01.2. |
| **Dependencias / habilita** | — / `M01.2` |
| **Intervención requerida del usuario** | Facilitar exportaciones o acceso de sólo lectura. |

### M01.2 — Matriz de evaluabilidad del piloto

| Campo | Contenido |
|---|---|
| **ID** | `M01.2` — ≤8 h |
| **Objetivo** | Clasificar cada capacidad con evidencia real. |
| **Implementación requerida** | Matriz detector × campo × fuente × cobertura y distribución de volumen. |
| **Procedimiento del asistente** | Mapear campos a consumidores; medir claves; evaluar volumen; clasificar `EVALUABLE`, `AGGREGATE_ONLY` o `NOT_EVALUABLE`; documentar razón. |
| **Evidencia de cierre** | Una clasificación reproducible para cada detector propuesto. |
| **Criterio de aceptación** | Cada fila cita campos, período, volumen y limitación. |
| **Pruebas** | Detector sin campo; join ambiguo; poco volumen; período no superpuesto. |
| **Condición para avanzar** | Si ninguna promesa central es evaluable, se redefine el producto en M03. |
| **Dependencias / habilita** | `M01.1` / `M02.1`, `M03`, cierre de `M05.2` |
| **Intervención requerida del usuario** | Explicar identificadores de producto/variante y cualquier ausencia conocida. |

### M02.1 — Catálogo experimental de consultas GA4

| Campo | Contenido |
|---|---|
| **ID** | `M02.1` — ≤8 h |
| **Objetivo** | Expresar cada necesidad analítica como una consulta cerrada. |
| **Implementación requerida** | Specs experimentales por detector con dimensiones, métricas, filtros y scope. |
| **Procedimiento del asistente** | Enumerar consultas; separar item/event/session; fijar filtros; asociar consumidor; crear fixtures incompatibles. |
| **Evidencia de cierre** | Catálogo candidato versionado. |
| **Criterio de aceptación** | Ningún detector depende de una consulta implícita o ad hoc. |
| **Pruebas** | Scope mezclado; filtro ausente; spec duplicada; consumidor inexistente. |
| **Condición para avanzar** | Las specs completas habilitan M02.2. |
| **Dependencias / habilita** | `M01.2` / `M02.2` |
| **Intervención requerida del usuario** | Ninguna. |

### M02.2 — Compatibilidad y controles reales de GA4

| Campo | Contenido |
|---|---|
| **ID** | `M02.2` — ≤8 h |
| **Objetivo** | Verificar las specs contra la propiedad piloto. |
| **Implementación requerida** | Ejecución de compatibilidad, muestras, medición de “other” y comparación manual. |
| **Procedimiento del asistente** | Autorizar propiedad; verificar cada spec; ejecutar compatibles; medir cardinalidad/umbrales; comparar dos totales; clasificar. |
| **Evidencia de cierre** | Matriz spec × compatibilidad × cobertura × diferencia. |
| **Criterio de aceptación** | Sólo specs compatibles y explicables quedan aprobadas. |
| **Pruebas** | Incompatible bloqueada; “other” alto; control divergente; definición custom sin historia. |
| **Condición para avanzar** | Sólo specs PASS pasan a M14.1. |
| **Dependencias / habilita** | `M02.1` / `M03`, `M14.1` |
| **Intervención requerida del usuario** | Autorizar GA4 y confirmar dos totales en su interfaz. |

### M03 — Acta de producto, datos y privacidad

| Campo | Contenido |
|---|---|
| **ID** | `M03` — corte único, ≤8 h |
| **Objetivo** | Elegir uno de dos productos completos y autorizar sus datos. |
| **Implementación requerida** | Acta con `product_variant=ads_catalog`, fuentes, detectores —incluido D02—, reportes habilitados, retención, borrado, consentimiento, lenguaje prohibido y política de zonas horarias. |
| **Procedimiento del asistente** | Resumir M00–M02; formalizar Rama A; fijar promesa propia; limitar datos; resolver no evaluables; declarar zona canónica y tratamiento de Meta `America/Los_Angeles`; aprobar privacidad. |
| **Evidencia de cierre** | Alcance sin TBD críticos y con criterios específicos para el producto elegido. |
| **Criterio de aceptación** | Rama A queda aprobada con Meta realmente accesible; ninguna comparación diaria mezcla etiquetas de fecha de zonas distintas sin convertir los límites por instante. Rama B, si se activara posteriormente, nunca se define como “Rama A sin Meta”. |
| **Pruebas** | Cada dato tiene consumidor; cada capacidad pertenece al producto; ventana Meta LA contra TN/GA4 en otra zona; transición DST de cuatro/cinco horas; enmienda obligatoria si M16.2 activa Rama B. |
| **Condición para avanzar** | Sin acta no se conectan datos reales. |
| **Dependencias / habilita** | `M00`, `M01.2`, `M02.2` / OAuth reales, metodología definitiva |
| **Intervención requerida del usuario** | Aprobar producto, datos, retención, borrado, limitaciones y consentimiento. |

---

## Fase 1 — Base segura y reanudable

**Condición de cierre:** contratos, almacenamiento, aislamiento, cifrado, jobs y onboarding listos para fuentes reales.

### M04.1 — Auditoría del repositorio existente — CERRADA

| Campo | Contenido |
|---|---|
| **ID** | `M04.1` — cerrada el 2026-09-17 |
| **Objetivo** | Clasificar el repositorio existente contra el roadmap v2 sin confundir código presente con comportamiento probado. |
| **Implementación requerida** | Inventario congelado de 83 archivos, veredictos conservar/adaptar/retirar, respuestas obligatorias y hallazgos con microfase asignada. |
| **Procedimiento del asistente** | Congelar snapshot; leer instrucciones; auditar aplicación, SQL, pruebas, scripts y dependencias; reconciliar 83/83; aprobar retiros. |
| **Evidencia de cierre** | `docs/FASES/FASE1/MF04/m04-1-auditoria.md`. |
| **Criterio de aceptación** | Cada archivo tiene un veredicto trazable al v2 y todo adaptar/retirar tiene destino. |
| **Pruebas** | Reconciliación bidireccional del manifiesto; revisión estática sin operaciones contra Supabase. |
| **Condición para avanzar** | `G-AUDIT`: **APROBADO**. |
| **Dependencias / habilita** | — / `M04.2` |
| **Intervención requerida del usuario** | Ninguna. |

### M04.2 — Runtime, CI y autenticación base — CERRADA

| Campo | Contenido |
|---|---|
| **ID** | `M04.2` — cerrada el 2026-09-19 |
| **Objetivo** | Dejar una baseline reproducible local, limpia y remota. |
| **Implementación requerida** | Node 24 fijado, instalación limpia, CI Ubuntu, evidencia de Auth y documentación activa alineada. |
| **Procedimiento del asistente** | Fijar runtime; configurar workflow; mover el checkout fuera de OneDrive; verificar; probar Auth; clonar limpio; observar CI real. |
| **Evidencia de cierre** | `docs/FASES/FASE1/MF04/m04-2-baseline.md`, `.nvmrc`, workflow y commits de evidencia. |
| **Criterio de aceptación** | T-M04.2-01–06 en `PASS`, clon limpio verde y GitHub Actions en `success`. |
| **Pruebas** | `npm ci`; `npm run verify`; seis pasos de Auth; run 35456743013 en 54 s. |
| **Condición para avanzar** | `G-BASELINE`: **APROBADO**; habilita M05.1.1. |
| **Dependencias / habilita** | `M04.1` / `M05.1.1` |
| **Intervención requerida del usuario** | Configurar Supabase y editar `.env.local` exclusivamente a mano. |

> **Nota de CI, 2026-09-19:** GitHub anunció que `ubuntu-latest` comenzará a migrar a Ubuntu 26 el 2026-10-19. No crea una microfase; antes o después de esa fecha se debe observar una corrida verde y fijar una imagen explícita sólo si aparece una incompatibilidad.

### Mantenimiento inmediato posterior a M04 — COMPLETADO

- Dependabot quedó configurado semanalmente para npm mediante `.github/dependabot.yml`; en GitHub se activaron vulnerability alerts y automated security fixes.
- Se revisó el aviso de `npm ci` para `unrs-resolver@1.12.2`. Es una dependencia transitiva de desarrollo de `eslint-config-next`; su script usa `napi-postinstall` para preparar el binding nativo y puede recurrir al registro npm si el opcional falta. Los entornos verificados ya reciben el binding opcional correcto, `npm audit` informó 0 vulnerabilidades y no se aprobó manualmente el fallback. Una aprobación futura exige revisar otra vez versión, integridad y código ejecutado.

### Grupo M05.1 — Contratos de control e ingesta

M05.1 se divide únicamente por sus doce contratos conocidos. Cada corte entrega un schema estricto, versión, fixtures válidos e inválidos y documentación de invariantes. M05.1 no comienza hasta que se abra explícitamente una nueva sesión de ejecución.

### M05.1.1 — K01 `TenantContext`

| Campo | Contenido |
|---|---|
| **ID** | `M05.1.1` — ≤8 h |
| **Objetivo** | Fijar la identidad tenant que consumen todos los contratos posteriores. |
| **Implementación requerida** | K01 con `user_id` verificado, `company_id` resuelto por membresía, `role=owner` y `request_id`; nunca acepta un tenant elegido por el navegador. |
| **Procedimiento del asistente** | Definir schema y versión; resolver claims/membresía; prohibir IDs aportados por cliente; crear fixtures; documentar invariantes. |
| **Evidencia de cierre** | K01 exportable con fixtures y contrato documentado. |
| **Criterio de aceptación** | Un contexto sólo existe si usuario, membresía y empresa coinciden. |
| **Pruebas** | Claim ausente; empresa manipulada; membresía inexistente; rol inválido; campo extra. |
| **Condición para avanzar** | Habilita contratos tenant-scoped. |
| **Dependencias / habilita** | `M04.2` / `M05.1.2`–`M05.1.12` |
| **Intervención requerida del usuario** | Ninguna. |

### M05.1.2 — K02 `OAuthAttempt`

| Campo | Contenido |
|---|---|
| **ID** | `M05.1.2` — ≤8 h |
| **Objetivo** | Modelar intentos OAuth consumibles una sola vez y resistentes a CSRF. |
| **Implementación requerida** | K02 con empresa, proveedor, `state_hash`, PKCE cifrado cuando aplique, redirect/return allowlisted, expiración, consumo, estado y error. |
| **Procedimiento del asistente** | Definir estados; hashear state; tipar PKCE/redirect/retorno; fijar expiración y consumo atómico; crear fixtures. |
| **Evidencia de cierre** | K02 versionado y probado. |
| **Criterio de aceptación** | Nunca persiste state claro ni permite reutilizar un intento. |
| **Pruebas** | State claro; redirect externo; vencido; doble consumo; proveedor inválido. |
| **Condición para avanzar** | Habilita contratos de conexión OAuth. |
| **Dependencias / habilita** | `M05.1.1` / `M05.1.3`, `M08.1`, OAuth de M09/M13/M16 |
| **Intervención requerida del usuario** | Ninguna. |

### M05.1.3 — K03 `IntegrationConnection`

| Campo | Contenido |
|---|---|
| **ID** | `M05.1.3` — ≤8 h |
| **Objetivo** | Representar una conexión externa y su salud sin incluir credenciales. |
| **Implementación requerida** | K03 con tenant, proveedor, cuenta externa, scopes, estados, zona, moneda, timestamps, último error y versión del conector. |
| **Procedimiento del asistente** | Definir proveedores/estados/transiciones; separar metadata de secretos; tipar salud y versión; crear fixtures. |
| **Evidencia de cierre** | K03 versionado y probado. |
| **Criterio de aceptación** | Estado, proveedor y metadata son compatibles y no contienen tokens. |
| **Pruebas** | Transición inválida; provider desconocido; token inyectado; moneda/zona inválida; campo extra. |
| **Condición para avanzar** | Habilita secretos, jobs y onboarding por fuentes. |
| **Dependencias / habilita** | `M05.1.1`, `M05.1.2` / `M05.1.4`–`M05.1.7`, `M08.1` |
| **Intervención requerida del usuario** | Ninguna. |

### M05.1.4 — K04 `SecretCredential`

| Campo | Contenido |
|---|---|
| **ID** | `M05.1.4` — ≤8 h |
| **Objetivo** | Definir credenciales cifradas que nunca atraviesan la Data API. |
| **Implementación requerida** | K04 con tenant/conexión, ciphertext, IV, auth tag, versión de clave, tipo, expiración, presencia de refresh y rotación. |
| **Procedimiento del asistente** | Tipar sobre cifrado; prohibir texto claro; ligar a K03; versionar clave; crear fixtures de rotación y error. |
| **Evidencia de cierre** | K04 versionado y probado. |
| **Criterio de aceptación** | Ningún fixture válido contiene token o secreto claro. |
| **Pruebas** | Plaintext; IV/tag ausente; versión desconocida; conexión cruzada; expiración inválida. |
| **Condición para avanzar** | Habilita almacenamiento privado y worker acotado. |
| **Dependencias / habilita** | `M05.1.3` / `M06.3` |
| **Intervención requerida del usuario** | Ninguna. |

### M05.1.5 — K05 `SyncJob`

| Campo | Contenido |
|---|---|
| **ID** | `M05.1.5` — ≤8 h |
| **Objetivo** | Cerrar el contrato durable de trabajo, reintento y leasing. |
| **Implementación requerida** | K05 con tenant/conexión, kind, recurso, ventana, estado, disponibilidad, lease, intentos, idempotencia, error redactado y finalización. |
| **Procedimiento del asistente** | Definir kinds/estados terminales; tipar ventana/lease/intentos; fijar idempotencia y redacción; crear fixtures. |
| **Evidencia de cierre** | K05 versionado y probado. |
| **Criterio de aceptación** | No admite estado, lease, intento o ventana incompatibles. |
| **Pruebas** | Transición inválida; lease sin owner; intento excedido; idempotency vacía; secreto en error. |
| **Condición para avanzar** | Habilita checkpoints y arquitectura de jobs. |
| **Dependencias / habilita** | `M05.1.1`, `M05.1.3` / `M05.1.6`, `M05.1.7`, `M07.1` |
| **Intervención requerida del usuario** | Ninguna. |

### M05.1.6 — K06 `SyncCheckpoint`

| Campo | Contenido |
|---|---|
| **ID** | `M05.1.6` — ≤8 h |
| **Objetivo** | Modelar reanudación sin inventar un cursor común entre proveedores. |
| **Implementación requerida** | K06 con tenant/conexión/recurso, cursor opaco, watermark, ventana, última observación, versión del conector y job. |
| **Procedimiento del asistente** | Tipar cursor como opaco; ligar K03/K05; separar watermark de observación; versionar; crear fixtures. |
| **Evidencia de cierre** | K06 versionado y probado. |
| **Criterio de aceptación** | Un checkpoint sólo avanza asociado a conexión, recurso, versión y job compatibles. |
| **Pruebas** | Cursor normalizado global; job cruzado; ventana invertida; versión ausente; watermark inválido. |
| **Condición para avanzar** | Habilita paginación y reanudación segura. |
| **Dependencias / habilita** | `M05.1.3`, `M05.1.5` / `M07.2`, extractores |
| **Intervención requerida del usuario** | Ninguna. |

### M05.1.7 — K07 `RawObservation`

| Campo | Contenido |
|---|---|
| **ID** | `M05.1.7` — ≤8 h |
| **Objetivo** | Definir evidencia raw append-only, trazable e idempotente. |
| **Implementación requerida** | K07 con tenant/conexión/job, fuente/recurso/ID externo, tiempos, payload, SHA-256, versión, ETag y page ref. |
| **Procedimiento del asistente** | Definir allowlist de metadata; exigir hash y referencias; prohibir mutación; versionar payload; crear fixtures. |
| **Evidencia de cierre** | K07 versionado y probado. |
| **Criterio de aceptación** | Toda observación cita origen y hash; una corrección crea otra observación. |
| **Pruebas** | Raw sin hash; update; tenant/job cruzado; fecha inválida; payload sin versión. |
| **Condición para avanzar** | Habilita normalizadores, enlaces, replay y snapshot. |
| **Dependencias / habilita** | `M05.1.3`, `M05.1.5` / `M05.1.8`–`M05.1.12`, M10–M18 |
| **Intervención requerida del usuario** | Ninguna. |

### M05.1.8 — K08 `CanonicalEntityLink`

| Campo | Contenido |
|---|---|
| **ID** | `M05.1.8` — ≤8 h |
| **Objetivo** | Vincular identidades externas sin fusionar ni sobrescribir observaciones. |
| **Implementación requerida** | K08 con tenant, entidad canónica/tipo, fuente/ID externo, vigencia, método, confianza y referencias de evidencia. |
| **Procedimiento del asistente** | Definir tipos/métodos; acotar confianza; tipar vigencia; exigir evidencia; crear casos ambiguos. |
| **Evidencia de cierre** | K08 versionado y probado. |
| **Criterio de aceptación** | Ningún enlace ambiguo se vuelve exacto sin evidencia. |
| **Pruebas** | Vigencia solapada; confianza fuera de rango; método incompatible; evidencia inexistente; tenant cruzado. |
| **Condición para avanzar** | Habilita reconciliación entre fuentes. |
| **Dependencias / habilita** | `M05.1.1`, `M05.1.7` / `M05.1.9`, `M05.1.10`, M11.3, M18 |
| **Intervención requerida del usuario** | Ninguna. |

### M05.1.9 — K09 `CatalogVariantObservation`

| Campo | Contenido |
|---|---|
| **ID** | `M05.1.9` — ≤8 h |
| **Objetivo** | Tipar observaciones de producto/variante sin convertir estado actual en historia inventada. |
| **Implementación requerida** | K09 con tenant, variante canónica, raw, fuente, IDs, SKU, handle, URL, publicación, stock, precio/moneda, candidato principal y tiempo. |
| **Procedimiento del asistente** | Definir nulabilidad y dinero decimal; ligar K07/K08; separar observado de reconstruido; crear fixtures temporales. |
| **Evidencia de cierre** | K09 versionado y probado. |
| **Criterio de aceptación** | Publicación y stock sólo se afirman para el instante observado. |
| **Pruebas** | Raw inexistente; float; moneda ausente; variante cruzada; timestamp futuro; estado reconstruido como observado. |
| **Condición para avanzar** | Habilita normalización y serie M12. |
| **Dependencias / habilita** | `M05.1.7`, `M05.1.8` / `M11.1`, `M12.1` |
| **Intervención requerida del usuario** | Ninguna. |

### M05.1.10 — K10 `OrderObservation`

| Campo | Contenido |
|---|---|
| **ID** | `M05.1.10` — ≤8 h |
| **Objetivo** | Tipar pedidos y líneas sin PII y con importes reproducibles. |
| **Implementación requerida** | K10 pedido con tenant, orden canónica/raw, ID externo, tiempos, estado, total/moneda y observación; líneas con refs producto/variante, cantidad y unit gross. |
| **Procedimiento del asistente** | Definir estados y dinero decimal; excluir PII; ligar raw/enlaces; tipar líneas; crear fixtures de cancelación y devolución. |
| **Evidencia de cierre** | K10 versionado y probado. |
| **Criterio de aceptación** | Totales y unidades son reproducibles sin email, teléfono ni domicilio. |
| **Pruebas** | PII inyectada; float; línea huérfana; moneda incompatible; cancelado/reembolso; raw cruzado. |
| **Condición para avanzar** | Habilita normalización de pedidos y reconstrucción sesgada. |
| **Dependencias / habilita** | `M05.1.7`, `M05.1.8` / `M11.2`, `M10b` |
| **Intervención requerida del usuario** | Ninguna. |

### M05.1.11 — K11 `GA4AggregateObservation`

| Campo | Contenido |
|---|---|
| **ID** | `M05.1.11` — ≤8 h |
| **Objetivo** | Cerrar agregados GA4 tipados por spec, sin filas libres de dimensión o métrica. |
| **Implementación requerida** | K11 con tenant/raw, spec y versión, fecha, dimensiones/métricas allowlisted, row count, thresholding/other y tiempo. |
| **Procedimiento del asistente** | Definir shapes por spec; tipar métricas/dimensiones; registrar thresholding y other; ligar K07; crear fixtures. |
| **Evidencia de cierre** | K11 versionado y probado. |
| **Criterio de aceptación** | Toda métrica corresponde a una spec versionada y evidencia raw. |
| **Pruebas** | Dimensión libre; métrica incompatible; spec ausente; other inválido; raw/tenant cruzado. |
| **Condición para avanzar** | Habilita promoción de specs y normalización GA4. |
| **Dependencias / habilita** | `M05.1.7` / `M14.1`, `M15.3` |
| **Intervención requerida del usuario** | Ninguna. |

### M05.1.12 — K12 `AdDeliveryObservation` y cierre K01–K12

| Campo | Contenido |
|---|---|
| **ID** | `M05.1.12` — ≤8 h |
| **Objetivo** | Cerrar observaciones Meta de Rama A y verificar el conjunto completo K01–K12. |
| **Implementación requerida** | K12 con tenant/raw, cuenta/campaña/adset/ad, estado, fecha, gasto/moneda, destino, UTM, referencia creativa y tiempo; matriz final de referencias K01–K12. |
| **Procedimiento del asistente** | Tipar jerarquía y dinero; ligar K07/K08; limitar a Rama A; crear fixtures; ejecutar validación cruzada y documentar versiones de los doce contratos. |
| **Evidencia de cierre** | K12 y catálogo K01–K12 exportables, versionados y probados. |
| **Criterio de aceptación** | K12 no existe en outputs de Rama B; los doce contratos rechazan tenant, secreto, estado o referencia incompatibles. |
| **Pruebas** | Rama B; gasto float; moneda/fecha inválida; jerarquía rota; raw cruzado; referencias K01–K12; campos extra. |
| **Condición para avanzar** | `G-K01-K12`: habilita M05.2, M06.1, M11.1 y M14.1. |
| **Dependencias / habilita** | `M05.1.1`–`M05.1.11` / `M05.2`, `M06.1`, `M11.1`, `M14.1` |
| **Intervención requerida del usuario** | Ninguna. |

### M05.2 — Contratos analíticos y dos reportes

| Campo | Contenido |
|---|---|
| **ID** | `M05.2` — ≤8 h |
| **Objetivo** | Cerrar K13–K19 y la metodología versionada. |
| **Implementación requerida** | Calidad, detectores, hallazgos, runs, K16 con `report_kind` y `narration_mode: template \| llm`, chat y snapshot; umbrales y fórmulas. |
| **Procedimiento del asistente** | Incorporar resultados M01–M03; definir abstenciones; separar reportes; fijar ventanas mínimas; validar ledger/evidencia; versionar metodología. |
| **Evidencia de cierre** | Contratos de análisis y publicación con fixtures para ambos productos y ambos reportes. |
| **Criterio de aceptación** | `reliability` y `catalog` no pueden confundirse ni publicarse debajo de su ventana mínima. |
| **Pruebas** | `report_kind` inválido; ventana corta; producto incompatible; hallazgo sin evidencia; número fuera del ledger. |
| **Condición para avanzar** | Metodología cerrada habilita M19a.1, M19b.1, M22.1 y M23.1. |
| **Dependencias / habilita** | `M05.1.12`, `M01.2`, `M03` / análisis y reportes |
| **Intervención requerida del usuario** | Aprobar significado comercial, umbrales, pesos y promesas de cada reporte. |

### M06.1 — Esquemas y migraciones base

| Campo | Contenido |
|---|---|
| **ID** | `M06.1` — ≤8 h |
| **Objetivo** | Materializar K01–K12 en PostgreSQL. |
| **Implementación requerida** | Esquemas, tablas, constraints, índices y una cadena limpia para el proyecto nuevo: se retiran `0002` y `0005`–`0011`, se corrige `0003` para no depender del contexto descartado y se reescribe `0004` para los objetos K01–K12 vigentes. |
| **Procedimiento del asistente** | Materializar control/data plane; aplicar `company_id`; corregir la cadena heredada; agregar constraints; instalar desde cero; probar registro confirmado, alta de empresa/membresía y entrada a `/app`; documentar rollback aplicable al baseline nuevo. |
| **Evidencia de cierre** | Base migrable con topología documentada. |
| **Criterio de aceptación** | Cada tabla tiene dueño, clave, tenant y política de mutación definida; una base vacía llega a `public.companies` y permite el recorrido Auth→empresa→membresía→`/app`. |
| **Pruebas** | Cadena desde cero sin referencias a objetos retirados; Auth y bootstrap de empresa; constraints; índices únicos. |
| **Condición para avanzar** | Habilita políticas y cifrado. |
| **Dependencias / habilita** | `M05.1.12` / `M06.2`, `M06.3` |
| **Intervención requerida del usuario** | Ninguna. |

### M06.2 — RLS y aislamiento multiempresa

| Campo | Contenido |
|---|---|
| **ID** | `M06.2` — ≤8 h |
| **Objetivo** | Impedir lecturas y escrituras cruzadas. |
| **Implementación requerida** | RLS, `FORCE RLS`, RPCs de sesión y pruebas remotas con dos tenants. |
| **Procedimiento del asistente** | Definir políticas; negar por defecto; aplicar RLS+`FORCE RLS`; exponer proyecciones mínimas; eliminar `SUPABASE_TEST_ALLOW_APP_PROJECT`; unificar las guardas REST/pgTAP para exigir un proyecto distinto y desechable; probar IDs manipulados y el rol dueño. |
| **Evidencia de cierre** | Matriz de privilegios con aislamiento probado. |
| **Criterio de aceptación** | Usuario A nunca accede a datos de B; toda tabla tenant-scoped tiene `relrowsecurity` y `relforcerowsecurity`; el rol dueño previsto no omite políticas y el runtime normal no usa `BYPASSRLS`. |
| **Pruebas** | Select/insert/update/delete cruzados; RPC; tenant ausente; catálogo de tablas; rol dueño; rechazo del proyecto de aplicación tanto en REST como en pgTAP. |
| **Condición para avanzar** | RLS verde antes de datos piloto. |
| **Dependencias / habilita** | `M06.1` / `M06.3`, `M08.1` |
| **Intervención requerida del usuario** | Ninguna. |

### M06.3 — Cifrado y rol acotado del worker

| Campo | Contenido |
|---|---|
| **ID** | `M06.3` — ≤8 h |
| **Objetivo** | Separar credenciales y ejecución interna del acceso web. |
| **Implementación requerida** | Sobre AES-GCM versionado, esquema privado, funciones `worker_api` y rol sin acceso directo a tablas. |
| **Procedimiento del asistente** | Cifrar; almacenar; cargar sólo con lease; limitar grants; excluir imports web; probar rotación y revocación. |
| **Evidencia de cierre** | Worker funcional sin cookies ni `service_role`. |
| **Criterio de aceptación** | Ningún cliente o Data API puede leer credenciales. |
| **Pruebas** | Texto claro; clave incorrecta; rol fuera de función; rotación; import prohibido. |
| **Condición para avanzar** | Habilita OAuth productivo y jobs. |
| **Dependencias / habilita** | `M06.1`, `M06.2` / `M07.1`, `M09.1`, `M13.1`, `M16.1` |
| **Intervención requerida del usuario** | Aprobar quién accede al entorno piloto y custodiar secretos fuera del chat. |

### M07.1 — Ciclo de vida e idempotencia de jobs

| Campo | Contenido |
|---|---|
| **ID** | `M07.1` — ≤8 h |
| **Objetivo** | Definir trabajos pequeños, repetibles y deduplicados. |
| **Implementación requerida** | Estados, creación, `available_at`, intentos, claves de idempotencia y dead letter. |
| **Procedimiento del asistente** | Implementar enqueue; deduplicar; validar transiciones; clasificar errores; limitar intentos. |
| **Evidencia de cierre** | Jobs creados una sola vez por unidad lógica. |
| **Criterio de aceptación** | Repetir una orden no crea efectos duplicados. |
| **Pruebas** | Doble enqueue; transición inválida; max attempts; cancelación. |
| **Condición para avanzar** | Habilita leasing. |
| **Dependencias / habilita** | `M06.3` / `M07.2` |
| **Intervención requerida del usuario** | Ninguna. |

### M07.2 — Leases, checkpoints y resultados tardíos

| Campo | Contenido |
|---|---|
| **ID** | `M07.2` — ≤8 h |
| **Objetivo** | Asegurar propiedad temporal y reanudación exacta. |
| **Implementación requerida** | Claim atómico, renovación, checkpoint transaccional y validación de owner/attempt. |
| **Procedimiento del asistente** | Reclamar; renovar; insertar página; confirmar checkpoint; expirar; reclamar de nuevo; rechazar resultado viejo. |
| **Evidencia de cierre** | Dos workers compiten sin duplicar el efecto. |
| **Criterio de aceptación** | Checkpoint sólo avanza junto con observaciones confirmadas. |
| **Pruebas** | Competencia; lease vencido; crash pre/post commit; late result. |
| **Condición para avanzar** | Habilita runner. |
| **Dependencias / habilita** | `M07.1` / `M07.3` |
| **Intervención requerida del usuario** | Ninguna. |

### M07.3 — Runner, reintentos y observabilidad

| Campo | Contenido |
|---|---|
| **ID** | `M07.3` — ≤8 h |
| **Objetivo** | Ejecutar jobs y dejar cada fallo diagnosticable. |
| **Implementación requerida** | Runner, dispatch por kind, backoff, heartbeat, métricas y comandos de drain. |
| **Procedimiento del asistente** | Tomar job; cargar handler; renovar lease; completar/fallar; redactar error; emitir métricas; detener limpio. |
| **Evidencia de cierre** | Worker reanuda un lote interrumpido y muestra su progreso. |
| **Criterio de aceptación** | Error transitorio reintenta; permanente termina explícitamente. |
| **Pruebas** | API caída; timeout; shutdown; handler desconocido; secreto en error. |
| **Condición para avanzar** | Habilita todos los backfills. |
| **Dependencias / habilita** | `M07.2` / `M10a`, `M15.1`, `M17.1`, `M24a.1` |
| **Intervención requerida del usuario** | Ninguna. |

### M08.1 — Máquina de estados del onboarding

| Campo | Contenido |
|---|---|
| **ID** | `M08.1` — ≤8 h |
| **Objetivo** | Modelar un onboarding reanudable. |
| **Implementación requerida** | Estado por fuente, paso actual, errores recuperables y capability matrix por producto. |
| **Procedimiento del asistente** | Definir estados; persistir progreso; validar transiciones; derivar siguiente paso; separar productos A/B. |
| **Evidencia de cierre** | Contrato del recorrido y fixtures de cada estado. |
| **Criterio de aceptación** | Refrescar o volver no pierde progreso ni mezcla productos. |
| **Pruebas** | Estado imposible; doble pestaña; rama cambiada; fuente degradada. |
| **Condición para avanzar** | Habilita UI. |
| **Dependencias / habilita** | `M05.1.12`, `M06.2` / `M08.2` |
| **Intervención requerida del usuario** | Ninguna. |

### M08.2 — UI de conexiones y progreso

| Campo | Contenido |
|---|---|
| **ID** | `M08.2` — ≤8 h |
| **Objetivo** | Mostrar qué conectar, qué falta y qué está funcionando. |
| **Implementación requerida** | Tarjetas de fuentes, selector, progreso, salud, último sync y límites del producto elegido. |
| **Procedimiento del asistente** | Renderizar estados; conectar acciones; mostrar progreso; explicar degradación; adaptar navegación A/B. |
| **Evidencia de cierre** | Recorrido navegable con fixtures, sin APIs reales. |
| **Criterio de aceptación** | El dueño entiende el siguiente paso y la promesa de su producto. |
| **Pruebas** | Empty/loading/error/success; móvil; rama A/B; conexión parcial. |
| **Condición para avanzar** | Habilita recuperación y luego OAuth. |
| **Dependencias / habilita** | `M08.1` / `M08.3` |
| **Intervención requerida del usuario** | Revisar claridad de textos y pasos. |

### M08.3 — Recuperación, reautorización y E2E del onboarding

| Campo | Contenido |
|---|---|
| **ID** | `M08.3` — ≤8 h |
| **Objetivo** | Hacer robustos abandono, expiración y callback repetido. |
| **Implementación requerida** | Retorno seguro, reanudación, reauth, disconnect y pruebas end-to-end. |
| **Procedimiento del asistente** | Simular abandono; expirar intento; repetir callback; revocar conexión; retomar; confirmar estado final; reproducir confirmación de correo consumida antes de abrirse. |
| **Evidencia de cierre** | Suite de recuperación del onboarding. |
| **Criterio de aceptación** | Ningún fallo crea conexiones duplicadas o rutas abiertas; un token de correo ausente, vencido, ya usado o consumido por un scanner produce un estado explicable y una recuperación segura. |
| **Pruebas** | Open redirect; state vencido; callback doble; cancelación; reauth; link de email sin parámetros; link ya consumido; scanner que abre el token antes del usuario. |
| **Condición para avanzar** | Flujo común obligatorio para M09, M13 y M16. |
| **Dependencias / habilita** | `M08.2` / OAuth productivos |
| **Intervención requerida del usuario** | Ejecutar una revisión funcional del recorrido. |

---

## Fase 2 — Tiendanube e historia de catálogo

**Condición de cierre:** historia cruda y normalizada, reconstrucción sesgada identificada y observaciones temporales funcionando.

### M09.1 — Configuración e inicio OAuth Tiendanube

| Campo | Contenido |
|---|---|
| **ID** | `M09.1` — ≤8 h |
| **Objetivo** | Iniciar autorización con permisos mínimos. |
| **Implementación requerida** | Configuración, redirect allowlist, intento OAuth y endpoint start. |
| **Procedimiento del asistente** | Registrar app; pedir scopes de lectura; crear state hash; guardar intento; redirigir. |
| **Evidencia de cierre** | Inicio OAuth probado sin persistir secretos claros. |
| **Criterio de aceptación** | Redirect y scopes coinciden con el acta. |
| **Pruebas** | Return path externo; state predecible; scope extra; intento vencido. |
| **Condición para avanzar** | Habilita callback. |
| **Dependencias / habilita** | `M03`, `M06.3`, `M08.3` / `M09.2` |
| **Intervención requerida del usuario** | Crear o facilitar la app y su redirect. |

### M09.2 — Callback, token y metadata de tienda

| Campo | Contenido |
|---|---|
| **ID** | `M09.2` — ≤8 h |
| **Objetivo** | Completar OAuth y verificar la tienda. |
| **Implementación requerida** | Callback, canje, cifrado, consumo one-shot y consulta de tienda. |
| **Procedimiento del asistente** | Validar state; canjear code; cifrar; consumir intento; leer tienda/moneda/zona; guardar conexión. |
| **Evidencia de cierre** | Conexión real en estado `connected`. |
| **Criterio de aceptación** | Tienda piloto verificada y token ausente de logs/Data API. |
| **Pruebas** | Callback repetido; code inválido; canje fallido; cifrado; metadata incompleta. |
| **Condición para avanzar** | Habilita ciclo de vida. |
| **Dependencias / habilita** | `M09.1` / `M09.3` |
| **Intervención requerida del usuario** | Autorizar la tienda piloto. |

### M09.3 — Reautorización, desconexión y primer job

| Campo | Contenido |
|---|---|
| **ID** | `M09.3` — ≤8 h |
| **Objetivo** | Cerrar el ciclo de vida de la conexión. |
| **Implementación requerida** | Probe, estados degradados, reauth, disconnect y enqueue inicial. |
| **Procedimiento del asistente** | Probar credencial; degradar ante error; reconectar; desconectar; impedir jobs nuevos; encolar backfill válido. |
| **Evidencia de cierre** | Tarjeta Tiendanube con estados y acciones correctos. |
| **Criterio de aceptación** | Una credencial revocada no queda aparentando salud. |
| **Pruebas** | 401/403; disconnect; reconexión; doble enqueue. |
| **Condición para avanzar** | Habilita M10a y M10c. |
| **Dependencias / habilita** | `M09.2`, `M07.3` / backfill TN |
| **Intervención requerida del usuario** | Confirmar tienda, moneda y zona mostradas. |

### M10a — Snapshot crudo actual de catálogo y stock

| Campo | Contenido |
|---|---|
| **ID** | `M10a` — ≤8 h |
| **Objetivo** | Capturar productos, variantes, stock y estado actuales como observación, no como verdad histórica. |
| **Implementación requerida** | Cliente paginado, raw append-only, hashes, `observed_at`, ETag y checkpoint de catálogo. |
| **Procedimiento del asistente** | Crear jobs; paginar; seleccionar campos mínimos; insertar raw; hashear; confirmar checkpoint; repetir. |
| **Evidencia de cierre** | Snapshot actual completo o con huecos cuantificados. |
| **Criterio de aceptación** | Segunda ejecución conserva nuevas observaciones sin duplicar el mismo efecto lógico. |
| **Pruebas** | Página repetida; rate limit; payload inesperado; crash; hash estable. |
| **Condición para avanzar** | Provee el ancla actual para M10b y normalización. |
| **Dependencias / habilita** | `M09.3` / `M10b`, `M11.1`, `M12.1` |
| **Intervención requerida del usuario** | Confirmar conteo aproximado de productos y variantes. |

### M10b — Reconstrucción retrospectiva sesgada de stock

| Campo | Contenido |
|---|---|
| **ID** | `M10b` — nuevo estable, ≤8 h |
| **Objetivo** | Estimar stock pasado a partir del stock actual y las unidades pedidas, sin presentarlo como observación real. |
| **Implementación requerida** | Serie `estimated_stock` por variante, fórmula versionada, `coverage_mode=reconstructed_biased`, advertencias y evidencia de inputs. |
| **Procedimiento del asistente** | Tomar stock actual de M10a; sumar hacia atrás unidades de pedidos normalizables; registrar cancelaciones conocidas; no inferir reposiciones; acotar valores; guardar método y sesgo. |
| **Evidencia de cierre** | Curva retrospectiva estimada con fórmula: `stock_estimado(t) = stock_actual + unidades_pedidas_desde(t)`, más advertencia visible. |
| **Criterio de aceptación** | Toda fila está marcada como estimada. Se declara que reposiciones y ajustes invisibles hacen que la curva tienda a sobreestimar stock pasado y, por lo tanto, **subestimar quiebres**. |
| **Pruebas** | Pedido cancelado; devolución; stock negativo; variante sin ventas; reposición ficticia demuestra el sesgo; replay determinístico. |
| **Condición para avanzar** | Puede alimentar análisis de stock sólo bajo reglas de evidencia estimada. Nunca habilita afirmaciones de publicación histórica. |
| **Dependencias / habilita** | `M10a`, `M10c`, `M11.2` / `M21.1`, `M24b.1` |
| **Intervención requerida del usuario** | Aprobar el texto de sesgo. No reconstruir datos manualmente. |

> **Invariante:** publicado/despublicado es **no reconstruible** desde stock actual y pedidos. Antes de las observaciones directas de M12, cualquier análisis histórico de ese estado debe devolver `not_evaluable`.

### M10c — Backfill crudo de pedidos y líneas

| Campo | Contenido |
|---|---|
| **ID** | `M10c` — ≤8 h |
| **Objetivo** | Capturar el historial mínimo de pedidos necesario para ventas y reconstrucción. |
| **Implementación requerida** | Cliente paginado de pedidos, selección sin PII, raw, hashes y checkpoint por ventana. |
| **Procedimiento del asistente** | Trocear período; paginar; excluir PII; guardar pedido/líneas; registrar estado/moneda; confirmar checkpoint. |
| **Evidencia de cierre** | Historial crudo de pedidos con período y huecos visibles. |
| **Criterio de aceptación** | Totales mínimos reconcilian y no se almacena información personal innecesaria. |
| **Pruebas** | PII; pedido actualizado; línea duplicada; página tardía; moneda; crash. |
| **Condición para avanzar** | Habilita M10b y M11.2. |
| **Dependencias / habilita** | `M09.3` / `M10b`, `M11.2` |
| **Intervención requerida del usuario** | Confirmar pedidos y monto de dos días de control. |

### M10d — Reanudación, cobertura y cierre del backfill TN

| Campo | Contenido |
|---|---|
| **ID** | `M10d` — ≤8 h |
| **Objetivo** | Probar que catálogo y pedidos cierran de forma idempotente y medible. |
| **Implementación requerida** | Resumen de ventanas, huecos, conteos, checkpoints, replays y estado terminal. |
| **Procedimiento del asistente** | Interrumpir; reanudar; repetir; comparar hashes/conteos; inyectar hueco; clasificar cobertura; cerrar jobs. |
| **Evidencia de cierre** | Manifiesto del backfill TN y prueba de reanudación. |
| **Criterio de aceptación** | Mismo input produce mismas observaciones lógicas; todo hueco es explícito. |
| **Pruebas** | Crash pre/post checkpoint; ventana repetida; resultado tardío; página perdida. |
| **Condición para avanzar** | Habilita normalización final y análisis. |
| **Dependencias / habilita** | `M10a`, `M10c` / `M11.1`, `M11.2` |
| **Intervención requerida del usuario** | Revisar únicamente los totales resumidos. |

### M11.1 — Normalización de catálogo

| Campo | Contenido |
|---|---|
| **ID** | `M11.1` — ≤8 h |
| **Objetivo** | Convertir raw de catálogo en observaciones tipadas. |
| **Implementación requerida** | Normalizador de producto, variante, SKU, URL, publicación, stock, precio y moneda. |
| **Procedimiento del asistente** | Validar payload; extraer entidades; conservar IDs; insertar observaciones; vincular raw; medir descartes. |
| **Evidencia de cierre** | Catálogo consultable con trazabilidad. |
| **Criterio de aceptación** | Ningún estado actual se reescribe como historia pasada. |
| **Pruebas** | Sin SKU; variante borrada; moneda; nulo; payload nuevo. |
| **Condición para avanzar** | Habilita enlaces y observación temporal. |
| **Dependencias / habilita** | `M10a`, `M10d` / `M11.3`, `M12.1` |
| **Intervención requerida del usuario** | Ninguna. |

### M11.2 — Normalización de pedidos y unidades

| Campo | Contenido |
|---|---|
| **ID** | `M11.2` — ≤8 h |
| **Objetivo** | Producir ventas y unidades por variante sin PII. |
| **Implementación requerida** | Normalizador de pedido, estado, total, moneda y líneas. |
| **Procedimiento del asistente** | Validar; clasificar estados; normalizar importes; resolver líneas; conservar raw; medir diferencias. |
| **Evidencia de cierre** | Pedidos y líneas tipados y conciliados. |
| **Criterio de aceptación** | Totales reproducibles y reglas de cancelación/devolución explícitas. |
| **Pruebas** | Cancelado; reembolso; línea repetida; variante ausente; moneda. |
| **Condición para avanzar** | Habilita M10b y enlaces. |
| **Dependencias / habilita** | `M10c`, `M10d` / `M10b`, `M11.3` |
| **Intervención requerida del usuario** | Aclarar estados comerciales ambiguos si aparecen. |

### M11.3 — Enlaces canónicos y reconciliación TN

| Campo | Contenido |
|---|---|
| **ID** | `M11.3` — ≤8 h |
| **Objetivo** | Unir catálogo y pedidos sin fusionar observaciones. |
| **Implementación requerida** | Entidades canónicas, links externos, confianza, vigencia y tabla de no resueltos. |
| **Procedimiento del asistente** | Vincular IDs exactos; tratar cambios; separar ambiguos; medir cobertura; conciliar conteos; replay. |
| **Evidencia de cierre** | Cobertura de links y lista de casos ambiguos. |
| **Criterio de aceptación** | Ninguna coincidencia dudosa se convierte en exacta. |
| **Pruebas** | SKU duplicado; ID cambiado; variante borrada; link histórico; replay. |
| **Condición para avanzar** | Habilita detectores TN y mapping Meta. |
| **Dependencias / habilita** | `M11.1`, `M11.2` / `M18.1`, `M19a.1`, `M21.1` |
| **Intervención requerida del usuario** | Confirmar sólo equivalencias ambiguas conocidas. |

### M12.1 — Webhooks como observaciones de catálogo

| Campo | Contenido |
|---|---|
| **ID** | `M12.1` — ≤8 h |
| **Objetivo** | Registrar cambios de catálogo en el tiempo; no prometer menor latencia. |
| **Implementación requerida** | Receptor que valida, conserva recepción y encola una nueva observación inmutable de producto/variante. |
| **Procedimiento del asistente** | Validar origen; guardar evento; deduplicar efecto; recuperar recurso; observar estado; vincular a raw. |
| **Evidencia de cierre** | Un cambio genera una observación nueva con fecha y procedencia. |
| **Criterio de aceptación** | El webhook mejora resolución temporal, pero no se usa como SLA de frescura. |
| **Pruebas** | Duplicado; desorden; firma inválida; recurso borrado; recuperación fallida. |
| **Condición para avanzar** | Habilita snapshots periódicos. |
| **Dependencias / habilita** | `M07.3`, `M09.3`, `M11.1` / `M12.2` |
| **Intervención requerida del usuario** | Habilitar webhooks y hacer un cambio controlado. |

### M12.2 — Polling como muestreo temporal de catálogo

| Campo | Contenido |
|---|---|
| **ID** | `M12.2` — ≤8 h |
| **Objetivo** | Crear una serie de observaciones aunque no lleguen eventos. |
| **Implementación requerida** | Jobs periódicos con solapamiento, snapshots, detección de cambios y cobertura temporal. |
| **Procedimiento del asistente** | Programar muestreo; leer catálogo; insertar observaciones; comparar hash; registrar intervalos; recuperar webhook perdido. |
| **Evidencia de cierre** | Línea temporal de stock y publicado/despublicado desde el inicio de M12. |
| **Criterio de aceptación** | Los intervalos de observación son visibles; no se infieren cambios entre dos muestras. |
| **Pruebas** | Poll omitido; hash igual; cambio entre polls; API caída; solapamiento. |
| **Condición para avanzar** | Habilita evaluación directa de estados históricos. |
| **Dependencias / habilita** | `M12.1` / `M12.3`, `M20.1`, `M24b.1` |
| **Intervención requerida del usuario** | Ninguna. |

### M12.3 — Cobertura, replay y límites temporales

| Campo | Contenido |
|---|---|
| **ID** | `M12.3` — ≤8 h |
| **Objetivo** | Medir qué parte de la historia de catálogo fue realmente observada. |
| **Implementación requerida** | Intervalos observados, gaps, procedencia webhook/poll, replay, regla `not_evaluable` para pre-M12 y protección exportable de la serie temporal M12. |
| **Procedimiento del asistente** | Construir intervalos; marcar gaps; simular evento perdido; reconciliar; reejecutar; comparar; exportar y restaurar la serie M12; documentar limitaciones. |
| **Evidencia de cierre** | Manifiesto de cobertura temporal del catálogo. |
| **Criterio de aceptación** | Publicado/despublicado antes de M12 siempre es `not_evaluable`; stock reconstruido nunca se etiqueta observado; la serie M12, única evidencia no redescargable, puede restaurarse sin convertir datos reconstruidos en observados. |
| **Pruebas** | Gap; orden inverso; pre-M12; mezcla observed/reconstructed; replay; export/restore de la serie M12. |
| **Condición para avanzar** | Cierra el motor de observación y habilita reportes de catálogo honestos. |
| **Dependencias / habilita** | `M12.2`, `M10b` / `M19a.1`, `M20.1`, `M21.1`, `M26.1` |
| **Intervención requerida del usuario** | Revisar que las limitaciones sean comprensibles. |

---

## Fase 3 — GA4

**Condición de cierre:** propiedad correcta conectada, catálogo de consultas validado y 28 días o más de superposición TN+GA4 con cobertura explícita.

### M13.1 — Inicio OAuth de Google

| Campo | Contenido |
|---|---|
| **ID** | `M13.1` — ≤8 h |
| **Objetivo** | Iniciar OAuth con permiso mínimo y PKCE/state. |
| **Implementación requerida** | Configuración, intento OAuth, PKCE cifrado y endpoint start. |
| **Procedimiento del asistente** | Fijar redirect/scope; crear verifier/state; persistir intento; redirigir; validar allowlist. |
| **Evidencia de cierre** | Inicio OAuth verificable. |
| **Criterio de aceptación** | Sólo se solicita `analytics.readonly`. |
| **Pruebas** | State débil; redirect externo; verifier claro; scope extra. |
| **Condición para avanzar** | Habilita callback. |
| **Dependencias / habilita** | `M03`, `M06.3`, `M08.3` / `M13.2` |
| **Intervención requerida del usuario** | Configurar pantalla/redirect y comenzar autorización. |

### M13.2 — Callback, cifrado y listado de propiedades

| Campo | Contenido |
|---|---|
| **ID** | `M13.2` — ≤8 h |
| **Objetivo** | Canjear credenciales y descubrir propiedades accesibles. |
| **Implementación requerida** | Callback, validación PKCE/state, cifrado, refresh y cliente de administración. |
| **Procedimiento del asistente** | Validar retorno; canjear; cifrar; consumir intento; listar cuentas/propiedades; redactar errores. |
| **Evidencia de cierre** | Lista de propiedades autorizadas sin tokens expuestos. |
| **Criterio de aceptación** | Sólo aparecen propiedades devueltas por Google para ese usuario. |
| **Pruebas** | Callback doble; verifier incorrecto; refresh ausente; token en log; 403. |
| **Condición para avanzar** | Habilita selección. |
| **Dependencias / habilita** | `M13.1` / `M13.3` |
| **Intervención requerida del usuario** | Completar la autorización de Google. |

### M13.3 — Selección, metadata y ciclo de vida GA4

| Campo | Contenido |
|---|---|
| **ID** | `M13.3` — ≤8 h |
| **Objetivo** | Fijar propiedad, moneda, zona y reautorización. |
| **Implementación requerida** | Selector, metadata, probe, refresh, revocación, disconnect y enqueue. |
| **Procedimiento del asistente** | Elegir propiedad; verificar pertenencia; leer metadata; probar refresh; simular revocación; encolar validación. |
| **Evidencia de cierre** | Tarjeta GA4 conectada y verificable. |
| **Criterio de aceptación** | Propiedad explícita y metadata completa. |
| **Pruebas** | Propiedad no listada; refresh; revocación; selección repetida. |
| **Condición para avanzar** | Habilita catálogo productivo. |
| **Dependencias / habilita** | `M13.2` / `M14.1` |
| **Intervención requerida del usuario** | Elegir propiedad y confirmar moneda/zona. |

### M14.1 — Promoción y versionado de specs GA4

| Campo | Contenido |
|---|---|
| **ID** | `M14.1` — ≤8 h |
| **Objetivo** | Convertir sólo las specs aprobadas en contratos productivos. |
| **Implementación requerida** | Manifest versionado con campos, scope, filtros, consumidor y hash. |
| **Procedimiento del asistente** | Importar PASS de M02.2; tipar campos; fijar filtros; asociar detector; calcular hash; rechazar ad hoc. |
| **Evidencia de cierre** | Catálogo productivo inicial. |
| **Criterio de aceptación** | Cada spec tiene consumidor y versión. |
| **Pruebas** | Spec huérfana; hash; filtro omitido; scope mezclado. |
| **Condición para avanzar** | Habilita preflight. |
| **Dependencias / habilita** | `M02.2`, `M05.1.12`, `M13.3` / `M14.2` |
| **Intervención requerida del usuario** | Ninguna. |

### M14.2 — Preflight de compatibilidad

| Campo | Contenido |
|---|---|
| **ID** | `M14.2` — ≤8 h |
| **Objetivo** | Impedir que una spec incompatible llegue a `runReport`. |
| **Implementación requerida** | Validador obligatorio, caché por propiedad/versión y estados de bloqueo. |
| **Procedimiento del asistente** | Consultar compatibilidad; guardar evidencia; comparar versión; bloquear; invalidar caché ante cambio. |
| **Evidencia de cierre** | Estado compatible/incompatible por spec y propiedad. |
| **Criterio de aceptación** | Cero ejecución de specs no aprobadas. |
| **Pruebas** | Incompatible; metadata cambiada; caché vencida; error API. |
| **Condición para avanzar** | Habilita ejecución de muestras. |
| **Dependencias / habilita** | `M14.1` / `M14.3` |
| **Intervención requerida del usuario** | Ninguna. |

### M14.3 — Control totals y granularidad

| Campo | Contenido |
|---|---|
| **ID** | `M14.3` — ≤8 h |
| **Objetivo** | Cuantificar diferencias, cardinalidad y thresholding. |
| **Implementación requerida** | Runner de muestras, cálculo de “other”, comparación de controles y restricciones. |
| **Procedimiento del asistente** | Ejecutar período corto; medir filas/other; comparar compras e ingresos; clasificar diferencia; registrar limitación. |
| **Evidencia de cierre** | Reporte de calidad por spec. |
| **Criterio de aceptación** | Toda diferencia relevante queda explicada o bloqueada. |
| **Pruebas** | Other alto; cero ambiguo; thresholding; diferencia de moneda/zona. |
| **Condición para avanzar** | Habilita freeze. |
| **Dependencias / habilita** | `M14.2` / `M14.4` |
| **Intervención requerida del usuario** | Confirmar dos totales de control. |

### M14.4 — Freeze del catálogo y cobertura por detector

| Campo | Contenido |
|---|---|
| **ID** | `M14.4` — ≤8 h |
| **Objetivo** | Congelar qué consulta alimenta a qué capacidad. |
| **Implementación requerida** | Matriz spec → detector, elegibilidad, versión y migración de cambios. |
| **Procedimiento del asistente** | Resolver bloqueadas; marcar forward-only; completar consumidores; sellar manifest; probar cambios de versión. |
| **Evidencia de cierre** | Catálogo sin incompatibilidades ni ambigüedades. |
| **Criterio de aceptación** | Cada detector tiene specs suficientes o abstención explícita. |
| **Pruebas** | Detector incompleto; versión vieja; custom definition sin pasado; manifest alterado. |
| **Condición para avanzar** | Habilita M15.1. |
| **Dependencias / habilita** | `M14.3` / `M15.1` |
| **Intervención requerida del usuario** | Aprobar recortes o capacidades sólo futuras. |

### M15.1 — Planificador de ventanas GA4

| Campo | Contenido |
|---|---|
| **ID** | `M15.1` — ≤8 h |
| **Objetivo** | Trocear specs y fechas en jobs reanudables. |
| **Implementación requerida** | Planner, claves de idempotencia, ventanas y checkpoints por spec. |
| **Procedimiento del asistente** | Tomar manifest; calcular período; crear ventanas; encolar; deduplicar; exponer progreso. |
| **Evidencia de cierre** | Plan completo de jobs antes de llamar GA4. |
| **Criterio de aceptación** | Toda fecha/spec aparece una vez. |
| **Pruebas** | Límite de fecha; rerun; ventana vacía; spec bloqueada. |
| **Condición para avanzar** | Habilita extractor. |
| **Dependencias / habilita** | `M07.3`, `M14.4` / `M15.2` |
| **Intervención requerida del usuario** | Autorizar el backfill real. |

### M15.2 — Extracción y raw GA4

| Campo | Contenido |
|---|---|
| **ID** | `M15.2` — ≤8 h |
| **Objetivo** | Ejecutar specs y conservar la respuesta reproducible. |
| **Implementación requerida** | Cliente, paginación, rate limit, raw, hash, page refs y quarantine. |
| **Procedimiento del asistente** | Preflight; ejecutar; paginar; guardar raw; hashear; registrar error; confirmar checkpoint. |
| **Evidencia de cierre** | Respuestas crudas por spec/ventana. |
| **Criterio de aceptación** | Ninguna página confirmada queda fuera del checkpoint. |
| **Pruebas** | Paginación; timeout; rate limit; payload inesperado; crash. |
| **Condición para avanzar** | Habilita normalización. |
| **Dependencias / habilita** | `M15.1` / `M15.3` |
| **Intervención requerida del usuario** | Ninguna. |

### M15.3 — Observaciones y cobertura GA4

| Campo | Contenido |
|---|---|
| **ID** | `M15.3` — ≤8 h |
| **Objetivo** | Normalizar agregados sin ocultar pérdida de granularidad. |
| **Implementación requerida** | Observaciones K11, metadata de other/thresholding, moneda, zona y row counts. |
| **Procedimiento del asistente** | Validar spec hash; convertir filas; normalizar vacíos; registrar cobertura; vincular raw; medir descartes. |
| **Evidencia de cierre** | Métricas tipadas y auditables. |
| **Criterio de aceptación** | Toda métrica cita spec y raw. |
| **Pruebas** | Guion/cero; other; moneda; zona; fila inesperada. |
| **Condición para avanzar** | Habilita cierre. |
| **Dependencias / habilita** | `M15.2` / `M15.4` |
| **Intervención requerida del usuario** | Ninguna. |

### M15.4 — Replay, superposición y cierre GA4

| Campo | Contenido |
|---|---|
| **ID** | `M15.4` — ≤8 h |
| **Objetivo** | Verificar idempotencia y la ventana común TN+GA4. |
| **Implementación requerida** | Replay, comparación de hashes/totales, gaps y cálculo de días superpuestos. |
| **Procedimiento del asistente** | Repetir; interrumpir/reanudar; conciliar dos días; medir overlap; clasificar huecos; cerrar jobs. |
| **Evidencia de cierre** | Manifiesto GA4 con `overlap_days`. |
| **Criterio de aceptación** | Reliability sólo se habilita con al menos 28 días superpuestos. |
| **Pruebas** | Replay; resultado tardío; gap; 27/28 días; divergencia. |
| **Condición para avanzar** | Habilita M19a.1. |
| **Dependencias / habilita** | `M15.3`, `M11.2` / `M19a.1`, `M21.3` |
| **Intervención requerida del usuario** | Confirmar las diferencias finales contra GA4. |

---

## Fase 4 — Producto con Meta o producto alternativo

### M16.1 — OAuth Meta seguro — sólo `ads_catalog`

| Campo | Contenido |
|---|---|
| **ID** | `M16.1` — ≤8 h |
| **Objetivo** | Implementar el acceso exacto validado en M00. |
| **Implementación requerida** | Start/callback, state, cifrado y permisos efectivos. |
| **Procedimiento del asistente** | Crear intento; autorizar; validar; cifrar; inspeccionar scopes; persistir conexión. |
| **Evidencia de cierre** | Credencial Meta válida sin secretos expuestos. |
| **Criterio de aceptación** | Los permisos coinciden con M00. |
| **Pruebas** | State; permiso faltante; token en log; callback doble. |
| **Condición para avanzar** | Habilita cuenta y lifecycle. |
| **Dependencias / habilita** | `M00 PASS`, `M03`, `M06.3`, `M08.3` / `M16.2` |
| **Intervención requerida del usuario** | Autorizar Meta. |

### M16.2 — Selección de cuenta y ciclo de vida Meta

| Campo | Contenido |
|---|---|
| **ID** | `M16.2` — ≤8 h |
| **Objetivo** | Elegir cuenta, verificar insights y tratar revocación. |
| **Implementación requerida** | Selector, metadata, probe, reauth, disconnect y enqueue. |
| **Procedimiento del asistente** | Listar cuentas; elegir; leer moneda/zona; probar insight; simular revocación; encolar. |
| **Evidencia de cierre** | Cuenta publicitaria conectada y saludable. |
| **Criterio de aceptación** | Cuenta e insight reales responden. |
| **Pruebas** | Cuenta no autorizada; 403; revocación; reconexión. |
| **Condición para avanzar** | Éxito habilita M17.1. Un fallo que active M16b obliga primero a enmendar y volver a aprobar M03. |
| **Dependencias / habilita** | `M16.1` / `M17.1` o `M16b` |
| **Intervención requerida del usuario** | Elegir cuenta y confirmar moneda/zona. |

### M16b — Producto `commerce_reliability`

| Campo | Contenido |
|---|---|
| **ID** | `M16b` — nuevo significado estable, corte único ≤8 h |
| **Objetivo** | Cerrar un producto TN+GA4 autónomo, no una versión degradada del producto publicitario. |
| **Implementación requerida** | Capability matrix, navegación, onboarding, textos, detectores, reportes y demo específicos de `commerce_reliability`; rutas Meta inexistentes. |
| **Procedimiento del asistente** | Enmendar M03 y volver a aprobar producto, fuentes, detectores, datos, retención, consentimiento y lenguaje prohibido; actualizar `product_variant`; retirar lenguaje de ads/gasto/presupuesto; ajustar navegación, onboarding, reportes y demo; probar cero dependencias Meta. |
| **Evidencia de cierre** | Experiencia completa TN+GA4 con identidad y criterios propios. |
| **Criterio de aceptación** | No aparecen botones, estados, métricas ni abstenciones que hagan sentir que “falta Meta”; simplemente pertenecen a otro producto. |
| **Pruebas** | Cero llamadas/campos Meta; copy sin gasto o presupuesto; reportes válidos; demo propia; chat no conoce conceptos excluidos. |
| **Condición para avanzar** | Rama B avanza sólo como `commerce_reliability`, nunca como `ads_catalog` parcial. |
| **Dependencias / habilita** | `M00 FAIL` o `M16.2 FAIL`, M03 enmendada y reaprobada, `M15.4` / `M19a.1`, M20/M21 aplicables, reportes B |
| **Intervención requerida del usuario** | Aprobar nombre, promesa y textos del producto alternativo. |

### M17.1 — Estructura de campañas y anuncios

| Campo | Contenido |
|---|---|
| **ID** | `M17.1` — ≤8 h |
| **Objetivo** | Capturar jerarquía y estados publicitarios. |
| **Implementación requerida** | Clientes campañas/adsets/ads, paginación, raw y checkpoints. |
| **Procedimiento del asistente** | Planificar jobs; leer niveles; guardar raw; hashear; normalizar IDs/estado; reanudar. |
| **Evidencia de cierre** | Estructura Meta versionada. |
| **Criterio de aceptación** | Jerarquía completa o gaps explícitos. |
| **Pruebas** | Página repetida; objeto archivado; rate limit; crash. |
| **Condición para avanzar** | Habilita creativos e insights. |
| **Dependencias / habilita** | `M07.3`, `M16.2` / `M17.2`, `M17.3` |
| **Intervención requerida del usuario** | Ninguna. |

### M17.2 — Creativos, destinos y UTM

| Campo | Contenido |
|---|---|
| **ID** | `M17.2` — ≤8 h |
| **Objetivo** | Capturar evidencia para vincular anuncio y producto. |
| **Implementación requerida** | Extractor de creative, destination URL, UTM y referencias. |
| **Procedimiento del asistente** | Leer creative; resolver destino permitido; normalizar URL/UTM; guardar raw; marcar ausentes. |
| **Evidencia de cierre** | Metadata de destino por anuncio. |
| **Criterio de aceptación** | Una URL ausente nunca se inventa. |
| **Pruebas** | Dynamic creative; sin URL; redirect; UTM duplicada; payload nuevo. |
| **Condición para avanzar** | Habilita candidatos de mapping. |
| **Dependencias / habilita** | `M17.1` / `M18.1` |
| **Intervención requerida del usuario** | Indicar qué nombres pueden verse anonimizados. |

### M17.3 — Insights diarios de inversión

| Campo | Contenido |
|---|---|
| **ID** | `M17.3` — ≤8 h |
| **Objetivo** | Capturar gasto diario en moneda y zona correctas. |
| **Implementación requerida** | Specs de insights, ventanas, paginación, raw y observaciones K12. |
| **Procedimiento del asistente** | Trocear fechas; consultar; guardar; normalizar gasto; registrar moneda/zona/API; checkpoint. |
| **Evidencia de cierre** | Serie diaria de gasto por anuncio. |
| **Criterio de aceptación** | Cada importe cita raw, fecha, moneda y versión API. |
| **Pruebas** | Sin gasto; moneda; zona; breakdown; rate limit; replay. |
| **Condición para avanzar** | Habilita conciliación y detección. |
| **Dependencias / habilita** | `M17.1` / `M17.4`, `M20.2` |
| **Intervención requerida del usuario** | Confirmar dos totales contra Ads Manager. |

### M17.4 — Conciliación y cierre Meta

| Campo | Contenido |
|---|---|
| **ID** | `M17.4` — ≤8 h |
| **Objetivo** | Probar cobertura, idempotencia y coherencia Meta. |
| **Implementación requerida** | Replay, control totals, gaps, manifest de API y período común. |
| **Procedimiento del asistente** | Repetir; reanudar; comparar días; medir anuncios con destino/gasto; registrar huecos; cerrar. |
| **Evidencia de cierre** | Manifiesto Meta validado. |
| **Criterio de aceptación** | Totales coinciden dentro de diferencia explicada. |
| **Pruebas** | 27/28 días; gap; duplicado; versión API; cuenta revocada. |
| **Condición para avanzar** | Habilita M19b.1 y mapping final. |
| **Dependencias / habilita** | `M17.2`, `M17.3` / `M18.1`, `M19b.1` |
| **Intervención requerida del usuario** | Aprobar diferencias explicadas. |

### M18.1 — Candidatos de mapping anuncio–producto

| Campo | Contenido |
|---|---|
| **ID** | `M18.1` — ≤8 h |
| **Objetivo** | Generar candidatos por claves verificables. |
| **Implementación requerida** | Normalización de URL, ID, SKU y UTM; candidatos con método/evidencia. |
| **Procedimiento del asistente** | Normalizar; coincidir ID exacto; coincidir URL/SKU/UTM; conservar candidatos múltiples; medir. |
| **Evidencia de cierre** | Tabla de candidatos sin decisiones ocultas. |
| **Criterio de aceptación** | Método y evidencia acompañan cada candidato. |
| **Pruebas** | URL equivalente; SKU duplicado; UTM ausente; varios productos. |
| **Condición para avanzar** | Habilita resolución. |
| **Dependencias / habilita** | `M11.3`, `M17.2`, `M17.4` / `M18.2` |
| **Intervención requerida del usuario** | Ninguna. |

### M18.2 — Resolución exacta y revisión ambigua

| Campo | Contenido |
|---|---|
| **ID** | `M18.2` — ≤8 h |
| **Objetivo** | Publicar sólo mappings defendibles. |
| **Implementación requerida** | Resolución automática exacta, bandeja manual, vigencia y confianza. |
| **Procedimiento del asistente** | Aceptar únicos exactos; separar ambiguos; revisar; registrar confirmación; fijar vigencia; impedir sobreescritura histórica. |
| **Evidencia de cierre** | Links canónicos aprobados y cola pendiente. |
| **Criterio de aceptación** | “Se parece” nunca cuenta como mapping. |
| **Pruebas** | Dos candidatos; cambio de URL; confirmación; revocación; historia. |
| **Condición para avanzar** | Habilita cobertura. |
| **Dependencias / habilita** | `M18.1` / `M18.3` |
| **Intervención requerida del usuario** | Confirmar casos ambiguos conocidos. |

### M18.3 — Cobertura por gasto y freeze de mappings

| Campo | Contenido |
|---|---|
| **ID** | `M18.3` — ≤8 h |
| **Objetivo** | Medir si los links alcanzan para análisis publicitario. |
| **Implementación requerida** | Cobertura por gasto, distribución de confianza y snapshot de links por run. |
| **Procedimiento del asistente** | Unir gasto; calcular cubierto/no cubierto; segmentar método; congelar versión; aplicar umbral; emitir limitación. |
| **Evidencia de cierre** | Métrica de cobertura auditable. |
| **Criterio de aceptación** | Se mide por gasto, no por cantidad de anuncios. |
| **Pruebas** | Anuncio caro no mapeado; link vencido; moneda; run repetido. |
| **Condición para avanzar** | Sólo cobertura suficiente habilita detectores gasto–catálogo. |
| **Dependencias / habilita** | `M18.2`, `M17.3` / `M19b.2`, `M20.2`, `M21.3` |
| **Intervención requerida del usuario** | Revisar el porcentaje final de cobertura. |

---

## Fase 5 — Confiabilidad y análisis determinístico

### M19a.1 — Ventana y contrato de confiabilidad TN+GA4

| Campo | Contenido |
|---|---|
| **ID** | `M19a.1` — ≤8 h |
| **Objetivo** | Congelar un run de confiabilidad basado exclusivamente en Tiendanube y GA4. |
| **Implementación requerida** | Analysis run, cutoff, overlap, versiones, hashes y elegibilidad de 28 días. |
| **Procedimiento del asistente** | Elegir cutoff; calcular overlap; congelar inputs; verificar 28 días; registrar gaps; abrir run. |
| **Evidencia de cierre** | Run TN+GA4 reproducible. |
| **Criterio de aceptación** | No contiene ni requiere tablas, campos o estados Meta. |
| **Pruebas** | 27/28 días; input tardío; hash; fuente Meta inyectada. |
| **Condición para avanzar** | Habilita controles TN+GA4. |
| **Dependencias / habilita** | `M11.3`, `M12.3`, `M15.4`, `M05.2` / `M19a.2`, `M19a.3` |
| **Intervención requerida del usuario** | Ninguna. |

### M19a.2 — Duplicación y conciliación TN–GA4

| Campo | Contenido |
|---|---|
| **ID** | `M19a.2` — ≤8 h |
| **Objetivo** | Medir duplicación y diferencias de compras entre comercio y analítica. |
| **Implementación requerida** | Controles de transaction ID, conteo, monto, cobertura de match y razones. |
| **Procedimiento del asistente** | Normalizar IDs; deduplicar; unir; calcular ratios/deltas; aplicar umbrales; guardar evidencia. |
| **Evidencia de cierre** | Assessment por control con `pass/warn/fail/not_evaluable`. |
| **Criterio de aceptación** | Toda diferencia se calcula sobre la ventana congelada. |
| **Pruebas** | Compra duplicada; ID ausente; moneda; diferencia de fecha; poco volumen. |
| **Condición para avanzar** | Fallo bloquea conclusiones que dependan de compras GA4. |
| **Dependencias / habilita** | `M19a.1` / `M19a.3`, `M24a.1` |
| **Intervención requerida del usuario** | Explicar divergencias de instrumentación conocidas. |

### M19a.3 — Embudo, zona, moneda y cierre M19a

| Campo | Contenido |
|---|---|
| **ID** | `M19a.3` — ≤8 h |
| **Objetivo** | Completar confiabilidad TN+GA4 y producir el gate base. |
| **Implementación requerida** | Presencia/elegibilidad de eventos, zona, moneda, cobertura, resumen y bloqueos; en Rama A incorpora el control de consistencia temporal requerido por H-M00-01 sin hacer que Meta bloquee el reporte base. |
| **Procedimiento del asistente** | Revisar eventos; validar volumen; preservar la zona original de cada fuente; convertir límites de ventana por instante; detectar días corridos entre Meta LA y TN/GA4; normalizar moneda; consolidar controles; propagar bloqueos; cerrar run. |
| **Evidencia de cierre** | Bloque 0 TN+GA4 listo para `report_kind=reliability`. |
| **Criterio de aceptación** | M19a funciona igual en ambos productos y nunca espera Meta. |
| **Pruebas** | Embudo ausente; moneda desconocida; zona inválida; Meta `America/Los_Angeles` contra fuente Buenos Aires; transición DST; not_evaluable; run parcial. |
| **Condición para avanzar** | Habilita M24a y la base de M20/M21. |
| **Dependencias / habilita** | `M19a.2` / `M20.1`, `M21.1`, `M24a.1` |
| **Intervención requerida del usuario** | Validar que las advertencias sean comprensibles. |

### M19b.1 — Confiabilidad de permisos, cuenta e insights Meta

| Campo | Contenido |
|---|---|
| **ID** | `M19b.1` — ≤8 h, sólo `ads_catalog` |
| **Objetivo** | Evaluar si la fuente Meta puede sostener análisis. |
| **Implementación requerida** | Controles de cuenta, permisos, período, moneda, zona, gasto y gaps. |
| **Procedimiento del asistente** | Congelar inputs; revisar permisos; medir días/gaps; conciliar totales; validar moneda/zona; clasificar. |
| **Evidencia de cierre** | Assessment de salud Meta. |
| **Criterio de aceptación** | Un permiso o período insuficiente bloquea detectores dependientes. |
| **Pruebas** | Scope revocado; cuenta cambiada; gap; moneda; 27/28 días. |
| **Condición para avanzar** | Habilita control de cobertura de destino. |
| **Dependencias / habilita** | `M17.4`, `M05.2` / `M19b.2` |
| **Intervención requerida del usuario** | Confirmar diferencias contra Ads Manager. |

### M19b.2 — UTM, mapping y gate Meta

| Campo | Contenido |
|---|---|
| **ID** | `M19b.2` — ≤8 h, sólo `ads_catalog` |
| **Objetivo** | Medir si gasto, destino y producto pueden cruzarse con confianza. |
| **Implementación requerida** | Cobertura UTM por gasto, cobertura mapping, límites y gate de recomendaciones publicitarias. |
| **Procedimiento del asistente** | Medir UTM; incorporar M18.3; aplicar umbrales; registrar no evaluables; propagar bloqueo; cerrar. |
| **Evidencia de cierre** | Bloque de confiabilidad Meta separado de M19a. |
| **Criterio de aceptación** | Un fallo Meta no invalida el reporte reliability TN+GA4; sí bloquea análisis publicitario. |
| **Pruebas** | UTM faltante; mapping bajo; anuncio sin destino; gasto cero; cobertura sesgada. |
| **Condición para avanzar** | Habilita M20.2 y se agrega a reliability A cuando esté listo. |
| **Dependencias / habilita** | `M19b.1`, `M18.3` / `M20.2`, versión A de `M24a` |
| **Intervención requerida del usuario** | Aprobar la interpretación de cobertura. |

### M20.1 — Intervalos observables de catálogo

| Campo | Contenido |
|---|---|
| **ID** | `M20.1` — ≤8 h |
| **Objetivo** | Preparar intervalos de stock y publicación sin mezclar observado y reconstruido. |
| **Implementación requerida** | Intervalos `observed/reconstructed_biased`, gaps y regla de estado no reconstruible. |
| **Procedimiento del asistente** | Tomar M12; incorporar M10b aparte; construir intervalos; marcar gaps; impedir inferencia de publicación pre-M12. |
| **Evidencia de cierre** | Timeline tipada por producto/variante. |
| **Criterio de aceptación** | Publicado/despublicado histórico sólo existe con observación directa. |
| **Pruebas** | Pre-M12; gap; reposición invisible; stock negativo; mezcla de modos. |
| **Condición para avanzar** | Habilita joins de catálogo. |
| **Dependencias / habilita** | `M10b`, `M12.3`, `M19a.3` / `M20.2`, `M21.1` |
| **Intervención requerida del usuario** | Ninguna. |

### M20.2 — Cruce inversión–catálogo — sólo `ads_catalog`

| Campo | Contenido |
|---|---|
| **ID** | `M20.2` — ≤8 h |
| **Objetivo** | Identificar gasto ocurrido durante estados problemáticos defendibles. |
| **Implementación requerida** | Join temporal por mapping congelado y clasificación agotado/despublicado/destino roto. |
| **Procedimiento del asistente** | Seleccionar intervalos; unir gasto diario; aplicar cobertura/gates; separar estado estimado; producir candidatos. |
| **Evidencia de cierre** | Candidatos con gasto, período, estado y procedencia. |
| **Criterio de aceptación** | No usa publicación reconstruida ni mapping fuera de vigencia. |
| **Pruebas** | Anuncio sin mapping; estado estimado; gap; zona; producto republicado. |
| **Condición para avanzar** | Habilita cálculo monetario específico. |
| **Dependencias / habilita** | `M20.1`, `M19b.2`, `M17.3` / `M20.3` |
| **Intervención requerida del usuario** | Confirmar estados intencionales si aparecen. |

### M20.3 — Rango y evidencia de catálogo roto

| Campo | Contenido |
|---|---|
| **ID** | `M20.3` — ≤8 h |
| **Objetivo** | Convertir candidatos en hallazgos con incertidumbre visible. |
| **Implementación requerida** | Fórmula low/high, evidencia, probable causa, acción y validación. |
| **Procedimiento del asistente** | Calcular intervalo confirmado/posible; sumar gasto; adjuntar refs; clasificar confianza; emitir o abstenerse. |
| **Evidencia de cierre** | Detector de gasto a catálogo roto. |
| **Criterio de aceptación** | El monto se llama exposición, no pérdida demostrada. |
| **Pruebas** | Límite low/high; gap; gasto cero; moneda; intervalo abierto. |
| **Condición para avanzar** | Habilita M20.4. |
| **Dependencias / habilita** | `M20.2` / `M20.4`, `M22.1` |
| **Intervención requerida del usuario** | Revisar una muestra de hallazgos. |

### M20.4 — Variante commerce_reliability y suite del detector

| Campo | Contenido |
|---|---|
| **ID** | `M20.4` — ≤8 h |
| **Objetivo** | Cerrar comportamiento diferente por producto. |
| **Implementación requerida** | En `commerce_reliability`, detector de riesgo observable de catálogo sin gasto; en `ads_catalog`, suite completa de M20.2/M20.3. |
| **Procedimiento del asistente** | Separar output schemas; retirar lenguaje ads en B; ejecutar fixtures; verificar abstenciones; documentar capacidad. |
| **Evidencia de cierre** | Dos salidas coherentes con dos productos distintos. |
| **Criterio de aceptación** | Rama B no muestra “gasto no disponible”; muestra riesgo operativo de catálogo bajo su propio contrato. |
| **Pruebas** | Copy; campos prohibidos; branch routing; snapshot; determinismo. |
| **Condición para avanzar** | Cierra M20 para M22 y catalog report. |
| **Dependencias / habilita** | `M20.1`, `M20.3` cuando A / `M22.1`, `M24b.1` |
| **Intervención requerida del usuario** | Validar que ambas propuestas sean distintas y entendibles. |

### M21.1 — Variante principal y elegibilidad de stock

| Campo | Contenido |
|---|---|
| **ID** | `M21.1` — ≤8 h |
| **Objetivo** | Identificar variantes relevantes usando historia propia. |
| **Implementación requerida** | Regla de variante principal, volumen mínimo y modo observed/reconstructed. |
| **Procedimiento del asistente** | Agregar unidades; calcular participación; aplicar mínimos; vincular stock; marcar modo; abstenerse si no alcanza. |
| **Evidencia de cierre** | Variantes elegibles con evidencia. |
| **Criterio de aceptación** | Poco volumen no produce “principal” ficticia. |
| **Pruebas** | Producto nuevo; empate; sin ventas; reconstrucción; variante borrada. |
| **Condición para avanzar** | Habilita cobertura. |
| **Dependencias / habilita** | `M10b`, `M11.3`, `M20.1`, `M19a.3` / `M21.2` |
| **Intervención requerida del usuario** | Revisar una muestra de variantes principales. |

### M21.2 — Días de cobertura y sesgo

| Campo | Contenido |
|---|---|
| **ID** | `M21.2` — ≤8 h |
| **Objetivo** | Estimar cobertura sin ocultar el origen retrospectivo del stock. |
| **Implementación requerida** | Velocidad robusta, days cover, límites de volumen y propagación del sesgo M10b. |
| **Procedimiento del asistente** | Calcular ventas comparables; estimar velocidad; dividir stock; aplicar límites; etiquetar evidencia; emitir rango/abstención. |
| **Evidencia de cierre** | Cobertura con método y nivel de evidencia. |
| **Criterio de aceptación** | Reconstrucción sesgada nunca recibe la misma confianza que observación directa. |
| **Pruebas** | Demanda cero; outlier; reposición invisible; stock negativo; 13/14 días. |
| **Condición para avanzar** | Habilita hallazgo de stock. |
| **Dependencias / habilita** | `M21.1` / `M21.4` |
| **Intervención requerida del usuario** | Validar que el sesgo se explique claramente. |

### M21.3 — Sustitución con clave válida

| Campo | Contenido |
|---|---|
| **ID** | `M21.3` — ≤8 h |
| **Objetivo** | Medir sustitución sólo cuando exista un join retrospectivo defendible. |
| **Implementación requerida** | Cohorte elegible, clave anunciada/comprada, ventana y tasa con restricciones. |
| **Procedimiento del asistente** | Elegir clave; unir; exigir volumen; separar ambigüedad; calcular tasa; etiquetar no evaluable. |
| **Evidencia de cierre** | Resultado de sustitución o abstención con razón. |
| **Criterio de aceptación** | No se infiere sesión o producto anunciado si GA4 no lo aporta. |
| **Pruebas** | Join ausente; item scope incompatible; poco volumen; múltiples productos. |
| **Condición para avanzar** | Resultado elegible pasa a cierre. |
| **Dependencias / habilita** | `M15.4`, `M18.3` en A, `M19a.3` / `M21.4` |
| **Intervención requerida del usuario** | Confirmar una muestra si el join existe. |

### M21.4 — Cierre, replay y variantes de producto

| Campo | Contenido |
|---|---|
| **ID** | `M21.4` — ≤8 h |
| **Objetivo** | Cerrar stock/sustitución de forma determinística y coherente por producto. |
| **Implementación requerida** | Resultados K14, abstenciones, fixtures A/B y replay. |
| **Procedimiento del asistente** | Consolidar; propagar restricciones; retirar campos publicitarios en B; reejecutar; comparar; documentar. |
| **Evidencia de cierre** | Suite estable de M21. |
| **Criterio de aceptación** | Misma evidencia produce mismo estado y cifras. |
| **Pruebas** | Branch A/B; insufficient; not applicable; replay; evidencia faltante. |
| **Condición para avanzar** | Habilita M22.1. |
| **Dependencias / habilita** | `M21.2`, `M21.3` / `M22.1`, `M24b.1` |
| **Intervención requerida del usuario** | Aprobar la semántica de sustitución o su exclusión. |

### M22.1 — Fórmulas y ledger monetario

| Campo | Contenido |
|---|---|
| **ID** | `M22.1` — ≤8 h |
| **Objetivo** | Calcular rangos reproducibles desde resultados elegibles. |
| **Implementación requerida** | Fórmulas versionadas, inputs, low/high, moneda y numeric ledger. |
| **Procedimiento del asistente** | Seleccionar resultados; calcular rangos; redondear; registrar inputs/fórmula; validar moneda; abstenerse. |
| **Evidencia de cierre** | Ledger reconstruible por hallazgo. |
| **Criterio de aceptación** | Ningún monto se calcula en LLM o UI. |
| **Pruebas** | Low>high; moneda mixta; nulo; redondeo; replay. |
| **Condición para avanzar** | Habilita confianza. |
| **Dependencias / habilita** | `M20.4`, `M21.4`, `M05.2` / `M22.2` |
| **Intervención requerida del usuario** | Ninguna. |

### M22.2 — Confianza, recurrencia y prioridad

| Campo | Contenido |
|---|---|
| **ID** | `M22.2` — ≤8 h |
| **Objetivo** | Ordenar hallazgos con componentes visibles. |
| **Implementación requerida** | Confianza y razones, recurrencia, controlabilidad, pesos y score. |
| **Procedimiento del asistente** | Normalizar componentes; aplicar restricciones; calcular score; guardar desglose; desempatar estable. |
| **Evidencia de cierre** | Prioridad explicable por componente. |
| **Criterio de aceptación** | Un gate fallido reduce o bloquea lo correspondiente. |
| **Pruebas** | Empate; peso inválido; confianza baja; not_evaluable; branch. |
| **Condición para avanzar** | Habilita materialización. |
| **Dependencias / habilita** | `M22.1` / `M22.3` |
| **Intervención requerida del usuario** | Aprobar pesos y sentido del ranking. |

### M22.3 — Materialización y replay del análisis

| Campo | Contenido |
|---|---|
| **ID** | `M22.3` — ≤8 h |
| **Objetivo** | Sellar findings y resultados para publicación. |
| **Implementación requerida** | Persistencia K14/K15, hashes, estados terminales y comparación de replay. |
| **Procedimiento del asistente** | Validar refs; persistir; sellar versiones; reejecutar; comparar hashes; cerrar run. |
| **Evidencia de cierre** | Analysis run listo para narración y reportes. |
| **Criterio de aceptación** | Toda cifra, score y evidencia se reconstruye. |
| **Pruebas** | Ref inexistente; hash distinto; run incompleto; resultado tardío. |
| **Condición para avanzar** | `G-ANALISIS` habilita M23.1 y M24b.1. |
| **Dependencias / habilita** | `M22.2` / `M23.1`, `M24b.1` |
| **Intervención requerida del usuario** | Revisar una muestra priorizada. |

---

## Fase 6 — Narración, dos reportes y chat

**Condición de cierre:** narración validada, `reliability` y `catalog` publicados como entregas separadas y chat limitado a herramientas cerradas.

### M23.1 — Input allowlist y schema de narración

| Campo | Contenido |
|---|---|
| **ID** | `M23.1` — ≤8 h |
| **Objetivo** | Separar hechos calculados de texto generado. |
| **Implementación requerida** | `FindingCore`, K17, input allowlist, campos redactables y salida JSON estricta. |
| **Procedimiento del asistente** | Seleccionar hechos; excluir PII; adjuntar ledger/refs; definir salida; validar fixtures; versionar prompt. |
| **Evidencia de cierre** | Paquete de narración cerrado y auditable. |
| **Criterio de aceptación** | El modelo no recibe acceso a DB ni campos fuera de allowlist. |
| **Pruebas** | Campo extra; PII; ref ausente; schema inválido; producto equivocado. |
| **Condición para avanzar** | Habilita cliente LLM. |
| **Dependencias / habilita** | `M05.2`, `M22.3` / `M23.2` |
| **Intervención requerida del usuario** | Aprobar tono y datos operativos anonimizados permitidos. |

### M23.2 — Cliente LLM y salida estructurada

| Campo | Contenido |
|---|---|
| **ID** | `M23.2` — ≤8 h |
| **Objetivo** | Obtener narración estructurada con modelo y versión fijos. |
| **Implementación requerida** | Cliente Responses, JSON Schema, `store:false`, timeout, mock y logs de uso redactados. |
| **Procedimiento del asistente** | Configurar modelo; enviar paquete; validar respuesta; clasificar error; registrar tokens/costo; probar mock. |
| **Evidencia de cierre** | Narración válida para un fixture. |
| **Criterio de aceptación** | Respuesta libre o inválida nunca pasa. |
| **Pruebas** | Timeout; schema roto; modelo incorrecto; log sensible; respuesta vacía. |
| **Condición para avanzar** | Habilita guarda numérica. |
| **Dependencias / habilita** | `M23.1` / `M23.3` |
| **Intervención requerida del usuario** | Crear el proyecto API y guardar la clave en secretos, no en el chat. |

### M23.3 — Guarda numérica y de referencias

| Campo | Contenido |
|---|---|
| **ID** | `M23.3` — ≤8 h |
| **Objetivo** | Rechazar cifras o hechos no presentes en el paquete. |
| **Implementación requerida** | Extractor/normalizador numérico, comparación con ledger y verificador de `fact_refs`. |
| **Procedimiento del asistente** | Extraer números; normalizar ARS/%/fechas; comparar ledger; validar refs; rechazar; permitir sólo texto seguro. |
| **Evidencia de cierre** | Fixture con número inyectado rechazado. |
| **Criterio de aceptación** | Cero números nuevos y cero referencias inexistentes. |
| **Pruebas** | Decimal; porcentaje; fecha; número escrito; redondeo; ref cruzada. |
| **Condición para avanzar** | Habilita fallback y consumo productivo. |
| **Dependencias / habilita** | `M23.2` / `M23.4` |
| **Intervención requerida del usuario** | Ninguna. |

### M23.4 — Presupuesto, fallback y suite adversaria

| Campo | Contenido |
|---|---|
| **ID** | `M23.4` — ≤8 h |
| **Objetivo** | Fallar de forma segura ante costo, inyección o indisponibilidad. |
| **Implementación requerida** | Límite interno, reintento único, fallback determinístico, abstención y casos adversarios. |
| **Procedimiento del asistente** | Reservar costo; llamar; validar; reintentar una vez; devolver fallback; debitar; ejecutar ataques. |
| **Evidencia de cierre** | Narración segura con LLM disponible o caído. |
| **Criterio de aceptación** | Fallos no publican texto libre ni exceden presupuesto. |
| **Pruebas** | Prompt injection; presupuesto agotado; dos fallos; payload hostil; evidencia insuficiente. |
| **Condición para avanzar** | Habilita narración `llm`, el publicador catalog cuando la requiera y el orquestador de chat; no bloquea el primer reliability con plantilla. |
| **Dependencias / habilita** | `M23.3` / modo `llm` de `M24a.1`, `M24b.1`, `M25.3` |
| **Intervención requerida del usuario** | Fijar el límite de gasto y aprobar ejemplos de abstención. |

### M24a.1 — Contrato y publicación del reporte de confiabilidad

| Campo | Contenido |
|---|---|
| **ID** | `M24a.1` — primera entrega de reporte, ≤8 h |
| **Objetivo** | Publicar `report_kind=reliability` como artefacto independiente. |
| **Implementación requerida** | Validador K16, regla de 28 días TN+GA4, job de publicación y estado partial/ready/failed. |
| **Procedimiento del asistente** | Cargar M19a; verificar 28 días; agregar M19b si A y elegible; generar narración determinística con `narration_mode=template`; validar; publicar transaccionalmente; habilitar `llm` sólo después de M23.4. |
| **Evidencia de cierre** | Registro de reporte reliability con ventana y controles. |
| **Criterio de aceptación** | Menos de 28 días superpuestos no puede producir `ready`; Meta nunca bloquea el reporte base TN+GA4. |
| **Pruebas** | 27/28 días; M19b ausente; branch A/B; publicación atómica; número inválido; template sin OpenAI; llm sólo tras M23.4. |
| **Condición para avanzar** | Habilita UI reliability. |
| **Dependencias / habilita** | `M19a.3`; M19b opcional en A; M23.4 sólo para `narration_mode=llm` / `M24a.2` |
| **Intervención requerida del usuario** | Ninguna. |

### M24a.2 — UI y aceptación del reporte de confiabilidad

| Campo | Contenido |
|---|---|
| **ID** | `M24a.2` — primera entrega de reporte, ≤8 h |
| **Objetivo** | Mostrar medición, cobertura y bloqueos antes de hallazgos de catálogo. |
| **Implementación requerida** | Vista reliability, banner de ventana, controles, diferencias TN–GA4, evidencia y limitaciones por producto. |
| **Procedimiento del asistente** | Renderizar resumen; ordenar controles; abrir evidencia; mostrar ventana/fuentes; adaptar A/B; probar estados. |
| **Evidencia de cierre** | Primer reporte utilizable por el dueño. |
| **Criterio de aceptación** | El usuario distingue falla de datos, ausencia de evidencia y funcionamiento correcto. |
| **Pruebas** | Ready/partial/failed; móvil; tenant; M19b opcional; evidencia; accesibilidad. |
| **Condición para avanzar** | `G-RELIABILITY`: reporte explicado sin asistencia técnica. |
| **Dependencias / habilita** | `M24a.1` / `M25.1`, `M27.1` |
| **Intervención requerida del usuario** | Revisar claridad y exactitud del reporte reliability. |

### M24b.1 — Contrato y publicación del reporte de catálogo

| Campo | Contenido |
|---|---|
| **ID** | `M24b.1` — segunda entrega de reporte, ≤8 h |
| **Objetivo** | Publicar `report_kind=catalog` separado de confiabilidad. |
| **Implementación requerida** | Validador K16, ventana mínima de 28 días de pedidos + snapshot actual, coverage mode y publicación de findings M20/M21/M22. |
| **Procedimiento del asistente** | Verificar inputs; fijar modo observed/reconstructed/mixed; bloquear publicación histórica no observada; narrar; validar; publicar. |
| **Evidencia de cierre** | Registro catalog con ventana, sesgo, findings y producto. |
| **Criterio de aceptación** | Stock reconstruido se etiqueta sesgado; publicado/despublicado exige 7 días directos de M12 o queda `not_evaluable`. |
| **Pruebas** | 27/28 días; sin snapshot; reconstructed; 6/7 días directos; estado publicado pre-M12; branch A/B. |
| **Condición para avanzar** | Habilita UI catalog. |
| **Dependencias / habilita** | `M10b`, `M12.3`, `M22.3`, `M23.4` / `M24b.2` |
| **Intervención requerida del usuario** | Aprobar el texto del sesgo retrospectivo. |

### M24b.2 — UI y aceptación del reporte de catálogo

| Campo | Contenido |
|---|---|
| **ID** | `M24b.2` — segunda entrega de reporte, ≤8 h |
| **Objetivo** | Mostrar riesgos de catálogo de acuerdo con el producto y la calidad temporal. |
| **Implementación requerida** | Vista catalog, modo de cobertura, findings, rangos, fórmula, prioridad y evidencia; copy distinto A/B. |
| **Procedimiento del asistente** | Renderizar ventana/modo; mostrar sesgo arriba; ordenar findings; abrir evidencia; ocultar campos incompatibles; probar estados. |
| **Evidencia de cierre** | Segundo reporte independiente y auditable. |
| **Criterio de aceptación** | En A puede hablar de inversión–catálogo; en B sólo de medición y riesgo operativo de catálogo. |
| **Pruebas** | Copy A/B; observed/reconstructed; not_evaluable; fórmula; tenant; accesibilidad. |
| **Condición para avanzar** | `G-CATALOG`: un dueño entiende origen, sesgo y acción de cada hallazgo. |
| **Dependencias / habilita** | `M24b.1` / `M25.1`, `M27.1` |
| **Intervención requerida del usuario** | Revisar claridad y exactitud del reporte catalog. |

### M25.1 — Contratos de herramientas del chat

| Campo | Contenido |
|---|---|
| **ID** | `M25.1` — ≤8 h |
| **Objetivo** | Limitar el chat a consultas explícitas sobre los dos reportes. |
| **Implementación requerida** | Schemas para cobertura, lista/detalle de findings, métricas, períodos y evidencia, incluyendo `report_kind`. |
| **Procedimiento del asistente** | Definir args; exigir tenant/run/report kind; acotar períodos; definir ledger/citas; crear casos inválidos. |
| **Evidencia de cierre** | Catálogo K18 cerrado. |
| **Criterio de aceptación** | No acepta SQL, nombres de tabla ni reportes ambiguos. |
| **Pruebas** | report_kind ausente; período excesivo; ID cruzado; campo extra; SQL. |
| **Condición para avanzar** | Habilita implementación. |
| **Dependencias / habilita** | `M24a.2`, `M24b.2`, `M05.2` / `M25.2` |
| **Intervención requerida del usuario** | Aportar preguntas reales separadas por tipo de reporte. |

### M25.2 — RPCs y ejecución de herramientas

| Campo | Contenido |
|---|---|
| **ID** | `M25.2` — ≤8 h |
| **Objetivo** | Resolver cada herramienta bajo sesión y RLS. |
| **Implementación requerida** | RPCs/proyecciones, handlers, límites de filas y citas. |
| **Procedimiento del asistente** | Implementar queries cerradas; validar args; resolver tenant; devolver hechos/ledger/refs; medir límites. |
| **Evidencia de cierre** | Herramientas determinísticas sobre fixtures A/B. |
| **Criterio de aceptación** | Cero acceso cruzado y cero consulta libre. |
| **Pruebas** | Tenant; ID inválido; límite; report kind; evidencia ausente. |
| **Condición para avanzar** | Habilita orquestador. |
| **Dependencias / habilita** | `M25.1` / `M25.3` |
| **Intervención requerida del usuario** | Ninguna. |

### M25.3 — Orquestador y validación de respuesta

| Campo | Contenido |
|---|---|
| **ID** | `M25.3` — ≤8 h |
| **Objetivo** | Elegir herramientas sin permitir hechos o números libres. |
| **Implementación requerida** | Orquestador, límite de tool calls, answer schema, citas, guarda numérica y abstención. |
| **Procedimiento del asistente** | Clasificar pregunta; llamar herramientas; reunir ledger; redactar; validar; responder o abstenerse; registrar costo. |
| **Evidencia de cierre** | Respuesta estructurada con fuente y fecha. |
| **Criterio de aceptación** | Todo hecho proviene de una herramienta y respeta `report_kind`. |
| **Pruebas** | Injection; tool loop; número nuevo; cita inexistente; presupuesto. |
| **Condición para avanzar** | Habilita UI. |
| **Dependencias / habilita** | `M25.2`, `M23.4` / `M25.4` |
| **Intervención requerida del usuario** | Ninguna. |

### M25.4 — UI del chat y contexto explícito

| Campo | Contenido |
|---|---|
| **ID** | `M25.4` — ≤8 h |
| **Objetivo** | Hacer visible qué reporte y período responde el chat. |
| **Implementación requerida** | Panel, selector/contexto de report kind, citas, estados y limitaciones del producto. |
| **Procedimiento del asistente** | Mostrar contexto; enviar pregunta; renderizar respuesta/citas; manejar error; cambiar reporte; adaptar A/B. |
| **Evidencia de cierre** | Conversación navegable sin memoria autoritativa oculta. |
| **Criterio de aceptación** | El usuario siempre ve fuente, fecha y tipo de reporte. |
| **Pruebas** | Loading/error; cambio de reporte; Rama B; móvil; accesibilidad. |
| **Condición para avanzar** | Habilita aceptación adversaria. |
| **Dependencias / habilita** | `M25.3` / `M25.5` |
| **Intervención requerida del usuario** | Revisar utilidad de las respuestas. |

### M25.5 — Preguntas reales y suite adversaria

| Campo | Contenido |
|---|---|
| **ID** | `M25.5` — ≤8 h |
| **Objetivo** | Cerrar el chat con preguntas útiles y ataques. |
| **Implementación requerida** | Corpus de aceptación por producto/reporte y suite de seguridad/abstención. |
| **Procedimiento del asistente** | Clasificar preguntas; fijar respuesta esperada; ejecutar; revisar citas/números; atacar SQL/prompt; ajustar sólo contratos. |
| **Evidencia de cierre** | Resultado por pregunta y cero respuestas inseguras. |
| **Criterio de aceptación** | 100% de respuestas factuales citadas; lo no soportado se abstiene. |
| **Pruebas** | SQL; prompt injection; período; tenant; branch; número; fuente; pregunta ambigua. |
| **Condición para avanzar** | `G-CHAT` habilita snapshot. |
| **Dependencias / habilita** | `M25.4` / `M27.1` |
| **Intervención requerida del usuario** | Aportar y validar preguntas reales; no escribir SQL. |

---

## Fase 7 — Operación, snapshot y aceptación

### M26.1 — Programación y monitoreo de recolección

| Campo | Contenido |
|---|---|
| **ID** | `M26.1` — ≤8 h |
| **Objetivo** | Ejecutar observaciones y cargas periódicas con estado visible. |
| **Implementación requerida** | Scheduler, drain acotado, jobs periódicos, panel y alertas dead/reauth/stale. |
| **Procedimiento del asistente** | Programar; deduplicar overlap; ejecutar; medir frescura/cobertura; alertar; documentar recuperación. |
| **Evidencia de cierre** | Corridas automáticas observables. |
| **Criterio de aceptación** | M12 se mide por cobertura temporal, no por latencia de webhook. |
| **Pruebas** | Scheduler doble; worker caído; fuente stale; reauth; poll omitido. |
| **Condición para avanzar** | Habilita corrida estable. |
| **Dependencias / habilita** | `M12.3`, `M15.4`, `M17.4` si A / `M26.4` |
| **Intervención requerida del usuario** | Aprobar frecuencia de observación y destinatario de alertas. |

### M26.2 — Seguridad operativa y rotación

| Campo | Contenido |
|---|---|
| **ID** | `M26.2` — ≤8 h |
| **Objetivo** | Verificar privilegios, secretos y respuesta a revocación. |
| **Implementación requerida** | Auditoría de imports/grants, rotación, redacción de logs, CSP, defensa CSRF y runbook de credenciales. |
| **Procedimiento del asistente** | Escanear; reducir permisos; rotar clave; revocar token; revisar logs; definir y probar CSP; proteger mutaciones contra CSRF; probar recuperación. |
| **Evidencia de cierre** | Evidencia de mínimo privilegio y rotación. |
| **Criterio de aceptación** | Cero `service_role` en ejecución normal, cero secretos en logs, CSP efectiva y ninguna mutación sensible aceptada desde un origen no autorizado. |
| **Pruebas** | Import web; grant directo; clave vieja; token revocado; error sensible; CSP report/enforce; POST cross-site; Origin/Referer inválido. |
| **Condición para avanzar** | Habilita privacidad y cierre operativo. |
| **Dependencias / habilita** | `M06.3`, conectores / `M26.3`, `M26.4` |
| **Intervención requerida del usuario** | Custodiar secretos y participar en una revocación controlada. |

### M26.3 — Retención, desconexión y borrado

| Campo | Contenido |
|---|---|
| **ID** | `M26.3` — ≤8 h |
| **Objetivo** | Cumplir el ciclo de vida de los datos por tenant. |
| **Implementación requerida** | Jobs de retención, disconnect, delete, manifest residual y verificación de cero filas. |
| **Procedimiento del asistente** | Expirar raw; preservar manifest permitido; desconectar; borrar tenant de prueba; verificar tablas; documentar. |
| **Evidencia de cierre** | Informe de borrado y retención. |
| **Criterio de aceptación** | La solicitud elimina el tenant correcto sin afectar otro. |
| **Pruebas** | Tenant A/B; job interrumpido; credencial; snapshot; reintento. |
| **Condición para avanzar** | Habilita estabilidad prolongada. |
| **Dependencias / habilita** | `M26.2`, `M03` / `M26.4` |
| **Intervención requerida del usuario** | Aprobar política y ejecutar una solicitud de prueba. |

### M26.4 — Costo, estabilidad y runbooks

| Campo | Contenido |
|---|---|
| **ID** | `M26.4` — ≤8 h de implementación; la observación de calendario corre aparte |
| **Objetivo** | Demostrar operación estable dentro de límites. |
| **Implementación requerida** | Medición de costo, spend caps internos, dashboard de jobs, runbooks de fallos y recuperación de la serie temporal M12. No se exige backup general de datos redescargables desde Tiendanube, GA4 o Meta. |
| **Procedimiento del asistente** | Proyectar consumo; fijar límites; ejecutar período estable; recuperar errores; restaurar una copia de la serie M12 en un destino aislado; revisar alertas; cerrar evidencias. |
| **Evidencia de cierre** | Informe operativo con costo, frescura, cobertura y fallos recuperados. |
| **Criterio de aceptación** | El sistema bloquea consumo antes de superar el tope definido. |
| **Pruebas** | Presupuesto; API caída; job dead; alerta; recuperación; restore íntegro de observaciones M12 y sus referencias. |
| **Condición para avanzar** | `G-MVP-T` habilita aceptación final. |
| **Dependencias / habilita** | `M26.1`–`M26.3`, `M24a.2`, `M24b.2` / `M28.1` |
| **Intervención requerida del usuario** | Configurar spend caps y revisar los contactos de incidente. |

### M27.1 — Exportación mínima y anonimización

| Campo | Contenido |
|---|---|
| **ID** | `M27.1` — ≤8 h |
| **Objetivo** | Extraer una corrida real sin PII ni credenciales. |
| **Implementación requerida** | Export K19, pseudonimización estable, allowlist por contrato y escáner. |
| **Procedimiento del asistente** | Elegir run/reportes; extraer mínimo; anonimizar; eliminar secretos; escanear; generar manifest. |
| **Evidencia de cierre** | Snapshot candidato redactado. |
| **Criterio de aceptación** | Cero PII, cero tokens y ambos `report_kind` identificados. |
| **Pruebas** | Email inyectado; token; nombre; tenant id; campo fuera de allowlist. |
| **Condición para avanzar** | Habilita import/replay. |
| **Dependencias / habilita** | `M24a.2`, `M24b.2`, `M25.5` / `M27.2` |
| **Intervención requerida del usuario** | Elegir runs/reportes y aprobar anonimización. |

### M27.2 — Importación y replay determinístico

| Campo | Contenido |
|---|---|
| **ID** | `M27.2` — ≤8 h |
| **Objetivo** | Reproducir contratos, análisis y reportes desde snapshot. |
| **Implementación requerida** | Importador, adaptador replay por K07, tenant demo y comparación de hashes. |
| **Procedimiento del asistente** | Importar; reejecutar normalizadores; correr M19/M20/M21/M22; publicar ambos reportes; comparar. |
| **Evidencia de cierre** | Demo con mismos resultados que la corrida origen. |
| **Criterio de aceptación** | Hashes esperados coinciden sin edición manual. |
| **Pruebas** | Manifest alterado; versión distinta; report kind faltante; branch; hash. |
| **Condición para avanzar** | Habilita modo offline. |
| **Dependencias / habilita** | `M27.1` / `M27.3` |
| **Intervención requerida del usuario** | Ninguna. |

### M27.3 — Modo offline y sello final

| Campo | Contenido |
|---|---|
| **ID** | `M27.3` — ≤8 h |
| **Objetivo** | Probar la demo con APIs externas bloqueadas. |
| **Implementación requerida** | Bloqueo de hosts, modo demo de build, sello/hash y recorrido de reportes/chat. |
| **Procedimiento del asistente** | Bloquear egress; iniciar demo; abrir reliability/catalog; preguntar al chat; verificar cero requests; sellar. |
| **Evidencia de cierre** | Snapshot final reproducible offline. |
| **Criterio de aceptación** | Cero solicitudes externas y cero divergencia de detectores. |
| **Pruebas** | Meta/GA4/TN/OpenAI bloqueados; hash; chat; ambos productos. |
| **Condición para avanzar** | Habilita ensayo final. |
| **Dependencias / habilita** | `M27.2` / `M28.1`, `M28.3` |
| **Intervención requerida del usuario** | Aprobar el snapshot visible. |

### M28.1 — Suite de aceptación del producto

| Campo | Contenido |
|---|---|
| **ID** | `M28.1` — ≤8 h |
| **Objetivo** | Probar el recorrido completo del `product_variant` elegido. |
| **Implementación requerida** | E2E registro→conexiones→sync→reliability→catalog→chat y matriz de gates. |
| **Procedimiento del asistente** | Preparar entorno; ejecutar fixtures/real; probar dos tenants; recorrer ambos reportes; verificar límites. |
| **Evidencia de cierre** | Informe de aceptación funcional. |
| **Criterio de aceptación** | Cada criterio del producto elegido tiene evidencia. |
| **Pruebas** | Tenant; branch; ventanas mínimas; reporte; chat; reauth. |
| **Condición para avanzar** | Habilita deploy. |
| **Dependencias / habilita** | `M22.3`, `M25.5`, `M26.4`, `M27.3` / `M28.2` |
| **Intervención requerida del usuario** | Recorrer el sistema como dueño. |

### M28.2 — Despliegue, readiness y rollback

| Campo | Contenido |
|---|---|
| **ID** | `M28.2` — ≤8 h |
| **Objetivo** | Desplegar con comprobación y vuelta atrás. |
| **Implementación requerida** | Producción/demo, health/readiness, smoke, versión fijada y runbook de rollback. |
| **Procedimiento del asistente** | Desplegar; migrar; verificar health; ejecutar smoke; fijar versión; simular rollback; registrar. |
| **Evidencia de cierre** | Deploy verificable y reversible. |
| **Criterio de aceptación** | Smoke verde y rollback probado. |
| **Pruebas** | Migración; secreto faltante; health; rollback; tenant demo. |
| **Condición para avanzar** | Habilita ensayo. |
| **Dependencias / habilita** | `M28.1` / `M28.3` |
| **Intervención requerida del usuario** | Confirmar dominio y acceso final. |

### M28.3 — Guion y fallos de demostración

| Campo | Contenido |
|---|---|
| **ID** | `M28.3` — ≤8 h |
| **Objetivo** | Preparar una demostración que sobreviva fallos externos. |
| **Implementación requerida** | Guion, recorrido por ambos reportes, preguntas de chat, plan offline y simulaciones de caída. |
| **Procedimiento del asistente** | Ensayar online; cortar APIs; ensayar offline; simular LLM/deploy caído; medir; corregir bloqueantes. |
| **Evidencia de cierre** | Dos ensayos completos consecutivos. |
| **Criterio de aceptación** | El relato coincide con el producto elegido y no oculta sesgos o límites. |
| **Pruebas** | Sin red; sin LLM; API caída; reportes prepublicados; tiempo; backup. |
| **Condición para avanzar** | Habilita freeze. |
| **Dependencias / habilita** | `M28.2`, `M27.3` / `M28.4` |
| **Intervención requerida del usuario** | Ensayar la presentación como evaluador. |

### M28.4 — Manifiesto, freeze y aceptación final

| Campo | Contenido |
|---|---|
| **ID** | `M28.4` — ≤8 h |
| **Objetivo** | Congelar una versión aceptada y sus evidencias. |
| **Implementación requerida** | `mvp-acceptance`, hashes, versiones, gates, limitaciones y checklist final. |
| **Procedimiento del asistente** | Reunir evidencias; verificar gates; registrar contratos/metodología/dataset; congelar; autorizar sólo correcciones bloqueantes. |
| **Evidencia de cierre** | Manifiesto final del MVP. |
| **Criterio de aceptación** | Todos los gates aplicables están PASS o existe recorte contractual explícito. |
| **Pruebas** | Hash; versión; gate faltante; cambio posterior; producto incorrecto. |
| **Condición para avanzar** | `G-MVP-P`: MVP entregado. |
| **Dependencias / habilita** | `M28.3` / entrega final |
| **Intervención requerida del usuario** | Aprobar el producto visible, sus limitaciones y el freeze. |

---

## Camino crítico corregido

`M04.1 → M04.2 → M05.1.1–M05.1.12 → M06.1–M06.3 → M07.1–M07.3 → M08.1–M08.3`, en paralelo con `M00 → M01.1–M01.2 → M02.1–M02.2 → M03`.

Luego:

- Tiendanube: `M09.1–M09.3 → M10a + M10c → M10d → M11.1 + M11.2 → M10b + M11.3 → M12.1–M12.3`.
- GA4: `M13.1–M13.3 → M14.1–M14.4 → M15.1–M15.4`.
- Producto `ads_catalog`: `M16.1–M16.2 → M17.1–M17.4 → M18.1–M18.3 → M19b.1–M19b.2`.
- Producto `commerce_reliability`: `M16b`; no atraviesa M17/M18/M19b.
- Confiabilidad común: `M19a.1–M19a.3 → M24a.1–M24a.2`.
- Catálogo: `M20.1–M20.4` y `M21.1–M21.4 → M22.1–M22.3 → M24b.1–M24b.2`.
- Cierre: `M23.1–M23.4 → M25.1–M25.5 → M26.1–M26.4 → M27.1–M27.3 → M28.1–M28.4`.

M12 permanece porque crea historia observada de catálogo. Su éxito se mide por cobertura temporal, trazabilidad y recuperación de huecos; no por reducir latencia.
