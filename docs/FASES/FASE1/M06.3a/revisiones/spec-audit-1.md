# M06.3a — Auditoría de spec 1

- Fecha: 2026-10-01.
- Commit auditado: `f96b3b3` (`M06.3a TERMINO GRILLING Y SPEC`). Durante la revisión, el commit incorporó los cambios documentales que estaban en el árbol sobre `25bf4ab`; no cambió código de aplicación ni pruebas.
- Spec: `docs/FASES/FASE1/M06.3a/spec.md`, estado **BORRADOR**.
- Hash Git del contenido, excluyendo la línea `**Estado:**` y con saltos LF: `b778be1253199fb871119af092255aa5c6036f5e`.
- Alcance: auditoría documental y comprobaciones locales. Único archivo escrito por esta auditoría: este informe. No se modificaron spec, ruta, hallazgos, implementación ni migraciones.
- El usuario confirmó Q1–Q11 y cerró el grill. Esa confirmación no aprueba la spec ni `G-CRYPTO`. Los textos que todavía solicitan confirmación son desactualización documental, no una decisión pendiente.

## Veredicto

**REQUIERE CAMBIOS.** Cinco hallazgos de severidad alta, tres media y uno baja. El baseline terminó pasando `npm run verify`, tras los incidentes de entorno detallados abajo. Las decisiones del grill se conservan; las correcciones no requieren rediseñar la ruta ni incorporar infraestructura.

En las referencias siguientes, **S** significa `docs/FASES/FASE1/M06.3a/spec.md`, **R** significa `docs/FASES/FASE1/meta_first/spec.md` y **P** significa `docs/FASES/FASE1/meta_first/plan.md`.

## Checklist

| # | Ítem | PASS/FAIL | Evidencia |
|---|---|---|---|
| 1 | Trazabilidad | PASS | P, ficha M06.3a:210–223; S, Heredados:413–434: CA-21 y CA-23–27, incluida la versión reescrita de CA-27. La parte HTTP de CA-26 queda explícitamente en M16.1. |
| 2 | Alcance | PASS | P, II.6:501–520; S, Alcance y Archivos previstos. Q1/Q2 autorizan suite permanente, lockfile, sql-target y README acotado; no se agrega migración ni caller OAuth. |
| 3 | Coherencia con spec general | FAIL | A-01: R §14 conserva «Cifrado: —», mientras S y P exigen dos comprobaciones adicionales. A-09: modo transacción requerido por R §7 y P II.6 no queda exigido por la guarda de S §7. Los consumidores M28.2a/M16.1/M16.2/M16c permanecen separados. |
| 4 | Decisiones | PASS | S, D-M06.3a-01–11; respuestas y confirmación del usuario. Q10 no contradice CA-25: ese CA no condiciona la entrega de material autenticado a confirmar el rewrap; Q8 mantiene las condiciones de retiro. |
| 5 | Trampas | PASS | P II.6; S, Trampas 1–2 y T-04/T-10: IV aleatorio por sellado y error distinto por versión ausente. |
| 6 | Intervenciones y acciones reservadas | PASS | P III.2; S, Intervenciones:536–547. Contraseña, llavero y URL tienen paso previsto; push, despliegue y ambos db:push quedan reservados al usuario. No hace falta migrar para este corte. |
| 7 | Verificación | PASS | S, Verificación:525–533; P III.3:793. Exige db:check:test, test:app y verify; la suite nueva falla y no se omite. Las deficiencias de algunos casos concretos se registran en 14/18, no se interpretan como permiso para saltar la suite. |
| 8 | Dependencias | PASS | PROJECT_STATE, Cerradas: G-K01, G-K02-K04 y G-DB-META aprobados. Contratos K01–K04 y 0012 están en la base; sesiones de M05.1.1, M05.1.2–M05.1.4 y M06.1a–M06.2a registran pruebas y correcciones. |
| 9 | Lo entregado de verdad | PASS | credential.ts, primitives.ts, tenant/context.ts y 0012:809–861, 1249, 1380–1514. La spec consume el AAD existente, status/generation, conteo global y PX006/PX008; reconoce que SQL no valida el estado al recifrar. |
| 10 | Pendientes y hallazgos | FAIL | A-06: H-E1-17 sigue presentando opciones pendientes incompatibles con Q3. H-E1-36/37/41 conservan la asignación y límites acordados; matriz explícita abajo. |
| 11 | Contexto real | FAIL | A-08: S, Heredados:430 remite H-E1-36 a HALLAZGOS:120, que contiene H-E1-33; H-E1-36 está en :123. Las referencias numéricas antiguas al plan también requieren sincronización, aunque S:16 advierte que prevalecen los títulos. |
| 12 | Archivos previstos | PASS | S:380–405 frente a P II.6 y precondiciones 8–9. Los archivos funcionales están autorizados y los artefactos de seguimiento/pipeline también. |
| 13 | Diseño suficiente | FAIL | A-03/A-07: falta fijar la negociación TLS frente al entorno y completar el contrato de validación/errores del repository y el tipo Queryable. |
| 14 | Verificable | FAIL | A-04/A-05/A-09: búsqueda incompatible con su regresión, prueba de variable ausente contaminada por dotenv y modo transacción no exigido por el gate. Los 25 criterios sí tienen casos asociados. |
| 15 | Sin nada abierto | PASS | Q1–Q11 confirmadas por el usuario. H-S-01/02/04/06 tienen comprobación durante implementación; H-S-03 se difiere a M16.2; H-S-05 tiene evidencia TLS. La confirmación global pendiente en S:609 es texto obsoleto (A-08). |
| 16 | Ejecutable ahora | PASS | verify final exit 0: 8 archivos, 145 pruebas y build completo. Scripts de package.json existen. Las cuatro variables nuevas aún faltan en .env.example, pero incorporarlas es el paso 10 autorizado antes de env:prepare y de la verificación remota; no se exige que la implementación futura ya exista. |
| 17 | Consistencia interna | FAIL | A-04: C-14/T-24 prohíben el literal que T-23 necesita. A-09: alcance exige transaction pooler, pero T-22 acepta session mode sin un bloqueo posterior explícito. |
| 18 | Reglas no negociables | FAIL | A-02: la identidad/destino validados pueden diferir de los que usa pg. K01, acceso exclusivamente por worker_api, ausencia de cambios SQL y errores redactados están exigidos; falta cerrar ese hueco de la guarda antes de implementarla. |

