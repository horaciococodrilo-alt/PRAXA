PRAXA Company Brain v0 — plan de construcción

Estado: propuesta revisada para decisión humana; no es normativa hasta ser aceptada y versionada en el repositorio
Producto: Company Brain para PyMEs
MVP: walking skeleton vertical para divergencia de inventario y riesgo de sobreventa
Secuencia: R0 → VS-01 → VS-02 → VS-03 → VS-04 → VS-05 → VS-06 → VS-07
Regla rectora: arquitectura completa como norte; implementación estrictamente vertical. Future-compatible, no future-built.

1. Función y límites de este plan

Este documento define el orden de construcción, las dependencias, los entregables, los gates y los recortes permitidos del MVP. No demuestra que una capacidad esté implementada ni autoriza por sí mismo una fase.

Cada fuente conserva una función distinta:

Decisión

Fuente con autoridad

Proceso de trabajo

AGENTS.md, luego CLAUDE.md

Arquitectura e invariantes

ADR Accepted y docs/architecture/company-brain-spec.md

Alcance autorizado ahora

docs/plans/current.md

Secuencia y gates

Este build plan y el roadmap maestro

Motivo de las decisiones

Decision log

Estado real

Rama, commit, diff, migraciones, PR y CI del SHA exacto

Ante una contradicción material, no se elige silenciosamente el documento más nuevo: se clasifica el conflicto, se propone la corrección mínima y se espera decisión humana cuando afecte arquitectura, alcance o contratos públicos.

Este plan debe mantenerse estable. El estado diario del PR, los SHA, resultados de CI, cantidades de tests y tareas pendientes viven en las fuentes dinámicas, no aquí.

2. Resultado de producto que ordena la construcción

PRAXA debe transformar datos operativos fragmentados, documentos de policy y evidencia autorizada en un expediente reproducible que:

resuelva la variante exacta;

muestre observaciones, cantidades, fechas y fuentes;

seleccione de forma determinística la policy aprobada y vigente;

calcule el riesgo sin delegar autoridad al LLM;

declare conflictos, obsolescencia y datos faltantes;

recupere sólo evidencia autorizada y citable;

permita a un agente explicar y registrar una propuesta no ejecutada;

permita a una persona confirmar, corregir o descartar;

reconstruya posteriormente qué contexto, herramientas, versiones y decisiones influyeron.

Pregunta canónica:

¿Por qué la remera negra talle M tiene riesgo de sobreventa y qué deberíamos hacer?

El MVP demuestra observar, comprender, proponer y decidir sobre un caso sintético. No ejecuta acciones externas ni verifica resultados en sistemas productivos.

3. Invariantes globales

El LLM no produce números, estados, permisos ni policies autoritativas.

Identidad, autorización, selección de policy y cálculos son determinísticos.

Toda tabla de negocio tiene tenant_id y la protección RLS aplicable.

El rol de aplicación no es owner y no tiene BYPASSRLS.

La autorización ocurre antes del retrieval y las citas se reautorizan.

Evidencia, propuestas, decisiones y auditoría son append-only para el rol de aplicación cuando corresponda.

El estado derivado puede reconstruirse desde evidencia versionada.

Toda afirmación material tiene una cita autorizada o una dependencia determinística.

Evidencia insuficiente produce abstención o una brecha explícita.

Contenido no autorizado no se recupera, no se cita y no influye.

Una propuesta nunca se presenta como acción ejecutada.

No hay escrituras en sistemas externos durante el MVP.

No se amplía una fase por conveniencia ni se contradice una ADR en silencio.

No se declara una fase terminada sin evidencia ejecutada sobre su SHA candidato.

Las credenciales de aplicación, migración y seed permanecen separadas.

Un GUC manipulable no se trata como autenticación ni como prueba suficiente de membership.

4. Resumen, estimaciones y camino crítico

Fase

Resultado demostrable

Estimación de referencia

R0

Fuentes de verdad, ADR, roadmap y CI alineados

10–16 h

VS-01

PostgreSQL, tenancy, membership, roles y RLS verificables

20–30 h

VS-02

Evidencia, versiones, chunks, embeddings y ACL sin duplicación

