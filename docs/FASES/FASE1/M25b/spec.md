# M25b — Spec del detector de anomalías de Meta Ads

**Estado:** APROBADA

## Fuentes

- Autorización y alcance dados por el usuario el 2026-11-11.
- Propuesta de ruta:
  `docs/FASES/FASE1/meta_first/revisiones/propuesta-enmienda-m25b-1.md`.
- Ruta vigente: `docs/FASES/FASE1/meta_first/plan.md` y `spec.md`.
- Base: `main@d8dca84`; rama aislada `feat/m25b-meta-anomalies`.
- Dependencia cerrada: `G-SYNC`, aprobada el 2026-11-08.

La auditoría resultó `APROBABLE` y el usuario aprobó la enmienda, esta spec, el plan y los
parámetros el 2026-11-11.

## Objetivo

Detectar cambios relevantes de rendimiento en los Insights persistidos de Meta Ads y mostrarlos
con evidencia verificable, sin IA y sin escribir en Meta. El resultado debe poder ser consumido
por la pantalla de anomalías y, más adelante, por el diagnóstico automático sin cambiar el motor.

## Alcance

- Cuenta y campañas de la única conexión Meta visible para la empresa.
- Comparación de siete días cerrados contra los siete inmediatamente anteriores.
- CTR, CPC, CPM, gasto y CPA de compras bajo gates independientes.
- Contrato reutilizable, motor puro, adaptador server-only y fixture sintético separado.
- Pantalla `/app/anomalias`, navegación, estados vacíos y demostración explícita.
- Pruebas unitarias, de componente y de aplicación focalizada.

## Fuera de alcance

- Modificar diagnóstico, chat, reportes o sus contratos.
- Explicar causas, recomendar acciones, predecir resultados o usar un LLM.
- Alertas push, email, tareas programadas, workers o persistencia de anomalías.
- Cambiar presupuestos, campañas, anuncios o cualquier recurso de Meta.
- Consultar Meta en vivo; crear migraciones; cambiar RLS, grants o funciones SQL.
- ROAS, rentabilidad, revenue, atribución propia o reconciliación con Tiendanube/GA4.
- Frecuencia agregada: la spec de la ruta prohíbe agregarla entre días.
- Más de una cuenta por empresa o selección de empresa/conexión desde el navegador.

## Contexto verificado en el código

| Qué | Dónde | Implicación |
|---|---|---|
| Estado y ventana de la última sincronización | `src/modules/integrations/meta/insights.ts` (`readMetaSyncStatus`) | El adaptador no inventa fechas ni consulta Meta. |
| Cobertura diaria por nivel/entidad | `readMetaDailyCoverage` y RPC `get_meta_daily_coverage` de `0016` | Se reutilizan JWT, RLS, presencia, estado temporal, frescura y precisión decimal. |
| Entidades capturadas | `listCapturedEntities` | La cuenta y las campañas se resuelven en el servidor. |
| Ventana persistida | M16c usa 28 días | Caben dos períodos de siete días más días abiertos o incompletos. |
| Acciones tipadas | `MetaCoverageRow.actions` | Compra es `action_type=purchase`, `variant=value`, con `count` decimal o nulo. |
| Atribución | `MetaCoverageRow.attribution` | CPA se omite si no es conocida e idéntica en las 14 filas. |
| Tenant | `requireTenantContext` y `readConnectionRecord` | Ninguna API pública acepta `company_id` o `connection_id`. |
| Navegación | `src/components/app/shell.tsx` | Se agrega solo `/app/anomalias`; no se toca diagnóstico. |
| Cuenta piloto sin actividad | `docs/PROJECT_STATE.md` | La demostración sintética es necesaria y debe estar claramente separada. |

## Diseño concreto

### 1. Contrato público reutilizable

Vive en `src/modules/anomalies/contract.ts` y no importa módulos de UI, Next, Supabase,
diagnóstico, chat ni reporting.

```ts
type MetaAnomalyLevel = 'account' | 'campaign';
type MetaAnomalyMetric = 'ctr' | 'cpc' | 'cpm' | 'spend' | 'cpa_purchase';
type MetaAnomalySeverity = 'warning' | 'critical';
type MetaAnomalyMode = 'real' | 'synthetic_demo';

type MetaAnomalyObservation = {
  day: string;
  level: MetaAnomalyLevel;
  entityRef: string;
  entityName: string | null;
  presence: 'no_observado' | 'sin_fila_reportada' | 'con_datos';
  temporalStatus: 'abierto' | 'cerrado';
  capturedBeforeDayEnd: boolean | null;
  spend: string | null;
  impressions: string | null;
  clicks: string | null;
  purchases: string | null;
  purchaseAttributionKey: string | null;
  currency: string | null;
  timezone: string | null;
  fetchedAt: string | null;
};
```

