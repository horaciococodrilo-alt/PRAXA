# Auditoría M04.1 — repositorio existente

Fecha: 2026-09-17
Snapshot auditado: `9483eae`
Fuente normativa: roadmap v2, revisión 2 (en ese momento, el archivo externo `roadmap-microfases-v2-praxa.md`; después se incorporó como `docs/ROADMAP.md` v2.x, hoy archivado fuera del repositorio; no confundir con el `docs/ROADMAP.md` v1 que citan los veredictos de este documento, borrado en M04.2), con las correcciones del spec de M04.1/M04.2.
Alcance congelado: 83 archivos versionados bajo `src/`, `tests/`, `supabase/`, `scripts/`, `proxy.ts` y `docs/`.

`docs/ROADMAP.md` se usa solamente como evidencia histórica. Los veredictos `retirar` son recomendaciones y no autorizan por sí solos una eliminación. En el cierre de G-AUDIT el usuario confirmó que los dos proyectos Supabase existentes —ambos con las once migraciones aplicadas y sin datos que preservar salvo una empresa de prueba— se descartarán después de completar M04.2. El proyecto nuevo empieza limpio. Por eso, para `0002` y `0005`–`0011`, `retirar` significa borrar los archivos versionados en M06.1, no crear migraciones compensatorias ni preservar ese historial. M06.1 debe verificarse contra una base limpia.

## Veredictos por archivo