30–45 h

VS-03

Variante, policy aprobada y detector determinístico

28–42 h

VS-04

Retrieval autorizado y ContextPacket citado y reproducible

35–50 h

VS-05

API, agente y una skill registran una propuesta sin ejecutar

28–42 h

VS-06

Revisión humana y decisión auditada

25–38 h

VS-07

Evaluación, hardening y demo reproducible

25–35 h

Subtotal



201–298 h

Con contingencia del 20%



241–358 h

Las estimaciones no son compromisos. Se sustituyen por horas reales al cerrar fases y se recalibran al terminar VS-03, VS-04 y VS-05.

Camino crítico:

R0 → VS-01 → VS-02 → VS-03 → VS-04 → VS-05 → VS-06 → VS-07

Paralelización segura:

diseñar fixtures y casos de evaluación durante VS-02 y VS-03;

comenzar la interfaz de VS-06 contra un packet mockeado sólo después de congelar el schema en VS-04;

ejecutar revisión independiente en cada fase;

hacer discovery comercial sin alterar automáticamente el backlog técnico.

No se paraleliza:

dos agentes editando la misma rama;

VS-03 antes de fijar identidad y evidencia;

VS-04 antes de fijar la selección determinística de policy;

VS-05 antes de probar autorización y ContextPacket;

dos fases activas de producto a la vez.

5. Contrato operativo común a todas las fases

Antes de implementar

La fase anterior está fusionada, verificada y cerrada.

docs/plans/current.md autoriza una sola fase.

Se leen las reglas, ADR y secciones de spec citadas.

Se inspeccionan rama, base, HEAD, working tree, archivos sin trackear y diff real.

Se presenta un plan con archivos, migraciones, pruebas, riesgos y mapeo a aceptación.

Una decisión humana resuelve cualquier ampliación de alcance o contradicción material.

Durante la implementación

Una rama corta por fase y un único agente escritor.

Commits cohesivos como checkpoints recuperables.

Tests junto con el código; PostgreSQL real para integración y seguridad.

Migraciones nuevas en lugar de editar las ya aplicadas.

Sin refactors, servicios o dependencias ajenos al ticket.

Un checkpoint remoto y draft PR después del primer corte coherente y de los guards rápidos.

Verificación y cierre

Dependencias desde lockfile, lint, format check, typecheck y tests aplicables.

Migraciones desde una base vacía y alembic check cuando aplique.

git diff --check, guards de secretos y seguridad del repositorio.

CI sobre el SHA candidato y auditoría read-only del diff completo.

Todo push posterior invalida la auditoría anterior.

Hallazgos P0/P1 resueltos; riesgos menores registrados.

Horas reales, limitaciones, deuda y handoff actualizados.

Merge manual autorizado; la fase siguiente no comienza automáticamente.

6. Fases del MVP

R0 — Reconciliación de fuentes de verdad

Objetivo: hacer que spec, ADR, product brief, build plan, roadmap, current.md, README, reglas de agentes y CI describan el mismo walking skeleton.

Entregables: ADR del corte vertical, append-only y retrieval segmentado; índice ADR; enmiendas focalizadas; plan R0–VS-07; current.md con una sola fase; CI endurecida y actions fijadas; reglas de revisión.

Verificación: referencias válidas, ausencia de definiciones activas contradictorias, git diff --check, suite existente desde checkout limpio y checks asociados al SHA correcto. La verificación funcional usa el contrato canónico vigente, no una receta documental paralela.

Aceptación: fuentes alineadas, revisión independiente, horas reales y handoff. R0 no autoriza automáticamente VS-01.

Exclusiones: código funcional, tablas de dominio, embeddings, agente y UI.

VS-01 — Fundación de datos y seguridad

Objetivo: demostrar aislamiento desde las primeras tablas y fijar persistencia, configuración, roles y contexto transaccional antes de introducir evidencia o dominio.

Dependencias: R0 fusionado; ADR-014 Accepted; PostgreSQL/pgvector por digest disponible.

Decisiones vigentes:

PostgreSQL 16 con vector y FTS nativo.

