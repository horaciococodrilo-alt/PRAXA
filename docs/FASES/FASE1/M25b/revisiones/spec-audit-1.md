# Auditoría de la spec de M25b — ronda 1

- **Fecha:** 2026-11-11 (America/Buenos_Aires).
- **Base:** `main@d8dca84`; rama `feat/m25b-meta-anomalies`.
- **Hash auditado de la spec sin la línea de estado:**
  `6f99c6ec7275cfc59923d5147a8c336675a100c1`.
- **Estado auditado:** `BORRADOR`.
- **Código:** idéntico a la base; solo existen documentos nuevos sin seguimiento.

## Veredicto

**APROBABLE: 18 PASS, 0 FAIL.** La auditoría no cambia el estado de la spec, no incorpora aún la
enmienda a las fuentes normativas y no inicia la implementación.

## Checklist

| # | Ítem | Resultado | Evidencia |
|---:|---|---|---|
| 1 | Autorización | PASS | El usuario autorizó M25b, la rama aislada, pruebas primero, CPA confiable, contrato reutilizable, demo sintético separado y prohibió merge y cambios en diagnóstico/chat/reportes/Meta. La spec lo conserva en objetivo, alcance, exclusiones y D-M25b-01/04/05/06. |
| 2 | Dependencia | PASS | `PROJECT_STATE.md` registra `G-SYNC` aprobado el 2026-11-08. M25b no depende del `G-CHAT` pendiente. |
| 3 | Enmienda de ruta | PASS | `propuesta-enmienda-m25b-1.md` define DEC-25, CA-74 a CA-81, el gate y la coordinación; sigue como propuesta hasta aprobación visible. |
| 4 | No interferencia | PASS | La tabla de archivos y la lista prohibida excluyen diagnóstico, chat, reporting y migraciones. Solo `shell.tsx` es compartido y su cambio se limita a una entrada aditiva. |
| 5 | Reutilización | PASS | El contrato de `contract.ts` no depende de Next, Supabase ni UI; `detectMetaAnomalies` recibe observaciones normalizadas y devuelve un DTO versionado y serializable. |
| 6 | Autoridad | PASS | Todas las reglas son determinísticas y versionadas; no hay LLM, causalidad, recomendaciones ni escrituras. Cumple INV-07 y no amplía INV-08. |
| 7 | Períodos | PASS | Dos ventanas de siete días cerrados y consecutivos caben en los 28 días existentes; huecos y días abiertos se rechazan, no se comprimen. |
| 8 | Ausencia y cobertura | PASS | Presencia, estado temporal, captura parcial y bases nulas se validan por regla. Ninguna ausencia se transforma en cero. |
| 9 | Precisión | PASS | Gasto y ratios usan bigint+escala, multiplicación cruzada y texto decimal. La spec prohíbe convertir los datos a `number` o promediar tasas diarias. |
| 10 | CPA | PASS | Exige compra explícita los 14 días, atribución conocida e idéntica, gasto completo y cinco compras por período. Su omisión no bloquea otras reglas. |
| 11 | Umbrales | PASS | Los cinco pares warning/critical y sus mínimos están en una constante versionada, tienen regla de borde y casos T-04 a T-11. |
| 12 | Evidencia visible | PASS | El DTO y la pantalla exigen alcance, métrica, valores, variación, unidad/moneda, períodos, cobertura, frescura, regla y severidad. |
| 13 | Demo honesto | PASS | `?ejemplo=1` usa solo fixture sintético, banner previo y regreso al modo real. T-18 y T-24 prueban no mezclar ni leer datos reales. |
| 14 | Seguridad | PASS | El adaptador construye K01 y reutiliza JWT/RLS; no acepta tenant ni conexión del cliente, no muestra referencias externas y no crea otra frontera. `SECURITY.md` no necesita cambio. |
| 15 | Archivos | PASS | Todos los archivos de código, pruebas y seguimiento están enumerados. La necesidad de una RPC, migración o archivo no previsto es condición de parada. |
| 16 | Verificabilidad | PASS | 12 criterios operativos y 26 casos cubren unit, component, app, diff y recorrido. Cada criterio tiene al menos un caso; el plan los agrupa por etapas TDD. |
| 17 | Acciones reservadas | PASS | Spec, plan, commits, push, PR, integración, despliegue y gate quedan asignados al usuario. No hay merge automático a main. |
| 18 | Consistencia interna | PASS | Objetivo, diseño, archivos, criterios, casos, decisiones y propuesta de ruta coinciden; no hay preguntas abiertas ni contradicciones con el código inspeccionado. |

## Decisiones que aprobará el usuario al aprobar la spec

Además del alcance ya autorizado, la spec concreta tres parámetros de producto:

1. umbrales y mínimos de `META_ANOMALY_RULES_V1`;
2. máximo de 20 alertas ordenadas;
3. demostración exclusiva mediante `?ejemplo=1`.

Están centralizados y versionados para que un ajuste futuro no cambie silenciosamente el
significado de resultados anteriores.

## Verificaciones ejecutadas

| Comando | Resultado |
|---|---|
| `git diff --check` | PASS, sin errores. |
| búsqueda de diff en diagnóstico/chat/reporting/migraciones | PASS, salida vacía. |
| lint de `npm run verify` | PASS. |
| `next typegen` | PASS. |
| `tsc --noEmit` | PASS. |
| `npm run test -- --configLoader native` | PASS: 38 archivos, 958 pruebas. Se usó el cargador nativo porque Vitest no puede escribir `.vite-temp` dentro del `node_modules` enlazado y externo. |
| build Turbopack | No acreditado: rechazó dependencias enlazadas fuera de la raíz hermética de la copia. |
| build webpack | No acreditado: llegó a compilar y falló al intentar descargar las fuentes Google por la red bloqueada del entorno. |

Los dos límites de build son del entorno aislado y anteriores a cualquier código M25b; no revelan
una contradicción de la spec. `verify` completo sigue siendo obligatorio para cerrar la microfase
en un entorno con dependencias locales y acceso a las fuentes, o con las fuentes ya cacheadas.

## Contradicciones y hallazgos

Ninguna contradicción y ningún hallazgo nuevo. La cuenta sin actividad y las limitaciones de M25a
ya están documentadas y no se duplican.

## Siguiente paso

El usuario puede aprobar la enmienda propuesta y esta spec con su hash auditado. Después se
actualiza el estado de la spec a `APROBADA`, se incorpora el hash al plan y se audita el plan antes
de escribir las pruebas rojas.