El motor exporta una única entrada estable:

```ts
detectMetaAnomalies(input: {
  mode: MetaAnomalyMode;
  observations: readonly MetaAnomalyObservation[];
  generatedAt: string;
}): MetaAnomalyResult
```

`MetaAnomalyResult` es JSON-serializable y contiene:

- `contractVersion: 1` y `rulesVersion: 'meta-anomaly-rules/1'`;
- `mode`, `generatedAt`, `status` (`ready` o `insufficient_data`);
- `periods` anterior y actual, o `null` si no hay 14 días consecutivos;
- `evaluatedScopes`, `omittedScopes` y motivos cerrados;
- `anomalies`, máximo 20, ordenadas por severidad, magnitud y clave estable.

Cada anomalía contiene: `id` determinístico sin referencia externa cruda, `metric`, `level`,
`entityRef`, `entityName`, `severity`, `direction`, `baseline`, `current`, `changePct`, `unit`,
`currency`, `periods`, `evidence`, `ruleId` y `rulesVersion`. El consumidor decide cómo mostrar
`entityRef`; la pantalla nunca lo muestra.

### 2. Precisión y agregación

- Los decimales SQL se parsean a coeficiente `bigint` + escala. No se convierten a `number`.
- Gasto se suma exactamente. Impresiones y clics deben ser enteros no negativos.
- CTR = `100 × clicks / impressions`; CPC = `spend / clicks`; CPM =
  `1000 × spend / impressions`; CPA = `spend / purchases`.
- Comparaciones y umbrales se resuelven por multiplicación cruzada exacta.
- Los valores visibles y `changePct` se redondean half-up a dos y una cifra decimal,
  respectivamente, y permanecen como texto.
- No se promedian tasas diarias.

### 3. Selección de períodos y gates

Por cada alcance (la cuenta y cada campaña), el motor toma los últimos 14 días calendario
consecutivos que terminan en el día cerrado más reciente disponible. Cada regla exige en sus 14
filas:

- `presence=con_datos`, `temporalStatus=cerrado` y
  `capturedBeforeDayEnd=false`;
- moneda única cuando la métrica es monetaria;
- bases no nulas de esa regla;
- denominador anterior y actual mayor que cero;
- mínimos de volumen de la tabla siguiente.

Un gate fallido omite solo esa regla. El alcance queda `omitted` únicamente si ninguna regla pudo
evaluarse. Un hueco de fecha impide evaluar ese alcance. Un valor ausente nunca es cero.

| Regla | Warning | Critical | Mínimo por período |
|---|---:|---:|---:|
| CTR baja | 20 % | 40 % | 1.000 impresiones |
| CPC sube | 25 % | 50 % | 20 clics |
| CPM sube | 25 % | 50 % | 1.000 impresiones |
| Gasto sube | 30 % | 60 % | 1.000 impresiones y gasto anterior > 0 |
| CPA de compra sube | 25 % | 50 % | 5 compras |

Los umbrales viven en `META_ANOMALY_RULES_V1`, una sola constante inmutable. Igualar el umbral
dispara la regla. Una variación menor no lo hace.

### 4. Gate adicional de CPA

CPA se evalúa únicamente cuando cada una de las 14 filas tiene:

- gasto no nulo;
- una acción explícita `purchase`, variante `value`, con `count` no nulo;
- atribución con `known=true`;
- la misma representación canónica de ventanas de atribución en todos los días;
- al menos cinco compras en cada período.

Una acción ausente no significa cero compras. Atribución desconocida, distinta, parcial o ausente
omite CPA. Esta omisión no impide detectar CTR, CPC, CPM o gasto.

### 5. Adaptador real

`src/modules/anomalies/load.ts` lleva `server-only`. Construye K01, lee la conexión visible y el
estado de sincronización, y luego lee cobertura de `account` y `campaign`. No acepta argumentos
de tenant o conexión del cliente. Mapea `MetaCoverageRow` al contrato normalizado y llama al
motor.