pg_trgm queda excluido hasta que un caso medido demuestre que exact match no basta.

SQLAlchemy 2 síncrono con psycopg; la decisión no está pendiente.

Docker Compose es la estrategia local y debe existir una sola estrategia de PostgreSQL por ejecución de CI.

Entregables:

Compose con la imagen fijada por digest.

Bootstrap idempotente de roles y base.

SQLAlchemy 2 sync, Alembic y migraciones desde vacío.

Roles separados: superusuario temporal de CI/bootstrap, owner/migración y aplicación.

Tablas mínimas de tenant, principal, membership, roles, permisos y relaciones.

RLS habilitada y forzada; policies explícitas TO praxa_app.

Membership self-only y limitación documentada cuando no pueda comprobarse sin recursión o bypass peligroso.

Contexto con SET LOCAL dentro de la transacción.

Limpieza real del contexto al devolver conexiones al pool.

Guard estático contra patrones prohibidos.

Un solo contrato ejecutable de integración/seguridad: make ci-full, o un script canónico compartido por Make y Actions sin duplicar la secuencia.

Contrato de configuración:

La API recibe únicamente DATABASE_URL.

Alembic recibe MIGRATION_DATABASE_URL.

Seed/bootstrap recibe SEED_DATABASE_URL sólo en tareas explícitas de bootstrap, test o CI.

APP_ENV es obligatorio y bootstrap sólo acepta development, test o ci.

En un shell local limpio, las herramientas documentadas funcionan con un .env no versionado.

CI funciona sin .env mediante variables exportadas.

Una variable exportada tiene prioridad sobre el valor del .env.

Si falta la configuración necesaria, el proceso falla antes de conectar y no imprime URLs, passwords ni secretos.

.env.example no contiene secretos y explica la coherencia entre POSTGRES_HOST_PORT y las tres URLs.

Migraciones: vector; tenancy/principals/memberships/catálogos; relaciones role/permission; funciones de contexto fail-closed; grants, ENABLE/FORCE RLS y policies. FTS nativo no requiere extensión.

Pruebas obligatorias:

Tenant A no lee, inserta, actualiza ni elimina filas de B.

Sin tenant/principal, principal inexistente o membership inválida: fail-closed.

Principal inactivo no obtiene acceso al tenant ni enumera el padrón.

UUID inválido en un GUC no rompe la transacción ni habilita acceso.

app.role no participa en policies.

La suite usa praxa_app, no owner, y verifica que ninguna policy quede para {public}.

El pool reutiliza backend sin filtrar contexto; un control negativo demuestra el riesgo sin el listener.

Bootstrap shell/Python es idempotente.

Upgrade → downgrade → upgrade, current, heads y alembic check.

Los IDs de Alembic caben en version_num.

No se usa SQLite como sustituto de integración o seguridad.

Se prueban explícitamente los cuatro comportamientos del contrato de configuración: .env local, CI exportado, precedencia del entorno y falta de configuración.

Aceptación: mínimo privilegio, PostgreSQL real, make ci-full reproduce la cadena completa y Actions invoca ese contrato sin una segunda receta ni un PostgreSQL duplicado. El gate de restricción por rol sobre un recurso de negocio es no aplicable en VS-01 y obligatorio en VS-02.

Exclusiones: evidencia, contratos de evidencia, ContextPacket, entidades de inventario, retrieval, agente y UI.

VS-02 — Ingesta, evidencia, chunks, embeddings y ACL

Objetivo: importar dos fuentes estructuradas y documentos de policy conservando identidad, versiones, procedencia, permisos, chunks y citas sin duplicación.

Dependencias: VS-01 fusionada; proveedor de embeddings detrás de una interfaz pequeña; fake offline; fixtures aprobados.

Entregables: protocolo de fuente; normalize() pura; dos adaptadores y documentos sintéticos; evidence_source, source_object, evidence_version, evidence_chunk, import_run; identidad de origen separada del hash; tombstones; localizadores; chunking determinístico; embeddings versionados; timeout explícito y acotado en cada llamada al proveedor de embeddings, nunca el default de la librería; índices FTS/vector; ACL heredada; evidencia no mutable por la app; ingesta síncrona; primer recurso de negocio restringido por rol dentro del tenant; puertos de repositorio como Protocol en el núcleo de dominio/aplicación y adaptadores SQLAlchemy en infraestructura, sin imports de SQLAlchemy o FastAPI desde el dominio.

