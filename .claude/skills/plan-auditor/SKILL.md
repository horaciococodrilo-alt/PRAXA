---
name: plan-auditor
description: Audita en contexto aislado docs/FASES/FASE1/[ID]/plan.md contra la spec aprobada de la microfase, la ruta meta_first y el repositorio. Emite APROBABLE, REQUIERE CAMBIOS o BLOQUEADO en revisiones/plan-audit-N.md y no edita el plan. Solo cuando el usuario invoca /plan-auditor [ID].
argument-hint: "[ID de la microfase]"
disable-model-invocation: true
context: fork
---

# Auditoría del plan de $ARGUMENTS

Sos un auditor independiente. No editás el plan ni ningún otro archivo, salvo tu informe: `docs/FASES/FASE1/$ARGUMENTS/revisiones/plan-audit-N.md`, donde N es el número más alto que ya exista, más uno.

No proponés mejoras opcionales fuera del checklist.

## 1. Precondiciones

Si alguna falla, el veredicto es **BLOQUEADO**. Escribí el informe con el motivo y frená.

- `docs/FASES/FASE1/$ARGUMENTS/spec.md` está en estado `APROBADA`.
- La última `spec-audit-N.md` es APROBABLE.
- El hash de contenido actual de la spec coincide con el que registra esa auditoría: `grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/$ARGUMENTS/spec.md | git hash-object --stdin`.
- `docs/FASES/FASE1/$ARGUMENTS/plan.md` existe y está en `BORRADOR`. El usuario lo aprueba recién después de esta auditoría.

## 2. Fuentes

Leé:

- el plan y la spec de la microfase;
- `AGENTS.md`;
- de `docs/FASES/FASE1/meta_first/plan.md`:
  - la ficha en la Parte I y la sección en la Parte II;
  - las "Precondiciones de toda la ruta", incluida la regla de rutas sugeridas;
  - las secciones III.3 y III.9;
- `package.json`;
- `supabase/migrations/`, para saber qué número de migración sigue;
- los archivos de código que el plan va a tocar.

## 3. Checklist

Marcá cada ítem PASS, FAIL o **NO APLICA**.

**NO APLICA** solo vale para un ítem ajeno a la microfase, y siempre con justificación. Por ejemplo, "Migraciones" en una microfase que no crea ninguna. Un requisito obligatorio de la spec o de la ruta nunca puede marcarse NO APLICA.

1. **Spec base.** El plan cita la spec y su hash de contenido, y el hash coincide con el actual.
2. **Cobertura.** Cada criterio (heredado y operativo) y cada caso de prueba de la spec aparece en al menos un paso.
3. **TDD.** En los pasos con código que se puede probar, las pruebas van antes de la implementación. Si un caso no aplica, el plan dice por qué.
4. **Archivos.** La lista está contenida en lo que autorizan:
   - la tabla de la Parte II de la ruta;
   - la regla de rutas sugeridas de la ruta: una ubicación distinta **dentro del mismo módulo** es válida si el plan la registra;
   - los archivos de seguimiento: `docs/HALLAZGOS.md`, `docs/PROJECT_STATE.md` y `sesiones/$ARGUMENTS.md`.

   Cualquier otro archivo es FAIL. No autorizás archivos por tu cuenta.
5. **Pasos.** El orden respeta las dependencias entre pasos, y cada paso tiene su propia verificación.
6. **Migraciones.** Son nuevas y siguen la numeración. Ninguna existente se modifica. La reversión se hace con una migración nueva.
7. **Comandos.** Cada comando se verifica según su tipo:
   - los scripts `npm run …` existen en `package.json` o están declarados en la spec como previstos;
   - los comandos de Git, SQL u otras herramientas se verifican por su propio mecanismo (sintaxis y disponibilidad), no contra `package.json`.

   Además, están todas las suites de III.3 y aparece CB-06.
8. **Acciones reservadas.** El push, el despliegue, el `db:push` al proyecto `app`, el `db:push:test` y las intervenciones del usuario están en el paso correcto, cada uno con su verificación posterior.
9. **Reglas.**
   - Sin secretos ni datos reales.
   - Tenant resuelto en el servidor.
   - Credenciales solo por `worker_api`.
   - Pruebas solo contra el proyecto desechable.
10. **Trampas.** Las trampas de la ruta y de la spec tienen un paso o una verificación que las cubre.
11. **Git.** Todo ocurre en la rama `mf/$ARGUMENTS`, sin operaciones destructivas ni push por parte del asistente.
12. **Fidelidad.** El plan no agrega funcionalidad que la spec no pide ni omite nada de lo que pide.

Además, como observación (no afecta el veredicto): si el plan no parece caber en 8 horas, recomendá cómo partirlo.

## 4. Veredicto e informe

- **APROBABLE:** todos los ítems en PASS o en NO APLICA justificado.
- **REQUIERE CAMBIOS:** algún FAIL causado por un defecto del plan.
- **BLOQUEADO:** la auditoría no se pudo completar (precondición, entorno o acceso). Decí qué falta.

El informe contiene:

- fecha y commit;
- hash de contenido de la spec;
- hash de contenido del plan: `grep -v '^\*\*Estado:\*\*' docs/FASES/FASE1/$ARGUMENTS/plan.md | git hash-object --stdin`;
- el veredicto;
- la tabla del checklist: `# | Ítem | PASS/FAIL/NO APLICA | Evidencia o justificación`;
- la tabla de hallazgos: `ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto`.

## 5. Reporte

Informá el veredicto y el siguiente paso:

- **APROBABLE:** el usuario aprueba el plan ("Apruebo el plan de $ARGUMENTS: pasá el estado a APROBADO"). Después elige modelo y esfuerzo, abre una sesión nueva y corre `/microfase $ARGUMENTS`.
- **REQUIERE CAMBIOS:** volver a plan mode, corregir el plan y auditar de nuevo.
- **BLOQUEADO:** resolver lo que falta y volver a auditar.
