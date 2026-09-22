# M03a — Acta mínima de datos y privacidad para Meta

## Estado

`BORRADOR` — pendiente de aprobación del usuario. Hasta que este documento pase a `APROBADA`, ninguna microfase puede conectar una cuenta Meta real ni persistir datos de ella.

## Alcance

Esta acta habilita exclusivamente la conexión de cuentas publicitarias de Meta y la lectura de sus insights. No habilita Tiendanube, no habilita GA4 y no reemplaza el acta completa de `M03`, que sigue pendiente para la metodología comercial definitiva.

## Decisión 1 — Zona horaria canónica

**Propuesta:** la zona canónica del producto es `America/Argentina/Buenos_Aires`. Cada cuenta Meta conserva además su propia zona, declarada por la API, y esa zona se persiste junto a cada observación.

Ninguna comparación diaria mezcla etiquetas de fecha de zonas distintas. Cuando haya que comparar o agregar, se convierten los límites de la ventana por instante, no las etiquetas de día. Si la alineación entre dos fuentes no puede determinarse, el sistema se abstiene en lugar de estimar.

Motivo: la cuenta piloto reporta en `America/Los_Angeles`, cuatro o cinco horas de diferencia según DST. Sumar etiquetas de día sin convertir movería gasto real de un día a otro. Ver `H-M00-01`.

## Decisión 2 — Campos que se persisten

Sólo se persiste lo que tiene un consumidor declarado. Ningún campo entra "por las dudas".

| Campo | Origen | Consumidor |
|---|---|---|
| Identificador de cuenta publicitaria | `me/adaccounts` | Identificar la conexión y aislar por empresa |
| Nombre de la cuenta | `me/adaccounts` | Mostrar al usuario qué cuenta conectó |
| Moneda | `me/adaccounts` | Declarar la unidad de todo monto; nunca se convierte |
| Zona horaria de la cuenta | `me/adaccounts` | Decisión 1 |
| Fecha del día reportado | `/insights` | Clave temporal de la observación |
| Gasto del día | `/insights` | Hechos que el chat puede citar |
| Impresiones del día | `/insights` | Hechos que el chat puede citar |
| Permisos efectivos concedidos | Inspección del token | Detectar degradación de acceso y pedir reautorización |

**No se persiste:** ningún dato personal de clientes finales del anunciante, ningún contenido creativo, ningún identificador de usuario de Meta más allá de lo necesario para la conexión.

**Nunca, bajo ninguna circunstancia:** tokens en claro, en logs, en evidencia, en fixtures o en documentos. Los tokens viven cifrados y sólo ahí.

## Decisión 3 — Retención y borrado

**Propuesta:**

- Los insights se retienen mientras la conexión esté activa, y hasta 90 días después de desconectarla.
- Al desconectar, la credencial se destruye de inmediato, no a los 90 días.
- El usuario puede pedir el borrado total en cualquier momento; se ejecuta sobre observaciones, crudos y credencial.
- Existe un endpoint de borrado de datos accesible públicamente, requisito de Meta para el App Review de `M16d`.

Motivo de los 90 días: permite reconectar sin volver a descargar el histórico, y es un plazo defendible frente a un cliente que pregunta cuánto guardás de lo suyo.

## Decisión 4 — Consentimiento

**Propuesta de texto que ve el cliente antes de autorizar:**

> PRAXA va a leer, en modo sólo lectura, el rendimiento de tu cuenta publicitaria de Meta: gasto e impresiones por día, junto con la moneda y la zona horaria de la cuenta. No accede a tus campañas para modificarlas, no accede a datos personales de tus clientes y no publica nada en tu nombre. Podés desconectar la cuenta cuando quieras y pedir el borrado de todo lo guardado.

El permiso solicitado es `ads_read` y nada más. Pedir un permiso que no se usa es motivo de rechazo en el App Review y una promesa que el producto no cumple.

## Lenguaje prohibido en la interfaz

Mientras el producto sólo lea insights de Meta, la interfaz no afirma haber detectado desperdicio, no recomienda mover presupuesto y no compara contra ningún benchmark. Esas afirmaciones requieren los detectores y las fuentes que todavía no existen.

Ninguna cifra mostrada al usuario se origina en el modelo de lenguaje. Toda cifra proviene de una observación persistida.

## Aprobación

| Decisión | Estado | Fecha |
|---|---|---|
| 1 — Zona canónica | `PENDIENTE` | — |
| 2 — Campos persistidos | `PENDIENTE` | — |
| 3 — Retención y borrado | `PENDIENTE` | — |
| 4 — Consentimiento | `PENDIENTE` | — |

## Dependencias

Habilitada por `M00 PASS`. Habilita `M05.1.2` y `M16.1`, según la Enmienda 1 de [ROADMAP.md](../../../ROADMAP.md).

## Hallazgos

`H-M00-01` y `H-E1-01`, en [HALLAZGOS.md](../../../HALLAZGOS.md).