Pruebas: idempotencia por objeto; identidades distintas para igual contenido; nueva versión ante cambio real; tombstones; reconstrucción; pureza; localizadores; herencia ACL; grants; rol restringido; RLS; inputs inválidos o excesivos; fixtures sin datos reales; timeout del proveedor termina de forma segura y deja el fallo observable; un guard de arquitectura falla si un módulo de dominio importa sqlalchemy o fastapi.

Aceptación: evidencia inspeccionable, citable y reconstruible; fake offline; gate de autorización por rol aprobado. La invisibilidad por todos los canales se completa en VS-04.

Exclusiones: conectores reales, OAuth, webhooks, colas, retrieval, agente y UI.

VS-03 — Memoria canónica, policy y detector determinístico

Objetivo: resolver la variante, conservar observaciones, activar la policy aprobada y vigente y detectar riesgo de sobreventa sin LLM.

Entregables: normalizadores por fuente; canonical_variant; external_entity_ref; inventory_observation; exact match por SKU; revisión explícita de ambigüedades; inventory_policy_candidate; inventory_policy_version; flujo documento → candidato → aprobación → versión activa; invariante de no solapamiento para policies aprobadas del mismo tenant y scope normalizado, aplicado preferentemente mediante un constraint de exclusión de rangos en PostgreSQL; si el modelo de scopes no permite expresarlo correctamente como constraint, el camino de aprobación usa una transacción SERIALIZABLE y devuelve un conflicto tipado; vigencia limitada a policy; vínculo policy/evidencia; cálculo de stock vendible; detector; detected_conflict, knowledge_gap y case; estados unknown, zero, not_received, stale y conflicted.

Pruebas: normalización; no auto-match ambiguo; selección por tenant, aprobación, scope y fecha; historia de policies; solapamientos; dos aprobaciones simultáneas de policies incompatibles para el mismo tenant/scope, de las cuales sólo una puede confirmar; property tests del cálculo; unknown distinto de cero; casos gold; ausencia del LLM del camino autoritativo.

Aceptación: policy nunca seleccionada por FTS, vector o LLM; cada policy activa tiene aprobación y cita; el cálculo expone dependencias; la pregunta canónica llega a un case estructurado.

Exclusiones: matching probabilístico, facts universales, DSL, motor de reglas, segunda familia de casos, retrieval y agente.

VS-04 — Retrieval autorizado, Context Compiler y ContextPacket

Objetivo: producir el contexto mínimo, autorizado, citado y reproducible para investigar el caso.

Entregables: canales exacto, SQL, FTS y vector; ranking/dedupe sólo dentro de cada canal; autorización antes de recuperar o rankear; reautorización de citas; detección de stale/conflicts/gaps; InventoryContextPayloadV1; ContextExecutionEnvelopeV1; hash canónico; compiler determinístico; dataset de retrieval/citas.

Payload mínimo: pregunta; entidad; observaciones por fuente/fecha; policy efectiva y cita; resultados determinísticos; conflictos/brechas; evidencia autorizada; answerability; capacidades y límites.

Pruebas: principal no autorizado no recupera por ningún canal; contenido oculto no altera ranking, answerability, hash ni payload; citas exactas; policy estructurada coincide con evidencia; mismo estado produce mismo payload/hash; envelope variable sin romper reproducibilidad; fixtures partial, conflicted y unknown; presupuesto conserva las citas necesarias.

Aceptación: no hay RRF global; ningún contenido no autorizado influye; toda afirmación material tiene cita o dependencia determinística; el packet declara qué falta.

Exclusiones: clasificador general de intención, reranker aprendido, packet multidominio, agente y MCP.

VS-05 — Brain API, agente y skill versionada

Objetivo: permitir que un agente investigue el caso usando sólo capacidades autorizadas y registre una propuesta estructurada sin ejecutarla.

