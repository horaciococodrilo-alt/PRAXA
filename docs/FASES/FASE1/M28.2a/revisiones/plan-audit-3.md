# Auditoría de plan — M28.2a — 2026-10-03 (tercera ronda)

- **Commit auditado:** `3cffad3` ("aprobada"). Árbol de trabajo con dos archivos sin comitear que son evidencia de esta auditoría: `revisiones/spec-audit-3.md` (nota aclaratoria) y `revisiones/plan-audit-2.md` (ronda anterior, BLOQUEADO). Se preservan.
- **Hash de contenido de la spec, sin la línea de estado:** `7517041448d9579977406bf7c8cd6d39a954e922`.
- **Hash de contenido del plan, sin la línea de estado:** `78a06808c0cf4205ad34316ffd9f6dbe58b78803`.
- **Veredicto: APROBABLE.** Los 12 ítems están en PASS o NO APLICA justificado.

## Precondiciones

| Precondición | Resultado | Evidencia |
|---|---|---|
| `spec.md` en estado `APROBADA` | PASS | `spec.md:3` dice `**Estado:** APROBADA` (corregido desde `plan-audit-1.md`). |
| La última `spec-audit-N.md` es APROBABLE | PASS | `spec-audit-3.md` (la de número más alto) tiene veredicto APROBABLE. |
| El hash de contenido actual de la spec coincide con el que registra esa auditoría | PASS, con resolución registrada | El hash recalculado (`7517041...`) no coincide con el que `spec-audit-3.md` registró originalmente (`cb4ab933...`), que resultó ser contenido transitorio nunca comiteado (confirmado por búsqueda en los dos commits que tocan `spec.md` y en todos los blobs colgantes del repo, sin coincidencia). Por decisión explícita del usuario, se agregó una nota aclaratoria al final de `spec-audit-3.md` que documenta esto y fija que, a efectos de identidad de contenido, el hash vigente (`7517041...`) es el que audita `spec-audit-2.md` (también APROBABLE). Con esa nota, la precondición queda satisfecha para esta ronda: el contenido vigente de la spec tiene una auditoría APROBABLE que lo identifica correctamente por hash. |
| `plan.md` existe y está en `BORRADOR` | PASS | `plan.md:3` dice `**Estado:** BORRADOR`. |

## Checklist

