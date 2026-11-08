# Propuesta de ampliación de Insights para M16c

**Estado:** antecedente histórico de la propuesta; sustituido por la enmienda autorizada el 2026-11-06 en `meta_first/plan.md` y §11 de `meta_first/spec.md`. Las preguntas y sugerencias siguientes se conservan como historia, no como contrato vigente. Evidencia en `meta_first/sesiones/enmienda-insights-2026-11-06.md`.  
**Fecha:** 2026-11-06.  
**Decisión de producto expresada por el usuario:** la sincronización debe guardar los datos importantes de Meta Ads en los niveles cuenta, campaña, conjunto de anuncios y anuncio, para que el chat responda sobre ellos. El usuario confirmó el alcance propuesto en el chat. Los detalles técnicos siguientes deben incorporarse de forma coherente a la ruta, la spec de M16c y las microfases del chat antes de implementar.

## Motivo y conflicto con la ruta vigente

La ruta vigente acota M16c a `level=account`, `spend` e `impressions` por día (`meta_first/spec.md` §11; `meta_first/plan.md` I.1, ficha M16c y II.11). M25a limita sus herramientas a esas dos métricas y §2 excluye ratios. La spec BORRADOR de M16c hereda ese recorte. El alcance confirmado por el usuario no cabe en esos contratos. No basta con sumar campos a `fields`: cambian la identidad de cada fila, la completitud, la cobertura, la consulta del chat, los tipos, la retención y las pruebas.

## Contrato de datos propuesto para la enmienda

| Categoría | Captura propuesta | Regla necesaria |
|---|---|---|
| Granularidad | Insights diarios separados en `account`, `campaign`, `adset` y `ad`, de la única cuenta confirmada | Una fila se identifica por cuenta, nivel, entidad y fecha. No derivar el total de cuenta sumando filas inferiores. Cada nivel tiene completitud y cobertura propias. |
| Medidas base | `spend`, `impressions`, `reach`, `clicks` y `inline_link_clicks` cuando Meta los informe | Gasto y conteos exactos como cadenas desde la API hasta SQL y de SQL a TypeScript. Ausente, nulo, cero explícito y día no observado son distintos. `reach` cuenta personas únicas: no sumar días o entidades para producir un alcance de período. |
| Resultados | `actions` y `action_values`, desglosados por `action_type` y con la configuración/ventana de atribución empleada | Estructura tipada, acotada y validada; no guardar la respuesta cruda de Meta. Un tipo de acción ausente no se interpreta como cero. No sumar valores de tipos o monedas diferentes. El chat solo expone tipos con semántica aprobada. |
| Entidades | ID interno de Meta, nombre y estado de campaña, conjunto y anuncio; objetivo de campaña cuando exista | IDs completos solo en la base y nunca en logs/capturas con importes. Guardar la metadata necesaria para identificar resultados históricos sin atribuir nombres actuales a una captura pasada. |
| Procedencia | Zona, moneda, rango, nivel, campos pedidos, parámetros de atribución, instante de captura, páginas, resultado, ID de snapshot y ejecución | Snapshots inmutables. Cobertura vigente solo de extracciones completas para ese nivel; una fallida no reemplaza datos anteriores. |
| Tasas | CTR, CPC, CPM y frecuencia quedan como **decisión técnica pendiente** | Son ratios o medidas no aditivas que la ruta actual excluye. Si se incorporan, se define fuente, fórmula o valor informado por Meta, precisión, período y casos de denominador cero. No se calcula nada en el LLM. |

