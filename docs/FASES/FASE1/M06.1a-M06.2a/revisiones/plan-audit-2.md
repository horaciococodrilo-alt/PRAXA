# Auditoría de plan — M06.1a-M06.2a (2)

- **Fecha:** 2026-09-27.
- **Commit de referencia:** `3eea43a29081e154ad4bfab945bf90ab02d1fd8b` (`main`). El plan auditado está sin seguimiento; su identidad es el hash siguiente, no el contenido de ese commit.
- **Hash de contenido de la spec:** `e57d8a7fefc5c45575343d9c045c9e096b97b063`.
- **Hash de contenido del plan:** `be9885c30f31a064aa35df51d4e11cee14043466`.
- **Plan:** `docs/FASES/FASE1/M06.1a-M06.2a/plan.md`, `BORRADOR`.
- **Procedimiento:** `.claude/skills/plan-auditor/SKILL.md`, auditoría independiente en contexto aislado, por invocación expresa del usuario.

## Precondiciones y alcance

| Precondición exacta de la skill | Resultado |
|---|---|
| Spec en `APROBADA` | Cumplida: `spec.md:3`. |
| Última auditoría de spec APROBABLE | Cumplida: `revisiones/spec-audit-5.md`. |
| Hash actual de la spec igual al de esa auditoría | Cumplida: `e57d8a7fefc5c45575343d9c045c9e096b97b063`. |
| Plan existente en `BORRADOR` | Cumplida: `plan.md:3`. |

El árbol inicial tiene únicamente dos archivos sin seguimiento: el plan y `revisiones/plan-audit-1.md`. Se preservan ambos. Las dependencias de implementación están cerradas en `docs/PROJECT_STATE.md:11-15`: `G-DOCS`, `G-K01` y `G-K02-K04`. No existe aún la rama `mf/M06.1a-M06.2a` ni ninguno de los seis archivos nuevos de código/pruebas previstos.

El plan recoge la preferencia anterior del usuario de commitear antes de revisiones (`plan.md:183`, `:282`). La invocación expresa actual autoriza esta auditoría del borrador tal como está; las cuatro precondiciones de la skill no incluyen un commit previo. Por eso la falta de commit no se transforma en un bloqueo adicional ni en un defecto funcional del plan. Esta excepción para auditar ahora no autoriza commits del asistente, cambios de estado ni implementación. Las revisiones posteriores conservan la preparación y la intervención del usuario previstas en el paso 13.

## Veredicto

**APROBABLE.** Los doce ítems están en PASS. No hay defectos del plan que requieran cambios ni precondiciones pendientes que impidan completar esta auditoría. El resultado corresponde exclusivamente a los hashes indicados; no aprueba `G-DB-META` ni certifica el funcionamiento remoto.

## Checklist