## Revisión explícita solicitada

| Punto | Resultado |
|---|---|
| Q1: gate efectivo | Está exigido en P II.6/III.3 y S §12/Verificación, con `db:check:test` + `test:app`, login real, restricciones, recorrido repository y fail-not-skip. Que check-target tolere una variable ausente como nota no habilita el gate: la suite debe fallar. A-01 sincroniza la tabla superior; A-02/A-05/A-09 corrigen defectos de verificación, sin reducir esta obligación. |
| Q11, incluido sslnegotiation | S:222 incluye los siete controles del parser instalado: sslmode, sslcert, sslkey, sslrootcert, ssl, sslnegotiation y uselibpqcompat. Comprueba presencia decodificada, repetidos y valores vacíos antes del parser, pool, red o lectura de certificados. **Falta la vía PGSSLNEGOTIATION**, A-03. No hace falta cambiar la CA ni reabrir Q5. |
| Fingerprint de la CA | Correcto: S:226–231 y T-48 usan X509Certificate sobre el PEM versionado como evidencia de procedencia/sustitución auditable. El runtime confía en `ca` con `rejectUnauthorized: true` y hostname estándar; no compara fingerprints del peer ni fija el certificado hoja. Conviene conservar expresamente esta distinción al corregir A-03. |
| Q10 y keyVersion | Correcto: S:239–264 distingue `not_attempted`, `confirmed`, `version_conflict` y `unconfirmed`. En todos los resultados keyVersion es la del material leído. Un error posterior de transporte/timeout no invalida el descifrado; tampoco acredita persistencia. No hay retry/relectura automática; PX006 y rechazos explícitos se propagan. T-45/T-46 cubren ambos resultados posibles de la escritura incierta. |
| H-E1-17 | **No sincronizado**: S D-03/C-19/T-38 adopta el mock por suite; HALLAZGOS:34/83 conserva «Pendiente» y «instalar o alias». A-06 pide registrar la convención acordada, sin atribuir una solución automática a instalar el paquete. |
| H-E1-36 | Correcto: **diferido P2 a M16c/0013**; M06.3a solo verifica acceso real y frena el gate si falla, con diagnóstico e intervención del usuario. No se cierra por aprobar el diseño. |
| H-E1-37 | Correcto en el detalle de HALLAZGOS:124 y S:270/628: **mitigación / límite aceptado a nivel repository, pendiente de implementar y verificar**. El resumen «Pendiente» no acredita una mitigación ya implementada. Después de verificar tampoco debe pasar a simplemente RESUELTO: SQL seguirá siendo más amplio. T-41 exige la carrera real PX006. S §4/C-22 incluye disconnected sin purgar en el conteo que bloquea retiro. |
| H-E1-41 | Correcto: **resuelto documentalmente** por Q9/D-08, HALLAZGOS:58/133. SECURITY enumera categorías/restricciones y remite a migraciones/pgTAP, sin otra matriz exacta. |

