# M16c: sincronización manual ampliada de Meta Ads

M16c incorpora la sincronización manual diaria de cuenta, campaña, conjunto y anuncio.
Guarda snapshots inmutables, cobertura por nivel y día, metadata y acciones tipadas.
Publica cada nivel bajo posesión y generación de la conexión, y muestra estados parciales sin inventar datos.
La implementación ya está integrada en main; esta descripción sirve para revisar su alcance y el seguimiento documental.

## Criterios y cobertura

| Criterio | Pruebas |
|---|---|
| Aislamiento, ACL, RLS, cascadas y referencias opacas (C-01/02/16/17; CA-46) | pgTAP 09/10/13; T-01/02/24/25/26/31/35 |
| Inicio único, lease, posesión y cambios de conexión en vuelo (C-03/04/15; CA-58/59) | T-03/04/05/22/23 |
| Snapshots, cobertura, ausencia, idempotencia y metadata (C-05 a C-08; CA-41/42/43/45/47) | T-06 a T-12/17/18/38 |
| Precisión y catálogo de cuatro niveles (C-09 a C-12/20/21; CA-44/44b/47b/60) | T-13/14/16/17/18/30/31/32/36/37 |
| Límites, retry, error persistido y privacidad (C-13/14/19; CA-39/56/57) | T-19/20/21/22/29/33/34 |
| Acción, UI y resultado fiel (C-18/22) | T-27/28/33/34/35; QA manual confirmado |

## Verificación

| Comando | Resultado |
|---|---|
| `npm run verify` | Exit 0; 726 pruebas y build completo de 13 páginas |
| `npm run db:check:test` | Exit 0; desechable verificado |
| `npm run test:policies` | Exit 0; 727 aserciones |
| `npm run test:app -- --reporter=verbose` | Exit 0; 75 aprobadas, 7 omitidas ajenas a M16c |
| `npm run test:unit -- tests/unit/__qa__/` | Exit 0; 3 exploratorias, archivo temporal eliminado |

## Riesgos y acciones reservadas

La cuenta real no tiene actividad: la sincronización completó los cuatro niveles con cero filas. D-M16c-02 permite cerrar el gate en ese caso, pero no valida campos ni tipos reales; `H-E1-189` queda como riesgo aceptado temporal y `H-E1-194` se revisa en la primera sincronización con filas. La holgura con actividad y la consulta Graph `ids` no se midieron en la cuenta real.

El usuario ya aplicó 0016 al proyecto app antes de integrar y desplegar la implementación; no hay una migración nueva pendiente por este seguimiento. El usuario confirmó el aviso de éxito, los cuatro niveles y la fecha final en Anuncios → Todas, y autorizó cerrar `G-SYNC`. La decisión sobre cuentas adicionales y gráficos del chat (`H-E1-190`) corresponde a la preparación de M25a.1.

## Cómo revisarlo

Empezar por `M16c/spec.md` y `M16c/plan.md`; seguir con `supabase/migrations/0016_meta_insights.sql`, `src/modules/integrations/meta/insights.ts`, `entities.ts`, la UI de Integraciones y las pruebas pgTAP/app/componentes. La evidencia de publicación y sincronización real está en `meta_first/sesiones/M16c.md`; los informes finales son `implementation-review-3.md` y `qa-review-2.md`. El diff integral de la implementación se obtiene desde `a27f727`, porque main ya la contiene.
