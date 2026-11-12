# Propuesta de enmienda — M26a Diagnóstico de Meta Ads

**Estado:** BORRADOR, sin vigencia. Preparada el 2026-11-11 a pedido del usuario después del grill de producto. No modifica la ruta aprobada ni cierra `G-CHAT`.

## Decisiones del usuario que originan la propuesta

Una microfase `M26a`, ejecutada en etapas con un solo gate y excepción expresa al límite de ocho horas, después de `G-CHAT` y antes de `M28.3a`. Diagnóstico manual de Meta Ads de 28 días, objetivo y acción de resultado elegidos por el dueño y guardados por empresa, comparación con los 28 días anteriores si hay cobertura, recomendaciones interpretativas con evidencia, búsqueda web opcional, Claude de Anthropic solo para el diagnóstico, PDF y un único informe vigente. Una nueva generación exige sincronización de las últimas 24 horas, posterior al informe vigente, y 24 horas completas desde su publicación. El informe anterior se borra de la base activa solo al publicar el nuevo; el usuario autorizó una excepción puntual a la reversibilidad. Si falla la generación o no hay actividad, permanece el anterior. Al desconectar Meta se conserva en la base pero deja de mostrarse o descargarse hasta que exista una conexión activa y un informe nuevo; al eliminar la empresa se borra. La cuenta piloto sin actividad solo acredita el estado insuficiente y pruebas sintéticas, no valor comercial.

## Conflictos con la ruta actual

| Fuente vigente | Conflicto | Enmienda requerida antes de aprobar `M26a` |
|---|---|---|
| Parte I, I.1 y mapa/gates, `plan.md:68-118` | La ruta excluye reportes y recomendaciones, y pasa de M25a a M28.3a | Insertar M26a y `G-DIAG`, hacer que M28.3a dependa también de `G-DIAG`; distinguir diagnóstico Meta de reportes genéricos pospuestos. |
| Parte I, I.4; Parte II, III.2, III.3, III.8 | No hay ficha, pasos, archivos ni verificaciones de M26a | Incorporar la ficha y II.14 para M26a; renumerar la actual II.14 de demo; autorizar expresamente todos los archivos previstos en la spec M26a. |
| `spec.md:39-46`, `:349`, `:477` | Se excluyen recomendaciones, rentabilidad y reportes; el chat no evalúa rentabilidad | Mantener esa exclusión para M25a y agregar un contrato nuevo y acotado de diagnóstico. El retorno atribuido a Meta no es ganancia real ni ROAS de la tienda. |
| `spec.md:285-296`, `SECURITY.md:324-339`, acta M03a §5 | Desconectar purga datos de la conexión | Declarar la excepción de retención para un solo diagnóstico derivado, sin FK que lo borre con la conexión; ocultarlo al desconectar; borrarlo al reemplazarlo o al eliminar la empresa. |
| `AGENTS.md`, regla de reversibilidad | El borrado definitivo del informe anterior no permite restaurar su texto exacto | Incorporar una excepción limitada a la publicación atómica del nuevo informe, aprobada expresamente por el usuario en el grill; ninguna otra escritura pierde reversibilidad. |
| `spec.md:67-68`, acta M03a §4, `SECURITY.md` §2 y §8 | El tercero LLM declarado es DeepInfra | Añadir Anthropic como destino exclusivo del diagnóstico, su retención estándar, búsqueda web separada y minimización; DeepInfra permanece para el chat. Reaprobar el acta y comunicarlo al dueño antes de datos reales. |

## Ficha propuesta para Parte I

### M26a — Diagnóstico de Meta Ads

| Campo | Contenido propuesto |
|---|---|
| **ID** | `M26a`, microfase única en tres etapas, excepción expresa al límite de ocho horas, un solo gate `G-DIAG`. |
| **Objetivo** | Que el dueño genere, lea y descargue un diagnóstico de Meta Ads con cifras calculadas por PRAXA, interpretaciones y hasta tres oportunidades justificadas por evidencia. |
| **Implementación requerida** | Configuración del objetivo y acción; preparación completa y acotada de evidencia de 28 días; cálculo de comparaciones y retorno atribuido admisible; persistencia de un informe vigente con publicación atómica y borrado del anterior; dos pasos Anthropic (contexto web opcional sin datos privados y generación estructurada); pantalla y PDF; pruebas y evaluación. |
| **Procedimiento del asistente** | Tres etapas: `.1` datos, contrato y persistencia; `.2` Anthropic, búsqueda y validación; `.3` UI, PDF, evaluación y documentación. TDD para comportamientos; cada etapa tiene control técnico, sin gate propio. No se envían datos reales a Anthropic antes del acta nuevamente aprobada y comunicada. |
| **Evidencia de cierre** | `sesiones/M26a.md`: comandos, resultados, fixtures y evaluación sintética; capturas redactadas de estados y PDF; revisión visible del usuario de PDF sintéticos; recorrido real sin actividad registrado sin simular valor comercial. |
| **Criterio de aceptación** | Informe de 28 días con cobertura y procedencia; ninguna cifra autoritativa sale del modelo; hechos y recomendaciones ligados a evidencia; cero actividad y datos parciales honestos; aislamiento por empresa; reemplazo atómico; PDF fiel; retención y visibilidad decididas; prueba adversaria de web y proveedor. |
| **Pruebas** | `npm run verify`, `npm run db:check:test`, `npm run test:policies`, `npm run test:app`, `npm run test:eval` para el diagnóstico, inspección manual de PDF y recorrido de UI. Ninguna prueba positiva obligatoria se omite por falta de configuración. |
| **Condición para avanzar** | `G-DIAG` aprobado por el usuario tras spec/plan auditados, implementación verificada y revisión de PDF. Habilita `M28.3a` junto con `G-CHAT`. La falta de actividad real limita la validación de valor, no se oculta. |
| **Dependencias / habilita** | `G-SYNC` y `G-CHAT` / `M28.3a`. `G-CHAT` figura pendiente en `PROJECT_STATE.md` al redactar esta propuesta. |
| **Intervención requerida del usuario** | Aprobar enmienda de ruta, spec y plan; crear y configurar la cuenta/clave de Anthropic sin compartirla por chat; aprobar acta actualizada y comunicar transferencia al dueño; aplicar migración en desechable y `app`; publicar cuando corresponda; revisar PDFs sintéticos y aprobar `G-DIAG`. |

