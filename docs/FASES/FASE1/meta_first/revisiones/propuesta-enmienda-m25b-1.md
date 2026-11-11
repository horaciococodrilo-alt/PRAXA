# Propuesta de enmienda — M25b detector de anomalías de Meta Ads

**Estado:** APROBADA por el usuario
**Fecha:** 2026-11-11 (America/Buenos_Aires)
**Base:** `main@d8dca84`
**Origen de la decisión:** el usuario autorizó expresamente M25b y su implementación en una
rama aislada, con pruebas primero, el 2026-11-11.

## Motivo

La ruta actual termina en un chat sobre datos verificados, pero no avisa por iniciativa propia
cuando cambia de forma relevante el rendimiento publicitario. M25b agrega un detector
determinístico, demostrable aun cuando la cuenta piloto siga sin actividad, sin convertir al LLM
en autoridad y sin escribir en Meta.

## Cambios propuestos en la ruta

### Decisión nueva

- **DEC-25 — Detector de anomalías.** Después de `G-SYNC`, M25b puede ejecutarse en paralelo
  con M25a. Consume solo Insights persistidos bajo RLS, compara dos períodos cerrados y produce
  resultados versionados que la pantalla de anomalías usa directamente y que un diagnóstico
  futuro podrá consumir. No modifica diagnóstico, chat ni reportes. No consulta ni escribe Meta.

### Mapa y gates

`G-SYNC` habilita en paralelo M25a y M25b. La demo M28.3a requiere `G-CHAT` y el nuevo
`G-ANOMALIES`. M25b no depende de `G-CHAT` y no modifica su gate.

### Ficha propuesta para la Parte I

| Campo | Contenido |
|---|---|
| **ID** | `M25b` — ≤8 h, ejecutada en dos etapas internas con una spec y un plan |
| **Objetivo** | Detectar cambios relevantes de CTR, CPC, CPM, gasto y, solo con datos suficientes y confiables, CPA de compras, mostrando períodos, severidad y evidencia. |
| **Implementación requerida** | Motor puro y reutilizable; adaptador server-only sobre la cobertura persistida de cuenta y campaña; pantalla `/app/anomalias`; demostración sintética inequívocamente identificada y separada de datos reales. |
| **Procedimiento del asistente** | Pruebas primero. Decimales exactos. Cobertura y atribución antes que detección. Ningún dato ausente se interpreta como cero. No tocar diagnóstico, chat ni reportes. |
| **Evidencia de cierre** | Sesión M25b con pruebas rojas y verdes, `verify`, prueba de aplicación focalizada, diff y recorrido manual real/sintético. |
| **Criterio de aceptación** | CA-74 a CA-81 y CB-01 a CB-06. La pantalla distingue siempre datos reales y simulados. CPA se omite sin evidencia suficiente. |
| **Pruebas** | Unitarias del contrato y reglas, componente de todos los estados, aplicación con tenant y RLS existentes, `npm run verify`. |
| **Condición para avanzar** | `G-ANOMALIES`. |
| **Dependencias / habilita** | `G-SYNC` / M28.3a junto con `G-CHAT` |
| **Intervención requerida del usuario** | Aprobar spec y plan; hacer commit/push/PR/despliegue; aprobar `G-ANOMALIES`. |

### Criterios nuevos para la spec de la ruta

- **CA-74 — Contrato reutilizable y versionado.** El motor no importa UI, Next, Supabase,
  chat, diagnóstico ni reporting. Acepta observaciones normalizadas y devuelve un resultado
  serializable con versión de contrato y de reglas, modo, estado, períodos, cobertura y anomalías.
- **CA-75 — Períodos y cobertura.** Compara siete días cerrados y consecutivos contra los
  siete inmediatamente anteriores. Solo usa filas `con_datos`, cerradas y no capturadas antes
  de finalizar el día. Ausencia, `null`, día abierto, captura parcial, moneda incompatible o un
  hueco hacen no evaluable la regla afectada, nunca cero.
- **CA-76 — Reglas versionadas.** CTR baja 20 %/40 %, CPC y CPM suben 25 %/50 %, gasto sube
  30 %/60 % y CPA de compras sube 25 %/50 % para severidad `warning`/`critical`. CTR, CPM y
  gasto requieren al menos 1.000 impresiones en cada período; CPC, 20 clics; CPA, 5 compras.
  Los umbrales viven en una única constante versionada.
- **CA-77 — CPA confiable.** CPA usa gasto dividido por compras `purchase` explícitas. Exige
  gasto y compras presentes en cada uno de los 14 días, atribución conocida, idéntica y compatible
  en todos ellos, y el mínimo de compras de CA-76. Si no se cumple, se omite solo CPA.
- **CA-78 — Evidencia.** Cada anomalía declara alcance (`account` o `campaign`), nombre visible,
  métrica, dirección, severidad, valor anterior, valor actual, variación, unidad/moneda, ambos
  períodos, cobertura y regla aplicada. No afirma causas ni recomienda cambios automáticos.
- **CA-79 — Pantalla.** `/app/anomalias` presenta estados sin conexión, sin sincronización,
  datos insuficientes, sin anomalías, con anomalías y error controlado. Muestra alertas ordenadas,
  comparación, períodos, severidad, evidencia, frescura y enlace para sincronizar.
- **CA-80 — Demostración sintética.** Cuando faltan datos reales se ofrece una demostración.
  Su URL y encabezado la marcan como `Datos simulados`; usa nombres y referencias sintéticas y
  jamás mezcla filas o conclusiones con datos reales. Puede volver al modo real.
- **CA-81 — Seguridad y solo lectura.** El tenant se resuelve en el servidor, la lectura usa
  el JWT y RLS existentes, ninguna entrada cliente decide empresa o conexión, no se exponen IDs
  externos completos y no existe escritura ni llamada a Meta.

### Parte II propuesta

1. Contrato, fixtures y pruebas rojas del motor.
2. Aritmética decimal exacta, selección de ventanas, gates por métrica y reglas.
3. Adaptador `server-only` que reutiliza conexión, estado y cobertura existentes.
4. Fixture de demostración separado del adaptador real.
5. Pantalla, navegación y estados accesibles.
6. Pruebas unitarias, de componente y aplicación; `verify`; recorrido manual.

No hay migraciones. No se modifican `src/modules/chat/`, `src/modules/reporting/`,
`src/app/(app)/app/diagnostico/`, `src/components/app/diagnostico.*` ni Meta Ads.

## Documentos a coordinar después de la aprobación

- `docs/FASES/FASE1/meta_first/spec.md`: DEC-25, CA-74 a CA-81 y verificación.
- `docs/FASES/FASE1/meta_first/plan.md`: mapa, gates, ficha y Parte II de M25b.
- `docs/PROJECT_STATE.md`: M25b habilitada en paralelo por `G-SYNC`.
- `docs/ARCHITECTURE.md`: pasar el módulo de anomalías de previsto a existente al implementar.
- `docs/FASES/FASE1/M25b/spec.md`, `plan.md` y `sesiones/M25b.md`.

`SECURITY.md` no cambia: M25b conserva las fronteras, invariantes, RLS y política de solo lectura
existentes. Si la implementación exigiera cambiar una de esas propiedades, se detiene.

## Aprobación solicitada

El usuario aprobó el texto, la spec, el plan y sus parámetros el 2026-11-11. La enmienda se
incorpora a las fuentes normativas antes de escribir código.
