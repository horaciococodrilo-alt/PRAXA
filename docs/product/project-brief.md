# Praxa — Project Brief

**Estado:** iniciativa en validación; cero product-market fit demostrado.  
**Entrega actual:** Company Brain v0 como proyecto académico de seis meses.   
**Equipo:** Simón Alfandari, Matías Guiter, Juan Grimberg y Gonzalo Mayer.

## Descripción breve

Praxa busca convertir datos y conocimiento operativo dispersos de una empresa en contexto gobernado, verificable y reutilizable por personas y sistemas de IA.

La visión completa es una capa operacional entre los sistemas de la empresa y los agentes: el Company Brain aporta estado, reglas, historia y evidencia; un runtime futuro controla; las skills futuras describen procedimientos; las APIs producen efectos reales; y las personas aprueban acciones sensibles.

## Tesis comercial vigente

El Company Brain es un mecanismo, no necesariamente el motivo de compra. El dolor visible que debe validarse es el trabajo operativo y las excepciones que cruzan tienda, marketplace, ERP, logística, facturación y atención.

Praxa podría convertirse en un coordinador de operaciones para ecommerce multicanal que detecta un caso, reúne evidencia, aplica una regla vigente, propone el siguiente paso, obtiene aprobación cuando corresponde, verifica el resultado y conserva lo aprendido.

Nada de esto está comercialmente validado todavía. El código no debe decidir cuál es la primera cuña comercial.

## Cadena de problemas

### F3 — Dolor observable

Casos y trabajo operativo quedan trabados entre sistemas. El equipo copia datos, concilia, revisa pedidos, persigue tareas incompletas y vuelve a investigar excepciones desde cero.

### F1 — Causa estructural

Reglas, criterios, precedentes y excepciones están distribuidos entre sistemas, documentos, chats y la cabeza de personas. Pueden ser incompletos, contradictorios o desactualizados.

### F2 — Barrera de adopción

El dueño o responsable no técnico no tiene un punto medio seguro para delegar acciones a IA: o revisa todo, o acepta una caja negra. Necesita evidencia, límites, aprobación, pausa, auditoría y verificación del resultado.

## Segmento de investigación

Hipótesis actual:

- Ecommerce argentino multicanal y multisistema.
- Aproximadamente 15 a 60 empleados.
- Tres o más canales de venta.
- Seis a doce sistemas relevantes.
- Ya sufrió una excepción costosa o una automatización incompleta.
- Existe un responsable de operaciones, pero dueño u operaciones todavía intervienen en casos y cierres.

Los umbrales de volumen, canales y empleados no están validados y no deben codificarse como restricciones universales.

## Actores hipotéticos

| Actor | Rol esperado |
|---|---|
| Dueño, gerente o COO | Comprador económico y responsable del costo/riesgo |
| Responsable de operaciones | Champion y usuario experto del flujo real |
| Operaciones, administración, atención, logística y finanzas | Usuarios diarios potenciales |
| Contador, IT, agencia o integrador | Influenciadores y aprobadores según el caso |
| Agente futuro | Consumidor limitado de contexto; nunca propietario de credenciales o permisos |

## Alcance técnico actual

Construir únicamente Company Brain v0:

- Ingesta estructurada y documental.
- Evidencia original inmutable y citable.
- Estado canónico de ecommerce.
- Resolución de entidades entre fuentes.
- Hechos y políticas versionados.
- Vigencia y procedencia.
- Contradicciones y gaps.
- Revisión humana.
- Retrieval exacto, full-text, semántico, relacional y temporal.
- ContextPacket pequeño, citado y task-scoped.
- Answerability explícita.
- Cobertura, búsqueda, revisión y auditoría mínimas.
- Aislamiento multi-tenant y RLS.

## Fuera del alcance actual

- Agentes autónomos en producción.
- Skills ejecutables.
- Credenciales entregadas al LLM.
- Escritura real en marketplaces, tiendas, ERP o ARCA.
- Rollback contra APIs externas.
- Descubrimiento universal de procesos.
- Sistema operativo general para cualquier PyME.
- Multiagentes por área.
- Benchmarks entre clientes.
- Promesa de reducción de personal.

## Caso de demostración canónico

Mercado Libre y una tienda reportan inventarios distintos para la misma variante. Una política aprobada indica la fuente autoritativa y un stock de seguridad.

Praxa debe:

1. Conservar las observaciones originales.
2. Resolver que ambas publicaciones representan la misma variante.
3. Recuperar la política vigente.
4. Calcular stock vendible mediante código determinístico.
5. Mostrar contradicción, evidencia y lagunas.
6. Producir un ContextPacket citado.
7. Permitir inspección y corrección humana.
8. No modificar ningún sistema externo.

## Dos líneas de trabajo que no deben confundirse

### Proyecto técnico académico

Construir y demostrar un Company Brain v0 con datos sintéticos, arquitectura segura y alcance controlado.

### Validación de startup

Entrevistar y observar ecommerce para descubrir una excepción recurrente, costosa, comparable y comprable. El software académico no prueba por sí mismo deseabilidad, disposición a pagar ni tamaño de mercado.
