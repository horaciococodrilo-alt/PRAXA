# M16.1 — Auditoría de la spec, ronda 1

- **Fecha:** 2026-10-12
- **Commit:** `609ea29` (`main`), con la Enmienda M16.1 de la ruta sin comitear en `docs/FASES/FASE1/meta_first/plan.md` y `spec.md`, y `H-E1-114` en `docs/HALLAZGOS.md`
- **Hash de contenido de la spec** (sin la línea de estado): `d23466fe8757c63d4ca1b6d7f6e7c0c8843fba36`
- **Estado de la spec al auditar:** `BORRADOR`
- **Alcance:** la spec de M16.1 y, porque la spec depende de ella, la Enmienda M16.1 de la ruta (ficha, II.9, III.2; CA-29b, CA-30 y la fila OAuth de la sección 14)

## Veredicto

**REQUIERE CAMBIOS.**

La base está en verde y el diseño es ejecutable en general. Las referencias al código son exactas y la spec usa las interfaces que entregaron de verdad M05.1.x, M06.x y M28.2a. Hay cuatro defectos que obligan a corregir antes de aprobar:

- un criterio de cierre que no se puede cumplir con la suite actual (A-01, alta);
- una contradicción interna sobre la redirección del callback (A-02, media);
- un choque no previsto con una prueba existente al modificar `page.tsx` (A-03, media);
- CA-26 quedó absoluta frente al límite de los logs del hosting que declara la enmienda (A-04, media).

## Checklist