## Contradicciones

| Elemento de la spec | Contradice a (fuente y ubicación) | Evidencia | Cómo se resuelve |
|---|---|---|---|
| S Verificación exige db:check:test y test:app | R §14:528, fuente aprobada superior al borrador, todavía declara ninguna suite adicional para cifrado | P II.6/III.3 ya refleja Q1; R §5:106 también exige pruebas del cliente | Sincronizar la fila de R con Q1 ya confirmado. Se reporta, no se modifica silenciosamente ni se vuelve a preguntar la decisión. A-01. |
| S §5 dice política TLS exclusiva del módulo | pg instalado toma PGSSLNEGOTIATION cuando no se fija sslnegotiation en config | connection-parameters.js:104; prueba local reproducible abajo | Fijar explícitamente la negociación en código y probar que el entorno no la cambia. A-03. |
| S C-14/T-24: cero apariciones del nombre de excepción en tests | S T-23: activar esa misma variable para demostrar que perdió efecto | S:450,489–490 | Prohibir soporte operativo y autorizar únicamente el literal de la regresión negativa; no disfrazarlo concatenando cadenas para pasar grep. A-04. |
| S D-03/C-19/T-38 da Q3 por decidida | HALLAZGOS:83 ofrece instalar paquete o alias como decisión pendiente | Mock existente en tenant-context.test.ts:11 | Actualizar registro con convención confirmada. A-06. |
| S Alcance/CA heredado exige pooler de transacción | S §7 regla 7 y T-22 permiten puerto 5432 sin bloqueo posterior explícito | R §7:178; P II.6 paso 4; S:290,488 | Exigir el endpoint en modo transacción para aprobar T-31/T-33 y el gate; una nota diagnóstica no puede sustituir esa condición. A-09. |

## Hallazgos

Todos se asignan a la corrección documental previa a la implementación de M06.3a. A-01 requiere sincronizar la fuente de la ruta; este auditor solo escribe el informe.

