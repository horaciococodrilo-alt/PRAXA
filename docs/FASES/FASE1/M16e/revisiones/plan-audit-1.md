# Auditoría del plan de M16e — ronda 1

- **Fecha:** 2026-11-14
- **Commit:** `63322ed` (rama `mf/M16e`). El plan está sin commitear (`?? docs/FASES/FASE1/M16e/plan.md`); se auditó el árbol de trabajo.
- **Hash de contenido de la spec:** `9a4eb6f7fa0540591aca327dda3430f1e0f6d153`
- **Hash de contenido del plan:** `434636c933f4ab044e9d2503f1da73dde906447a`

## Precondiciones

| Precondición | Resultado |
|---|---|
| Spec en `APROBADA` | Cumple. |
| Última `spec-audit-N` APROBABLE | **No cumple:** `spec-audit-4` dio REQUIERE CAMBIOS. |
| Hash de la spec igual al de esa auditoría | **No cumple:** `spec-audit-4` registra `3dc84cb9…`; el actual es `9a4eb6f7…`. |
| Plan en `BORRADOR` | Cumple. |

Estas dos precondiciones, en sentido estricto, darían BLOQUEADO. El encabezado de la spec registra que el usuario la aprobó el 2026-11-14 sin una auditoría APROBABLE, como excepción expresa, «así ya puedo hacer el plan». La auditoría trata esa excepción documentada como sustituto de las dos precondiciones y sigue con el checklist. El riesgo es el que declara la propia spec: las correcciones posteriores a `spec-audit-4` no se volvieron a auditar.

## Veredicto

**REQUIERE CAMBIOS: 9 PASS y 3 FAIL (4, 10 y 12).** Dos de los hallazgos son de severidad media y uno de ellos (P-01) requiere que el usuario apruebe una enmienda de ruta. No hubo bloqueo de entorno, y no se ejecutaron suites: el plan no tiene código que probar.

## Checklist

| # | Ítem | Resultado | Evidencia o justificación |
|---|---|---|---|
| 1 | Spec base | PASS | El plan cita la spec y el hash `9a4eb6f7…`, que coincide con el actual. |
| 2 | Cobertura | PASS | C-01 a C-15 y T-01 a T-15 aparecen en los pasos 1 a 14. C-09 está en el paso 14 (rango C-01–C-15) y T-13 es opcional, como en la spec. Los heredados también: CB-01 a CB-06 en los pasos 0, 13 y 14; §17.1 a §17.10 en los pasos 0, 1, 5 y 14; CA-37c en el 4; CA-38, CA-38c, DEC-09 y DEC-17 en los pasos 1, 4 y 6; §12 y §16 en el 11. |
| 3 | TDD | PASS | Los pasos 1, 4, 5, 6, 8 y 11 dicen «pruebas primero», y el bloque inicial de «Pasos» exige observar el fallo antes de implementar. Los pasos 2, 3, 9, 10, 12, 13 y 14 son acciones del usuario, mediciones o recorridos manuales. |
| 4 | Archivos | FAIL | `src/modules/integrations/{lifecycle,actions}.ts` no están en II.14b. El código autorizado es `src/modules/integrations/{contract,tiendanube,repository,db,crypto}/`, `meta/oauth.ts` y «acciones y pantalla en `src/app/(app)/app/integraciones/`» (`meta_first/plan.md`, II.14b). El plan lo reconoce: deja la tabla «sujeta a esa enmienda» y la enmienda va en el paso 0. Pero hoy el alcance no los incluye (P-01). Todo lo demás de la tabla está autorizado por II.14b, por D-M16e-20 y D-M16e-22, o es de seguimiento. Los otros llamadores de firmas que cambian están dentro de lo autorizado: `readLiveConnection` lo llaman `diagnostics/{actions,eligibility,orchestrator}.ts` y `meta/oauth.ts`; `anomalies/load.ts` y `meta/insights.ts` usan `readConnectionRecord`, que conserva el filtro de Meta. El AAD ya incluye el proveedor (`contract/credential.ts:83-86`), así que `crypto/` no cambia. |
| 5 | Pasos | PASS, con observación | El orden respeta las dependencias: ruta y acta → migración 1 → `db:push:test` → Portal → .2 → .3 → .4 → publicación → T-15 → .5 → `db:push:test` → publicación → recorrido real. Cada paso tiene su verificación. Hay dos observaciones menores, P-04 y P-05. |
| 6 | Migraciones | PASS | La última es `0022` y el último pgTAP `17`. El plan usa `0023_tiendanube.sql`, `0024_tiendanube_diag.sql` y `18_tiendanube.test.sql`, sujetos a confirmar la secuencia. No edita ninguna migración existente, y las correcciones o reversiones van en una migración nueva. |
| 7 | Comandos | PASS | `db:check:test`, `verify`, `test:policies`, `test:app`, `db:push:test` y `test:eval` existen en `package.json:17-27`. `git diff --check` y `git diff --name-only` son válidos. Están las suites de III.3: `db:check:test`, `test:policies` y `test:app` en cada control, más el caso real (paso 14) y el de privacidad (paso 10). CB-06 aparece en «Verificación final» («una prueba requerida omitida equivale a no ejecutada») y en el paso 13. |
| 8 | Acciones reservadas | PASS | `db:push:test` en los pasos 2 y 12; push, integración en `main`, `db:push` en `app` y despliegue en los pasos 9 y 13; commits del usuario por etapa; Portal y variables en el paso 3; acta en los pasos 0 y 14. Cada uno tiene su verificación en «Intervenciones del usuario». |
| 9 | Reglas | PASS | Sin secretos ni valores reales. El tenant sale de K01. Las credenciales pasan solo por `worker_api`. Las suites corren solo en el desechable, y en `app` solo hay recorridos manuales (paso 10 y «Qué no se hace»). |
| 10 | Trampas | FAIL | Están cubiertas: índice global y `.maybeSingle()` (paso 1); `token_type`, `ads_read`, moneda y zona (paso 1); `runLazyPurge` (paso 4); callback con `code` (paso 4, «callback limpio»); 10.000 (paso 5); PII del pedido (paso 5); `User-Agent`, `402` y `401` (paso 5, T-10); webhooks de 3 s y duplicados (paso 6); corte antes de confirmar (paso 6); orquestador sin Meta (paso 11). Faltan tres (P-03): pedir `payment_status=any` en lugar de `paid`; no rotular nada como «ingreso neto»; y que el dueño no conecte su tienda entre la primera publicación y la comunicación del acta. |
| 11 | Git | PASS | Todo ocurre en `mf/M16e`. Push, integración en `main` y despliegue son acciones del usuario. No hay operaciones destructivas. |
| 12 | Fidelidad | FAIL | Falta que la interfaz explique, al desconectar, cómo desinstalar PRAXA desde el administrador de Tiendanube (spec §1, «Desconexión», A-07). El paso 4 solo dice «desconexión de Tiendanube sin revocación remota», y el paso 8 no lo nombra (P-02). Fuera de eso, el plan no agrega funcionalidad: los cambios de firma de `consume_oauth_attempt`, `create_pending_connection` y `list_pending_purges` son la forma de aplicar el proveedor que la spec exige (C-01, A-14). |