| # | Ítem | PASS/FAIL/NO APLICA | Evidencia |
|---:|---|---|---|
| 1 | Spec base | PASS | `plan.md:7` cita `spec.md` y el hash `7517041448d9579977406bf7c8cd6d39a954e922`; coincide con el hash recalculado ahora sobre el `spec.md` vigente (idéntico desde `7b2a30f`). La referencia a `spec-audit-2.md` como fuente de ese hash es correcta tras la nota aclaratoria agregada a `spec-audit-3.md`. |
| 2 | Cobertura | PASS | Cada criterio `M28.2a-C-01` a `C-10` aparece en al menos un paso (0–11, incluidos 3R/8b/8c/8d): C-01 en 1,2,8d,11; C-02 en 2,3,9,11; C-03 en 0,3,3R,9,11; C-04 en 4,11; C-05 en 5,7,8b,8c,11; C-06 en 6,7,11; C-07 en 7,11; C-08 en 8,11; C-09 en 8b,8c,11; C-10 en 0,9,10,11. Cada caso `T-01` a `T-11` aparece igual: T-01 en 1,2,8d; T-02 en 2,3; T-03 en 0,3,3R; T-04 en 4; T-05 en 5,7,8b; T-06 en 6,7; T-07 en 8; T-08 en 8b; T-09 en 5,8c; T-10 en 10; T-11 en 0,9,10. Ninguno falta. |
| 3 | TDD | NO APLICA, justificado | La spec excluye explícitamente código y pruebas automatizadas nuevas (`spec.md`, "Fuera de alcance"). El plan lo declara en la sección TDD de "Pasos": "no corresponde un ciclo RED–GREEN de código... Una infraestructura ausente es `NO EJECUTADO`, no un RED válido." No hay pasos con código probable por unit/component salvo el paso 10 (`npm run verify` sobre código ya existente, sin cambios), que no introduce comportamiento nuevo a testear. |
| 4 | Archivos | PASS | La tabla de "Archivos" del plan lista: `plan.md` (autorizado por la Precondición 9 de la ruta: artefactos del pipeline `docs/FASES/FASE1/[ID]/plan.md`); `entorno.md` (II.7, paso 9); `sesiones/M28.2a.md` (Precondición 8, archivos de seguimiento); capturas redactadas con rutas diferidas a paso 9 (autorizado explícitamente por `spec.md:104`: "No fijar nombres de imágenes hasta contar con capturas; sus rutas concretas se listarán en el plan de implementación bajo el paso 9"); `PROJECT_STATE.md` y `HALLAZGOS.md` (Precondición 8). Ningún archivo fuera de esa lista. El plan declara explícitamente "No hay cambios de APIs, tipos, interfaces, código, configuración versionada ni dependencias." |
| 5 | Pasos | PASS | El orden (0 preparación → 1 Vercel → 2 variables → 3 migraciones → 3R rama excepcional → 4 exposición → 5 Auth → 6 SMTP → 7 registro/login → 8 cierre → 8b recuperación → 8c bordes sin sesión → 8d Integraciones → 9 evidencia → 10 verify/diff → 11 cierre de gate) respeta las dependencias de II.7 (no se puede configurar SMTP antes del dominio, ni probar registro antes de Auth/SMTP, ni cerrar el registro antes de haberlo probado). Cada paso tiene columna de verificación propia y distinta de la acción. |
| 6 | Migraciones | NO APLICA, justificado | El plan declara explícitamente que no crea ninguna migración nueva: aplica `0012_integrations.sql` (ya existente) al proyecto `app` mediante el wrapper (`npm run db:push`), previamente verificada en el proyecto desechable. Confirmado contra `supabase/migrations/`: la última es `0012_integrations.sql`; el plan identifica correctamente que el siguiente número sería `0013` sin consumirlo ("ya previsto por la ruta para trabajo posterior; no se consume en M28.2a"). Ninguna migración existente se modifica. |
| 7 | Comandos | PASS | Scripts npm citados (`lint`, `typegen`, `typecheck`, `test`, `build`, `verify`, `db:check`, `db:check:test`, `db:preview`, `db:push`, `db:push:test`) existen todos en `package.json:9-26`. Comandos Git (`git status --short`, `git rev-parse HEAD`, `git diff --check`, `git diff --name-only`, `git diff --cached --name-only`, `git diff --exit-code HEAD -- supabase/migrations/`) son sintácticamente válidos y de uso estándar. III.3 para `M28.2a` exige "`npm run verify`; checklist manual y registro con una dirección externa" (`meta_first/plan.md:798`): cubierto en los pasos 10 y 7/8b. CB-06 aparece en los pasos 0, 3R, 9, 10 y en "Verificación final". |
| 8 | Acciones reservadas | PASS | Push de Git (paso 1, condicional a que el commit no esté publicado), despliegue (pasos 1–3), `db:push` a `app` (paso 3), `db:push:test` (paso 3R, exclusivamente excepcional) y las intervenciones del usuario (pasos 1–8d) están en el paso correcto. La tabla final "Intervenciones del usuario y acciones reservadas" repite cada una con su verificación posterior. |
| 9 | Reglas | PASS | Sin secretos ni datos reales: el plan reitera en cada paso que no se leen/copian valores (`.env.local`, contraseñas, enlaces de correo). Tenant resuelto en servidor: paso 8d usa el onboarding existente (ya resuelve tenant server-side); no se toca código. Credenciales solo por `worker_api`: pasos 2–3 excluyen `service_role` explícitamente ("tampoco sustituir el rol acotado por `service_role`"). Pruebas solo contra el desechable: la única ejecución de pruebas automatizadas posible (`db:push:test`) está acotada a la rama excepcional 3R, explícitamente marcada como no rutinaria. |
| 10 | Trampas | PASS | Trampa de la ruta (SMTP por defecto solo al equipo) cubierta en pasos 6–7 y en "Riesgos" ("Correo engañosamente positivo"). Trampa de Hobby/Vercel (DEC-08) cubierta en "Riesgos" ("Decisiones conservadas"). Trampas de la spec: mensaje genérico de `forgot-password` (pasos 8b/8c), build verde sin variables de Auth (Riesgos, "Evidencia insuficiente"), `config.toml` local no acredita remoto (paso 5, Riesgos), `db:check` no conecta (paso 3, Riesgos), pantalla vacía de Integraciones no prueba credenciales (paso 8d, más la prohibición general de código nuevo en "Qué no se hace" que impide agregar un endpoint de diagnóstico). |
| 11 | Git | PASS | Rama actual `mf/M28.2a` (confirmado por el estado de Git). El plan no incluye ninguna operación de push, commit, despliegue o acción destructiva a cargo del asistente; todas están reservadas al usuario en la tabla final. |
| 12 | Fidelidad | PASS | El plan no agrega alcance: cada paso traza a un punto de II.7 o a un criterio/caso de la spec. La granularidad adicional (8b/8c/8d separando recuperación, casos borde sin sesión e Integraciones) no es alcance nuevo, es descomposición operativa de lo que la spec ya exige en T-05, T-08, T-09 y T-01. No omite nada: los diez criterios y los once casos están cubiertos (ítem 2). |

## Hallazgos

Ninguno. No sobrevive ningún FAIL.

## Observación de tamaño

No se recomienda partir la microfase. El trabajo del asistente es documental y de verificación (preparar, acompañar, registrar evidencia); la ejecución real es del usuario (cuentas, DNS, SMTP, dashboard, dos aplicaciones de migración). Coincide con la observación de `spec-audit-2.md` y `spec-audit-3.md`, que llegaron a la misma conclusión sobre la spec.

## Siguiente paso

El plan es APROBABLE. El usuario puede aprobarlo ("Apruebo el plan de M28.2a: pasá el estado a APROBADO"). Después, elegir modelo y esfuerzo, abrir una sesión nueva y correr `/microfase M28.2a`.