Entregables: REST /api/v1; endpoints de entidad, contexto y propuesta; tools resolve_inventory_entity, get_inventory_context, create_resolution_proposal; autorización por llamada; un proveedor de modelo detrás de una interfaz pequeña; fake offline; prompt/modelo/skill versionados; investigate_inventory_divergence v1; output tipado; límites de tool calls, tokens, tiempo y costo; timeout/retry acotados; abstenciones; resolution_proposal append-only; trazas; suite de prompt injection.

Pruebas: agente sin DB; rechazo de tools no autorizadas; límites y timeouts; abstención; prompt injection no cambia permisos, tools ni policy; valores coinciden con tool outputs; output inválido se rechaza; propuesta marcada no ejecutada; suite offline y determinística.

Aceptación: una sola skill, ninguna afirmación material sin soporte, costos trazados y ninguna abstracción multivendor prematura.

Exclusiones: MCP, segunda skill, memoria entre ejecuciones, autonomía, multiagente y escrituras externas.

VS-06 — Revisión humana, decisiones y auditoría

Objetivo: permitir que una persona entienda el expediente, acepte, corrija o descarte la propuesta y deje una decisión auditable.

Entregables: lista/detalle de casos; valores por fuente y fecha; policy con versión y evidencia; cálculo; propuesta; citas navegables; gaps e incertidumbre; acciones internas de confirmar, corregir, descartar, marcar fuente/policy incorrecta y pedir evidencia; review_decision append-only; audit timeline; accesibilidad básica.

Pruebas: actor, contenido, motivo y tiempo de cada decisión; concurrencia sin pisado silencioso; citas correctas; acceso autorizado; estados especiales distinguibles; corrección no activa policy ni entrena modelos; teclado y etiquetas accesibles.

Aceptación: una persona ajena a la implementación comprende el expediente; propuesta y decisión son inequívocas; la auditoría reconstruye consulta, respuesta y decisión.

Exclusiones: dashboard ejecutivo, exportaciones, búsqueda global, design system completo y aprendizaje desde feedback.

VS-07 — Evaluación, hardening y entrega reproducible

Objetivo: cerrar el MVP con evidencia cuantitativa, pruebas adversariales y una demo desde checkout limpio.

Entregables: dataset con clases positiva, negativa, ambigua, obsoleta, restringida e insuficiente; evals separadas por capacidad; Playwright E2E; pruebas adversariales de RLS, ACL y prompt injection; instalación/seed desde vacío; guion de demo; documentación operativa; límites, deuda, riesgos residuales y decisión go/no-go.

Gates duros:

cero fuga entre tenants;

denegación sin contexto;

contenido no autorizado no se recupera ni influye;

reingesta sin duplicados ni versiones falsas;

tombstones no reaparecen;

policy correcta para fecha y scope;

cálculo reproducible sin LLM;

afirmaciones materiales citadas o determinísticas;

citas abren la evidencia exacta;

evidencia insuficiente produce abstención;

prompt injection no cambia permisos, tools ni policy;

propuesta y decisión quedan trazadas;

demo reproducible desde seed limpio.

Exclusiones: despliegue productivo, datos reales, SLA, conectores productivos y nuevas features.

7. Estrategia de skills

Skill de producto del MVP

El MVP incluye sólo investigate_inventory_divergence v1. Investiga un caso mediante tools autorizadas, recibe un ContextPacket, produce explicación citada y propuesta no ejecutada y se abstiene ante evidencia insuficiente. No accede directamente a PostgreSQL ni decide identidad, policy, permisos o cálculos.

No se agrega una segunda skill hasta demostrar con evals y uso del flujo completo que la primera aporta valor sin degradar seguridad, trazabilidad, latencia o costo.

Skills futuras de producto

Son hipótesis, no backlog autorizado:

explain_process_deviation: explicar una desviación contra un modelo o policy aprobados;

recommend_resolution_playbook: proponer un playbook versionado, prerequisitos y riesgos;

verify_resolution_outcome: comparar estado previo, decisión y evidencia posterior sin inventar causalidad.

Las futuras acciones no deben esconderse dentro de una skill amplia. Cada acción requiere una tool estrecha, autorización por llamada, preview, idempotencia, límites, recibo, recuperación y auditoría.

