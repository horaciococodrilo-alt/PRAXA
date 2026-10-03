# M06.3a — Auditoría de spec 5

- Fecha: 2026-10-01.
- Commit base: `f96b3b3`.
- Spec: `docs/FASES/FASE1/M06.3a/spec.md`, estado **BORRADOR**.
- Hash Git del contenido sin la línea `**Estado:**`: `73916504c73990df7a2d38ff18b7ea7f3c592375`.
- El hash coincide con los auditados en `spec-audit-3.md` y `spec-audit-4.md`. Se volvió a contrastar el árbol actual, las fuentes y el checklist. Los cambios preexistentes de la spec, la spec general y `HALLAZGOS.md`, así como los informes anteriores sin seguimiento en Git, se preservaron.

## Veredicto

**APROBABLE.** Los 18 ítems pasan. No se detectaron contradicciones ni hallazgos nuevos. La spec permanece en BORRADOR y `G-CRYPTO` no está aprobado.

En la tabla, **S** es `docs/FASES/FASE1/M06.3a/spec.md`, **P** es `docs/FASES/FASE1/meta_first/plan.md` y **R** es `docs/FASES/FASE1/meta_first/spec.md`.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | P:210-223 exige CA-21 y CA-23–27; S:475-495 los enumera y asigna la prueba del cliente HTTP de CA-26 a M16.1. |
| 2 | Alcance | PASS | S §Alcance, §Fuera de alcance y §Archivos previstos frente a P:501-526: llavero, cifrado, cliente, repositorio, guardas, suites y documentos previstos; ninguna migración ni ruta OAuth. |
| 3 | Coherencia con la spec general | PASS | R §§5, 7–9, 13b y 14; R:528 exige `db:check:test` y `test:app`, igual que P:793 y S:594-604. Los contratos que consumen M16.1, M16.2 y M28.2a conservan sus responsabilidades. |
| 4 | Decisiones | PASS | S:652-666 registra D-M06.3a-01–11 como decisiones del usuario, sin cambiar CA ni DEC de R. |
| 5 | Trampas | PASS | P:524-526 y S:619-650 cubren IV nuevo, versión ausente diferenciada, pooler, error de Vitest e incertidumbre de rotación. |
| 6 | Intervenciones y acciones reservadas | PASS | P:223, P:764-781 y S:606-617 asignan contraseña y llavero al usuario y reservan push, despliegue y ambos `db:push`, con comprobaciones posteriores. |
| 7 | Verificación | PASS | P:783-803, R:520-541 y S:594-604 exigen `verify`, `db:check:test` y `test:app`; S:417-429 y T-37 impiden que la suite real pase por omisión (CB-06). |
| 8 | Dependencias | PASS | `docs/PROJECT_STATE.md` §Cerradas aprueba G-K01, G-K02-K04 y G-DB-META; sus sesiones en `meta_first/sesiones/` registran las pruebas. K01–K04 y `0012_integrations.sql` están en la rama base. |
| 9 | Lo entregado de verdad | PASS | S §Contexto verificado y S:320-327 se ajustan a los diez campos K04 de `src/modules/integrations/contract/credential.ts:37-60` y al `get_credential`/`rewrap_credential` de `0012_integrations.sql:809-862,1401-1514`. |
| 10 | Pendientes y hallazgos | PASS | S:692-706 y `docs/HALLAZGOS.md` asignan H-M04.1-02, H-E1-09/10/17/36/37; H-E1-36 separa login aquí de endurecimiento en M16c y H-E1-37 declara el límite SQL. |
| 11 | Contexto real | PASS | Se contrastaron referencias de S §Contexto verificado con K01/K04, SQL `0012`, scripts, `package.json`, tests y docs locales; la referencia a H-E1-36 apunta a su entrada actual. |
| 12 | Archivos previstos | PASS | S:443-471 coincide con P:503-518 y sus ajustes aprobados de Q-01/Q-02/Q-09; el lockfile, resolvedor, README y suite app están autorizados. |
| 13 | Diseño suficiente | PASS | S §§2–8 define formatos, tipos, SQL fijo, errores, respuestas, seguridad del destino y semántica del recifrado; S:284-327 fija validación y proyección K04 sin pedir decisiones al implementador. |
| 14 | Verificable | PASS | S:529-592 asigna T-01–T-53 a criterios con comandos existentes en `package.json:10-26`, resultados concretos y casos negativos, incluidos errores, URL, concurrencia y base real. |
| 15 | Sin nada abierto | PASS | S:668-690 declara Q-01–Q-11 cerradas. H-S-01–06 tienen verificación o fase asignada; el login real sigue exigido por T-31. |
| 16 | Ejecutable ahora | PASS | `npm run verify` terminó exit 0 fuera del sandbox: lint, typegen, typecheck, 8 archivos/145 pruebas y build. Los scripts existen en `package.json`; las cuatro variables futuras tienen paso autorizado en `.env.example` (S:410-415), y la intervención de S:611-613 está situada antes de la prueba real. |
| 17 | Consistencia interna | PASS | S:320-327 y T-52:589 proyectan los mismos diez campos K04; S:417-429, C-18:518 y T-31/T-37:563-569 coinciden en suite obligatoria sin skip. |
| 18 | Reglas no negociables | PASS | S §§5–8, §12 y C-20:527 usan K01 para empresa/actor, `worker_api` para credenciales, errores redactados, base desechable y ninguna migración. La URL efectiva y TLS se verifican antes de conectar (S:229-243,329-351). |

## Contradicciones

Ninguna.

## Hallazgos

Ninguno.

## Verificación y siguiente paso

`git diff --check` terminó exit 0. El primer `npm run verify` llegó a Vitest y falló al cargar la configuración por `spawn EPERM` dentro del sandbox, sin ejecutar pruebas. Repetido fuera del sandbox, terminó **exit 0**: 8 archivos, 145 pruebas y build completo. No se corrieron `db:check:test`, `test:app` ni pgTAP en esta auditoría: corresponden a la implementación y a sus gates. No se leyó `.env.local` ni se expusieron valores de entorno.

El siguiente paso es que el usuario apruebe visiblemente la spec y la pase a `APROBADA`; después puede seguir el pipeline de planificación. Esta auditoría no aprueba `G-CRYPTO` ni inicia la implementación. No hay evidencia suficiente para recomendar una división por el límite de ocho horas.
