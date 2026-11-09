# Propuesta de enmienda de la ruta: el chat completo en una sola microfase

**Estado:** BORRADOR, pendiente de aprobación del usuario. Todavía no cambia la ruta.  
**Fecha:** 2026-11-08.  
**Origen:** decisiones del usuario sobre `H-E1-190`: «Opción A ampliada, con los 19 bloques y las reglas de casos dudosos, sumando edad, género y lugar al chat», y «m25a.1 .2 y m25b juntas en una microfase».

## Qué cambia

`M25a.1`, `M25a.2` y lo que iba a ser `M25b` pasan a ser una sola microfase, **`M25a`**, con un solo gate: **`G-CHAT`**. `G-CHAT-BASE` y `G-VR02` dejan de ser gates y pasan a ser controles de etapa.

La secuencia pasa a ser `M25a` → `M28.3a`.

## Alcance de M25a

Todo lo que la ruta ya pedía a `M25a.1` y `M25a.2`, más lo siguiente.

**1. La IA elige; el servidor calcula; la app dibuja.** La IA no escribe código ni produce números. Elige herramientas y bloques de un catálogo cerrado (opción A de `H-E1-190`).

**2. Seis cálculos, hechos en SQL:** comparar períodos, promedio diario, ranking, costo por resultado, participación y variación porcentual.

**3. Desgloses:** una herramienta para consultar edad y género, país y región, con las reglas de DEC-23.

**4. Diecinueve bloques:**

| Grupo | Bloques |
|---|---|
| Básicos (6) | Tarjeta, líneas, barras, barras agrupadas, dona, tabla |
| Análisis (9) | Resumen con variación, período contra período, barras apiladas, ranking, tabla con mini tendencia, tabla desplegable, embudo, calendario de calor, desglose por tipo de resultado |
| Contexto (4) | Estado de los datos, conclusiones, fuentes y metodología, preguntas sugeridas |

**5. Casos dudosos:**

| Situación | Comportamiento |
|---|---|
| Falta un dato, como el período | Usa un valor por defecto y lo muestra |
| La pregunta admite sentidos muy distintos | Pregunta antes de responder |
| Pide otro formato | Lo cambia, si sirve para esos datos |
| Pide algo que no tiene, como una causa | Lo dice y ofrece lo que sí puede mostrar |

**6. Sigue afuera:** ROAS, rentabilidad, causas, recomendaciones, y calificar un gasto como «estable». Tampoco se cruzan edad o género con lugar.

**7. Historia:** se acumula sincronizando, y el chat avisa desde qué fecha tiene datos. Sin carga histórica.

## Forma de ejecución

Una spec, un plan, una corrida y un gate, sin el límite de 8 horas, por decisión del usuario. Migración única `0018` y pgTAP `15`.

| Etapa | Contenido | Control al terminar |
|---|---|---|
| `M25a.1` | Registro por consulta, redacción, herramientas, seis cálculos y desgloses | `verify`, `db:check:test`, `test:policies` y `test:app` |
| `M25a.2` | Modelo, verificación de cifras, pantalla del chat con bloques básicos | Los mismos, suite adversaria y **VR-02 con los umbrales de DEC-21** |
| `M25a.3` | Los 19 bloques, casos dudosos, teléfono y accesibilidad, evaluación ampliada | Los mismos y recorrido manual en la aplicación |

Rigen las reglas de corrida única de M16c: no se pasa de etapa con pruebas en rojo, cada etapa termina con un commit del usuario, y la corrida se puede reanudar en otra sesión.

**VR-02 es una parada obligatoria.** La etapa `.3` no empieza si no pasó. Si falla, primero se diagnostica la causa. Así no se construyen los bloques sobre un modelo que no responde bien.

## Qué se acepta con una sola microfase

- **Una sola aprobación.** El usuario aprueba una vez, al final. Un defecto de la base detectado en la pantalla obliga a retroceder dentro de la corrida.
- **Revisión grande.** La revisión final cubre SQL, el modelo y la interfaz juntos, sobre el cambio más grande de la ruta.
- **Nada visible hasta el final.** Lo publicado y aprobado llega recién con `G-CHAT`; la demo espera a que esté todo.
- **Más de una sesión.** La regla de reanudación existe por eso.