La [colección oficial de Marketing API de Meta](https://www.postman.com/meta/facebook-marketing-api/overview) muestra consultas de Insights en los distintos niveles y ejemplos con `reach`, `clicks`, `inline_link_clicks`, `actions` y `action_values`. Es evidencia de capacidad de la API, no prueba de que la cuenta piloto devuelva todos los campos ni de que cada combinación esté disponible. El probe previo de la cuenta autorizada devolvió cero filas (`meta_first/sesiones/M16.2.md` §VR-01); la validación real sigue pendiente.

## Flujo de producto

1. El dueño pulsa «Sincronizar ahora». El servidor resuelve la empresa y la conexión por membresía; no recibe IDs de empresa o cuenta del cliente.
2. El servidor consulta Meta en los cuatro niveles, con límites de ventana, paginación, reintentos y duración. Cada respuesta se valida y se proyecta al contrato cerrado; no se guardan tokens, URL de `paging.next` ni JSON crudo.
3. La base publica únicamente resultados completos con posesión vigente, conexión activa y generación de credencial sin cambios. Mantiene procedencia y distingue cobertura por nivel y entidad.
4. El chat posterior lee los datos guardados con el JWT del dueño y RLS. Herramientas cerradas devuelven métricas y resultados con nivel, entidad, período, unidad, atribución, cobertura y fuente. El modelo no consulta Meta directamente, no genera cifras autoritativas y se abstiene de responder sobre medidas sin cobertura.

## Criterios que deberá fijar la enmienda de ruta

1. La sincronización completa de cada nivel recorre todas sus páginas; un límite, error o respuesta inválida deja ese nivel incompleto y conserva su cobertura anterior. La UI no anuncia «todo sincronizado» si algún nivel pedido quedó incompleto.
2. La cobertura distingue `con_datos`, `sin_fila_reportada` y `no_observado` por nivel, entidad y día. Una entidad pausada o eliminada no borra su historial mientras la conexión siga viva; tampoco crea ceros ficticios.
3. El total de cuenta viene de la consulta `account`. No se obtiene sumando campañas, conjuntos o anuncios. Para un período, `reach`, frecuencia y tasas requieren un valor de Meta para ese período o una regla determinística válida para esa métrica; la suma de sus valores diarios no sirve.
4. Gasto, valores de acciones, conteos y tasas conservan precisión de extremo a extremo. El servidor valida tipo, unidad, signo, rango y atribución; el modelo no hace conversiones ni cálculos autoritativos.
5. Cada acción tiene tipo y valor numérico opcional separados. Tipos ausentes no son cero. Una pregunta sobre compras, leads o mensajes solo se responde si el tipo correspondiente existe, está aprobado para el chat y tiene cobertura suficiente.
6. La lectura del chat devuelve entidad, nivel, métrica o tipo de acción, período, moneda/unidad, parámetros de atribución, cobertura, frescura y referencia de snapshot. El servidor comprueba las cifras y las comparaciones antes de mostrarlas.
7. La publicación y la purga conservan el aislamiento, la posesión vigente, la generación de credencial y la idempotencia de la ruta actual. Los nuevos datos se borran al desconectar o cerrar la empresa.
8. Pruebas obligatorias: cuatro niveles, paginación intermedia fallida, entidad con fila ausente, cambio de nombre/estado, acción con tipo desconocido, atribución diferente, conteos/valores grandes, `reach` no aditivo, cero frente a ausencia, ejecución desplazada y desconexión en vuelo. App y pgTAP usan solo el proyecto desechable.

## Enmiendas necesarias antes de implementar

1. **Ruta `meta_first` (Parte I y spec):** sustituir el objetivo restringido a dos métricas; fijar catálogo de datos, granularidad, semántica de cobertura, valores no aditivos, límites y CA de seguridad, exactitud y pruebas. Resolver explícitamente el lugar de tasas y el catálogo de tipos de resultado.
2. **Parte II y microfases:** dividir M16c en cortes revisables de hasta ocho horas. La migración `0016` y el esquema de cobertura actuales están diseñados para cuenta/día y deben redefinirse antes de escribir SQL. Actualizar II.11, sus archivos previstos y las dependencias de M25a.1/M25a.2. Resolver además Q-01 a Q-03 de la auditoría de spec M16c.
3. **Spec BORRADOR de M16c:** reexpandir después de la enmienda de ruta; cambiar contratos SQL y TypeScript, criterios y casos de prueba. La auditoría `spec-audit-1.md` sigue siendo evidencia histórica del borrador de dos métricas, no una aprobación del alcance ampliado.
4. **Acta M03a:** actualizar qué datos reales se guardan, por qué, quién los recibe y qué se comunica al dueño. La aprobación anterior de `G-ACTA-META` cubre la versión de gasto e impresiones; antes de incorporar datos reales ampliados, el usuario debe aprobar la versión actualizada y comunicar el cambio al dueño. No se presume su consentimiento por esta decisión de producto.
5. **Seguridad y arquitectura:** actualizar sus propiedades transversales cuando la ruta autorice esos archivos, sin copiar catálogo de campos, TTL o conteos. Conservar aislamiento, solo lectura sobre Meta, borrado por desconexión y modelo sin autoridad numérica.
6. **Estado y gate:** mantener M16c y `G-SYNC` pendientes. No iniciar M25a.1 ni ejecutar `db:push`, despliegue o sincronización real ampliada hasta cerrar los gates y acciones reservadas.

**Corte sugerido para la enmienda:** `M16c.1` fija y prueba el contrato de datos y la migración nueva; `M16c.2` implementa la extracción de los cuatro niveles y la publicación con Meta simulada; `M16c.3` incorpora la UI, las verificaciones completas y la sincronización real. Cada ficha tendrá su gate, dependencias, archivos y máximo de ocho horas. Es una propuesta de división, no microfases habilitadas por este documento.

**Texto de revisión requerido para el acta M03a:** añadir a §1 las métricas diarias por nivel, acciones/valores por tipo, metadatos de entidades y parámetros de atribución; en §2, explicar las preguntas de rendimiento que permiten responder; en §4, declarar que DeepInfra recibirá solo los resultados de herramientas pertinentes a cada pregunta, incluidos nombres de entidades cuando se necesiten; en §9, exigir que el dueño sea informado de la ampliación antes de la primera sincronización ampliada. Conservar retención y borrado por desconexión. El archivo aprobado `M03a/acta-meta.md` no se cambia hasta que la ruta autorice esa revisión y se pueda aprobar la versión concreta.

## Puntos que debe cerrar la spec antes de una nueva auditoría

- Catálogo exacto de tipos de resultado que el chat podrá citar y su semántica; conservar los demás tipos devueltos por Meta solo si la política de datos revisada lo permite.
- Si CTR, CPC, CPM y frecuencia se incorporan ahora, su fuente y reglas de período; nunca sumar ratios ni `reach` de filas diarias.
- Presupuesto real de cuatro niveles, límites de página/duración y Q-04 frente a la configuración desplegada.
- Cobertura, ausencia, reemplazo e idempotencia por nivel y entidad, incluidas altas, pausas y eliminaciones de anuncios.
- Contratos de las herramientas y de la guarda de afirmaciones del chat para niveles, entidades, acciones y atribución.
- Pruebas con Meta simulada, SQL/Data API, carreras y caso real redactado; sin montos ni IDs completos en evidencia.

Esta propuesta registra la decisión de alcance y la traduce en cambios revisables. No se interpreta como spec aprobada ni como permiso para saltar las condiciones de parada de `AGENTS.md`.
