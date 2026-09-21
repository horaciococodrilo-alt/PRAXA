# Sesión M04 — auditoría y baseline reproducible

Fecha de cierre: 2026-09-19  
Roadmap aplicable: `roadmap-microfases-v2-praxa.md`, revisión 2  
Resultado: M04.1 y M04.2 cerradas; `G-AUDIT` y `G-BASELINE` aprobados. M05.1 quedó habilitada, pero no se inició.

## 1. Estado inicial

La sesión comenzó sobre el commit `9483eae`, con el árbol Git limpio y un repositorio existente de Next.js 16, TypeScript, Supabase y Vitest. El universo que M04.1 congeló tenía 83 archivos versionados dentro del alcance: 39 en `src/`, 13 en `tests/`, 20 en `supabase/`, 7 en `scripts/`, 3 en `docs/` y `proxy.ts`.

El proyecto no estaba vacío. Ya contenía:

- registro, confirmación de correo, login, recuperación y logout con Supabase Auth;
- empresa y membresía como raíz de tenant;
- un onboarding guardable basado en una entrevista de objetivos, sistemas y contexto;
- un contrato monolítico de reporte;
- once migraciones SQL, políticas RLS, grants y pruebas de aislamiento, onboarding y concurrencia;
- scripts para aplicar migraciones y ejecutar pruebas remotas;
- documentación que presentaba `docs/ROADMAP.md`, correspondiente a la planificación anterior de 27 microfases, como fuente vigente.

El historial y el roadmap anterior afirmaban que varias capas de base y pruebas remotas habían sido verificadas. M04 no tomó esas afirmaciones históricas como prueba actual: la auditoría fue estática y no ejecutó `db:push`, pgTAP, `test:policies` ni `test:app`. Al comenzar tampoco estaba validado el flujo manual completo de Auth contra el proyecto Supabase nuevo, no existía CI, no había instalación limpia reproducida fuera del checkout y el runtime no estaba declarado mediante `.nvmrc` y `engines`.

Había además una divergencia de producto. El código implementaba la entrevista y un reporte único, mientras el roadmap v2 define onboarding por conexiones y dos reportes separados, `reliability` y `catalog`, para uno de dos `product_variant`. La selección de producto de M03 no estaba cerrada. Esta diferencia convirtió gran parte del código existente en material para conservar, adaptar o retirar, no en una base que pudiera prolongarse sin revisión.

## 2. Ejecución cronológica de M04.1

### Paso 1 — Confirmación del punto de partida

Se comprobó que el roadmap v2 era legible, que `HEAD` seguía en `9483eae` y que el árbol estaba limpio. La razón fue evitar una auditoría sobre un estado móvil o sobre una planificación distinta de la aprobada. También se confirmó que el repositorio real estaba entonces en `C:\Users\Simon\OneDrive\Escritorio\PRAXA`; la ruta alternativa indicada inicialmente no existía.

### Paso 2 — Inventario congelado

Se generó el manifiesto con `git ls-files` para las rutas dentro del alcance. El resultado fue exactamente 83 archivos. Congelar el inventario antes de escribir la auditoría permitió reconciliar después la tabla de veredictos en ambas direcciones: ningún archivo omitido, agregado dos veces o incorporado retrospectivamente.

### Paso 3 — Jerarquía de instrucciones y requisitos

Se leyeron completos `AGENTS.md`, `CLAUDE.md`, `README.md`, `.env.example` y los requisitos aplicables del roadmap v2. `AGENTS.md` y `CLAUDE.md` no contenían una planificación anterior que contradijera el v2; el riesgo activo estaba en `docs/ROADMAP.md` y en referencias del README que lo presentaban como vigente.

Se detectó también que `.env.example` anunciaba ocho variables pero declaraba nueve. La novena era `SUPABASE_TEST_IS_DISPOSABLE`, usada por las guardas de los scripts y pruebas remotas. El comentario incorrecto quedó fuera de M04.2 por decisión explícita: era un typo sin impacto operativo.