| Módulo | Veredicto | Razón (citando el v2) | Microfase afectada |
|---|---|---|---|
| `docs/ARCHITECTURE.md` | adaptar | Describe el onboarding de objetivos y un reporte monolítico; M08.1 redefine onboarding como estado de conexión y M05.2 separa K16 en `reliability` y `catalog`. | M05.2, M08.1 |
| `docs/ROADMAP.md` | retirar | Es el roadmap anterior y contradice el camino crítico y los dos productos del v2; M04.2 debe sacar inmediatamente esa fuente de la ruta activa y corregir README. Debe conservarse como historia. | M04.2 |
| `docs/SECURITY.md` | adaptar | La matriz actual sirve como evidencia, pero M06.2 exige RLS más `FORCE RLS` para K01–K12 y M06.3 prohíbe `service_role` en el worker normal. | M06.2, M06.3 |
| `proxy.ts` | conservar | Refresca sesión y redirige sin sustituir autorización; es compatible con la sesión/RLS de M06.2 y con el E2E de registro de M28.1. | — |
| `scripts/check-target.mjs` | adaptar | La verificación previa es útil para M06.1/M06.2, pero hereda la excepción no documentada `SUPABASE_TEST_ALLOW_APP_PROJECT` de `scripts/lib/target.mjs`. | M06.2 |
| `scripts/db-push.mjs` | conservar | Aplica migraciones versionadas y verificadas contra destino, coherente con la base migrable exigida por M06.1. | — |
| `scripts/lib/env.mjs` | conservar | Carga `.env.local` sin imprimir secretos y deja prevalecer CI; apoya M04 y el mínimo privilegio de M26.2. | — |
| `scripts/lib/sql-target.mjs` | adaptar | Protege pgTAP con proyecto desechable y rechazo del proyecto de aplicación, pero su política difiere de `target.mjs`; M06.2 debe unificar una sola regla segura. | M06.2 |
| `scripts/lib/target.mjs` | adaptar | La variable no documentada `SUPABASE_TEST_ALLOW_APP_PROJECT` desactiva la guarda de igualdad para pruebas REST; véase H-M04.1-02. | M06.2 |
| `scripts/prepare-env.mjs` | adaptar | Preserva valores y no filtra secretos, pero informa “todas por completar” aunque `NEXT_PUBLIC_SITE_URL` tiene valor; debe alinearse con el entorno de M06.1. | M06.1 |
| `scripts/run-pgtap.mjs` | conservar | Usa exclusivamente el destino SQL desechable y respeta `begin`/`rollback`; es el ejecutor remoto necesario para las pruebas RLS de M06.2. | — |
| `src/app/(app)/app/contexto/page.tsx` | retirar | Renderiza objetivos y contexto de la entrevista descartada (`requireUser` en línea 22); M08.1/M08.2 reemplazan este recorrido por conexiones y progreso por fuente. | M08.1, M08.2 |
| `src/app/(app)/app/integraciones/page.tsx` | adaptar | La ruta y el estado vacío sirven, pero hoy muestran sistemas declarados; M08.2 exige tarjetas de fuentes, salud, progreso y ramas A/B. | M08.2 |
| `src/app/(app)/app/layout.tsx` | conservar | El shell revalida sesión y resuelve empresa antes de mostrar la app (líneas 32–36), patrón compatible con M06.2 y M28.1. | — |
| `src/app/(app)/app/page.tsx` | adaptar | El inicio debe reflejar el `product_variant` elegido por M03 y los estados de conexión de M08.1. | M03, M08.2 |
| `src/app/(app)/app/reportes/page.tsx` | adaptar | Consulta una tabla real, pero presenta un reporte único; M24a.2 y M24b.2 exigen UIs independientes para `reliability` y `catalog`. | M24a.2, M24b.2 |
| `src/app/(auth)/forgot-password/page.tsx` | conservar | Implementa recuperación de acceso sin revelar existencia de cuenta, compatible con el recorrido de registro/autenticación de M28.1. | — |
| `src/app/(auth)/layout.tsx` | conservar | Es presentación compartida del flujo de autenticación requerido por el E2E de M28.1. | — |
| `src/app/(auth)/login/page.tsx` | conservar | Implementa login y valida `next` como ruta interna (líneas 30 y 42), necesario para M28.1. | — |
| `src/app/(auth)/reset-password/page.tsx` | conservar | Completa recuperación bajo sesión establecida por callback, sin introducir credenciales privilegiadas; compatible con M26.2/M28.1. | — |
| `src/app/(auth)/signup/page.tsx` | conservar | Implementa registro y verificación por correo, inicio explícito del E2E de M28.1. | — |
| `src/app/(auth)/verify-email/page.tsx` | conservar | Presenta los estados del enlace de confirmación requeridos por el flujo de registro de M28.1. | — |
| `src/app/auth/callback/route.ts` | conservar | Intercambia PKCE u OTP y rechaza redirects externos (líneas 24–28); sirve al registro de M28.1 y al retorno seguro exigido por M08.3. | — |
| `src/app/auth/signout/route.ts` | conservar | Cierra sesión sólo por POST, parte del ciclo de autenticación que M28.1 debe recorrer. | — |
| `src/app/favicon.ico` | conservar | Activo neutro compartido por las UIs de M08.2, M24a.2 y M24b.2. | — |
| `src/app/globals.css` | conservar | Base visual reutilizable para onboarding y las dos UIs de reporte de M08.2/M24. | — |
| `src/app/layout.tsx` | conservar | Layout raíz sin decisiones del producto anterior; soporta todo el recorrido visible de M28.1. | — |
| `src/app/onboarding/layout.tsx` | adaptar | El shell y logout son reutilizables, pero debe alojar el onboarding de conexión de fuentes de M08.1/M08.2, no la entrevista. | M08.1, M08.2 |
| `src/app/onboarding/page.tsx` | retirar | Carga `OnboardingWizard` y snapshots de objetivos/contexto (líneas 1–6 y 26–63); M08.1 exige estados por fuente y capability matrix. | M08.1 |
| `src/app/page.tsx` | adaptar | La landing debe usar promesa y copy diferentes para `ads_catalog` y `commerce_reliability`, decisión de M03. | M03 |
| `src/components/app-nav.tsx` | adaptar | La navegación actual incluye “Objetivos y contexto” y un único reporte; M08.2 y M24a.2/M24b.2 requieren conexiones y reportes separados. | M08.2, M24a.2, M24b.2 |
| `src/components/configuration-missing.tsx` | conservar | Hace explícita la falta de las variables públicas sin revelar secretos, compatible con el baseline M04 y M26.2. | — |
| `src/components/edit-context-button.tsx` | retirar | Sólo abre la edición del contexto de entrevista mediante `startContextEdit` (líneas 1–38); no pertenece al onboarding de fuentes de M08.1. | M08.1 |
| `src/components/onboarding-wizard.tsx` | retirar | El wizard implementa empresa, sistemas declarados, objetivos, problemas y restricciones (desde líneas 121 y 289); la entrevista fue descartada y M08.1/M08.2 definen otro producto. | M08.1, M08.2 |
| `src/components/ui.tsx` | conservar | Componentes visuales genéricos reutilizables por M08.2, M24a.2 y M24b.2. | — |
| `src/lib/env.ts` | conservar | Limita la aplicación a URL y clave publishable, coherente con RLS de M06.2 y cero `service_role` en M26.2. | — |
| `src/lib/supabase/client.ts` | conservar | El cliente web usa sólo la clave publishable y la sesión del usuario, requisito de mínimo privilegio de M06.2/M26.2. | — |
| `src/lib/supabase/server.ts` | conservar | El cliente servidor usa clave publishable y cookies; mantiene las consultas bajo RLS de M06.2. | — |
| `src/modules/company/service.ts` | conservar | Resuelve empresa desde la sesión, nunca desde un `company_id` del navegador (líneas 19–22 y 85–89); es base de K01/M06.2. | — |
| `src/modules/identity/session.ts` | conservar | Centraliza identidad verificada con `getClaims()` y revalidación por acción, compatible con M06.2 y M28.1. | — |
| `src/modules/onboarding/actions.ts` | retirar | Sus acciones persisten empresa declarada, sistemas, objetivos y contexto (líneas 56–258); M08.1 reemplaza el contrato por estados de conexión. La empresa se conserva en su módulo propio. | M08.1 |
| `src/modules/onboarding/repository.ts` | retirar | Persiste y activa `company_context_versions`, objetivos y sistemas (líneas 7–10 y 134–253); esas entidades pertenecen a la entrevista descartada que M08.1 sustituye por conexión de fuentes. | M08.1, M06.1 |
| `src/modules/onboarding/schema.ts` | retirar | Define los contratos de objetivos, sistemas declarados y contexto (líneas 1–194), no la máquina de estados/capability matrix exigida por M08.1. | M08.1 |
| `src/modules/reporting/contract/evidence.ts` | adaptar | El ledger y trazabilidad son reutilizables, pero M05.2 exige ligarlos a dos `report_kind`, producto, ventana y cobertura. | M05.2 |
| `src/modules/reporting/contract/findings.ts` | adaptar | La integridad hallazgo→evidencia sirve, pero M05.2/M22 requieren detectores, evaluabilidad y semántica distinta A/B. | M05.2, M22.1 |
| `src/modules/reporting/contract/index.ts` | adaptar | Debe exportar el nuevo K16 y contratos separados definidos en M05.2. | M05.2 |
| `src/modules/reporting/contract/methodology.ts` | adaptar | Las cuatro etapas del plan anterior no son el contrato de los dos reportes; M05.2 fija metodología, umbrales, abstenciones y `narration_mode`. | M05.2 |
| `src/modules/reporting/contract/primitives.ts` | adaptar | Los primitives de conocido/desconocido son útiles para abstención, pero deben alinearse con ventanas, cobertura y estados de M05.2. | M05.2 |
| `src/modules/reporting/contract/report.ts` | adaptar | Define un documento único de seis secciones y carece de los campos K16 que M05.2 exige; debe ser reemplazado por contratos `reliability`/`catalog`. | M05.2 |
| `src/modules/reporting/contract/versions.ts` | adaptar | Conserva versionado separado, pero las versiones deben corresponder al nuevo K16 y metodología de M05.2. | M05.2 |
| `supabase/.gitignore` | conservar | Ignora estado local de Supabase sin ocultar migraciones; compatible con la base versionada de M06.1. | — |
| `supabase/config.toml` | adaptar | Mantiene `private` fuera de Data API, pero sus comentarios aún hablan de `supabase link`/`test db --linked`; M06.1 debe documentar el flujo remoto real. | M06.1 |
| `supabase/migrations/0001_schemas_and_identity.sql` | adaptar | Empresa y membresía son base útil de tenant, pero falta `FORCE RLS`, requisito explícito de M06.2; véase H-M04.1-01. | M06.2 |
| `supabase/migrations/0002_company_context.sql` | retirar | Materializa persistencia de la entrevista en `company_context_versions`, objetivos y sistemas (líneas 1–536); M08.1 la descarta. M06.1 debe borrar este archivo antes de probar la cadena sobre la base limpia. | M06.1, M08.1 |
| `supabase/migrations/0003_reports.sql` | adaptar | Además de carecer de los campos K16 de M05.2, su FK de líneas 31–33 referencia `company_context_versions`, creada por la retirada `0002`; no puede aplicarse sobre `0001` sola. Su corrección es prerequisito de la migración limpia de M06.1; véase H-M04.1-03. | M05.2, M06.1 |
| `supabase/migrations/0004_grants.sql` | adaptar | La matriz explícita es un patrón útil, pero las líneas 31–33, 43–45, 55–56, 59–60 y 66–67/72–73 referencian tablas o funciones de la retirada `0002`; no puede aplicarse sobre el baseline limpio. M06.1 debe reescribirla para K01–K12; véase H-M04.1-03. | M06.1, M06.2 |
| `supabase/migrations/0005_onboarding_writes.sql` | retirar | Sus RPCs de escritura para objetivos y sistemas (líneas 1–121) pertenecen a la entrevista; M08.1 requiere persistencia de conexiones, no declaraciones. | M06.1, M08.1 |
| `supabase/migrations/0006_activation_integrity.sql` | retirar | Refuerza activación y coherencia del contexto de entrevista (líneas 1–344). Sus ideas de integridad pueden reutilizarse, pero estas funciones/tablas no pertenecen a M08.1. | M06.1, M08.1 |
| `supabase/migrations/0007_write_path_locking.sql` | retirar | Serializa y encierra escrituras del contexto descartado (líneas 1–446); no es el modelo de estados por fuente de M08.1. | M06.1, M08.1 |
| `supabase/migrations/0008_admin_activation.sql` | retirar | Añade bypass administrativo a la activación del contexto descartado (líneas 1–105). La política administrativa debe rediseñarse en M06.3/M26.2. | M06.1, M06.3 |
| `supabase/migrations/0009_clone_children_privileges.sql` | retirar | Clona objetivos y sistemas entre versiones del contexto anterior (líneas 1–148); M08.1 no usa esa entrevista. | M06.1, M08.1 |
| `supabase/migrations/0010_context_revision.sql` | retirar | Calcula revisión del contexto y sus listas para el wizard anterior (líneas 1–217); M08.1 requiere revisión/estado por conexión. | M06.1, M08.1 |
| `supabase/migrations/0011_revision_conflict_code.sql` | retirar | Sólo especializa el conflicto de revisión del contexto descartado (líneas 1–101); no corresponde a la máquina de estados de M08.1. | M06.1, M08.1 |
| `supabase/tests/01_tenant_isolation.test.sql` | adaptar | Prueba aislamiento de las seis tablas actuales; M06.2 exige extenderlo a todas las tablas K01–K12 y comprobar `FORCE RLS`. | M06.2 |
| `supabase/tests/02_context_lifecycle.test.sql` | retirar | Prueba el ciclo draft/active/superseded de la entrevista descartada (líneas 1–230), no estados por fuente de M08.1. | M08.1 |
| `supabase/tests/03_privileges.test.sql` | adaptar | La prueba de grants explícitos sirve, pero debe cubrir K01–K12 y quitar tablas retiradas según M06.1/M06.2. | M06.1, M06.2 |
| `supabase/tests/04_company_creation.test.sql` | conservar | Verifica alta idempotente de empresa/membresía, base del tenant exigido por M06.1/M06.2. | — |
| `supabase/tests/05_delete_carveout.test.sql` | retirar | Prueba la excepción administrativa de borrado del contexto descartado (líneas 1–186); M06.3/M26.2 deben definir las excepciones del modelo nuevo. | M06.3, M26.2 |
| `supabase/tests/06_activation_integrity.test.sql` | retirar | Prueba coherencia y activación del contexto anterior (líneas 1–235), no la máquina de estados de M08.1. | M08.1 |
| `supabase/tests/07_context_revision.test.sql` | retirar | Prueba firmas y conflictos de revisión del wizard anterior (líneas 1–232), flujo que M08.1 reemplaza por estados de conexión. | M08.1 |
| `tests/app/concurrency.test.ts` | retirar | El sujeto probado —edición y confirmación del contexto— se retira (líneas 1–431), pero el arnés de dos sesiones coordinadas debe conservarse como patrón reutilizable para callback repetido y reauth en M08.3. | M08.3 |
| `tests/app/email-flows.test.ts` | conservar | Prueba registro, confirmación y recuperación; sigue siendo parte del E2E de M28.1. | — |
| `tests/app/helpers.ts` | adaptar | El aislamiento de usuarios de prueba sirve, pero acepta `SUPABASE_TEST_ALLOW_APP_PROJECT`; debe cerrarse o documentarse según H-M04.1-02. | M06.2 |
| `tests/app/isolation.test.ts` | adaptar | Los casos de dos empresas son valiosos, pero sólo cubren el esquema anterior; M06.2 exige repetirlos para todas las tablas K01–K12 y `FORCE RLS`. | M06.2 |
| `tests/app/onboarding.test.ts` | adaptar | Conservar alta idempotente de empresa (líneas 23–76); retirar persistencia/activación/clonado del contexto (líneas 78–248) y reemplazar por estados por fuente de M08.1/M08.3. | M08.1, M08.3 |
| `tests/app/setup.ts` | conservar | Carga `.env.local` sin sobrescribir CI; sirve a las pruebas remotas de M06.2/M28.1. | — |
| `tests/component/onboarding-wizard.test.tsx` | retirar | Congela guardado por pasos, objetivos y revisión del wizard descartado (líneas 1–319); M08.2 requiere pruebas de tarjetas y progreso de conexiones. | M08.2 |
| `tests/component/setup.ts` | conservar | Setup genérico de componentes, reutilizable por las UIs de M08.2/M24. | — |
| `tests/unit/no-privileged-credentials.test.ts` | conservar | Impide credenciales que omiten RLS bajo `src/`/proxy, requisito de M06.3 y M26.2. | — |
| `tests/unit/onboarding-schema.test.ts` | retirar | Valida objetivos, sistemas declarados y contexto de la entrevista (líneas 1–144); M08.1 necesita estados por fuente y capability matrix. | M08.1 |
| `tests/unit/report-contract.test.ts` | adaptar | Verifica el contrato monolítico anterior; M05.2 exige fixtures de ambos productos, ambos reportes, ventanas, cobertura y narración. | M05.2 |
| `tests/unit/sql-test-target.test.ts` | adaptar | Prueba el destino SQL estricto, pero no cubre la inconsistencia con `SUPABASE_TEST_ALLOW_APP_PROJECT`; debe fijar una política única en M06.2. | M06.2 |
| `tests/unit/supabase-key-formats.test.ts` | conservar | Verifica compatibilidad de claves públicas/secretas sin red; útil para auth y custodia de secretos de M06.3. | — |

