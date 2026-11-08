# Propuesta de enmienda de la ruta: G-SYNC con cuenta sin actividad

**Estado:** APROBADA por el usuario e integrada el 2026-11-07 ([sesión](../../meta_first/sesiones/enmienda-gsync-2026-11-07.md)). La tabla conserva el texto vigente anterior como historia.  
**Fecha:** 2026-11-07. Revisada el mismo día: se coordinan todos los textos de Q-04, la validación pendiente se separa de `H-E1-117` en `H-E1-189` y se precisa qué detecta el extractor.  
**Origen:** D-M16c-02 y M16c-Q-01 de [la spec de M16c](../spec.md); hallazgo A-01 de [spec-audit-4.md](spec-audit-4.md).

## Motivo

La única cuenta que lista la integración no tuvo actividad en 28 días (VR-01; `H-E1-185`). Las cuentas con actividad no pertenecen al portfolio del dueño, y el usuario decidió no conseguir otra (D-M16c-02). Con el texto vigente, Q-04 se fija «con lo medido en VR-01» o «con mediciones reales», y G-SYNC queda pendiente si faltan campos reales. Eso puede frenar M25a.1 sin fecha.

## Origen de cada límite de Q-04

| Límite | De dónde sale | Qué no es |
|---|---|---|
| Duración máxima y reserva de finalización | La duración máxima efectiva configurada en Vercel, con margen (`meta_first/spec.md:131`, CA-56) | — |
| Ventana de relectura | Los 28 días iniciales configurables de CA-47b y DEC-05. La ventana máxima de lectura no puede ser menor | No sale de Vercel ni de volúmenes medidos |
| Páginas por nivel, páginas de metadata, entidades y payload | Cotas técnicas conservadoras, elegidas para que la ejecución quepa en la duración máxima | No se presentan como volúmenes medidos |
| Medición de VR-01 (1 página, 1 llamada, alrededor de 1,1 s) y de la sincronización real de M16c.3 | Referencia registrada. Con la cuenta sin actividad, no es representativa | No fundamenta por sí sola ningún límite |

## Cambios propuestos

| # | Archivo y ubicación | Texto vigente | Texto propuesto |
|---|---|---|---|
| 1 | `meta_first/spec.md:23` | «Q-04 es un parámetro que se fija con mediciones en `M16c`.» | «Q-04 es un parámetro que se fija en `M16c`; el origen de cada límite está en la tabla de preguntas (Q-04).» |
| 2 | `meta_first/spec.md:525`, fila Q-04 | «Valores iniciales de ventana máxima, páginas y duración de la sincronización. Se fijan en `M16c` con lo medido en VR-01 y por debajo de la duración configurada en Vercel. No bloquea ninguna microfase anterior» | «Valores iniciales de ventana máxima, páginas y duración de la sincronización. Se fijan en `M16c`: la duración, por debajo de la configurada en Vercel con margen; la ventana, a partir de los 28 días de CA-47b; páginas, entidades y payload, como cotas técnicas conservadoras. Lo medido en VR-01 y en la sincronización real de `M16c.3` se registra como referencia y, si la cuenta no tiene actividad, no se presenta como representativo (D-M16c-02). No bloquea ninguna microfase anterior» |
| 3 | `meta_first/plan.md:14`, Base | «Q-04 es un parámetro que se fija con mediciones en `M16c`.» | «Q-04 es un parámetro que se fija en `M16c` (spec, Q-04).» |
| 4 | `meta_first/plan.md:301`, ficha M16c, Procedimiento | «Pruebas primero con Meta simulada. Fijar Q-04 con mediciones reales y registrarlo en la spec.» | «Pruebas primero con Meta simulada. Fijar Q-04 según la spec (Q-04): duración por debajo de la configurada en Vercel, ventana según CA-47b y cotas técnicas conservadoras; contrastarlo con la sincronización real y registrarlo en la spec (D-M16c-02).» |
| 5 | `meta_first/plan.md:302`, ficha M16c, Evidencia de cierre | «Pruebas en verde y una sincronización real redactada.» | «Pruebas en verde y una sincronización real redactada de los cuatro niveles. Si la cuenta no tiene actividad, la sincronización puede traer 0 filas: no valida campos ni tipos ni acredita valores cero (`H-E1-189`).» |
| 6 | `meta_first/plan.md:694`, II.11, fila M16c.3, Acción | «Medir Q-04 por los cuatro niveles, debajo del límite efectivo desplegado, validar campos reales y comunicar ampliación al dueño» | «Fijar Q-04 por los cuatro niveles, debajo del límite efectivo desplegado (spec, Q-04); validar campos y tipos reales si la sincronización trae filas, y comunicar ampliación al dueño» |
| 7 | `meta_first/plan.md:694`, II.11, fila M16c.3, Verificación | «Sin extrapolar campos desde respuesta vacía; G-SYNC pendiente si falta evidencia» | «Sin extrapolar campos desde respuesta vacía. Con la cuenta sin actividad, G-SYNC puede cerrarse con la sincronización real de los cuatro niveles completos y 0 filas; `H-E1-189` pasa a riesgo aceptado temporal. G-SYNC pendiente si falta la sincronización real» |
| 8 | `meta_first/plan.md:696`, II.11, Cierre | «`G-SYNC` solo se alcanza en M16c.3 con todos los niveles, CA y evidencia real.» | «`G-SYNC` solo se alcanza en M16c.3 con todos los niveles, CA y evidencia real. La evidencia real puede ser una sincronización sin filas cuando la cuenta autorizada no tiene actividad (D-M16c-02); no se presenta como validación de campos ni de tipos.» |
| 9 | `meta_first/plan.md:871`, III.4, fila Q-04 | «`M16c`, con datos de VR-01» | «`M16c`, según la spec (Q-04) y la sincronización real de M16c.3 (D-M16c-02)» |
| 10 | `docs/HALLAZGOS.md`, `H-E1-189`, índice y detalle | «Pendiente», asignado a M16c.3 | Igual mientras G-SYNC esté abierto. Si G-SYNC se cierra con 0 filas: «Riesgo aceptado temporal (D-M16c-02)», con la validación en la primera sincronización con filas. Si los campos o tipos difieren de lo simulado, se registra un hallazgo nuevo, asignado en ese momento |