| # | Ítem | PASS/FAIL/NO APLICA | Evidencia o justificación |
|---:|---|---|---|
| 1 | Spec base | PASS | `plan.md:7-9` cita la spec APROBADA, el hash actual y `spec-audit-5.md` APROBABLE. El cálculo independiente coincide. |
| 2 | Cobertura | PASS | Los 14 pasos de implementación cubren 38/38 criterios operativos, 48/48 casos, 31/31 IDs CA heredados y 6/6 CB. Se excluyó la tabla de autorrevisión al comprobar cobertura. Las dos fichas y la sección 5b también están asignadas; detalle debajo. |
| 3 | TDD | PASS | Paso 2: escribir y ejecutar exclusivamente la parte 1 de `10`, antes de `0012`, de las demás pruebas nuevas y de la parte 2. Pasos 3–6: escribir las pruebas restantes y registrar rojo por objetos ausentes; solo después, pasos 7–9: implementar y ensayar. T-14, las regresiones `01`–`07`, la hipótesis inicial de T-32 y los controles manuales tienen excepción justificada. Un skip no vale como rojo. |
| 4 | Archivos | PASS | Los seis archivos de código/pruebas coinciden con II.4–II.5 y con Archivos previstos de la spec. Los tres de seguimiento corresponden a precondición 8; plan e informes, a precondición 9. El ensayo externo está autorizado en Diseño §12.5 de la spec. No hay rutas alternativas que requieran invocar la regla de rutas sugeridas dentro del mismo módulo. No se editan configuración, contratos, scripts ni pruebas existentes. |
| 5 | Pasos | PASS | Entrada y destino → parte 1 de cierre → pruebas y rojo → estructura y funciones → ensayo y resolución condicional → aplicación del usuario → suites completas → controles → evidencia/revisiones → aprobación del gate. Cada fila tiene verificación propia; la ejecución de lo revisado estáticamente en 7–8 ocurre en 9. D-05 se decide antes del primer push. |
| 6 | Migraciones | PASS | Inventario real `0001`–`0011`; siguiente libre `0012`. Única migración nueva: `0012_integrations.sql`. La FK de reportes solo cambia condicionalmente dentro de esa migración nueva, nunca en `0003`. Después de aplicar se detiene ante defectos; reversión mediante otra migración nueva, con alcance y numeración decididos explícitamente, sin editar historial ni hacer reset. |
| 7 | Comandos | PASS | Los cinco scripts obligatorios existen en `package.json`: `db:check:test`, `db:push:test`, `test:policies`, `test:app`, `verify`. `verify` incluye lint, typegen, typecheck, unit/component y build; no sustituye pgTAP ni Data API. Git y grep tienen sintaxis adecuada y herramientas disponibles. Los fragmentos SQL conservan las variantes aprobadas de Diseño §9. El ensayo usa `pg` instalado, cargador y resolutor existentes, TAP completo y rollback. III.3 y CB-06 están expresos; falta de entorno o pruebas omitidas detiene el gate. |
| 8 | Acciones reservadas | PASS | Paso 10: asistente prepara ensayo, candidata y guarda; usuario ejecuta `db:push:test`; asistente verifica después con pgTAP y objetos persistentes. Paso 13: commits del usuario y comprobación posterior. Paso 14: aprobación explícita del gate. Push, despliegue y aplicación a app permanecen futuros y reservados, con verificación asociada. `.claude/settings.json` deniega `npm run db:push*` y `git push*`; el plan no propone eludirlo con el ensayo. |
| 9 | Reglas | PASS | Fixtures sintéticos y patrón T-38; ninguna lectura de secretos para evidencia. Actor/empresa provenientes del servidor, autorización en `company_members` y conexión filtrada por ID y empresa antes de los chequeos propios. Credenciales por `worker_api`, sin RPC pública ni grants a usuarios/rol C sobre las tablas. Data API afirma con clientes autenticados; SQL privilegiado solo prepara fixtures. Pruebas exclusivamente contra destino desechable, con guardas antes de operar. |
| 10 | Trampas | PASS | Las 18 trampas de la spec están mapeadas en Riesgos y pasos 2–12: bypass del dueño, falta de JWT, transiciones SQL, cierre con reporte, grants frente a RLS, rol C y `extensions`, membresía temporal, migración aplicada, ACL nula, alias y `ON CONFLICT`, errores capturados, orden del runner, destino de `db:preview`, claims, datos sintéticos, Vitest y consumo de una sentencia. Hipótesis remotas tienen prueba y condición de parada; H-S-09 conserva su asignación a M16.2. |
| 11 | Git | PASS | Paso 1 exige `mf/M06.1a-M06.2a` desde `main`, con inspección al retomar y preservación de cambios ajenos. No prevé operaciones destructivas, commit ni push del asistente. La auditoría documental actual en `main` no es la ejecución de ese paso. |
| 12 | Fidelidad | PASS | Se adoptan literalmente firmas y diseño de la spec; se conservan sus excepciones de conteo global, consumo sin cerrojo, purga ajena/inexistente y traducción de errores. El nulo de `p_client_business_id` añadido a T-45 prueba una obligación ya existente, sin cambiar la interfaz. Elegir siempre el ensayo es una opción ya prevista. Exclusiones y pendientes de M06.3a/M16.x permanecen fuera del corte. |