## Respuestas obligatorias

### 1. Aislamiento multiempresa

El patrón actual es aprovechable, pero no suficiente para K01–K12:

- `companies` es la raíz del tenant y, correctamente, no tiene `company_id`.
- `company_members`, `company_context_versions`, `company_objectives`, `company_systems` y `reports` tienen `company_id` no nulo.
- No hay otra tabla del producto sin tenant explícito; `auth.users` es administrada por Supabase.
- Las seis tablas tienen RLS habilitado y políticas o denegación por ausencia de política.
- Ninguna usa `FORCE ROW LEVEL SECURITY`.
- K01–K12 aún no existen como conjunto: faltan conexiones, secretos, jobs, checkpoints, raw, enlaces, catálogo, pedidos, GA4 y Meta.

Conclusión: conservar empresa/membresía y el patrón de claves compuestas; adaptar en M06.1/M06.2 para materializar K01–K12, aplicar RLS + `FORCE RLS` a cada tabla y repetir pruebas con dos tenants.

### 2. Autenticación

El código implementa, sin que todavía se haya probado manualmente:

- registro con contraseña y redirect de confirmación (`src/app/(auth)/signup/page.tsx:32`);
- intercambio PKCE y verificación OTP (`src/app/auth/callback/route.ts:36` y `:42`);
- login con contraseña (`src/app/(auth)/login/page.tsx:30`);
- persistencia/refresco mediante cookies SSR y `proxy.ts:24–54`;
- logout sólo por POST (`src/app/auth/signout/route.ts:9`);
- recuperación y cambio de contraseña (`forgot-password/page.tsx:26`, `reset-password/page.tsx:41`).