## Decisiones que asumí, a confirmar al aprobar

1. **Historia acumulada y «estable» afuera:** el usuario no los repitió; son lo que se le había propuesto.
2. **Cierre del gate sin actividad.** Si la cuenta sigue sin filas, `G-CHAT` se cierra con datos sintéticos y un recorrido real con 0 filas, y queda como riesgo temporal, igual que D-M16c-02. Recomendado: sí.

## Riesgos que la spec de M25a tiene que resolver

- **Límites del chat (CA-70).** Hasta 4 llamadas a herramientas por turno y 800 tokens por llamada al modelo pueden no alcanzar para una respuesta de varios bloques. Hay que medirlos y decidir si cambian.
- **Verificación de cifras (CA-50).** Hoy una variación se rechaza si no tiene herramienta. Tiene que aceptar las calculadas por el servidor y seguir rechazando las demás.
- **Evaluación.** VR-02 mide el chat básico. Hace falta ampliar su conjunto y fijar sus umbrales antes de correr la evaluación de la etapa `.3`.
- **Gráficos.** Solo existe un gráfico de barras hecho a mano para costos. La spec decide si se suma una librería.

## Cambios propuestos

| # | Archivo y ubicación | Cambio | Cuándo |
|---|---|---|---|
| 1 | `meta_first/plan.md`, encabezado | Línea de esta enmienda | Al aprobar |
| 2 | `meta_first/plan.md:55`, `:86-88`, I.2 | Un solo nodo `M25a` antes de `M28.3a` | Al aprobar |
| 3 | `meta_first/plan.md:109-111`, I.3 | `G-SYNC` habilita `M25a`. `G-CHAT`, de `M25a`, habilita `M28.3a`. Salen `G-CHAT-BASE` y `G-VR02` | Al aprobar |
| 4 | `meta_first/plan.md:310`, `:331-358`, `:373`, I.4 | Una sola ficha de `M25a`, en tres etapas y sin el límite de 8 horas. Las dependencias de `M16c` y `M28.3a` apuntan a ella | Al aprobar |
| 5 | `meta_first/plan.md:401`, `:713-750`, `:766`, `:839`, `:863-864`, `:883`, `:954-955` | II.12 y II.13 pasan a ser las etapas de `M25a`, con la `.3` nueva, y las tablas de la Parte III nombran esas etapas. `0018` y pgTAP `15` son la migración y la prueba únicas | Al aprobar |
| 6 | `meta_first/spec.md` | DEC-24. §11 deja de excluir la variación porcentual. CA-48 suma las herramientas. DEC-23 ya no excluye los desgloses del chat. §12 suma bloques y casos dudosos | Al aprobar |
| 7 | `docs/PROJECT_STATE.md` | Siguiente habilitada: `M25a`. Secuencia restante, y `H-E1-190` resuelta | Al aprobar |
| 8 | `SECURITY.md`, `ARCHITECTURE.md`, acta | Declarar que el modelo recibirá desgloses minimizados por pregunta, los flujos nuevos, y corregir `M25a.1` y `M25a.2` en el acta | **En `M25a`, antes de que el modelo reciba datos reales.** El usuario aprueba el acta de nuevo y comunica el cambio al dueño |

## Lo que no cambia

- El LLM no produce números autoritativos (INV-08). El MVP sigue siendo de solo lectura sobre Meta.
- VR-02 y sus umbrales de DEC-21 siguen siendo obligatorios.
- `M28.3a` y su gate `G-DEMO`.
- `AGENTS.md`: el límite general de 8 horas sigue escrito ahí. Esta enmienda solo exceptúa a `M25a`.
- Las acciones reservadas al usuario: cuenta y clave de DeepInfra, `db:push` y publicación.
- El acta aprobada el 2026-11-08 sigue siendo cierta hasta entonces: hoy el modelo no recibe desgloses.