El propósito de este paso fue separar instrucciones para asistentes, documentación histórica y fuente normativa. Desde ese momento, cada veredicto de auditoría se vinculó a una microfase concreta del v2 y `docs/ROADMAP.md` dejó de ser autoridad.

### Paso 4 — Autenticación, tenant y SQL

Se auditó `src/`, `proxy.ts` y la cadena de migraciones sin ejecutar operaciones contra Supabase. Se confirmó que la aplicación web usa clave pública y sesión de usuario, que las páginas y acciones vuelven a validar identidad y que `proxy.ts` refresca cookies y redirige, pero no reemplaza la autorización de la base.

La raíz de tenant existente —empresa y membresía— resultó aprovechable. Las seis tablas tenían RLS habilitado, pero ninguna tenía `FORCE ROW LEVEL SECURITY`, lo que originó H-M04.1-01. También se revisaron las excepciones `SECURITY DEFINER`: las ramas para `service_role`, `supabase_admin` y `postgres` eran operaciones administrativas globales sobre el contexto anterior. No abrían una vía para `authenticated`, pero una credencial con `BYPASSRLS` mantenía alcance global. Por eso el problema no se trató como escape disponible para un usuario común, sino como diseño administrativo demasiado amplio que M06.3 debe retirar y M26.2 debe mantener fuera del runtime normal.

La revisión de dependencias entre migraciones encontró que retirar el onboarding anterior rompía la cadena limpia: `0003` conservaba una FK a una tabla creada por `0002`, y `0004` seguía otorgando permisos sobre objetos de `0002`. Ese defecto se registró como H-M04.1-03.

### Paso 5 — Onboarding, reportes, pruebas, scripts y dependencias

Se separó expresamente lo que pertenece al producto anterior de lo que sigue siendo infraestructura válida:

- se conserva Auth, empresa, membresía, el shell, utilidades genéricas y los patrones de aislamiento;
- se retiran en sus microfases el wizard de entrevista, sus contratos, persistencia, migraciones y pruebas;
- se adaptan navegación, integraciones y reportes al onboarding por fuentes y a los dos `report_kind`;
- se reutilizan ideas de evidencia y valores desconocidos, pero no el contrato monolítico del reporte.

El análisis de imports, configuración y `npm ls --depth=0` no encontró dependencias directas claramente removibles. Los scripts tenían funciones útiles, pero sus guardas no eran uniformes. En particular, `SUPABASE_TEST_ALLOW_APP_PROJECT` permitía que las pruebas REST aceptaran el mismo proyecto que la aplicación si además estaba marcado como desechable; pgTAP no aceptaba esa excepción. La variable no estaba documentada y originó H-M04.1-02.

Se corrigió además una dependencia futura del roadmap: K16 en M05.2 debe incluir literalmente `narration_mode: template | llm`. La razón es que el primer reporte `reliability` debe poder publicarse con narración determinística sin esperar la capa LLM de M23.4. Si se pierde ese campo, M24a.1 vuelve a quedar acoplada incorrectamente a M23.4.

### Pasos 6 y 7 — Documento, reconciliación y hallazgos

Se creó `docs/auditoria-m04.md` con una fila por cada archivo del snapshot, usando sólo `conservar`, `adaptar` o `retirar`. Cada adaptación o retiro quedó asignado a una microfase; los archivos conservados usan `—`. La tabla fue reconciliada contra el manifiesto: 83 rutas únicas, cuatro campos completos por fila y ninguna ruta faltante o extra.

El documento respondió las nueve preguntas obligatorias, registró contradicciones y pendientes de M03, y distinguió evidencia estática de comportamiento efectivamente probado. Esta distinción fue importante para no declarar seguridad o funcionamiento remoto sólo porque hubiera código o pruebas escritas.

### Paso 8 — G-AUDIT