Skills internas de discovery

También son hipótesis y se construyen sólo después de repetir manualmente el método:

observe_operational_workflow;

reconstruct_case_timeline;

assess_process_data_readiness;

score_automation_candidate;

design_skill_contract.

Estas skills ayudan a observar y diseñar; no son capacidades del runtime del MVP ni sustituyen entrevistas, consentimiento o juicio profesional.

Skills opcionales del proceso de desarrollo

praxa-deliver-ticket y praxa-review-ticket pueden empaquetar prompts repetidos si una prueba real demuestra menos omisiones. No son fases del producto, no bloquean VS-01 y no se confunden con la skill de inventario. Si se autorizan, mantener implementador y revisor separados y evitar duplicar reglas de AGENTS.md.

8. Process intelligence: evolución futura, no alcance del MVP

PRAXA v0 no se presenta como plataforma de process mining. Sus observaciones de inventario, documentos y decisiones no constituyen todavía un event log representativo.

Antes de autorizar process mining deben existir eventos correlacionables y de calidad suficiente, con al menos caso u objeto, actividad, timestamp, actor o sistema, fuente y resultado, además de reglas de privacidad, retención y acceso.

Etapa futura

Resultado

Gate previo

PI-1 Observabilidad

Modelo de eventos y cobertura medida

Ciclo de vida de casos estable

PI-2 Reconstrucción

Timelines, variantes y handoffs

Eventos correlacionables

PI-3 Desempeño

Esperas, retrabajo y cuellos

Calidad de timestamps demostrada

PI-4 Conformidad

Comparación contra proceso/policy aprobados

Modelo esperado versionado

PI-5 Recomendación

Intervención o playbook sugeridos

Evaluación operativa suficiente

PI-6 Ejecución controlada

Tools estrechas y reversibles

Threat model y autorización separados

PI-7 Verificación

Resultado posterior y recurrencia

Evidencia atribuible posterior

Esta tabla es una dirección de evolución, no una extensión de VS-07 ni una autorización de trabajo. Observar correlación no prueba causalidad, y proponer una intervención no demuestra que funcionará.

9. Discovery comercial paralelo

La validación de producto ocurre en paralelo sin cambiar automáticamente el backlog:

elegir una decisión operativa frecuente y costosa;

observar casos con consentimiento y mínima captura de datos;

registrar actores, sistemas, pasos, decisiones, esperas, workarounds y artefactos;

inventariar evidencia y permisos;

reconstruir manualmente casos completos;

medir tiempo, errores, retrabajo y verificabilidad actuales;

ejecutar concierge o Wizard-of-Oz antes de automatizar;

separar lógica determinística, asistencia LLM y autoridad humana;

validar compromiso real de datos, tiempo o piloto;

proponer una nueva cuña, skill o integración sólo mediante un gate de alcance.

10. Gates para ampliar o recortar alcance

Antes de agregar una capacidad opcional

Identificar qué criterio actual no puede cumplirse.

Mostrar evidencia medida del cuello o necesidad de usuario.

Comprobar que PostgreSQL y el código actual no bastan.

Definir autoridad determinística/LLM/humana y controles negativos.

Registrar operación, fallos, privacidad y superficie de seguridad.

Explicar qué se elimina o retrasa para compensar.

Obtener autorización humana y actualizar la fuente correcta.

Orden de recorte si el plan se atrasa

pulido visual no esencial;

cantidad de casos del dataset, manteniendo todas las clases críticas;

sofisticación de stale, conservando freshness explícita;

FTS sólo si exacto + SQL + vector cumplen los casos y se documenta la pérdida;

permisos por rol dentro del tenant; si se quitan, el producto deja de llamarse permission-aware, aunque se conserva el aislamiento por tenant.

Nunca se recortan aislamiento, autorización previa, policy determinística, evidencia citable, idempotencia, cálculos determinísticos, abstención, ausencia de influencia no autorizada, separación propuesta/acción ni decisión humana auditada.

11. Decisiones explícitas sobre infraestructura futura

Redis: sólo ante cuello medido de queue.