## Cobertura comprobada

Los intervalos siguientes incluyen todos sus IDs. Las referencias son a los pasos de implementación, no a la autorrevisión del plan.

| Criterios operativos | Pasos que los cubren |
|---|---|
| C-01–C-15 | 7; además 3, 5 y 6 escriben sus pruebas, y 12 revisa los controles estáticos. |
| C-16–C-28 | 5 y 8; 4 agrega aislamiento y las excepciones de C-16/C-24. |
| C-29 | 4. |
| C-30–C-32 | 3. |
| C-33 | 2, 6, 9 y 13. |
| C-34 | 6. |
| C-35 | 5, 8 y 12. |
| C-36 | 1, 6 y 9–14. |
| C-37 | 5 y 8. |
| C-38 | 5 y 7. |

| Casos | Pasos que los cubren |
|---|---|
| T-01–T-03 | 7 y 12. |
| T-04–T-15 | 3; ejecución 6, 9 y 11. |
| T-16 | 4; ejecución 6, 9 y 11. |
| T-17–T-31 | 5; ejecución 6, 9 y 11; T-19 también revisión 8 y 12. |
| T-32 | 2 primero, luego 6, 9 y 11; evidencia 13. |
| T-33–T-34 | 6 y 11; regresiones previas también en 2. |
| T-35–T-36 | 10; T-35 también en entrada 1; evidencia 13. |
| T-37 | 11 y 13. |
| T-38 | 12 y 13. |
| T-39 | 5, 8, 9, 11 y 13. |
| T-40–T-41 | 12 y 13; T-40 también revisión 7. |
| T-42 | 4, 8, 9, 11 y 13. |
| T-43 | 1 y 12–14. |
| T-44 | 12 y 13. |
| T-45–T-47 | 5, 8, 9 y 11. |
| T-48 | 4, 8, 9 y 11. |

Heredados exactos comprobados: CA-01, CA-02, CA-02b, CA-02c, CA-03, CA-05, CA-07, CA-08, CA-09, CA-09b, CA-10–CA-22, CA-25, CA-28, CA-37, CA-37c, CA-38, CA-38b, CA-67 y CA-68. Todos aparecen en los pasos; no se afirma cubrir indiscriminadamente CA-01–CA-68. Las fichas de M06.1a/M06.2a se cubren en 3–8; la sección 5b, en 6; CB-01–CB-06, en 1 y 10–14 según su naturaleza.

La lectura semántica confirma, además de los IDs, los seis resultados de Data API, el orden empresa → usuario y los conteos de ambas partes de `10`, la retención exacta del intento consumido hace diez minutos, el rollback de purga ante rechazo y la precedencia de autorización frente a errores de estado/generación.

## Hallazgos

| ID (P-NN) | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| — | — | — | Sin hallazgos nuevos ni cambios obligatorios. | Los doce ítems del checklist cumplen. | Ninguno. |

Los IDs P-01 y P-02 de `plan-audit-1.md` se preservan y no se renumeran. P-01 es un detalle operativo para construir el ensayo temporal, cuyo mecanismo y límites ya están definidos; no constituye funcionalidad faltante ni un comando inexistente declarado como listo. La situación de P-02 se trata expresamente en Precondiciones y alcance. Ninguna observación de ese informe cambia la secuencia TDD del plan auditado.

## Observación de tamaño (no afecta el veredicto)