El usuario aprobó los veredictos de retiro. Se decidió que `0002` y `0005`–`0011` se eliminarán en M06.1, no mediante migraciones compensatorias: los dos proyectos Supabase anteriores no contenían datos que hubiera que preservar y serían descartados después de cerrar M04.2. La cadena resultante deberá probarse desde cero sobre una base limpia.

`G-AUDIT` quedó aprobado y M04.1 se cerró en el commit `702a2dc` (`docs: close M04.1 audit`). La aprobación autorizó los retiros para sus microfases asignadas; M04.1 no ejecutó ninguno.

## 3. Ejecución cronológica de M04.2

### Runtime y compatibilidad

Se confirmó Node `v24.18.1`. `.nvmrc` quedó fijado exactamente en `24.18.1` para que desarrollo y CI usen el mismo parche. `package.json` recibió únicamente `engines.node: ">=24 <25"`: el rango acepta actualizaciones de parche y minor dentro de Node 24 sin afirmar compatibilidad con Node 25. El README se corrigió a “Node.js 24.x” para no contradecir ese rango.

No se cambiaron dependencias, `package-lock.json` ni scripts npm. El bloque `scripts` se comparó estructuralmente con `HEAD` y permaneció idéntico; `verify` conserva `typegen` antes de `typecheck`.

### Workflow y prueba de variables de build

Antes de escribir el workflow se ejecutó el build con las tres `NEXT_PUBLIC_*` sin valores. Next informó que leía `.env.local`, pero el build terminó correctamente; por eso el CI no necesita secretos de aplicación. Incluir secretos innecesarios habría ampliado exposición sin aportar cobertura.

Se creó `.github/workflows/verify.yml` para `push` y `pull_request` sobre `main`, con cancelación por workflow/ref, permisos `contents: read`, `ubuntu-latest`, `actions/checkout@v7`, `actions/setup-node@v7`, caché npm, `npm ci` y `npm run verify`. Se eligió Ubuntu para probar independencia de la máquina Windows y consumir menos minutos, no para replicar el entorno local.

### H-M04.2-01 y traslado fuera de OneDrive

El checkout en OneDrive produjo tres incidentes: `EPERM` durante `npm ci`, `EPERM` sobre `.next\trace` durante el build y una carrera de sincronización que eliminó una copia sin valores de `.env.local`. Esto impedía que T-M04.2-01 midiera el proyecto y no al sincronizador.

El usuario decidió mover el repositorio a `C:\Users\Simon\dev\PRAXA` mediante `robocopy /E /MOVE`, excluyendo `node_modules` y `.next`, y luego ejecutó `npm ci`. El asistente no movió el repositorio ni cambió OneDrive. Desde entonces todas las operaciones se hicieron en la ruta nueva. H-M04.2-01 quedó resuelto.

Se estableció una regla permanente: sólo el usuario edita `.env.local`; ningún paso lo mueve, renombra, vacía o modifica. En la prueba de clon limpio se autorizó únicamente copiarlo como archivo opaco y borrar esa copia temporal.

### Limpieza de la documentación activa

Por decisión del usuario, `docs/ROADMAP.md` se eliminó con `git rm` en lugar de trasladarse a histórico. Git ya conserva su historia y el usuario tiene otra copia; mantenerlo dentro de `docs/` seguía siendo un riesgo para personas y asistentes. Del README se quitaron sólo las dos referencias que lo presentaban como vigente. La descripción antigua de onboarding y reportes quedó para sus microfases correspondientes.

### Baseline local

Después del traslado, `npm run verify` pasó lint, typegen, typecheck, 63 tests en 6 archivos y un build de 14 rutas. En algunas primeras corridas después de `npm ci`, Vitest no pudo iniciar el worker de `tests/component/onboarding-wizard.test.tsx`; los otros 54 tests pasaron. El reintento inmediato completó la suite. Se clasificó como timeout transitorio compatible con el antivirus escaneando `node_modules`, no como defecto reproducible: el procedimiento acordado permite un reintento antes de clasificarlo.