## Contrato nuevo que debe entrar en la spec de la ruta

1. `M26a` usa únicamente los datos persistidos del catálogo §11. Se admiten 28 días actuales, 28 anteriores si hay cobertura, cuatro niveles y desgloses disponibles. Ausencia, cero y falta de cobertura son distintos. No se infieren cohortes de compradores, productos vendidos ni ganancia neta desde Meta.
2. El dueño confirma un objetivo y un `action_type` verificado. Si faltan acciones o valores compatibles, el informe se vuelve parcial; no se fabrica una métrica sustituta. El retorno, cuando sea calculable, se rotula «valor atribuido por Meta / gasto» y no «ganancia».
3. La búsqueda en vivo se ejecuta por separado, con consultas genéricas de rubro/país/tema sin cifras, identificadores ni nombres de campañas. Solo entran fuentes originales con URL y fecha comprobables; si falta contexto pertinente, se omite. El texto web no ordena al sistema ni modifica cálculos.
4. Claude recibe evidencia estructurada y acotada procedente de todos los anuncios elegibles; PRAXA calcula y presenta las cifras. La salida del modelo usa estructura validada, referencias a evidencia, interpretaciones marcadas y hasta tres oportunidades. Una muestra pequeña permite hipótesis, no una certeza inventada.
5. Una generación se bloquea sin objetivo, conexión activa, sincronización de menos de 24 horas, sincronización posterior al informe o intervalo de 24 horas entre informes. Sin actividad no llama al modelo. Datos parciales permiten informe parcial.
6. Solo hay un informe vigente visible. Se publica el nuevo y se elimina el anterior en la misma transacción; fallas conservan el anterior. Es una excepción expresa a reversibilidad. El PDF se genera bajo autorización desde el informe vigente y no se guarda como objeto persistente. El informe se oculta tras desconexión, pero se conserva hasta reemplazo o borrado de empresa.
7. La cuenta piloto sin actividad se prueba con estado insuficiente y fixtures sintéticos. `G-DIAG` acredita funcionamiento técnico y calidad revisada; no acredita impacto en ventas.

## Archivos a autorizar en Parte II

`supabase/migrations/0022_meta_diagnostics.sql` (nueva, número condicionado al cierre de las migraciones anteriores); `supabase/tests/17_meta_diagnostics.test.sql` (nuevo), `09_integration_privileges.test.sql` y `10_demo_closure.test.sql`; `src/modules/diagnostics/` (contrato, preparación, cálculo, proveedor, web, orquestación, PDF y acceso); `src/modules/integrations/db/worker-api.ts`; `src/modules/app-data/{index,types}.ts`; `src/app/(app)/app/diagnostico/page.tsx` y `descargar/route.ts`; `src/components/app/{diagnostico.tsx,diagnostico.module.css}`; pruebas `tests/{unit,component,app,eval}/` específicas de diagnóstico y regresiones de pantalla; `package.json` y `package-lock.json` si se añade una biblioteca PDF; `.env.example`; `docs/FASES/FASE1/meta_first/entorno.md`; `docs/FASES/FASE1/M03a/acta-meta.md`; `docs/SECURITY.md`; `docs/ARCHITECTURE.md`; `docs/HALLAZGOS.md`; `docs/PROJECT_STATE.md`; `docs/FASES/FASE1/M26a/{spec,plan}.md` y `sesiones/M26a.md`. No editar migraciones existentes ni el proveedor del chat.

## Paso siguiente

Revisar esta propuesta con el usuario e integrar los cambios exactos en la Parte I, la Parte II y la spec de la ruta mediante aprobación visible. Después auditar `M26a/spec.md` contra esa ruta integrada. Hasta entonces la spec es un borrador con **REQUIERE CAMBIO EN LA RUTA** y no autoriza implementación.
