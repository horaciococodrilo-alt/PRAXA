# Auditoría de la spec M16c — 10

**Fecha:** 2026-11-07  
**Commit base:** `a27f727`  
**Hash de contenido de la spec, excluyendo solo la línea de estado:** `041e902bd01cab8363f35c2047157da90705c886`  
**Estado auditado:** BORRADOR.

Se auditó la versión posterior a la enmienda aprobada de corrida única, no el contenido aprobado en `spec-audit-9.md`. La ruta y el estado vigentes incluyen cambios documentales sin commit; se preservaron.

## Veredicto

**REQUIERE CAMBIOS: 14 PASS y 4 FAIL.** El contrato técnico previamente aprobado no mostró una contradicción nueva. Quedan dos contradicciones y referencias obsoletas del cambio a una sola corrida. Además, `npm run verify` falló dos veces en el build de Turbopack, por lo que la entrada no puede acreditarse limpia bajo el checklist de esta skill.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | Los 16 CA de la ficha aparecen en Heredados (`meta_first/plan.md:305`; `M16c/spec.md:241-262`). |
| 2 | Alcance | FAIL | La ruta ordena una corrida con progresión por controles, sin aprobaciones intermedias (`meta_first/plan.md:313-319`), pero la spec afirma que ninguna etapa se ejecuta automáticamente (`M16c/spec.md:5`). A-01. |
| 3 | Coherencia con la spec general y sucesoras | PASS | Catálogo, cobertura, precisión, cuatro niveles y referencias opacas conservan el contrato de §11 y M25a (`meta_first/spec.md:326-395`; `meta_first/plan.md:329-357`; `M16c/spec.md:68-106,146-170`). |
| 4 | Decisiones | PASS | D-M16c-01 a -05 identifican al usuario y fecha; D-M16c-05 tiene propuesta aprobada y sesión de integración (`M16c/spec.md:383-391`; `meta_first/sesiones/enmienda-corrida-unica-2026-11-07.md`). La excepción puntual de ocho horas fue una elección explícita. |
| 5 | Trampas | PASS | Ausencia, `paging.next`, posesión, precisión, agregación y metadata histórica siguen reflejadas (`meta_first/plan.md:706`; `M16c/spec.md:367-381`). |
| 6 | Intervenciones y acciones reservadas | PASS | Usuario: `db:push:test`, commits de etapa, comunicación, `db:push` en app, integración, push/despliegue, ensayo y gate, cada uno con verificación posterior (`M16c/spec.md:346-365`; `meta_first/plan.md:315-319,822-841`). |
| 7 | Verificación | PASS | Cada control de etapa exige `verify`, `db:check:test`, `test:policies` y `test:app`; CB-06 impide acreditar omitidas requeridas (`M16c/spec.md:329,338-342`; `meta_first/plan.md:843-864`). |
| 8 | Dependencias | PASS | `PROJECT_STATE.md:24,28-38` registra G-VR01 aprobado y M16c como siguiente; el código de M16.2 está en la base. G-SYNC sigue pendiente. |
| 9 | Lo entregado de verdad | PASS | Firmas de 0012, adaptador, repositorios, `purge_connection`, `graphUrl` y cliente coinciden con el código citado (`M16c/spec.md:42-64,112-144,174-182`); el cambio de corrida no altera esos contratos. |
| 10 | Pendientes y hallazgos | PASS | H-E1-22/27/35/36 siguen en .1; H-E1-117/189 en .3; H-E1-188 se difiere e H-E1-190 no bloquea M16c (`M16c/spec.md:393-415`; `HALLAZGOS.md:39,44,52-53,129,191-194`). |
| 11 | Contexto real | FAIL | `M16c/spec.md:20` llama «siguiente M16c.1» a lo que `PROJECT_STATE.md:28` registra como M16c único. Más claramente, las citas históricas de `M16c/spec.md:409` apuntan a líneas vigentes que ya no contienen las frases atribuidas (`meta_first/spec.md:23,525`; `meta_first/plan.md:16,303,702,704,879`). Las referencias de código de `:44-64` siguen vigentes. A-02. |
| 12 | Archivos previstos | PASS | La tabla de `M16c/spec.md:213-235` contiene plan y sesión únicos y archivos de II.11 o seguimiento (`meta_first/plan.md:689-704`). La frase residual «spec del corte» se trata en A-01. |
| 13 | Diseño suficiente | PASS | Objetos SQL, funciones, estados, posesión, payloads, lecturas, interfaces y resultados permanecen definidos (`M16c/spec.md:68-207`); el fallback de reloj de la auditoría 8 sigue resuelto (`:158-168`). |
| 14 | Verificable | PASS | C-01 a C-22 tienen T-01 a T-38 con comandos reales y resultados esperados; los controles completos incluyen la guarda de destino (`M16c/spec.md:264-342`; `package.json`). |
| 15 | Sin nada abierto | PASS | «Preguntas abiertas» no contiene decisiones pendientes; H-01 a H-08 y Ruta H-04 tienen verificación y momento (`M16c/spec.md:393-411`). |
| 16 | Ejecutable ahora | FAIL | `npm run verify` terminó exit 1 dos veces, dentro y fuera del sandbox: lint, typegen, typecheck y 26 archivos/595 pruebas pasaron; `next build` con Turbopack falló al crear el proceso de PostCSS para `src/app/globals.css`. `npm run build -- --webpack` terminó exit 0, pero no reemplaza el comando exigido. Scripts y nombres de variables sí existen (`package.json`, `.env.example`). A-03. |
| 17 | Consistencia interna | FAIL | `M16c/spec.md:5` dice a la vez «una sola corrida» y «no se ejecuta automáticamente ninguna etapa». Además, `:237,381` remite a «la spec del corte» pese a declarar que solo existe `M16c/spec.md` (`:5,232-234`). A-01. |
| 18 | Reglas no negociables | PASS | Tenant en servidor, sin datos reales ni secretos, migración 0016 nueva, pruebas en desechable, credenciales por `worker_api` y errores redactados (`M16c/spec.md:32,40,86,112,174,182,207,215,338-356`; `SECURITY.md` §§3, 5, 6 y 11). |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| «No se ejecuta automáticamente ninguna etapa» | Una sola corrida avanza de etapa al cumplir el control y el commit, sin aprobación intermedia (`meta_first/plan.md:313-319`) | `M16c/spec.md:5,7,340,391` | Aclarar que aprobar/auditar la spec no inicia la implementación, y que `/microfase M16c` continúa por las tres etapas tras cada control e intervención requerida. |
| Registrar un cambio en «la spec del corte afectado» | La ruta establece una sola spec para las tres etapas (`meta_first/plan.md:327`) | `M16c/spec.md:5,232-234,237,381` | Nombrar `M16c/spec.md` como destino único y conservar la parada por necesidad de cambiar la ruta. |