T-M04.2-03 confirmó compatibilidad entre Node, `.nvmrc` y `engines`; T-M04.2-04 confirmó la identidad de scripts y el orden de `verify`; T-M04.2-05 confirmó que `.env.local` está ignorado por `.gitignore`, ausente de `git ls-files` y que `package-lock.json` no cambió.

### Proyecto Supabase nuevo y Auth

El usuario creó el proyecto Supabase nuevo en la región America/São Paulo, configuró Site URL y Redirect URLs locales con comodín, mantuvo Email provider con confirmación activada y cargó manualmente las tres variables de aplicación en `.env.local`. No cargó variables `SUPABASE_TEST_*` ni `SUPABASE_DB_URL`.

La base se dejó deliberadamente sin migraciones: M04.2 validaba Auth, no la topología SQL futura. Los seis pasos manuales pasaron:

1. registro y envío del correo;
2. confirmación y creación de sesión;
3. login;
4. persistencia de sesión tras refresh;
5. logout mediante `POST /auth/signout`;
6. segundo login.

Después de confirmar o iniciar sesión, la aplicación falló al consultar `public.companies`, que no existe en la base vacía. Se registró como H-M04.2-02 y no como fallo de Auth. Un aviso separado de hidratación mostró el atributo `cz-shortcut-listen` inyectado en `<body>` por una extensión del navegador; no se atribuyó al proyecto ni a Supabase.

### Commit candidato y clon limpio

El baseline de implementación se concentró en el commit `b27da5c` (`chore: establish M04 baseline`), con seis cambios: workflow, `.nvmrc`, README, eliminación del roadmap anterior, baseline y `engines.node`. Antes del commit, `npm run verify` pasó tras el único reintento permitido por el timeout conocido.

El commit exacto `b27da5c` se clonó con `--no-hardlinks` en `%TEMP%`, fuera de OneDrive y del checkout principal. `npm ci` terminó con código 0, instaló 471 paquetes y encontró 0 vulnerabilidades. `.env.local` se copió al clon sin abrirlo ni mostrarlo. La primera ejecución de `npm run verify` pasó con código 0: lint, typegen, typecheck, 63 tests y build de 14 rutas. Luego se eliminó únicamente la copia temporal de `.env.local`.

La evidencia se añadió en un commit separado, `8203493` (`docs: record M04.2 clean-clone evidence`), porque enmendar `b27da5c` habría cambiado el SHA probado y habría dejado el documento apuntando a un commit que nunca se verificó.

### CI remoto y cierre operativo

Se hizo push de `main`. GitHub Actions ejecutó el workflow sobre el commit `8203493`: run `35456743013`, conclusión `success`, job `verify` de 54 segundos y ningún paso fallido. El único aviso fue la migración futura de `ubuntu-latest` a Ubuntu 26; no afectó el resultado.

Después del CI verde, el usuario eliminó los dos proyectos Supabase anteriores. El proyecto nuevo quedó como único proyecto y es el referenciado por el `.env.local` administrado por el usuario. El cierre de CI, la eliminación de los proyectos viejos y la aprobación de `G-BASELINE` quedaron registrados en `docs/baseline-m04-2.md` y en el commit `1b38042` (`docs: close M04.2 baseline`).

## 4. Decisiones y justificación