## Hallazgos

| ID | Severidad | Paso | Problema | Evidencia | Cambio propuesto |
|---|---|---|---|---|---|
| P-01 | media | 0; tabla de archivos | `src/modules/integrations/lifecycle.ts` y `actions.ts` no están autorizados por II.14b. El plan deja la tabla sujeta a una enmienda futura en vez de partir de un alcance ya aprobado. La spec también los atribuye a II.14b en «Archivos previstos», y esa atribución es incorrecta. | `meta_first/plan.md`, II.14b (lista de código); plan, «Archivos» y paso 0; `M16e/spec.md`, fila `src/modules/integrations/{lifecycle,actions}.ts` | Que el usuario apruebe ahora la línea de II.14b con los dos archivos y que se registre en la sesión de la enmienda. Después, quitar del plan la condición «sujeta a esa enmienda» y la enmienda del paso 0. **Requiere decisión del usuario** (enmienda de ruta). |
| P-02 | media | 4 u 8 | Falta la instrucción de desinstalación que la spec exige al desconectar Tiendanube (A-07), y su prueba. | `M16e/spec.md` §1 «Desconexión»; plan, pasos 4 y 8 | En el paso 4 (o en el 8, con la tarjeta), agregar el texto que explica cómo desinstalar PRAXA desde el administrador de Tiendanube, con una prueba de componente que lo verifique. |
| P-03 | baja | 5, 8 y 9 | Tres trampas de la spec no tienen paso ni verificación: `payment_status=any`, ningún rótulo «ingreso neto» y el dueño sin conectar su tienda entre publicaciones. | `M16e/spec.md`, «Trampas y riesgos»; plan, pasos 5, 8 y 9 | Paso 5: una prueba que compruebe que la petición usa `payment_status=any` y clasifica `partially_*` localmente. Paso 8: comprobar que ningún texto dice «ingreso neto». Paso 9: aviso al usuario de que el dueño no conecte su tienda hasta el paso 14. |
| P-04 | baja | 7 | El paso 7 ajusta presupuestos en código después del commit de la etapa .3 (paso 6), sin control completo ni commit propio. | Plan, pasos 6 y 7 | Mover la medición antes del cierre de .3, o agregar al paso 7 el control completo y el commit del usuario. |
| P-05 | baja | «Riesgos» | «Riesgos» dice que H-05 bloquea el control de .4, pero H-05 se verifica en el paso 10, después del control de .4 (paso 8) y de la publicación (paso 9). El paso 10 dice, con razón, que bloquea la etapa. | Plan, «Riesgos» y pasos 8 a 10 | Escribir que H-05 fallida en el paso 10 bloquea el avance a la etapa .5 y se decide con el usuario. |

## Observación de tamaño (no afecta el veredicto)

El plan no cabe en 8 horas: son 15 pasos, cinco etapas y dos publicaciones. El usuario exceptuó la microfase del límite. Si quisiera un corte, el natural sigue siendo el de las auditorías de la spec: cerrar `M16e` en el paso 10, con conexión, extracción, privacidad, pantalla y T-15, y llevar los pasos 11 a 13 (chat y diagnóstico) a una microfase propia, con gate.