Estados de vista cerrados:

- `not_connected`;
- `never_synced`;
- `insufficient_data`;
- `ready`;
- `unavailable` con mensaje fijo y sin detalles internos.

Una conexión `needs_reauth`, una sincronización de cuenta no completa o una lectura inválida no
se presenta como rendimiento válido. La pantalla ofrece ir a Integraciones.

### 6. Demostración sintética

`src/modules/anomalies/demo.ts` contiene observaciones genéricas sin IDs, nombres ni montos
reales. `?ejemplo=1` selecciona exclusivamente ese fixture. En este modo no se mezcla ni se
presenta ningún resultado real y la pantalla muestra, antes de las alertas:

> Datos simulados — Esta demostración no corresponde a tu cuenta de Meta Ads.

El modo real insuficiente ofrece un enlace `Ver demostración`. El modo demo ofrece `Volver a mis
datos`.

### 7. Pantalla

`/app/anomalias` es un Server Component. Muestra:

- encabezado y modo;
- resumen de alertas y alcances evaluados;
- tarjetas ordenadas con severidad, alcance, métrica, valores anterior/actual, variación y ambos
  períodos;
- bloque de evidencia con regla, cobertura, frescura y limitaciones;
- estados vacíos honestos: “sin anomalías detectadas” no equivale a “todo funciona bien”.

La navegación agrega `Anomalías` con `IconAlerta`. No se modifica ningún archivo de diagnóstico.

## Archivos previstos

| Archivo | Cambio | Para qué |
|---|---|---|
| `docs/FASES/FASE1/meta_first/revisiones/propuesta-enmienda-m25b-1.md` | Nuevo | Enmienda propuesta. |
| `docs/FASES/FASE1/meta_first/spec.md` | Modificado tras aprobación | DEC-25 y CA-74 a CA-81. |
| `docs/FASES/FASE1/meta_first/plan.md` | Modificado tras aprobación | Mapa, gate, ficha y Parte II. |
| `docs/PROJECT_STATE.md` | Modificado tras aprobación | Trabajo paralelo y gate. |
| `docs/ARCHITECTURE.md` | Modificado al implementar | Responsabilidad del módulo existente. |
| `docs/FASES/FASE1/M25b/spec.md` | Nuevo | Esta spec. |
| `docs/FASES/FASE1/M25b/plan.md` | Nuevo | Plan detallado. |
| `docs/FASES/FASE1/M25b/sesiones/M25b.md` | Nuevo | Evidencia real. |
| `src/modules/anomalies/contract.ts` | Nuevo | Contrato público. |
| `src/modules/anomalies/decimal.ts` | Nuevo | Aritmética exacta interna, sin acoplarse a chat. |
| `src/modules/anomalies/detect.ts` | Nuevo | Motor puro. |
| `src/modules/anomalies/load.ts` | Nuevo | Adaptador real server-only. |
| `src/modules/anomalies/demo.ts` | Nuevo | Fixture sintético separado. |
| `src/modules/anomalies/index.ts` | Nuevo | Exportaciones públicas. |
| `src/app/(app)/app/anomalias/page.tsx` | Nuevo | Ruta y selección explícita de modo. |
| `src/components/app/anomalias.tsx` | Nuevo | Presentación. |
| `src/components/app/anomalias.module.css` | Nuevo | Estilos aislados. |
| `src/components/app/shell.tsx` | Modificado | Navegación únicamente. |
| `tests/unit/meta-anomalies.test.ts` | Nuevo | Contrato, precisión, gates y reglas. |
| `tests/component/app-anomalias.test.tsx` | Nuevo | Estados y accesibilidad. |
| `tests/app/meta-anomalies.test.ts` | Nuevo | Tenant y lectura real bajo RLS existente. |

Archivos prohibidos para M25b: `src/modules/chat/**`, `src/modules/reporting/**`,
`src/app/(app)/app/diagnostico/**`, `src/components/app/diagnostico.*`, migraciones y pruebas
existentes de esos módulos.

## Criterios de aceptación