| Decisión | Justificación |
|---|---|
| Usar el roadmap v2 como única fuente normativa | El roadmap anterior describe otro producto y podía dirigir nuevas microfases en sentido incorrecto. |
| Auditar un snapshot de 83 archivos antes de cambiar código | Permite cobertura verificable y evita que el alcance cambie mientras se clasifica. |
| No ejecutar SQL ni pruebas remotas en M04.1 | M04.1 era una auditoría estática; ejecutar contra proyectos existentes habría mezclado evidencia con cambios externos y riesgo de datos. |
| Conservar Auth, empresa y membresía; retirar la entrevista | Auth y la raíz de tenant sirven al roadmap v2; objetivos, sistemas declarados y contexto pertenecen al producto anterior. |
| Exigir `narration_mode: template | llm` en K16 | Permite publicar `reliability` con plantilla antes de construir la capa LLM. |
| `.nvmrc` exacto y `engines.node` como `>=24 <25` | El pin hace reproducible el entorno; el rango admite parches/minors de Node 24 sin prometer Node 25. |
| Ejecutar CI en Ubuntu | Comprueba portabilidad respecto de Windows y reduce consumo de minutos. |
| No incluir secretos en CI | El build pasó sin las tres variables públicas; no había necesidad técnica de exponerlas al workflow. |
| Disparar sólo `push` y PR hacia `main`, con concurrency | Evita la duplicación no deseada y cancela corridas superpuestas del mismo ref. |
| Mover el checkout fuera de OneDrive | Tres incidentes demostraron que la sincronización impedía una baseline reproducible. |
| Reservar `.env.local` al usuario | Reduce riesgo de pérdida o exposición de secretos; el asistente no lo lee ni lo modifica. |
| Borrar `docs/ROADMAP.md` en lugar de archivarlo | Git conserva el historial y una copia externa existe; dentro del repo seguía siendo una fuente activa riesgosa. |
| Dejar el typo “ocho variables” fuera de alcance | No afectaba ejecución ni seguridad; cambiarlo habría ampliado innecesariamente M04.2. |
| Crear un proyecto Supabase limpio sin migraciones | Auth podía probarse aisladamente y M06.1 necesita validar una cadena rediseñada desde cero. |
| Tratar la ausencia de `public.companies` como no bloqueante | Era la consecuencia prevista de una base vacía, no un fallo del flujo de Auth. |
| Permitir un único reintento del timeout de Vitest | El fallo era transitorio y reproducía el patrón posterior a una instalación limpia; reintentos ilimitados ocultarían defectos reales. |
| Mantener separado el commit de evidencia del clon | Conserva la correspondencia entre la evidencia y el SHA realmente probado. |
| Borrar los proyectos Supabase viejos sólo después del CI verde | Permitió conservar una vía de referencia hasta que el baseline nuevo quedó comprobado local y remotamente. |

## 5. Hallazgos que condicionan trabajo posterior

### H-M04.1-01 — Falta `FORCE ROW LEVEL SECURITY`

Las seis tablas existentes habilitan RLS, pero ninguna fuerza su aplicación al dueño de tabla. Importa porque RLS habilitado no cubre todos los contextos de ejecución y porque K01–K12 ampliará la superficie tenant-scoped. Quedó asignado a M06.2, con la obligación de aplicar y probar `FORCE RLS` en cada tabla vigente y nueva; M06.3 y M26.2 deben además impedir `service_role` en el runtime normal. Si se ignora, un rol dueño o una ruta privilegiada podría omitir el aislamiento que las pruebas de usuario común aparentan garantizar.

### H-M04.1-02 — Guarda de proyecto de pruebas desactivable y no documentada

`SUPABASE_TEST_ALLOW_APP_PROJECT` permite a las pruebas REST aceptar el proyecto de aplicación cuando también se declara desechable. Si la variable está activa pero falta `SUPABASE_TEST_IS_DISPOSABLE=yes-this-project-is-disposable`, la ejecución se bloquea antes de evaluar la excepción. pgTAP nunca reconoce el bypass, de modo que REST y SQL aplican políticas diferentes.

Quedó asignado a M06.2, con recomendación de eliminar la excepción y exigir siempre un proyecto de pruebas separado y desechable. Si se ignora, una configuración implícita puede ejecutar pruebas destructivas o contaminantes contra el proyecto de aplicación y dar una falsa sensación de protección uniforme.

### H-M04.1-03 — Cadena de migraciones rota después de retirar `0002`