| ID | Severidad | Sección | Problema | Evidencia | Cambio propuesto | ¿Requiere decisión del usuario? |
|---|---|---|---|---|---|---|
| A-01 | alta | Verificación / ruta | La tabla de suites de la spec general no incorpora el gate reforzado ya aprobado en Q1. Dos fuentes vigentes describen obligaciones diferentes. | R:520–528 frente a P:793 y S:525–533. | Actualizar solo la fila Cifrado de R con db:check:test y test:app obligatorios, suite real sin skip/fallback. Mantener Q1 y CB-06. | No nueva decisión; Q1 ya autoriza la obligación. La contradicción se reporta antes de corregirla. |
| A-02 | alta | Diseño §7, C-13/C-18 | Validar usuario/ref/puerto desde la URI no basta si luego se entrega la cadena original a pg: parámetros de consulta `user`, `host` y `port` pueden reemplazarlos. Una guarda que sigue las siete reglas escritas puede aprobar una identidad o proyecto distintos de los efectivos. | pg-connection-string/index.js:40–64; scripts/lib/target.mjs:41; S:283–290. Prueba local: los tres overrides resultaron true, sin red. | Especificar una política que impida discrepancias entre destino/rol validados y efectivos, antes de abrir conexión. Recomendación técnica: rechazar los overrides de identidad/destino en las URLs SQL usadas por la guarda y comprobar ambos URLs con la misma semántica efectiva. Añadir casos sintéticos de user/host/port, incluidos codificados/repetidos, sin contactar destinos erróneos. | No; es necesario para el aislamiento y la identidad de Q1. No autoriza una revisión general de otros módulos. |
| A-03 | alta | Diseño §5, Q11, T-47/T-48 | Rechazar sslnegotiation en URL no hace exclusiva la política del módulo: `PGSSLNEGOTIATION=direct` sigue cambiando la negociación cuando la config propuesta omite esa propiedad. | pg/lib/connection-parameters.js:104–111; reproducción local da `direct` con SSL explícito estricto y URL sin parámetros. | Fijar `sslnegotiation: 'postgres'` en la configuración del módulo, coherente con la evidencia SSLRequest del grill, y comprobar con entorno sintético que no cambia. Mantener rechazo del parámetro URL y redacción de errores. Conservar hostname estándar y fingerprint solo documental/unitario. | No; aplica la garantía Q5/Q11 aprobada. |
| A-04 | alta | C-14, T-23 y T-24 | La regresión negativa introduce exactamente el literal que el criterio y el grep exigen eliminar de todo tests/. Una implementación fiel no puede satisfacer ambos requisitos. | S:450,489–490. | Definir ausencia de soporte operativo, exceptuar de forma cerrada el uso negativo de la regresión y ajustar la búsqueda al alcance efectivo. Mantener la prueba de que la variable true no permite apuntar a app. | No. |
| A-05 | media | T-37 | En Windows PowerShell, asignar cadena vacía elimina la variable del entorno. setup.ts luego carga .env.local con override false y puede reponer la URL válida. El comando no garantiza probar ausencia y podría ejecutar la suite normalmente. | tests/app/setup.ts:12–15; prueba sintética abajo. | Definir una ejecución aislada que quite/vacíe la variable después del setup, o un proceso de prueba que garantice su ausencia frente al loader. Debe comprobar fallo, no skip, y cero conexiones; no leer, renombrar ni editar .env.local para producir el negativo. | No. |
| A-06 | alta | H-E1-17 y C-19 | El registro canónico mantiene una decisión abierta y opciones descartadas por Q3. Además instalar el paquete por sí solo no es la convención adoptada. | HALLAZGOS:34/83 frente a S D-03/C-19/T-38 y confirmación del usuario. | Registrar H-E1-17 como resuelto por convención explícita de testing: mock por suite que atraviesa server-only. Separar esa resolución documental de comprobar los mocks de las nuevas suites cuando existan. Eliminar las opciones pendientes, sin agregar paquete ni alias. | No; Q3 confirmado. |
| A-07 | media | Diseño §5/§6 | Quedan elecciones de interfaz/error para el implementador: Queryable no tiene contrato; la validación de K01/input/fila leída y el rechazo de actor/empresa de una operación preparada no tienen una traducción tipada/redactada fijada. «Valida la fila» no explica cómo separar status/generation/provider del strictObject K04. | S:194,235–266; credential.ts:37–60 es estricto y get_credential SQL:814–829 devuelve campos adicionales. T-19 solo pide «error». | Completar el tipo mínimo del pool inyectado y el contrato de errores de validación de entrada, respuesta DB y operación preparada. Definir proyección/validación de la fila SQL y mensajes fijos sin ZodError/cause originales; fijar aserciones negativas correspondientes. No exige nuevos objetos SQL ni archivos. | No; concreción técnica de CA-26 y del contrato confirmado. |
| A-08 | baja | Fuentes, referencias y Preguntas abiertas | Subsisten referencias erróneas y estado de conversación anterior: H-E1-36 apunta a otra entrada; confirmación global figura pendiente aunque el usuario ya cerró el grill. | S:16,430,609; HALLAZGOS:120/123. | Actualizar referencias a ubicaciones vigentes o secciones estables y registrar grill cerrado, conservando BORRADOR y G-CRYPTO sin aprobar. | No; confirmación ya recibida. |
| A-09 | media | Diseño §7/T-22 frente a T-31/T-33 | Se acepta session mode como ok con nota; la suite solo exige resultado ok del resolvedor. Por lo tanto un test:app verde no acredita el modo transacción requerido ni H-S-02. | S:290,361–364,488,497–499,600; P II.6 paso 4; R §7. | Hacer explícita una condición obligatoria del gate que use el shared transaction pooler en 6543 y falle si el destino efectivo no cumple. Si la función conserva su nota diagnóstica, la suite debe imponer la condición antes de conectar. | No; no se cambia el modo de conexión decidido por la ruta. |