`src/` y `proxy.ts` usan exclusivamente `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. No existe un cliente privilegiado en la aplicación. Las claves secretas aparecen únicamente en pruebas/herramientas fuera de `src/`.

### 3. Onboarding

Sí: el onboarding actual es la entrevista descartada. Solicita nombre de empresa, sistemas declarados, objetivos, problemas, restricciones y contexto adicional; persiste versiones y exige confirmación. M08.1, en cambio, exige conectar fuentes, persistir estados por fuente y separar ramas A/B.

Despiece solicitado para aprobación:

| Destino | Archivo y evidencia | Motivo |
|---|---|---|
| Conservar | `src/modules/identity/session.ts:20–54` | Identidad verificada independiente de la entrevista; sirve a M06.2/M28.1. |
| Conservar | `src/modules/company/service.ts:29–89` | Empresa y membresía resueltas desde la sesión; base de tenant para M06.1/M06.2. |
| Conservar | `src/lib/supabase/client.ts:7–11`, `server.ts:12–35`, `proxy.ts:24–67` | Clientes publishable, cookies y refresco de sesión. |
| Conservar | `src/app/(auth)/*`, `src/app/auth/callback/route.ts`, `src/app/auth/signout/route.ts` | Registro, confirmación, login, recuperación y logout. |
| Retirar | `src/components/onboarding-wizard.tsx:121–fin` | Wizard de empresa/sistemas/objetivos/contexto. |
| Retirar | `src/modules/onboarding/schema.ts:1–fin` | Contratos de la entrevista y catálogo de sistemas declarados. |
| Retirar | `src/modules/onboarding/actions.ts:56–258` | Acciones de guardado/confirmación de entrevista. |
| Retirar | `src/modules/onboarding/repository.ts:7–253` | Persistencia draft/active/superseded de contexto, objetivos y sistemas. |
| Retirar | `src/app/onboarding/page.tsx:1–65` | Ensambla el wizard y carga snapshots del contexto anterior. |
| Retirar | `src/components/edit-context-button.tsx:1–fin` y `src/app/(app)/app/contexto/page.tsx:21–176` | Edición y visualización del contexto descartado. |
| Retirar | `supabase/migrations/0002_*`, `0005_*`–`0011_*` | Tablas, RPCs, locks, activación, clonado y revisiones del contexto anterior. Como los proyectos anteriores se descartarán y el nuevo empieza vacío, M06.1 debe borrar estos ocho archivos y probar la cadena desde cero. |
| Retirar | `tests/component/onboarding-wizard.test.tsx`, `tests/unit/onboarding-schema.test.ts`, `supabase/tests/02_*`, `05_*`–`07_*`, `tests/app/concurrency.test.ts` | Congelan el comportamiento descartado. |
| Separar/adaptar | `tests/app/onboarding.test.ts:23–76` frente a `:78–248` | Conservar pruebas de empresa idempotente; reemplazar pruebas del contexto por M08.1/M08.3. |

### 4. Contratos preliminares de reportes

No coinciden con K16. El contrato actual describe un único reporte de seis secciones y la tabla usa estados `pending | generating | ready | failed`. No contiene:

- `report_kind: reliability | catalog`;
- `product_variant: ads_catalog | commerce_reliability`;
- `analysis_run_id` ni unicidad `analysis_run_id + report_kind`;
- `window_start`, `window_end`, `window_days`, `minimum_window_days`;
- `coverage_mode: observed | reconstructed_biased | mixed`;
- `narration_mode: template | llm`;
- estado K16 `partial | ready | failed`.

Los primitives de evidencia, desconocidos explícitos y referencias pueden adaptarse. El schema raíz, fixtures, tabla y UI requieren sustitución en M05.2/M24.

### 5. `docs/ROADMAP.md`

Recomendación: moverlo a `docs/historico/ROADMAP-v1.md` y eliminar desde README/arquitectura toda referencia que lo presente como vigente. No se recomienda borrarlo porque explica el origen del código actual; no debe permanecer en `docs/ROADMAP.md` porque asistentes y personas lo interpretarán como fuente activa. Ejecutar el movimiento en M04.2, junto con la corrección de README.

### 6. Pruebas existentes

- Conservar: autenticación por correo, ausencia de credenciales privilegiadas, formatos de clave, alta de empresa y setup genérico.
- Adaptar: aislamiento, privilegios y destino remoto para cubrir K01–K12, `FORCE RLS` y una única política sobre proyectos desechables.
- Retirar/reemplazar: wizard, contratos de entrevista, ciclo de contexto, conflictos de revisión y contrato monolítico de reporte.

Ninguna prueba remota se considera pasada: `test:app`, pgTAP y correo no se ejecutaron en M04.1.

### 7. Scripts

- `db-push.mjs`: conserva historial de migraciones, verifica destino y sigue siendo correcto para M06+.
- `check-target.mjs`: correcto como entrada, pero hereda H-M04.1-02.
- `prepare-env.mjs`: no sobrescribe valores ni imprime secretos; su mensaje inicial es inexacto cuando hay defaults.
- `run-pgtap.mjs`: usa sólo `SUPABASE_TEST_DB_URL`, exige destino desechable, ejecuta archivos ordenados e interpreta TAP; correcto para M06.2.
- `lib/sql-target.mjs`: rechaza siempre el proyecto de aplicación; `lib/target.mjs` y `tests/app/helpers.ts` permiten una excepción no documentada. La política debe unificarse.

### 8. `proxy.ts`

Es el proxy de Next.js 16. Refresca tokens/cookies y redirige visitantes entre rutas públicas/protegidas. No es autorización final: páginas y Server Actions vuelven a validar identidad, y la base aplica RLS. Debe conservarse.

### 9. Dependencias

`npm ls --depth=0` terminó correctamente. Todas las dependencias directas tienen consumidor en código o configuración: Supabase, Next/React, Zod, Tailwind/PostCSS, Vitest/jsdom/testing-library, `pg`, `dotenv`, TypeScript, ESLint y sus tipos. No se recomienda retirar ninguna dependencia en M04.

## Hallazgos que cambian microfases posteriores

### H-M04.1-01 — Las seis tablas carecen de `FORCE ROW LEVEL SECURITY`

`companies`, `company_members`, `company_context_versions`, `company_objectives`, `company_systems` y `reports` habilitan RLS, pero ninguna ejecuta `ALTER TABLE ... FORCE ROW LEVEL SECURITY`. Es el hallazgo estructural de la auditoría.

Impacto: M06.2 debe aplicar y probar `FORCE RLS` en toda tabla tenant-scoped vigente, incluida cada tabla nueva de K01–K12. Debe probar también el rol dueño previsto. Esto no neutraliza una credencial con `BYPASSRLS` como `service_role`; M06.3 debe mantener el worker sin ella y M26.2 auditar su ausencia del runtime.

### H-M04.1-02 — `SUPABASE_TEST_ALLOW_APP_PROJECT` desactiva una guarda sin estar documentada

`scripts/lib/target.mjs:182–190` y `tests/app/helpers.ts:53–60` aceptan que `SUPABASE_TEST_URL` coincida con `NEXT_PUBLIC_SUPABASE_URL` cuando `SUPABASE_TEST_ALLOW_APP_PROJECT=true`, aunque la variable no está en `.env.example` ni en la lista documentada.

Comportamiento actual:

- Si `SUPABASE_TEST_ALLOW_APP_PROJECT=true` pero falta `SUPABASE_TEST_IS_DISPOSABLE=yes-this-project-is-disposable`, `resolveTarget('test')` falla y `tests/app/helpers.ts` bloquea/omite la suite antes de evaluar la excepción.
- `scripts/lib/sql-target.mjs` no reconoce `SUPABASE_TEST_ALLOW_APP_PROJECT`: pgTAP sigue rechazando el proyecto de aplicación incluso cuando las pruebas REST lo aceptarían.

Impacto: M06.2 debe eliminar la excepción o convertirla en una política explícita, documentada y probada. Recomendación: eliminarla y exigir siempre un proyecto de pruebas distinto y desechable.

### H-M04.1-03 — `0003` y `0004` no forman una cadena limpia después de retirar `0002`

La revisión fue estática; no se ejecutó SQL contra ningún proyecto.

- `0003_reports.sql:31–33` crea `reports_context_fkey` hacia `public.company_context_versions`, tabla creada por la retirada `0002_company_context.sql:28–72`. Por tanto, `0003` falla si se aplica después de `0001` sola. Sus otras dependencias —`public.companies`, `private.touch_updated_at()` y `private.is_company_member()`— sí existen en `0001`.
- `0004_grants.sql:31–33` y `:43–45` operan sobre `company_context_versions`, `company_objectives` y `company_systems`; `:55–56` y `:59–60` operan sobre `start_context_draft` y `activate_context_draft`; `:66–67` y `:72–73` operan sobre las dos funciones de enforcement. Todos esos objetos nacen en `0002` (`:28`, `:74`, `:115`, `:143`, `:218`, `:360` y `:451`). `0004` también depende de `reports`, creado por `0003`.

Impacto: antes de ejecutar M06.1, `0003` debe perder la FK al contexto descartado y alinearse con K16/M05.2, y `0004` debe eliminar todos los grants/revokes a objetos retirados y cubrir la topología K01–K12. La aceptación de M06.1 debe incluir aplicar desde cero la secuencia resultante sobre el proyecto limpio.

### H-M04.1-04 — K16 debe conservar `narration_mode`

M05.2 debe incorporar literalmente `narration_mode: template | llm` en K16 y en sus fixtures válidos/inválidos. El primer reporte `reliability` debe poder publicarse con plantilla determinística; por eso M24a.1 depende sólo de M19a.3 y no de M23.4. Perder este campo volvería a acoplar incorrectamente la publicación inicial a la capa LLM.

### H-M04.1-05 — El onboarding implementado pertenece al producto anterior

Impacto: M08.1/M08.2 deben sustituir la entrevista por estados de fuentes y capability matrix. M06.1 debe borrar las ocho migraciones retiradas, corregir `0003`/`0004` y validar la cadena sobre una base limpia.

### H-M04.1-06 — El contrato y la tabla de reportes son anteriores a K16

Impacto: M05.2 reemplaza el contrato; M24a.1/M24b.1 adaptan persistencia/publicación y M24a.2/M24b.2 separan UI.

### H-M04.1-07 — La documentación activa dirige al roadmap superado

Impacto: M04.2 debe mover `docs/ROADMAP.md` a histórico y actualizar README/arquitectura antes de que nuevas microfases tomen instrucciones incorrectas.

### H-M04.1-08 — Las excepciones administrativas son globales

Los triggers efectivos permiten a `service_role`, `supabase_admin` o `postgres`, con `auth.uid()` nulo, borrar contexto no draft y activar administrativamente. No crean una vía para `authenticated`, pero cualquier credencial administrativa conserva alcance global.

Impacto: M06.3 debe eliminar estas excepciones junto con el contexto descartado y diseñar operaciones administrativas acotadas para el modelo nuevo. M26.2 debe verificar cero `service_role` en ejecución normal y rotación/revocación.

## Pendientes de M03

- Copy, promesa y navegación de `src/app/page.tsx`, `src/app/(app)/app/page.tsx` y `src/components/app-nav.tsx` dependen de `product_variant`.
- La UI de integraciones debe ocultar Meta en `commerce_reliability` y mostrarla sólo en `ads_catalog`.
- Contratos/reportes deben incluir ambos productos desde M05.2, pero la rama ejecutada y sus textos finales dependen de M03.
- Ningún veredicto sobre la entrevista depende de M03: ambas ramas usan onboarding de conexiones, no entrevista guiada.

## Contradicciones encontradas

- README presenta `docs/ROADMAP.md` como fuente vigente; el spec lo declara histórico.
- El onboarding existente implementa la entrevista descartada, mientras M08.1 exige conexiones y estados por fuente.
- El contrato existente mezcla todo en un reporte; K16 exige `reliability` y `catalog` separados.
- `.env.example` afirma “ocho variables” pero declara nueve. La novena es `SUPABASE_TEST_IS_DISPOSABLE` y sí se usa.
- Existe además una variable implícita no documentada, `SUPABASE_TEST_ALLOW_APP_PROJECT`, con políticas distintas entre pruebas REST y SQL.
- `supabase/config.toml` comenta un flujo con `supabase link`/`test db --linked`, mientras README y scripts usan `--db-url` y un ejecutor pgTAP propio.
- Tras retirar `0002`, `0003` conserva una FK al contexto eliminado y `0004` conserva permisos sobre sus tablas y funciones; la secuencia actual no puede instalarse sobre una base limpia.

Estas contradicciones están clasificadas y tienen microfase de resolución; ninguna impide completar la auditoría.

## Archivos revisados fuera del universo congelado

Esta sección no amplía ni altera el manifiesto de 83 archivos. Registra defectos encontrados al revisar configuración de raíz y `public/`, con su destino operativo, pero sus filas no participan de la reconciliación 83 = 83.

| Archivo | Veredicto | Razón | Microfase afectada |
|---|---|---|---|
| `README.md` | adaptar | Presenta `docs/ROADMAP.md` como fuente vigente, describe el onboarding y los reportes anteriores y da instrucciones exclusivamente Bash (`export`) pese al entorno local Windows/cmd. M04.2 debe corregir referencias y ofrecer comandos coherentes con los entornos soportados. | M04.2 |
| `.env.example` | adaptar | Declara nueve variables pero anuncia ocho. Además omite `SUPABASE_TEST_ALLOW_APP_PROJECT`; H-M04.1-02 recomienda eliminar esa excepción en M06.2, no normalizarla como configuración segura. M04.2 corrige el conteo y M06.2 cierra la excepción. | M04.2, M06.2 |
| `vitest.config.mts` | adaptar | El proyecto `component` y sus comentarios están definidos alrededor del asistente de onboarding descartado (`:11–13`, `:34–44`). M08.2 debe reemplazar ese foco por la UI de conexiones, manteniendo la configuración `threads` mientras siga siendo necesaria en Windows. | M08.2 |

`tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, `AGENTS.md`, `CLAUDE.md`, `.gitignore` y los cinco SVG de `public/` fueron recorridos y no muestran un defecto funcional que justifique un veredicto adicional. Los SVG son boilerplate sin referencias, pero su presencia no altera el baseline ni requiere una microfase.

## Reconciliación de cobertura

El universo congelado contiene 83 rutas: `src/` 39, `tests/` 13, `supabase/` 20, `scripts/` 7, `docs/` 3 y `proxy.ts` 1. En el paso 7 se comparó bidireccionalmente la tabla contra `git ls-files`: hay 83 filas y 83 rutas únicas, sin faltantes, extras ni duplicados. Cada fila tiene cuatro campos; los únicos veredictos son `conservar`, `adaptar` y `retirar`; todo `adaptar`/`retirar` identifica una microfase y todo `conservar` usa `—`. Las razones citan una microfase concreta del v2 y no quedan marcadores abiertos sin ID. Este documento es el entregable nuevo y no forma parte del snapshot `9483eae`.

La tabla de archivos fuera de alcance es deliberadamente independiente: no suma filas al universo congelado y no modifica la igualdad 83 = 83.

## Cierre de G-AUDIT

G-AUDIT quedó aprobado por el usuario el 2026-09-17 con las correcciones de este cierre. Los veredictos `retirar` quedan autorizados para sus microfases asignadas; no se ejecutó ninguna retirada durante M04.1. La decisión de infraestructura es crear un proyecto Supabase limpio en M04.2, crear el proyecto desechable recién en M06 y borrar los dos proyectos anteriores sólo al final de M04.2, después de que `verify` y la prueba manual de Auth estén documentados.
