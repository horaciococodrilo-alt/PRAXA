# Registro de hallazgos

Registro único de hallazgos documentados en la auditoría M04.1, el baseline M04.2, la sesión M04 y la ruta `meta_first`. El detalle y la evidencia completa permanecen en los documentos de cada microfase.

| ID | Estado | Asignación | Fuente |
|---|---|---|---|
| `H-M04.1-01` | Pendiente | M06.2 | [Auditoría M04.1](FASES/FASE1/MF04/m04-1-auditoria.md) |
| `H-M04.1-02` | Pendiente | M06.2 | [Auditoría M04.1](FASES/FASE1/MF04/m04-1-auditoria.md) |
| `H-M04.1-03` | Pendiente | M06.1 | [Auditoría M04.1](FASES/FASE1/MF04/m04-1-auditoria.md) |
| `H-M04.1-04` | Pendiente | M05.2 | [Auditoría M04.1](FASES/FASE1/MF04/m04-1-auditoria.md) |
| `H-M04.1-05` | Pendiente | M06.1, M08.1 y M08.2 | [Auditoría M04.1](FASES/FASE1/MF04/m04-1-auditoria.md) |
| `H-M04.1-06` | Pendiente | M05.2, M24a.1, M24b.1, M24a.2 y M24b.2 | [Auditoría M04.1](FASES/FASE1/MF04/m04-1-auditoria.md) |
| `H-M04.1-07` | Resuelto en M04.2 | M04.2 | [Auditoría M04.1](FASES/FASE1/MF04/m04-1-auditoria.md) |
| `H-M04.1-08` | Pendiente | M06.3 y M26.2 | [Auditoría M04.1](FASES/FASE1/MF04/m04-1-auditoria.md) |
| `H-M04.2-01` | Resuelto | M04.2 | [Baseline M04.2](FASES/FASE1/MF04/m04-2-baseline.md) |
| `H-M04.2-02` | Pendiente | M06.1 | [Baseline M04.2](FASES/FASE1/MF04/m04-2-baseline.md) |
| `H-M04.2-03` | Pendiente | M08.3 | [Baseline M04.2](FASES/FASE1/MF04/m04-2-baseline.md) |
| `H-E1-01` | Pendiente | M16d | [Enmienda 1, Parte I del plan meta_first](FASES/FASE1/meta_first/plan.md) |
| `H-E1-02` | Resuelto en M04a | M04a | [Revisión de código](FASES/FASE1/meta_first/revision-codigo.md) |
| `H-E1-03` | Pendiente | M03a | [Revisión de código](FASES/FASE1/meta_first/revision-codigo.md) |
| `H-E1-04` | Parcial: resuelto en el árbol; historial pendiente de decisión del usuario | M04a | [Plan meta_first, III.7](FASES/FASE1/meta_first/plan.md) |
| `H-E1-05` | Pendiente | M06.1a | [Plan meta_first, III.7](FASES/FASE1/meta_first/plan.md) |
| `H-E1-06` | Pendiente | M06.2a y M28.3a | [Plan meta_first, III.7](FASES/FASE1/meta_first/plan.md) |
| `H-E1-07` | Pendiente (hipótesis) | M06.2a | [Plan meta_first, III.7](FASES/FASE1/meta_first/plan.md) |
| `H-E1-08` | Pendiente | M28.2a | [Plan meta_first, III.7](FASES/FASE1/meta_first/plan.md) |
| `H-E1-09` | Pendiente | M06.3a | [Plan meta_first, III.7](FASES/FASE1/meta_first/plan.md) |
| `H-E1-10` | Pendiente | M06.3a | [Plan meta_first, III.7](FASES/FASE1/meta_first/plan.md) |
| `H-E1-11` | Pendiente | M06.2a | [Plan meta_first, III.7](FASES/FASE1/meta_first/plan.md) |
| `H-E1-12` | Pendiente | Todas | [Plan meta_first, III.7](FASES/FASE1/meta_first/plan.md) |
| `H-E1-13` | Pendiente | M16.1 | [Plan meta_first, III.7](FASES/FASE1/meta_first/plan.md) |
| `H-E1-14` | Resuelto en M04a | M04a | [Sesión M04a](FASES/FASE1/meta_first/sesiones/M04a.md) |
| `H-E1-15` | Resuelto en M04a | M04a | [Sesión M04a](FASES/FASE1/meta_first/sesiones/M04a.md) |
| `H-E1-16` | Resuelto en M04a | M04a | [Sesión M04a](FASES/FASE1/meta_first/sesiones/M04a.md) |


## Detalle de los hallazgos de la ruta `meta_first` registrados en M04a

Impacto y evidencia en una línea cada uno. El contexto completo está en la fuente enlazada.