## Evidencia local reproducible

No se leyeron valores de .env.local, no se ejecutó SQL y no se abrió conexión a Supabase durante esta auditoría. Las comprobaciones siguientes usan únicamente valores sintéticos y el parser instalado. `next build` sí realiza su carga habitual del entorno, sin imprimir sus valores.

### Parser y negociación TLS

Ejecutado por entrada estándar de Node desde PowerShell:

```js
const CP = require('pg/lib/connection-parameters');
const url = 'postgresql://praxa_integrations.aaaaaaaaaaaaaaaaaaaa:secreta@pooler.example.invalid:6543/postgres?user=postgres.bbbbbbbbbbbbbbbbbbbb&host=other.example.invalid&port=5432';
const cp = new CP({ connectionString: url, ssl: { ca: 'synthetic', rejectUnauthorized: true } });
console.log({
  queryOverridesUser: cp.user !== new URL(url).username,
  queryOverridesHost: cp.host !== new URL(url).hostname,
  queryOverridesPort: cp.port !== 6543,
});
process.env.PGSSLNEGOTIATION = 'direct';
const tls = new CP({
  connectionString: 'postgresql://synthetic:secreta@example.invalid:6543/postgres',
  ssl: { ca: 'synthetic', rejectUnauthorized: true },
});
console.log({ sslnegotiationFromEnvironment: tls.sslnegotiation });
```

Resultado: los tres `queryOverrides...` fueron `true`; `sslnegotiationFromEnvironment` fue `direct`. Solo se construyeron parámetros: no Client, Pool, TLS ni consultas. Esto acredita el comportamiento del parser, no una explotación ni una conexión a un proyecto incorrecto.

### Variable ausente y loader

```powershell
$env:PRAXA_AUDIT_SYNTHETIC_EMPTY=''
node -e "console.log(JSON.stringify({emptyAssignmentRemovesVariable: !Object.hasOwn(process.env,'PRAXA_AUDIT_SYNTHETIC_EMPTY')}))"
```

Resultado: `emptyAssignmentRemovesVariable: true`. Separadamente, `dotenv.populate({}, { PRAXA_INTEGRATIONS_TEST_DB_URL: 'synthetic' }, { override: false })` rellenó la variable ausente. No se leyó un archivo de entorno para demostrarlo.

### Verificación base

| Ejecución | Resultado |
|---|---|
| `npm run verify`, sandbox | Lint, typegen y typecheck pasaron; Vitest no cargó por `spawn EPERM`. Exit 1; no es evidencia verde. |
| Mismo comando fuera del sandbox | 7 archivos y 136 pruebas pasaron; worker de componentes no inició (`Timeout waiting for worker to respond`). Exit 1; no se ejecutó build. Coincide con el síntoma de H-E1-18, sin afirmar su causa. |
| Repetición fuera del sandbox prevista por S Verificación paso 4 | **Exit 0**. Lint, typegen, typecheck; **8 archivos / 145 pruebas**; build completo, **11 páginas generadas**. Sin cambios de código entre corridas. |
| `git diff --check` | Exit 0 antes de crear el informe. |

No se corrieron `db:check:test`, `test:app` ni pgTAP para este spec-audit. La suite nueva todavía no existe: sus pruebas reales son condición de la implementación y de G-CRYPTO, no resultados acreditados por esta auditoría. La evidencia TLS previa tampoco acredita login del rol.

## Siguiente paso

Corregir los documentos afectados por A-01–A-09, conservando Q1–Q11 y las asignaciones de las microfases posteriores, y ejecutar otra auditoría sobre el hash resultante. Después de un resultado APROBABLE, la aprobación visible de la spec sigue correspondiendo al usuario. Este informe no inicia plan-audit ni implementación y no aprueba G-CRYPTO.

Observación de tamaño, sin efecto sobre el veredicto: el corte combina cuatro módulos, guardas, una suite remota y documentación, por lo que su límite de ocho horas merece control al preparar el plan. No se propone dividir ni ampliar la ruta en esta auditoría.
