# Propuesta de enmienda: empresa demo sintética para presentaciones

**Estado:** BORRADOR (2026-11-17), redactado a pedido del usuario. No modifica la ruta, la spec, `SECURITY.md` ni el código hasta su aprobación expresa.

## 1. Punto de partida

La cuenta de Meta del piloto no tuvo actividad: con datos reales no se ven gasto, comparaciones entre fuentes con valores, alertas de anomalías ni el diagnóstico (limitaciones registradas en `G-SYNC`, `G-DIAG`, `G-GA4-FUSION` y `G-ANOMALIES`). Para una presentación hace falta mostrar PRAXA completo, con datos llenos y coherentes entre las tres fuentes.

Meta no permite crear una cuenta con gasto y resultados sin pagar anuncios, y el MVP no escribe en sistemas externos. Mezclar Meta inventado con Tiendanube y GA4 reales del dueño produciría conclusiones falsas sobre una tienda real y excede la finalidad del acta (piloto, no presentación a terceros). El usuario eligió el 2026-11-17 una **empresa demo separada, con las tres fuentes sintéticas, fuera del proyecto `app`** (opción «a»).

`M28.3a` sigue siendo la demo **con el dueño y sus datos reales**; esta microfase no la reemplaza ni la bloquea.

## 2. Ficha propuesta `M28.2b` — Empresa demo sintética

| Campo | Contenido |
|---|---|
| **ID** | `M28.2b` (subdivisión del entorno `M28.2`). Trabajo paralelo: no depende de `M28.3a` ni la bloquea |
| **Objetivo** | Una empresa demo, visiblemente rotulada como tal, con Meta, Tiendanube y GA4 sintéticos y coherentes entre sí, desplegada en un entorno separado de `app`, para presentar Inicio, Integraciones, chat, anomalías, comparaciones y diagnóstico con datos llenos |
| **Implementación requerida** | Sembrador idempotente (`scripts/demo-seed.mjs` y su librería): crea o reemplaza la empresa demo y su usuario y carga 365 días de Tiendanube y GA4 y 90 días de Meta (cuatro niveles, desgloses) con las mismas funciones de `worker_api` que usan los conectores y, donde no haya función, con inserciones administrativas acotadas a la empresa demo, igual que los sembradores de prueba existentes. Sin migraciones nuevas. Guía para el entorno de vista previa en Vercel |
| **Datos** | Tienda ficticia de indumentaria (nombre y productos genéricos, sin parecido con clientes reales): ventas con estacionalidad semanal, productos con variantes y SKU, compradores que repiten (cohortes de 5 o más); GA4 con tráfico por fuente, embudo con eventos de comercio electrónico, `itemId` igual a la variante de Tiendanube en al menos el 80 % (regla de productos adoptada) y `utm_id` igual al ID de algunas campañas de Meta (comparación por campaña con correspondencia); Meta con 4–6 campañas, conjuntos y anuncios, gasto, clics y compras atribuidas, y anomalías inyectadas a propósito (pico de gasto, caída de CTR, salto del costo por resultado) para que el detector las marque. Todo con fechas relativas al día de siembra, para volver a sembrar antes de cada presentación |
| **Procedimiento del asistente** | Prueba unitaria del generador (determinista con semilla, coherencia entre fuentes, regla de cinco, anomalías detectables por el motor de M25b), sembrador con guarda de destino que **rechaza `app`**, recorrido en el entorno demo y evidencia en la sesión |
| **Evidencia de cierre** | `sesiones/M28.2b.md`: comandos y resultados, guarda contra `app` probada, conteos por fuente, capturas o recorrido redactado de cada pantalla |
| **Criterio de aceptación** | (1) El sembrador no corre contra `app`. (2) Repetirlo deja exactamente una empresa demo, sin duplicados. (3) En el entorno demo funcionan Inicio, Integraciones con las tres tarjetas, chat con las tres fuentes, anomalías con alertas reales del motor, comparaciones con correspondencia y diagnóstico v3. (4) Todo lo visible dice «Demo» en el nombre de la empresa. (5) Ningún dato real ni identificador de cuentas reales. (6) `npm run verify` en verde |
| **Pruebas** | Unit del generador y de la guarda; `npm run verify`; corrida del sembrador contra el entorno demo; recorrido manual |
| **Condición para avanzar** | `G-DEMO-SINT`, aprobación expresa del usuario tras el recorrido |
| **Dependencias** | `G-DIAG`, `G-TIENDA`, `G-GA4-FUSION` y `G-ANOMALIES` (aprobados) |
| **Intervención del usuario** | Crear o elegir la base del entorno demo (sección 3), configurar el despliegue de vista previa en Vercel con sus variables fuera del chat, correr el sembrador con el comando que se le indique y autorizar el costo de los modelos durante la presentación |

## 3. Dónde vive la demo: decisión pendiente

`SECURITY.md` §11 establece que el proyecto de pruebas es desechable y que sus variables **nunca se cargan en un despliegue**. Un despliegue de vista previa apuntado a ese proyecto cambia esa frontera, así que la opción elegida exige modificar `SECURITY.md` (**REQUIERE CAMBIO EN LA RUTA**). Alternativas:

| Opción | Cómo | Ventajas | Costos y riesgos |
|---|---|---|---|
| **a1. Tercer proyecto Supabase «demo»** (recomendada) | Proyecto nuevo, con las migraciones `0001`–`0031` aplicadas por el usuario y una vista previa de Vercel apuntada a él | Aísla la demo de `app` y también de las pruebas destructivas; la frontera de §11 se conserva y se agrega una tercera, sin datos reales | El plan gratuito de Supabase admite dos proyectos activos por organización: puede requerir otra organización o un plan pago. Un paso más de `db:push` por migración futura |
| **a2. Proyecto de pruebas existente** | Vista previa de Vercel apuntada al proyecto desechable | Sin proyecto nuevo | Las suites de aplicación y pgTAP corren en la misma base; una prueba o limpieza puede romper la demo. Hay que relajar §11 para un despliegue no productivo |

En los dos casos el despliegue demo no tiene OAuth real (los datos se siembran), usa sus propias variables de Preview y nunca comparte claves con `app`.

## 4. Decisiones que la enmienda debe cerrar

1. Opción a1 o a2 de la sección 3.
2. Costo de modelos en la demo: el chat (DeepInfra) y el diagnóstico (Anthropic) pagan por uso también en el entorno demo. ¿Se habilitan o se presenta el chat y el diagnóstico con un informe pregenerado una sola vez?
3. Rubro y nombre de la tienda ficticia (propuesta: «Tienda Demo — indumentaria», datos sintéticos).
4. Si `scripts/ga4-demo-events.mjs` (herramienta suelta del 2026-11-17, sin usar) se borra o se conserva.

## 5. Cambio documental tras la aprobación

`meta_first/plan.md`: Parte I (fila de `M28.2b`, orden y gate `G-DEMO-SINT`) y su ficha; `meta_first/spec.md`: criterios de la demo sintética; `SECURITY.md` §11 (entornos) según la opción elegida; `meta_first/entorno.md`: entorno demo; `PROJECT_STATE.md`: trabajo paralelo autorizado. Después siguen la spec y el plan de `M28.2b` según `docs/PIPELINE.md`.
