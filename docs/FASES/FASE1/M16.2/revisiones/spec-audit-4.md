# M16.2 — Auditoría de la spec, ronda 4

- **Fecha:** 2026-10-16
- **Commit base:** `65404aa` (`main`)
- **Spec auditada:** `docs/FASES/FASE1/M16.2/spec.md`, `BORRADOR`
- **Hash de contenido de la spec, sin la línea de estado:** `0b92d68f3042983fb37fd0339d9715071758cc7b`
- **Fuentes:** AGENTS.md; plan y spec vigentes de `meta_first`; PROJECT_STATE, HALLAZGOS, sesiones de dependencias, SECURITY, código y pruebas existentes. Las enmiendas coordinadas de la ruta fueron aprobadas visiblemente por el usuario el 2026-10-16 y figuran en los encabezados de ambos documentos.
- **Verificación:** `npm run verify` terminó con exit 0: lint, typegen, typecheck, 23 archivos de pruebas con 512 pruebas aprobadas, y build. `git diff --check` terminó con exit 0. No se ejecutaron pruebas contra producción.

## Veredicto

**APROBABLE.** Los 18 ítems están en PASS. La aprobación de la ruta habilita el alcance documental y los archivos; las correcciones A-13 a A-17 de la ronda 3 están incorporadas. La spec continúa en `BORRADOR` hasta que el usuario la apruebe de forma visible.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---:|---|---|---|
| 1 | Trazabilidad | PASS | «Heredados de la ruta» cubre CA-35 a CA-40, con CA-37b, CA-37c, CA-38b y CA-38c; la ficha aprobada de M16.2 incluye CA-38b en la UI (`meta_first/plan.md`, Parte I, M16.2). |
| 2 | Alcance | PASS | Los doce puntos de «Alcance», los criterios y los archivos corresponden a la ficha y a II.10 enmendada. El preflight y VD-01 constan en la ficha y III.2; la prueba durante sincronización y la persistencia de H-E1-22 tienen destino en M16c (`meta_first/plan.md`, II.10 y II.11). |
| 3 | Coherencia con la spec general | PASS | §14 vigente asigna a M16c la prueba de revocación y desconexión durante sincronización; M16.2 prueba confirmación y reautorización en carrera. CB-04 se transcribe sin recorte: VD-01 es una verificación posterior al despliegue a cargo del usuario, fuera de «Casos de prueba», siguiendo la intervención aprobada en la ruta. |
| 4 | Decisiones | PASS | D-M16.2-01 a -08, -10 y -11 identifican la decisión del usuario y la precisión de A-14; D-09 está retirada. La excepción puntual de ocho horas aparece en la ficha aprobada. |
| 5 | Trampas | PASS | La spec trata revocación antes de purga, clasificación por código Graph, registro temporalmente abierto, URL y logs, credencial pendiente y recuperación de escritura ambigua («Trampas y riesgos» y §§2b, 9-13). |
| 6 | Intervenciones y acciones reservadas | PASS | «Intervenciones» reserva al usuario aprobación, preflight, P-04, merge/push/despliegue, VD-01, alta, VR-01 y gate, con verificación posterior. `db:push` y `db:push:test` no aplican porque no hay migración; coincide con ficha y III.2. |
| 7 | Verificación | PASS | «Verificación» exige `verify`, `test:policies`, `test:app`, VR-01 y CB-06; coincide con III.3 de la ruta. |
| 8 | Dependencias | PASS | PROJECT_STATE registra G-OAUTH aprobado y M16.2 habilitada. G-ACTA-META y P-04 están exigidos antes de los pasos 10 a 12, no antes del trabajo con datos sintéticos. |
| 9 | Lo entregado de verdad | PASS | Las diferencias con M16.1 están resueltas explícitamente: `Resolved` no exportado se reemplaza por `ReauthDeps`, el canje y el mapeo de errores se reubican, y la purga recibe las dependencias simuladas (§§9.5, 13). |
| 10 | Pendientes y hallazgos | PASS | «Hallazgos relacionados» cubre los H-E1 asignados; H-E1-22 queda repartido entre log en M16.2 y persistencia en M16c, según HALLAZGOS y ruta aprobada. H-E1-40 se difiere con motivo: falta decisión del usuario y queda fuera de esta enmienda. |
| 11 | Contexto real | PASS | Las referencias a `getIntegraciones` sin `cache`, `oauth.ts`, `readCredential`, funciones `worker_api` y pruebas existentes corresponden al código actual. La sección de contradicciones describe en pasado la ruta original y en presente la enmienda aprobada. |
| 12 | Archivos previstos | PASS | Los 30 archivos individuales de implementación y pruebas de «Archivos previstos» figuran en II.10 aprobado; los restantes son documentos y archivos de seguimiento. La tabla ya no presenta archivos como pendientes de un cambio de ruta. |
| 13 | Diseño suficiente | PASS | El diseño fija tipos, resultados y errores del listado, confirmación, desconexión, reautorización y lote. Para la escritura ambigua define `AmbiguousWriteExpectation`, `AmbiguousWriteResolution`, dependencias inyectadas, comparación de credencial y tres salidas (§11). |
| 14 | Verificable | PASS | Los 45 criterios activos tienen al menos un caso entre los 51 casos activos, con comando real o recorrido manual y resultado esperado. C-43/T-49 fueron retirados: H-S-22 se comprueba como VD-01, sin figurar como prueba contra producción. Hay casos negativos y de borde, incluido T-52 para escritura ambigua. |
| 15 | Sin nada abierto | PASS | «Preguntas abiertas» está vacía. Las hipótesis de Meta y H-S-22 indican momento, observación esperada y parada; el preflight precede a la primera autorización real. |
| 16 | Ejecutable ahora | PASS | `npm run verify` pasó sobre la base. Los comandos están en `package.json`, los nombres de entorno en `.env.example`, y las intervenciones previas tienen pasos asignados. La spec debe pasar a `APROBADA` antes de implementar, según su propio encabezado. |
| 17 | Consistencia interna | PASS | Caso B y C-19 distinguen el fallo confirmado de la escritura ambigua C-46; en esta última no se revoca si se confirma que el token quedó guardado. VD-01 no figura entre criterios ni casos de prueba. Archivos, diseño y casos coinciden. |
| 18 | Reglas no negociables | PASS | K01 se construye en el servidor, no hay secretos ni datos reales en fixtures o evidencia, no se modifica ninguna migración, las suites usan el proyecto desechable, las credenciales pasan por `worker_api` y errores/logs se redactan (§§8-11, «Verificación»). |

## Contradicciones

Ninguna en la versión auditada.

## Hallazgos

Ninguno nuevo. A-09 a A-17 de la ronda 3 quedaron resueltos por las enmiendas aprobadas, la recuperación de escrituras ambiguas, el tratamiento de VD-01 y las precisiones de diseño y seguimiento documentadas en la spec.

## Observación de tamaño

M16.2 probablemente excede ocho horas. D-M16.2-11 registra la decisión expresa del usuario de conservar un solo corte, y la ficha vigente incorpora esa excepción. El plan de implementación deberá organizar etapas verificables.

## Siguiente paso

El usuario puede aprobar esta spec y pasar su estado a `APROBADA`; después corresponde preparar su plan. Esta auditoría no autoriza implementar M16.2 ni realizar acciones externas.
