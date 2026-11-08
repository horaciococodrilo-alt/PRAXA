# Enmienda documental de Insights ampliados — 2026-11-06

Base inspeccionada: `a27f727`. Al inicio había cambios documentales de esta conversación y el directorio M16c sin rastrear; se preservó el informe histórico de auditoría.

## Autorización y alcance

El usuario aprobó el conjunto de datos de cuenta, campaña, conjunto y anuncio y pidió integrarlo al repositorio. Después confirmó expresamente: «hay que resolver esto antes de M16C yo te doy aprobacion implementa esto». Esta ejecución resuelve la enmienda previa a M16c. La autorización ya existente permite coordinar las fuentes; no se pidió una nueva aprobación del mismo alcance.

La ruta y su acta quedan actualizadas para el catálogo único de §11: medidas base, tasas diarias informadas por Meta, acciones y valores por tipo, entidades y atribución. Se amplían herramientas y claims del chat. Reach/frecuencia multidiarios no se inventan; CTR/CPC/CPM de períodos se recalculan desde bases compatibles en SQL. No se suman niveles jerárquicos ni ventanas de atribución.

La [colección oficial de Meta](https://www.postman.com/meta/facebook-marketing-api/overview) y sus ejemplos de [Insights por cuenta](https://www.postman.com/meta/facebook-marketing-api/request/u38qbri/get-insight-details-from-an-adaccount-l4) y [atribución](https://www.postman.com/meta/facebook-marketing-api/request/5wdl62t/attributionsetting), consultados en esta conversación, sustentan los campos propuestos y las dimensiones disponibles. La colección no acredita la configuración ni la respuesta de la cuenta piloto en Graph v26. La spec conserva la verificación oficial/real de campos y atribución en los cortes futuros; el probe vacío no la reemplaza.

## Cambios realizados

- `meta_first/plan.md`: enmienda vigente, ficha de conjunto y cortes M16c.1/.2/.3, gates, archivos de II.11, pruebas, acciones reservadas y adaptación de M25a.1/.2. Se autorizan los archivos faltantes de Q-01/Q-02/Q-03 del borrador anterior y la revisión del acta y documentos transversales.
- `meta_first/spec.md`: DEC-22, catálogo único, snapshots por nivel y cobertura nivel/día/entidad, precisión, atribución, agregación y límites del chat. Se conservan IDs CA para mantener trazabilidad.
- `M16c/spec.md`: reemplazo del borrador incompatible por ficha BORRADOR de conjunto, trazabilidad de criterios/pruebas y requisitos para specs ejecutables de cada corte. Ninguna spec hija ni plan se presenta como aprobado.
- `M03a/acta-meta.md`: autorización suplementaria de alcance, categorías enlazadas al catálogo, finalidad, datos hacia DeepInfra y comunicación pendiente al dueño antes del ensayo real. La aprobación histórica del blob anterior permanece como historia; no acredita esa comunicación nueva.
- `ARCHITECTURE.md` y `SECURITY.md`: propiedades previstas de flujo por nivel, metadata y acciones, minimización hacia el modelo y nombres del proveedor tratados como texto no confiable. No se afirma que existan nuevos controles en runtime.
- `HALLAZGOS.md`: H-E1-187 resuelto documentalmente; comportamiento asignado a cortes futuros. `PROJECT_STATE.md`: siguiente M16c.1 para preparar spec/plan; G-SYNC y gates de cortes pendientes.
- La propuesta inicial se marca como antecedente histórico, sustituido por la enmienda. `spec-audit-1.md` no se modifica.

## Verificación y límites

1. `git status --short`: cambios solo en documentos y directorio M16c; ninguna migración, prueba ni código de runtime modificado.
2. `git diff --check`: exit 0, sin errores de espacios.
3. Búsqueda de referencias normativas que aún restringían chat/sincronización a dos métricas: corregidas en ruta, acta y documentos transversales. Las menciones históricas de sesiones, auditoría y propuesta quedan identificadas como historia.
4. Coherencia de DEC-22/cortes/IDs: PASS. La exploración completa de enlaces señaló destinos históricos ausentes y falsos positivos del parser en rutas con paréntesis. Una comprobación acotada a los enlaces añadidos terminó con exit 0: **19 enlaces locales nuevos, cero rotos**. Se confirmó contra HEAD que tres destinos ausentes de M06.3a ya estaban enlazados en HALLAZGOS antes del cambio; quedan en H-E1-188, fuera de M16c. Los futuros archivos de implementación se mantienen como código, no como enlaces a archivos existentes.
5. No se ejecutó `npm run verify` para esta enmienda exclusivamente documental. Su ejecución anterior, en la auditoría 1, pasó lint/tipos y 595 pruebas pero se interrumpió sin resultado de build; ese resultado no se convierte en un PASS. Antes de implementar se debe completar la verificación de base exigida por el pipeline.

No hubo commit, push, despliegue, acceso a secretos, suites contra producción ni datos reales nuevos. No se ejecutó ningún corte M16c. La condición documental de H-E1-187 está resuelta; la siguiente tarea es preparar y auditar la spec de M16c.1 y su plan antes de ejecutar ese único corte. La comunicación al dueño y medición real se realizan en M16c.3, sin bloquear trabajo sintético previo.