| ID | Criterio |
|---|---|
| M25b-C-01 | Cumple CA-74: contrato reutilizable, versionado y sin dependencias de UI o datos. |
| M25b-C-02 | Cumple CA-75: períodos consecutivos, gates por regla y ausencia distinta de cero. |
| M25b-C-03 | Cumple CA-76: cinco reglas, umbrales y mínimos versionados. |
| M25b-C-04 | Cumple CA-77: CPA solo con compras y atribución confiables. |
| M25b-C-05 | Cumple CA-78: evidencia completa y sin causalidad inventada. |
| M25b-C-06 | Cumple CA-79: todos los estados reales y navegación. |
| M25b-C-07 | Cumple CA-80: demostración separada e inequívoca. |
| M25b-C-08 | Cumple CA-81 e INV-01/02/07: tenant servidor, RLS y solo lectura. |
| M25b-C-09 | Decimales y razones no pierden precisión por `number`. |
| M25b-C-10 | Resultado determinístico, serializable y limitado a 20 alertas. |
| M25b-C-11 | No hay cambios en diagnóstico, chat, reporting, migraciones ni Meta. |
| M25b-C-12 | CB-01 a CB-06 y recorrido manual real/demo quedan documentados. |

## Casos de prueba

| ID | Caso | Tipo | Esperado |
|---|---|---|---|
| M25b-T-01 | Sin observaciones | unit | `insufficient_data`, sin alertas. |
| M25b-T-02 | Catorce días consecutivos y cerrados | unit | Períodos exactos 7+7. |
| M25b-T-03 | Hueco, día abierto, presencia ausente o captura parcial | unit | Omite el alcance o la regla afectada; nunca agrega cero. |
| M25b-T-04 | CTR justo debajo, igual y por encima de 20/40 % | unit | Bordes correctos y severidad. |
| M25b-T-05 | CPC justo debajo, igual y por encima de 25/50 % | unit | Bordes correctos y mínimo de clics. |
| M25b-T-06 | CPM justo debajo, igual y por encima de 25/50 % | unit | Bordes correctos y mínimo de impresiones. |
| M25b-T-07 | Gasto justo debajo, igual y por encima de 30/60 % | unit | Bordes correctos sin umbral monetario universal. |
| M25b-T-08 | CPA con compras explícitas, atribución idéntica y mínimo | unit | Warning/critical según regla. |
| M25b-T-09 | Compra ausente un día | unit | Omite CPA; otras reglas siguen. |
| M25b-T-10 | Atribución desconocida o distinta | unit | Omite CPA. |
| M25b-T-11 | Menos de cinco compras en un período | unit | Omite CPA. |
| M25b-T-12 | Decimales mayores que `Number.MAX_SAFE_INTEGER` | unit | Suma y comparación exactas. |
| M25b-T-13 | Cuenta y varias campañas | unit | Evalúa por separado, orden estable y máximo 20. |
| M25b-T-14 | Misma entrada repetida | unit | Resultado idéntico excepto `generatedAt` provisto. |
| M25b-T-15 | Resultado completo | unit | `JSON.stringify` funciona y no contiene `bigint`. |
| M25b-T-16 | Sin conexión y sin sync | component | Estados y enlaces correctos. |
| M25b-T-17 | Datos insuficientes | component | Ofrece demostración. |
| M25b-T-18 | Demostración | component | Banner antes de alertas; no afirma datos reales. |
| M25b-T-19 | Alertas reales | component | Métricas, períodos, severidad y evidencia accesibles. |
| M25b-T-20 | Sin anomalías | component | Texto acotado; no afirma que todo está bien. |
| M25b-T-21 | Navegación | component | Enlace Anomalías activo y accesible. |
| M25b-T-22 | Tenant A y tenant B | app | Cada uno solo recibe su conexión y cobertura. |
| M25b-T-23 | Entrada manipulada desde URL | app | No selecciona empresa, conexión ni entidad. |
| M25b-T-24 | Modo demo | app/unit | No ejecuta lectura real y usa solo fixture sintético. |
| M25b-T-25 | Diff | manual | Ningún archivo prohibido ni dato real modificado. |
| M25b-T-26 | Recorrido real y `?ejemplo=1` | manual | Estados distinguibles; diseño responsive y legible. |

## Verificación

- Rojo y verde focalizado:
  - `npm run test:unit -- tests/unit/meta-anomalies.test.ts`
  - `npm run test:component -- tests/component/app-anomalias.test.tsx`
- Aplicación, solo contra proyecto desechable:
  - `npm run db:check:test`
  - `npm run test:app -- tests/app/meta-anomalies.test.ts`
- Final: `npm run verify`.
- Revisión de diff y búsqueda de datos reales/secretos sin leer `.env.local`.
- Recorrido manual del modo real y `?ejemplo=1`.

