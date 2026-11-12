# M25b — Plan de implementación

**Estado:** APROBADO

**Spec base:** `docs/FASES/FASE1/M25b/spec.md`, aprobada con hash de contenido
`6f99c6ec7275cfc59923d5147a8c336675a100c1`.

## Archivos

El conjunto autorizado es el de «Archivos previstos» de la spec. Si hace falta otro archivo, se
detiene la implementación y se propone el cambio. En especial, están prohibidos diagnóstico,
chat, reporting y migraciones.

## Pasos

### Etapa 1 — Contrato y motor reutilizable

| # | Acción | Archivos | Cubre | Verificación |
|---:|---|---|---|---|
| 0 | Comprobar rama, base limpia, aprobación y archivos prohibidos | docs de M25b | C-11/12 | `git status`, hashes y diff base |
| 1 | Escribir T-01 a T-15 antes del código y registrar rojo por módulo inexistente | `tests/unit/meta-anomalies.test.ts` | C-01 a C-05, C-09/10 | test unit focalizado, exit distinto de 0 por causa esperada |
| 2 | Crear contrato, decimal exacto y constante versionada | `contract.ts`, `decimal.ts` | C-01/03/09/10 | T-04 a T-07, T-12, T-15 verdes |
| 3 | Implementar períodos, gates, reglas y CPA estricto | `detect.ts`, `index.ts` | C-02 a C-05 | T-01 a T-15 verdes |
| 4 | Control de etapa y evidencia | `sesiones/M25b.md` | C-12 | unit focalizado + lint/typecheck |

No se avanza a la etapa 2 si el motor no está verde o si el contrato importa código de pantalla,
Next, Supabase, chat, diagnóstico o reporting.

### Etapa 2 — Adaptador, demo y pantalla

| # | Acción | Archivos | Cubre | Verificación |
|---:|---|---|---|---|
| 5 | Escribir T-16 a T-24 y registrar rojo esperado | tests component/app | C-06 a C-08 | suites focalizadas rojas por componentes/adaptador ausentes |
| 6 | Mapear cobertura real bajo K01/RLS y estados cerrados | `load.ts` | C-02/04/08 | T-22/23 verdes contra desechable |
| 7 | Crear fixture sintético separado y comprobar que no lee datos reales | `demo.ts` | C-07 | T-18/24 verdes |
| 8 | Crear página y componente con todos los estados y evidencia | page, component, CSS | C-05 a C-07 | T-16 a T-20 verdes |
| 9 | Agregar navegación aditiva | `shell.tsx` | C-06/11 | T-21 verde; revisar conflicto con paralelo |
| 10 | Actualizar arquitectura y documentación normativa aprobada | docs previstos | C-01/11/12 | revisión cruzada y diff |
| 11 | Verificación completa y recorrido real/demo | tests y sesión | C-12 | app focalizada, `verify`, T-25/26 |

## Verificación final

1. `npm run test:unit -- tests/unit/meta-anomalies.test.ts`
2. `npm run test:component -- tests/component/app-anomalias.test.tsx`
3. `npm run db:check:test`
4. `npm run test:app -- tests/app/meta-anomalies.test.ts`
5. `npm run verify`
6. `git diff --check` y revisión de archivos prohibidos.
7. Recorrido manual de `/app/anomalias` y `/app/anomalias?ejemplo=1`.

## Intervenciones del usuario y acciones reservadas

- Aprobar enmienda, spec y plan antes del código.
- Hacer los commits que cierren etapas si desea conservar ese corte.
- Hacer push, PR, integración, despliegue y aprobación de `G-ANOMALIES`.
- Coordinar la integración con la rama del diagnóstico. El asistente prepara un diff aditivo y no
  resuelve un conflicto sobrescribiendo el trabajo paralelo.

## Migraciones

No aplica. Si aparece la necesidad de una RPC o persistencia nueva, se detiene M25b.

## Riesgos

- La cuenta real puede no tener datos; el gate se demuestra con pruebas y el modo sintético, sin
  presentarlo como validación real.
- El CPA puede quedar omitido con frecuencia por atribución o días sin compra explícita. Es el
  comportamiento seguro esperado.
- `shell.tsx` es el único archivo de código compartido probable con otro trabajo. El cambio será
  una entrada aditiva y se integrará después de comparar ambas ramas.
- Umbrales heurísticos pueden producir ruido; quedan centralizados y versionados.

## Qué no se hace

No se modifica diagnóstico, chat, reporting, Meta, SQL, RLS, autenticación, integraciones ni la
sincronización. No se hacen commit, push, PR, merge ni despliegue sin autorización.