`0003_reports.sql` referencia `company_context_versions`, creada por `0002`, y `0004_grants.sql` opera sobre tablas y funciones que también nacen en `0002`. Al retirar el onboarding anterior, la secuencia deja de poder instalarse desde cero.

Quedó asignado a M06.1, con trabajo relacionado en M05.2 para alinear `reports` con K16 y en M06.2 para rehacer grants. Si se ignora, el proyecto Supabase limpio fallará durante la migración y el esquema no será reproducible, aunque un proyecto antiguo con toda la historia todavía parezca funcionar.

### H-M04.2-01 — OneDrive impedía una verificación reproducible

Los `EPERM` de instalación y `.next\trace`, más la carrera que eliminó la copia de `.env.local`, mostraron que el checkout sincronizado introducía fallos ajenos al código. Se resolvió dentro de M04.2 moviendo el repositorio a `C:\Users\Simon\dev\PRAXA` y reinstalando desde el lockfile. Si se hubiera ignorado, T-M04.2-01 seguiría siendo intermitente y cualquier diagnóstico de build o instalación mezclaría defectos del proyecto con bloqueos del sincronizador.

### H-M04.2-02 — El proyecto nuevo no tiene `public.companies`

El proyecto Supabase nuevo se creó sin migraciones. Auth funciona, pero las rutas posteriores consultan `public.companies` y fallan en el schema cache. Quedó asignado a M06.1, que debe aplicar la cadena corregida sobre la base limpia. Si se ignora, los usuarios podrán autenticarse pero no entrar a la aplicación; además se podría diagnosticar erróneamente como fallo de login lo que en realidad es ausencia de esquema.

## 6. Estado del roadmap al cerrar la sesión

### Cerrado

- **M04.1 — Auditoría:** cerrada en `702a2dc`; `G-AUDIT` aprobado, inventario 83/83 reconciliado y retiros autorizados para sus microfases.
- **M04.2 — Baseline:** cerrada en `1b38042`; T-M04.2-01–06 en `PASS`, instalación limpia en `PASS`, CI remoto en `success` y `G-BASELINE` aprobado.
- **M04 — Baseline reproducible:** cerrado como fase agregada. Su gate habilita M05.1.

### Habilitado pero no iniciado

- **M05.1 — Contratos K01–K12:** ya no está bloqueada por M04. No se inició porque el usuario pidió detener la sesión después del cierre documental.

### Pendiente o bloqueado por dependencias

- **M00–M03:** no se cerraron en esta sesión. M03 sigue pendiente de los resultados de M00, M01.2 y M02.2 y de la aprobación del `product_variant`, datos, retención, borrado, límites y consentimiento. Esto bloquea conexiones con datos reales y la metodología comercial definitiva, pero no el inicio técnico de M05.1.
- **M05.2:** bloqueada por M05.1 y, para su cierre definitivo, por M01.2 y M03. Debe incorporar los dos reportes y `narration_mode`.
- **M06.1:** bloqueada por M05.1 y condicionada por H-M04.1-03. Antes de validarla debe existir una cadena limpia sin las migraciones retiradas y con `reports`/grants coherentes con los contratos vigentes.
- **M06.2:** bloqueada por M06.1. Debe resolver H-M04.1-01 y H-M04.1-02 con `FORCE RLS`, pruebas de dos tenants y una única política segura para destinos de prueba.
- **M06.3 y posteriores:** permanecen bloqueadas por sus dependencias del roadmap. Las excepciones administrativas globales y la ausencia de `service_role` en ejecución normal se resuelven en M06.3/M26.2.
- **M08.1/M08.2:** bloqueadas por contratos y base segura. Deben reemplazar la entrevista por estados de conexión, progreso por fuente y capability matrix; no deben extender el wizard anterior.
- **M24a.1:** no debe quedar bloqueada por M23.4 cuando use `narration_mode=template`; ésa es una corrección de dependencia que M05.2 debe preservar.

No se inició M05.1 ni ninguna otra microfase después de M04.