Una suite omitida que cubra M25b no acredita el gate (CB-06). No se ejecuta `db:push`,
`db:push:test`, ninguna prueba contra `app`, ni una llamada a Meta.

## Intervenciones del usuario y acciones reservadas

| Paso | Usuario | Verificación posterior |
|---|---|---|
| 1 | Aprobar la enmienda y esta spec después de auditoría APROBABLE | Estados y hashes documentados. |
| 2 | Aprobar el plan después de su auditoría | Plan `APROBADO`. |
| 3 | Hacer commit, push y PR cuando el asistente entregue | Rama remota y CI visibles. |
| 4 | Integrar después de coordinar con el diagnóstico paralelo | Rebase/merge sin archivos prohibidos ni resolución destructiva. |
| 5 | Desplegar y aprobar `G-ANOMALIES` | Recorrido real/demo en el entorno. |

El asistente no hace commit, push, PR, merge ni despliegue sin autorización adicional.

## Trampas y riesgos

- Ausencia no es cero; un array de acciones sin `purchase` no prueba cero compras.
- No promediar tasas diarias ni sumar niveles de jerarquía.
- Un aumento de gasto no es por sí mismo malo: la UI lo llama cambio relevante, no pérdida.
- Los umbrales son heurísticos versionados, no causalidad ni recomendación.
- El nombre de campaña es texto externo no confiable: React lo escapa; no se interpreta.
- La cuenta piloto puede no acreditar el recorrido real con alertas; el demo sintético no sustituye
  la prueba del adaptador, y siempre se etiqueta.
- El trabajo paralelo puede cambiar `shell.tsx`; la integración posterior se resuelve de forma
  aditiva, sin sobrescribir cambios del compañero.
- Si el adaptador exige una nueva RPC o migración, la microfase se detiene: está fuera de alcance.

## Decisiones de la microfase

| ID | Decisión | Motivo | Decidió | Fecha |
|---|---|---|---|---|
| D-M25b-01 | Rama aislada y sin merge a main | Trabajo paralelo | Usuario | 2026-11-11 |
| D-M25b-02 | Cuenta y campaña | Hacer la alerta accionable sin sumar niveles | Usuario + diseño de spec | 2026-11-11 |
| D-M25b-03 | 7 días vs 7 anteriores | Cabe en M16c y es explicable | Diseño de spec | 2026-11-11 |
| D-M25b-04 | CPA estricto y omisible | No inventar compras ni atribución | Usuario + diseño de spec | 2026-11-11 |
| D-M25b-05 | Motor puro con contrato versionado | Reuso futuro por diagnóstico | Usuario | 2026-11-11 |
| D-M25b-06 | Demo por modo exclusivo `?ejemplo=1` | Cuenta sin actividad y separación inequívoca | Usuario + diseño de spec | 2026-11-11 |
| D-M25b-07 | Sin persistir anomalías | Completar mañana sin nueva frontera ni migración | Diseño de spec | 2026-11-11 |
| D-M25b-08 | Umbrales y mínimos de CA-76 | Reducir ruido con reglas visibles y versionadas | Diseño de spec | 2026-11-11 |
| D-M25b-09 | Máximo 20 alertas | Pantalla legible y salida acotada | Diseño de spec | 2026-11-11 |

## Supuestos e hipótesis

- **H-M25b-01:** la cobertura de cuenta y campaña de 28 días permite encontrar 14 días cerrados
  consecutivos cuando la cuenta tiene actividad. Se verifica con fixtures y el recorrido real.
- **H-M25b-02:** la atribución canónica puede permanecer idéntica 14 días. Si no, CPA se omite por
  diseño y no bloquea la feature.
- **H-M25b-03:** la lectura existente cabe en los límites de filas. Se verifica en la prueba de
  aplicación y no se cambia la RPC.

## Preguntas abiertas

Ninguna para empezar después de la aprobación documental. Los umbrales son explícitos,
versionados y podrán revisarse en otra microfase con evidencia de falsos positivos.

## Hallazgos relacionados

Ninguno nuevo. La falta de actividad de la cuenta piloto ya está documentada en M16c y
`PROJECT_STATE.md`; no se duplica como hallazgo.

## Auditorías

- [`revisiones/spec-audit-1.md`](revisiones/spec-audit-1.md): APROBABLE, 18 PASS y 0 FAIL.