Doce funciones SQL, restricciones, cuatro archivos pgTAP, Data API y validación remota hacen que el grupo parezca mayor que un solo corte de ocho horas. Si hace falta subdividir, someter a decisión explícita cortes que preserven el orden: primero pasos 1–6 (parte 1 sola, resto de pruebas y rojo), después 7–9 (implementación y ensayo), y finalmente 10–14 (aplicación del usuario, verificación y cierre). Si las doce funciones requieren otro corte, dividir 7–9 por grupos de funciones con sus pruebas ya escritas. No implementar comportamiento antes de sus pruebas, no aplicar `0012` hasta el ensayo completo y conservar `G-DB-META` único al final. Esta observación no autoriza por sí sola ninguna subdivisión ni altera la spec.

## Fuentes y verificaciones de esta auditoría

Se leyeron la skill, `AGENTS.md`, spec y plan de la microfase completos, `spec-audit-5.md`, las fichas M06.1a/M06.2a, II.4–II.5, precondiciones y III.2/III.3/III.9 de la ruta; las secciones aplicables de la spec general; `PROJECT_STATE.md`, `HALLAZGOS.md`, `SECURITY.md`, `ARCHITECTURE.md`, `package.json` y `.claude/settings.json`. Se contrastaron K01–K04, los scripts de pgTAP/destino/aplicación/carga de entorno, helpers y configuración de app tests, migraciones y pruebas existentes relevantes al cierre, permisos y cerrojos. Los seis archivos nuevos previstos aún no existen; no hay código de ellos que auditar o ejecutar.

| Verificación local | Resultado |
|---|---|
| `git status --short --branch`, `git rev-parse HEAD`, `git branch --list mf/M06.1a-M06.2a`, `git diff --name-only main` | `main@3eea43a`; plan e informe 1 sin seguimiento; rama de implementación ausente; sin diff de archivos con seguimiento. |
| Inventario `supabase/migrations/` | Once archivos, `0001`–`0011`; `0012` libre. |
| Hash sin línea de estado mediante Node `fs`/`crypto` | Spec `e57d8a7…`; plan `be9885c…`; archivos con LF, preservados sin normalizar ni agregar saltos. |
| Expansión de intervalos de IDs sobre la tabla de los 14 pasos | C 38/38; T 48/48; CA heredados 31/31; CB 6/6; ninguna ausencia. |
| Patrones de T-38 sobre plan e informe 1, y T-44 sobre spec excluyendo su propia fila | Cero coincidencias. Solo verificación documental actual; no sustituye la búsqueda sobre el diff de implementación futuro. |
| Disponibilidad de herramientas y módulos | Git, Node, npm, PowerShell y grep disponibles; `pg` resuelve desde `node_modules` del repositorio. |

Para reproducir los hashes sin depender del transporte de texto de PowerShell, ejecutar este JavaScript por stdin de Node desde la raíz; implementa el objeto blob de Git sobre exactamente los bytes que conserva el filtro de la fórmula de la skill:

```javascript
const fs = require('fs');
const crypto = require('crypto');
for (const name of ['spec', 'plan']) {
  const source = fs.readFileSync(`docs/FASES/FASE1/M06.1a-M06.2a/${name}.md`);
  const bytes = Buffer.from(source.toString('utf8').split(/(?<=\n)/)
    .filter(line => !line.startsWith('**Estado:**')).join(''));
  const hash = crypto.createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
  console.log(name, hash);
}
```

No se ejecutaron `db:check:test`, `db:push:test`, pgTAP, Data API ni `verify`: esta auditoría comprueba el plan y sus mecanismos locales, no implementación. No se leyó `.env.local`, no se usaron cuentas externas y no se hizo commit, cambio de rama, push ni despliegue. El único archivo creado por esta invocación es este informe.

## Siguiente paso

El usuario puede aprobar el contenido auditado: «Apruebo el plan de M06.1a-M06.2a: pasá el estado a APROBADO». El commit sigue a cargo del usuario; conservar y verificar el hash de contenido al commitear. Si cambia contenido distinto de la línea de estado, corresponde auditar de nuevo. Después el usuario elige modelo y esfuerzo, abre una sesión nueva y corre `/microfase M06.1a-M06.2a`. No se inicia automáticamente ninguna implementación.