- **`H-E1-02`** — `AGENTS.md` y la plantilla `prompt-implementacion.md` apuntaban a `docs/microfases/<ID>/`, que no existe. *Impacto:* un asistente que siga la jerarquía no encuentra spec ni plan. *Evidencia:* el `AGENTS.md` anterior, en sus líneas 15 y 16. *Resolución:* M04a corrige ambos archivos a `docs/FASES/FASE1/<MF>/`.
- **`H-E1-03`** — `docs/SECURITY.md` dice que no hay política de borrado ni de retención. *Impacto:* se contradice con DEC-09 una vez aprobado M03a. *Evidencia:* `SECURITY.md`, línea 181.
- **`H-E1-04`** — El ROADMAP de un repositorio público contenía el identificador completo, el nombre del negocio y una magnitud de gasto de la cuenta piloto. *Impacto:* exposición de datos de un tercero. *Evidencia:* búsqueda por patrón `act_[0-9]{6,}`: 2 coincidencias en `docs/ROADMAP.md` de `247cae8` y `f3aa0fe`, y 0 en el árbol actual. *Estado:* el usuario quitó el archivo del árbol en `af1babd`. Siguen pendientes, como decisiones del usuario, la visibilidad del repositorio y la reescritura del historial. Si el ROADMAP vuelve al árbol, antes hay que redactar esos datos.
- **`H-E1-05`** — El plan anterior afirmaba que las migraciones usan `force row level security`. *Impacto:* se habría asumido una protección que no existe. *Evidencia:* 0 de las 11 migraciones en `supabase/migrations/` la contienen.
- **`H-E1-06`** — No hay flujo de baja. *Impacto:* no se puede borrar el usuario antes que su empresa. *Evidencia:* `0001_schemas_and_identity.sql:26` (`owner_id ... on delete restrict`) y `0002_company_context.sql:43` (`created_by` sin acción).
- **`H-E1-07`** — Hipótesis: el `on delete restrict` de `reports` puede romper la cascada al borrar `companies`. *Impacto:* la baja de una empresa podría fallar. *Evidencia:* `0003_reports.sql:33`. Hay que verificarla en M06.2a.
- **`H-E1-08`** — El SMTP por defecto de Supabase solo envía correos a los miembros del equipo. *Impacto:* el dueño no podría registrarse. *Evidencia:* hipótesis basada en la documentación de SMTP de Supabase Auth (https://supabase.com/docs/guides/auth/auth-smtp), citada en la spec, en "Fuentes"; se verifica en M28.2a.
- **`H-E1-09`** — `pg` está en `devDependencies` y la ruta lo usa en producción. *Impacto:* el build de producción puede no incluirlo. *Evidencia:* `package.json`.
- **`H-E1-10`** — `no-privileged-credentials` busca siete nombres fijos en lugar de garantizar una invariante. *Impacto:* una credencial privilegiada con otro nombre no se detecta. *Evidencia:* `tests/unit/no-privileged-credentials.test.ts`.
- **`H-E1-11`** — Desde 2026-10-30, Supabase deja de exponer las tablas nuevas de `public` que no tengan grants explícitos. *Impacto:* las tablas nuevas serían invisibles para la Data API. *Evidencia:* el changelog de cambios que rompen compatibilidad de Supabase (https://supabase.com/changelog?types=breaking-change), citado en la spec, en "Fuentes".
- **`H-E1-12`** — `npm run verify` no ejecuta pgTAP ni `test:app`. *Impacto:* `verify` en verde no prueba aislamiento ni privilegios. *Evidencia:* el script `verify` de `package.json` corre lint, typegen, typecheck, test y build.
- **`H-E1-13`** — La evidencia de M00 no prueba el flujo del producto, porque quien autorizó tenía un rol en la app de Meta. *Impacto:* el flujo real de un tercero sigue sin probarse. *Evidencia:* la spec `meta_first`.
- **`H-E1-14`** — Tras quitar `docs/ROADMAP.md` del árbol, `AGENTS.md`, los dos README, las plantillas, `.env.example` y los agentes `auditor-gate` y `revisor-microfase` seguían citándolo como fuente vigente. *Impacto:* cualquier asistente quedaba bloqueado o revisaba contra un archivo inexistente. *Evidencia:* la sesión de M04a. *Resolución:* en M04a, la Parte I de `meta_first/plan.md` pasa a ser el roadmap vigente y el contrato de ejecución se traslada a `AGENTS.md`.
- **`H-E1-15`** — El encabezado del roadmap vigente todavía presentaba `M04a` como primera microfase ejecutable y `G-DOCS` como aprobación futura, aunque la spec y `PROJECT_STATE.md` ya registraban el cierre. *Impacto:* la contradicción en la fuente de mayor jerarquía activaba una condición de parada antes de `M05.1.1`. *Evidencia:* revisión post-cierre de `plan.md`, línea 4. *Resolución:* el encabezado de plan y el texto de la spec reflejan el gate aprobado, M04a cerrada y M05.1.1 habilitada.
- **`H-E1-16`** — Los enlaces relativos de la plantilla `microfase.md` solo resolvían mientras el archivo permanecía en `_templates`; al copiarla a la ubicación de una microfase apuntaban a rutas inexistentes. *Impacto:* cada documento nuevo generado desde la plantilla nacía con enlaces rotos. *Evidencia:* revisión post-cierre de `docs/_templates/microfase.md`, líneas 9 y 47. *Resolución:* la plantilla usa rutas canónicas en texto, independientes de la ubicación del archivo instanciado.

No se agregan aquí montos, identificadores completos de cuentas, correos ni datos de clientes.