| # | Ítem | Resultado | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | La ficha (`plan.md:267`, texto enmendado) exige CA-28 a CA-34 con CA-29b. Todos figuran en "Heredados de la ruta", con CA-29b y CA-30 en su texto enmendado (`meta_first/spec.md:128-134`). Los resúmenes son fieles |
| 2 | Alcance | PASS | Los 10 puntos del alcance corresponden a los pasos 1 a 10 de II.9 enmendada (`plan.md:595-604`). Las decisiones no materiales (reintento único, 80000/80003/80014, `override_default_response_type`) trazan a CA-39, a `M06.3a/spec.md:280` y a H-S-02 |
| 3 | Coherencia con la spec general | **FAIL** | A-04: CA-26 (`meta_first/spec.md:253`) sigue diciendo que ningún código OAuth aparece "en logs", sin acotar, mientras la enmienda acota CA-30 e INV-06 a los logs que produce PRAXA. La regla de D-M16.1-08 y II.10, paso 6 (`GET oauth/revoke`, `plan.md:635`), quedan diferidas a M16.2 con `H-E1-114` (ver A-11) |
| 4 | Decisiones | PASS | D-M16.1-01 a D-M16.1-08 figuran como "Usuario", 2026-10-12. Las que cambian CA-29b y CA-30 (D-03 y D-07) están reflejadas en la enmienda de la ruta, que queda pendiente de aprobación visible |
| 5 | Trampas | PASS | Trampas 1 a 4 de II.9 (`plan.md:610-616`) = trampas 1 a 4 de la spec. La quinta y la sexta (`plan.md:618-620`) = trampas 8 y 18 |
| 6 | Intervenciones y acciones reservadas | **FAIL** | Coinciden con la ficha (`plan.md:270`) y con III.2 (`plan.md:802-803`). `db:push` y `db:push:test` no aplican, y el motivo está escrito (no hay migración). Pero "Merge, push y despliegue" no dice cómo se verifica después: la columna tiene "—" (spec, tabla de intervenciones). Ver A-12 |
| 7 | Verificación | PASS | III.3 para M16.1 (`plan.md:827`) pide `verify` y `test:app` sin autorización real. La spec los incluye y suma `db:check:test` y CB-06 ("Verificación") |
| 8 | Dependencias | PASS | `G-ENTORNO` está aprobado el 2026-10-11 en `PROJECT_STATE.md`, y M16.1 es la siguiente habilitada. `main@609ea29` contiene el merge de `mf/M28.2a` (PR #20). P-01 a P-03 están declarados por el usuario (H-S-12) |
| 9 | Lo entregado de verdad | PASS | Se verificó contra el código: `requireTenantContext`, `OAuthAttemptRejectedError`, `BROWSER_BINDING_COOKIE`, `oauthStateSchema`, `returnPathSchema`, `redactErrorMessage`, `WorkerApiError` con `failureKind`, `preparePendingConnectionWithCredential` y `executePreparedCredentialOperation`, `readCredential`, `SecretValue`, `CredentialKeyring` y las firmas SQL de `0012`. Los casos de la diferencia entre plan y entrega (`client_business_id` obligatorio, la falta de lectura de estado en `worker_api`, `H-E1-24`) quedan resueltos en el diseño |
| 10 | Pendientes y hallazgos | **FAIL** | `H-E1-13`, `-21`, `-22`, `-24` y `-42` quedan resueltos o diferidos con motivo. Pero `H-E1-23` (CB-06 sin delimitar, asignado a "la próxima corrección de la ruta") está abierto, afecta directamente el cierre con `test:app`, y la spec lo contradice al exigir cero omitidas (A-01) |
| 11 | Contexto real | **FAIL** | Todas las referencias al código y a la base son exactas. Las referencias a `plan.md:261`, `:263`, `:375` y `:590` apuntan a la versión comiteada. En el árbol con la enmienda están corridas una línea (`:262`, `:264`, `:376`, `:591`), porque la enmienda agregó la línea 6 del encabezado (A-05) |
| 12 | Archivos previstos | PASS | Cada archivo está en la tabla de II.9 enmendada, en las rutas permitidas por el preámbulo (`plan.md:376`) o en las precondiciones 8 y 9. `SECURITY.md` y `ARCHITECTURE.md` figuran, y la microfase cambia propiedades suyas (controles previstos → vigentes, INV-06, módulos existentes) |
| 13 | Diseño suficiente | **FAIL** | A-02: la redirección al login del callback contradice C-12. A-03: el diseño de `page.tsx` choca con `tests/component/app-paginas-sesion.test.tsx`, que no está entre los archivos previstos |
| 14 | Verificable | **FAIL** | A-01: el resultado esperado de C-28, de T-37 y de "Verificación" ("cero omitidas") no se puede alcanzar con `test:app`. A-06: la afirmación de que los valores sintéticos no disparan `no-secrets-in-tree` es falsa en el uso que describe T-07 |
| 15 | Sin nada abierto | PASS | "Preguntas abiertas" no tiene ninguna; Q-08 quedó resuelta por D-M16.1-08. Cada HIPÓTESIS (H-S-03, -04, -05, -07, -11, -13) dice cómo y cuándo se verifica (VR-01, en M16.2), y ninguna bloquea la implementación con Meta simulada. Los supuestos externos decisivos (v26.0, `config_id`, `/me`, Runtime Logs de Vercel, códigos de límite) citan documentación oficial consultada el 2026-10-12 |
| 16 | Ejecutable ahora | PASS | `npm run verify` sobre `609ea29`, en un worktree temporal porque el árbol tiene cambios sin comitear, ejecutado con `powershell -NoProfile`: exit 0, 21 archivos y 349 pruebas, build OK. Los scripts `test:unit`, `test:component`, `test:app`, `db:check:test` y `verify` existen. Las variables de prueba están en `.env.example`, y las `META_*` se declaran como nuevas. La aprobación de la enmienda figura como intervención previa |
| 17 | Consistencia interna | **FAIL** | A-02: C-12 dice "toda respuesta del callback es 303 a `/app/integraciones`", pero el paso 2 de §6.2 redirige a `/login?next=%2Fapp%2Fintegraciones` |
| 18 | Reglas no negociables | PASS | Tenant con K01 en el servidor, sin parámetros del navegador. Fixtures sintéticos. Sin migraciones. `test:app` solo contra el proyecto desechable, con `resolveIntegrationsTestTarget`, y nunca con `PRAXA_INTEGRATIONS_DB_URL`. Credenciales solo por `worker_api`. Errores con mensaje fijo y redactado (§3, §4) |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| C-28, T-37 y "Verificación": `test:app` "sin pruebas omitidas" y "declara cero omitidas" | Estado real de `tests/app/` y `H-E1-23` (`HALLAZGOS.md:40`, `:434`) | `describe.skipIf(canRun)` en `concurrency`, `email-flows`, `integrations-data-api`, `isolation` y `onboarding`, y el opt-in de `email-flows`. La sesión de M06.3a registra "37 pasadas y 7 omitidas" en cada corrida completa | A-01 |
| C-12: "Toda respuesta del callback es `303` a `/app/integraciones`" | La misma spec, §6.2, paso 2 | Sin sesión: `303` a `/login?next=%2Fapp%2Fintegraciones` | A-02 |
| Diseño §8: `page.tsx` recibe `searchParams` | `tests/component/app-paginas-sesion.test.tsx:72-77`, fuera de los archivos previstos | La prueba llama `Pagina()` sin argumentos y exige que rechace con `SIN_SESION` antes de cualquier lectura | A-03 |
| Heredado "CA-26 (parte HTTP)" y el texto propuesto para INV-06, que la cita como cubierta | CA-26 de la ruta (`meta_first/spec.md:253`), sin enmendar | La enmienda acota CA-30 y la fila de la sección 14, pero no CA-26, que sigue prohibiendo códigos OAuth "en logs" sin distinguir los del hosting. `SECURITY.md:246-248` (§7) también afirma, sin acotar, que el código "no se persiste ni se registra" | A-04 |
| Regla de D-M16.1-08, que §11 documenta como control vigente en `SECURITY.md` §4 | II.10, paso 6 (`plan.md:635`): `GET oauth/revoke` | La revocación por `GET` lleva `client_secret` y el token en la consulta. Está diferida con `H-E1-114`, pero la ruta no lo dice | A-11 (baja; diferimiento explícito) |

## Hallazgos

| ID | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | alta | Criterios (C-28), Casos (T-37), Verificación | El criterio de cierre exige que `test:app` pase "sin pruebas omitidas", y la evidencia, "cero omitidas". La suite actual siempre omite pruebas: los bloques `describe.skipIf(canRun)` de aviso "NO EJECUTADA" y los tres de correo opt-in. Literalmente, `G-OAUTH` no se puede aprobar. Es el mismo problema de `H-E1-23`, que la enmienda no resolvió | `tests/app/*.test.ts` (skipIf en 5 archivos); `sesiones/M06.3a.md:369`, `:399` (37 pasadas, 7 omitidas); `HALLAZGOS.md:434` | Acotar "sin omitidas" a `tests/app/meta-oauth.test.ts` y a las suites remotas positivas. Registrar las omitidas ajenas por archivo, con su motivo, como en `G-DB-META`. O resolver `H-E1-23` en la enmienda precisando CB-06 | Sí: cómo se interpreta CB-06 para este gate, o si se resuelve `H-E1-23` dentro de la enmienda |
| A-02 | media | Criterios (C-12), Diseño §6.2 | C-12 exige que toda respuesta del callback vaya a `/app/integraciones`, pero §6.2, paso 2, manda al login cuando no hay sesión. Ningún caso prueba el callback sin sesión (T-12 no lo incluye) | Spec, C-12 y §6.2, paso 2 | En C-12, admitir también `303` a `/login?next=%2Fapp%2Fintegraciones` sin otro parámetro. Agregar a T-12 el caso sin sesión: login, cookie borrada y ninguna llamada a `consumeOAuthAttempt` ni a `fetch` | No |
| A-03 | media | Diseño §8, Archivos previstos | La prueba existente descubre cada `page.tsx` de `/app`, la llama sin `props` y exige que rechace con `SIN_SESION` antes de leer datos. Si `IntegracionesPage({ searchParams })` desestructura en la firma, o lee `searchParams` antes de `requireAppSession`, la prueba falla con `TypeError`. Corregirla obligaría a tocar un archivo que no está en el plan | `tests/component/app-paginas-sesion.test.tsx:72-77`; `src/app/(app)/app/integraciones/page.tsx:15-16` | Indicar en §8 que la página recibe `props` sin desestructurar en la firma, que llama primero a `requireAppSession('/app/integraciones')` y que lee `await props.searchParams` después. Agregar a T-37 que `app-paginas-sesion` sigue en verde sin cambios | No |
| A-04 | media | Heredados (CA-26), Diseño §11, Enmienda | CA-26 sigue siendo absoluta frente al límite declarado de los logs del hosting. La enmienda acota CA-30 e INV-06, y el texto propuesto para INV-06 cita CA-26 como si ya estuviera acotada. Además, §11 no ajusta el punto de `SECURITY.md` §7 que dice que el código "no se registra" | `meta_first/spec.md:253`; `SECURITY.md:246-248`; D-M16.1-07 ("INV-06 y, por coherencia, CA-30") | Sumar CA-26 a la Enmienda M16.1 con el mismo calificativo ("los que produce PRAXA") y el límite del hosting. En §11, ajustar el punto de §7 de `SECURITY.md` al mismo texto | Sí: la aprobación visible del texto enmendado de CA-26, como extensión de D-M16.1-07 |
| A-05 | baja | Fuentes, Objetivo, Fuera de alcance, Diseño §1 | Las referencias a `plan.md:261`, `:263`, `:375` y `:590` coinciden con la versión comiteada. En el árbol con la enmienda, que es la que cita la spec, apuntan a la línea anterior | La línea 6 del encabezado de `plan.md` agregada por la enmienda; hoy son `:262`, `:264`, `:376` y `:591` | Actualizar las cuatro referencias, o citar por sección (ficha de M16.1, II.9, preámbulo de la Parte II) | No |
| A-06 | baja | Diseño §10, C-27 | La spec afirma que ningún valor sintético dispara `no-secrets-in-tree`. Pero `token-sintetico-meta` tiene exactamente 20 caracteres, y escrito literal después de `?access_token=` (el escenario de T-07) coincide con el patrón `oauth_param` (`{20,}`) | `tests/unit/no-secrets-in-tree.test.ts:13` | Usar un token sintético de menos de 20 caracteres, o exigir que las URLs de los fixtures se armen interpolando la constante y nunca con el valor literal en la consulta | No |
| A-07 | baja | Diseño §7 (`connections.ts`) | `readLiveConnection` no filtra por `company_id` antes de `maybeSingle()`. Si una cuenta perteneciera a dos empresas con conexión viva, la consulta fallaría (varias filas) en vez de leer la del K01. Hoy lo impide `companies_owner_unique`, pero el diseño depende de eso sin decirlo | Spec §7; `SECURITY.md` §12 (una cuenta, una empresa) | Agregar `.eq('company_id', ctx.company_id)` (K01, resuelto en el servidor) y mantener la comprobación posterior | No |
| A-08 | baja | Diseño §6, Casos | `MetaOAuthLogEvent` no enumera los valores de `etapa` ni de `resultado`. Los casos están fuera de orden numérico (T-42 antes de T-41) | Spec §6, "Registro"; tabla de casos | Enumerar `etapa` (por ejemplo, `inicio`, `configuracion`, `consumo`, `canje`, `inspeccion`, `negocio`, `pendiente`, `reauth`) y usar `MetaOAuthOutcome` como `resultado`. Reordenar T-41 y T-42 | No |
| A-09 | baja | Supuestos e hipótesis, Hallazgos relacionados | H-S-03, H-S-05 y H-S-07 se asignan a VR-01 en M16.2, pero solo H-S-13 queda prevista como hallazgo a registrar. III.4 de la ruta no las lista, así que M16.2 podría no verificarlas | Spec, "Hallazgos relacionados", último ítem; `plan.md:836-850` | Incluir H-S-03, H-S-05 y H-S-07 en el hallazgo nuevo que se registra al implementar, con asignación a VR-01 | No |
| A-11 | baja | Enmienda (II.10, paso 6), D-M16.1-08 | M16.1 documenta como control vigente que ninguna URL de salida lleva credenciales. Pero II.10, paso 6, sigue planeando `GET oauth/revoke`, que necesita `client_secret` y el token en la consulta. Está diferido con `H-E1-114`, pero la ruta no lo dice: quien lea solo la ruta en M16.2 encuentra una contradicción | `plan.md:635`; `HALLAZGOS.md`, `H-E1-114` | Agregar en la Enmienda M16.1 una nota en II.10, paso 6, que remita a `H-E1-114` y a D-M16.1-08. Si no, que la spec diga por qué la ruta no se enmienda por D-M16.1-08 | Sí: el texto de la enmienda de la ruta |
| A-12 | baja | Intervenciones y acciones reservadas | El merge, el push y el despliegue no tienen verificación posterior: la columna tiene "—" | Tabla de intervenciones, fila "Merge, push y despliegue" | Indicar la verificación sin datos reales: el despliegue de Vercel queda `Ready`; `GET /api/integraciones/meta/iniciar` responde `405` y `POST` sin `Origin` responde `403`; "Conectar" sigue deshabilitado en producción | No |

(`A-10` no se usa).

## Observaciones que no afectan el veredicto

- **Tamaño.** Probablemente no cabe en 8 horas: ocho módulos nuevos, dos rutas, la página, tres archivos de prueba con unos 42 casos (diez de ellos contra el proyecto desechable) y cinco documentos. Si hace falta partirla, el corte natural es:
  - **M16.1a:** `api.ts`, `errors.ts`, `client.ts` y `tokens.ts`, con sus pruebas unitarias (C-01 a C-07, C-17, C-18, C-31).
  - **M16.1b:** repositorios, `oauth.ts`, rutas, aviso, `test:app` y documentación.

  Partirla es un cambio de la ruta: lo decide el usuario.
- **H-S-13.** Que Graph acepte `POST` en `oauth/access_token` y en `debug_token` se valida recién en VR-01, con la autorización real del dueño. Si falla, ocurre el caso A o el caso B de la trampa 9 (`H-E1-114`). La spec lo declara y asigna la recuperación a M16.2.
- **`src/lib/supabase/server.ts:9-10`.** El comentario afirma "No existe un cliente privilegiado en la aplicación", con el mismo problema que `H-E1-42`. No está en los archivos previstos ni asignado a M16.1. Se menciona solo para que no se lo confunda con el alcance de `H-E1-42`.
- **Limpieza del entorno de auditoría.** El worktree temporal se desregistró de Git (`git worktree list` muestra solo `main`). Su carpeta quedó en el scratchpad de la sesión, porque Windows rechazó las rutas largas de `node_modules`, y está fuera del repositorio.

## Siguiente paso

1. Aplicar a la spec las correcciones técnicas: A-02, A-03, A-05, A-06, A-07, A-08, A-09 y A-12.
2. Pasar por `/grill-me` lo que requiere decisión del usuario:
   - A-01: cómo se interpreta CB-06 o si se resuelve `H-E1-23`;
   - A-04: enmendar CA-26 y el punto de §7 de `SECURITY.md`;
   - A-11: la nota en II.10, paso 6.
3. Volver a auditar (ronda 2) la spec y la enmienda juntas.