CA-56 (`meta_first/spec.md:362`) ya exige límites explícitos por debajo del tiempo de Vercel y no cambia.

## Alcance de H-E1-189 y de H-E1-117

`H-E1-117` agrupa hipótesis de OAuth de M16.1: H-S-03, H-S-04, H-S-05, H-S-07, H-S-13 y H-S-15 (`HALLAZGOS.md:610`). No trata de los campos de Insights y **esta enmienda no lo modifica ni lo acepta**: conserva su propio seguimiento. La sesión de M16.2 lo citó también para «validar campos»; ese pendiente pasa a `H-E1-189`, que cubre solo los campos y tipos de Insights y metadata del catálogo de §11 que no se validaron con filas reales.

## Lo que no cambia

- §11, CA-56, CA-44b y el resto de los CA y DEC de la spec de la ruta.
- La exigencia de una sincronización real redactada de los cuatro niveles. Sin ella, G-SYNC no se cierra.
- `H-E1-117`: sigue con su estado y su seguimiento.
- `SECURITY.md` y `ARCHITECTURE.md`: no cambia ninguna propiedad. El riesgo aceptado de `H-E1-189` es de validación de datos, no de seguridad.
- M25a.1 y M25a.2: su alcance no cambia. La spec de M25a.1 tiene que citar `H-E1-189` como hipótesis abierta y no puede tratar como validados con datos reales los campos que solo se probaron con Meta simulada.

## Riesgo que se acepta

Las herramientas del chat se construyen sobre un formato de Graph probado con simulaciones y documentación oficial, no con filas reales de la cuenta piloto. El extractor no detecta cualquier diferencia futura de Meta. Según el contrato de M16c:

| Si en una sincronización con filas aparece | El extractor | Consecuencia |
|---|---|---|
| Un valor presente y mal formado: número JSON en vez de cadena, patrón decimal inválido, acción duplicada, estructura conocida con forma distinta | Rechaza la página y deja el nivel incompleto | Se conserva la cobertura anterior; se detecta |
| Un campo pedido ausente o nulo | Lo guarda como `no_informado`; el nivel puede completarse | No se detecta como error. Si Meta renombrara o dejara de enviar un campo, se vería como «no informado» de forma permanente, sin alarma |
| Un campo extra que no está en el catálogo | Lo descarta | No se detecta ni se guarda |
| 0 filas | Completa el nivel vacío | No valida ningún campo ni tipo ni acredita valores cero |

La validación pendiente de `H-E1-189` consiste en comprobar, en la primera sincronización con filas, qué campos del catálogo llegan presentes y con el tipo esperado. Un campo que siempre falta se trata como hallazgo, no como dato «no informado» legítimo.

## Para integrar, una vez aprobada

1. Aplicar los cambios 1 y 2 en `meta_first/spec.md`, del 3 al 9 en `meta_first/plan.md` y el 10 en `docs/HALLAZGOS.md`.
2. Registrar la integración en `meta_first/sesiones/`, con la fecha de aprobación.
3. Actualizar M16c-Q-01 en la spec de M16c como resuelta y volver a auditar la spec.