## Hallazgos

| ID (A-NN) | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | media | Apertura, archivos previstos y trampas | La nueva regla de corrida única convive con una prohibición absoluta de avance automático y con una spec por corte inexistente. El implementador tendría que interpretar cuándo continuar y dónde registrar una desviación. | `M16c/spec.md:5,237,381`; `meta_first/plan.md:313-319,327` | Alinear esas frases con la corrida única y la spec única ya aprobadas en D-M16c-05. | No |
| A-02 | baja | Fuentes y preguntas abiertas | El estado siguiente se nombra como M16c.1 y las citas de la antigua Q-04 apuntan a líneas vigentes que ya dicen otra cosa. | `M16c/spec.md:20,409`; `PROJECT_STATE.md:28`; `meta_first/spec.md:23,525`; `meta_first/plan.md:16,303,702,704,879` | Nombrar M16c como siguiente y citar la propuesta/sesión de enmienda para el texto histórico, o quitar las citas de línea obsoletas. | No |
| A-03 | alta | Verificación de entrada | El comando obligatorio `npm run verify` no termina en verde: Turbopack falla al iniciar el proceso de PostCSS. El build diagnóstico con Webpack pasa, pero la skill exige el comando exacto. | Dos ejecuciones exit 1 de `npm run verify`; `npm run build -- --webpack` exit 0; panic log de Turbopack con `creating new process` | Diagnosticar y corregir el entorno o el build de la rama base, repetir `npm run verify` y registrar su salida. Esta auditoría no autoriza cambiar código o scripts. | No |

## Evidencia y límites

- `git rev-parse --short HEAD`: `a27f727`; hash calculado sobre los bytes de la spec sin la línea `**Estado:**`, conservando los saltos de línea. `git status --short --branch` mostró cambios documentales preexistentes y el directorio M16c sin rastrear; se preservaron.
- Se releyeron la spec M16c, `AGENTS.md`, la ficha y las partes pertinentes de la ruta enmendada, la spec general, `PROJECT_STATE.md`, hallazgos, sesiones de dependencias/enmiendas, `SECURITY.md` y el código citado. La auditoría 9 sirvió para separar cambios de organización del contrato técnico; no sustituye este checklist.
- Primer `npm run verify` en sandbox: exit 1; segundo fuera del sandbox: exit 1. En ambos pasaron lint, typegen, typecheck y 595/595 pruebas, y el build de Turbopack falló en `globals.css` por `creating new process`. `npm run build -- --webpack` fuera del sandbox: exit 0, 13 páginas estáticas generadas. No se inspeccionó `.env.local`; el build cargó su configuración normal sin imprimir valores.
- No se aplicó 0016 ni se ejecutaron `test:policies` o `test:app`: son verificaciones de implementación de la corrida. Sin commit, push, despliegue, acceso a producción ni edición de la spec u otros archivos.

## Tamaño de M16c

La corrida completa supera probablemente ocho horas, pero D-M16c-05 y la Parte I contienen una excepción puntual aprobada y tres controles de etapa. No se propone subdividirla contra esa decisión.

## Siguiente paso

Corregir A-01 y A-02 en la spec y resolver A-03 hasta que `npm run verify` termine exit 0; después auditar de nuevo. G-SYNC permanece pendiente. No hace falta una decisión de negocio nueva para esas correcciones.