Neo4j: sólo si edges/CTEs fallan contra un caso real.

Vector DB dedicada: sólo si pgvector falla contra evals o SLO.

Temporal: sólo ante workflows largos reales.

MCP: después de REST y auth estables; read-only primero.

Multiagente: sólo después de demostrar mejora neta.

RRF global: sólo si un dataset versionado demuestra mejora sin romper seguridad.

Aprendizaje autónomo de reglas: nunca en v0.

Process mining, task mining y observación de escritorio: fuera del MVP y sujetos a gates de datos, privacidad y valor.

12. Prerrequisitos de piloto con datos reales

Nada de esta sección pertenece al MVP académico ni se activa por completar VS-07. Se vuelve obligatorio antes de procesar el primer dato de una empresa real:

timeouts explícitos, reintentos acotados y circuit breaker en toda integración con un sistema externo;

cotas duras de ingesta y lecturas paginadas o limitadas, sin colecciones potencialmente ilimitadas;

política de retención, tasa de crecimiento esperada y procedimiento de purga auditado;

consentimiento, minimización de datos y permisos acordes al uso autorizado.

El evento que abre este gate es la intención concreta de recibir el primer dato empresarial real. Debe resolverse mediante alcance y revisión separados antes de aceptar esos datos; no amplía retroactivamente VS-01…VS-07.

13. Definition of Done global

El MVP sólo puede declararse cerrado cuando:

cada fase está fusionada en orden y su evidencia corresponde al SHA revisado;

no quedan P0/P1 ni contradicciones documentales materiales;

las trece gates duras de VS-07 están verdes;

el expediente puede recorrerse de extremo a extremo desde un seed limpio;

una persona comprende y decide sin confundir propuesta con ejecución;

horas reales, deuda, riesgos y limitaciones están registrados;

la demostración no usa datos reales ni promete process mining, autonomía o producción;

existe una decisión humana go/no-go sobre continuar, pilotar o replantear la cuña.

14. Auditoría de la versión anterior

Hallazgo

Corrección en esta propuesta

Autoridad

R0 verificaba algo “equivalente a make ci”

Se exige el contrato canónico vigente y, para VS-01, make ci-full

Roadmap y control seguro de cambios

VS-01 habilitaba vector y pg_trgm

Se mantiene vector; FTS es nativo; pg_trgm queda excluido

ADR/spec/roadmap

Sync o async aparecía pendiente

Se reconoce ADR-014 Accepted: SQLAlchemy 2 sync + psycopg

ADR-014

VS-01 adelantaba contratos de evidencia y ContextPacket

Evidencia comienza en VS-02 y ContextPacket en VS-04

Fronteras de fase

CI pedía PostgreSQL como service sin aclarar estrategia

Se exige una sola estrategia y una receta canónica compartida

Roadmap/CI contract

VS-01 exigía autorización por rol sobre un recurso que aún no existe

Gate marcado N/A en VS-01 y obligatorio en VS-02

Regla de honestidad

Faltaba el contrato explícito de .env y precedencia

Se añaden shell local, CI exportado, override y fail-closed sin secretos

Gate corregido de VS-01

No estaban completos los controles de pool, bootstrap y migraciones

Se añaden listener/control negativo, bootstrap dos veces, ciclo de migración y alembic check

Roadmap VS-01

El plan podía mezclar secuencia con estado actual

Se reserva el estado a rama/PR/CI/current.md

Política de fuentes

Process mining y skills futuras no tenían frontera

Se agregan como evolución no autorizada con gates de datos, privacidad y valor

Product brief y regla future-compatible

15. Adopción de esta propuesta

Revisar esta propuesta contra los archivos dinámicos del repositorio después de cerrar el PR activo.

Resolver cualquier conflicto restante con ADR/spec/current.md.

Aprobar o rechazar explícitamente los cambios de alcance documental.

Incorporar el plan en un PR documental separado o en la siguiente fase documental autorizada.

Actualizar referencias y decision log sin reescribir la historia.

No modificar el PR activo de VS-01 sólo para incorporar esta propuesta si el cambio no pertenece a su alcance autorizado.
