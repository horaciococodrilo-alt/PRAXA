# MF_FRONTEND — Frontend público: landing y pantallas de acceso

## Estado

`PASS` — cerrada el 2026-10-09 por decisión del usuario. Integrada en `mf/M28.2a` (merge
`2b4f5bb`). Sin push.

Trabajo **fuera de la ruta `meta_first`**: no figura en la Parte I del plan, no tiene gate
de la ruta y no habilita ni bloquea microfases. Lo pidió el usuario directamente.

## Objetivo

1. Reproducir en Next.js, con fidelidad visual, la landing aprobada en
   `docs/landing-referencia/` (HTML estático con 4 variantes: escritorio/móvil ×
   claro/oscuro).
2. Llevar al mismo lenguaje visual las pantallas de acceso (iniciar sesión, crear cuenta,
   recuperar acceso, nueva contraseña y verificación de correo), a partir de dos capturas
   de referencia, sin cambiar la lógica de Supabase Auth.
3. Hacer QA funcional de todo lo anterior y corregir lo que el usuario aprobara.

## Spec

### Qué se construye

- **Landing en `/`**, un componente por sección (`src/components/landing/`): barra móvil
  con menú, hero, anuncios, franja de herramientas, chat de decisiones, diagnóstico, tres
  pasos, seguridad, CTA final y footer. Un solo DOM responsive con corte en 768 px;
  cuando escritorio y móvil muestran contenido distinto, la sección lleva dos bloques
  alternados por CSS.
- **Tokens de diseño** por rol, con tema claro y oscuro (`landing.module.css`). El tema
  sigue a `prefers-color-scheme` y se puede fijar con `praxaTema('light' | 'dark')`.
- **Pantallas de acceso** (`src/app/(auth)/`, `src/components/auth/`) con los tokens,
  tipografías y tema de la landing.
- **Página 404** (`src/app/not-found.tsx`) con el mismo marco.
- **Ajustes de comportamiento aprobados en el QA:** errores de Supabase en castellano,
  rechazo de contraseñas de solo espacios, aviso de correo ya registrado (`H-E1-73`),
  campos de 16 px en móvil y proxy en `src/proxy.ts` (`H-E1-75`).

### Criterios de aceptación (pedido del usuario)

| Criterio | Resultado |
|---|---|
| Capturas con Playwright contra la referencia en 1320, 820 y 390 px, claro y oscuro | Alturas por sección idénticas; diferencias explicadas en la sesión |
| Sin scroll horizontal, sin errores de consola, sin imágenes rotas | Cumplido en landing (6 combinaciones) y acceso (30) |
| Lighthouse de accesibilidad ≥ 95 y un solo `<h1>` | Landing 96 (claro) y 100 (oscuro); acceso 100; un `<h1>` en todas |
| Compila y pasa lint y pruebas | `npm run verify` en verde en `feat/landing` y en el merge |
| Commits chicos por sección | 26 commits en `feat/landing` |

## Decisiones del usuario

| ID | Decisión |
|---|---|
| D-MF_FRONTEND-01 | Reproducción fiel: cada versión muestra su propio contenido; Tres pasos y Seguridad solo en escritorio; la barra con menú solo en móvil. |
| D-MF_FRONTEND-02 | Trabajo en una rama aparte (`feat/landing`, worktree `PRAXA-landing`) desde `main`. |
| D-MF_FRONTEND-03 | La landing anterior sin commitear se reemplaza; queda en un stash con nombre. |
| D-MF_FRONTEND-04 | "Solicitar acceso" pasa a "Crear cuenta" → `/signup` en toda la landing. |
| D-MF_FRONTEND-05 | El footer deja solo Contacto: se quitan Producto, Seguridad, Privacidad y Términos (no existen). |
| D-MF_FRONTEND-06 | "7 de 7 días" centrado bajo Cobertura y botón "Comprar" blanco con texto oscuro en ambos temas. |
| D-MF_FRONTEND-07 | Pantallas de acceso según las capturas, con fondo liso, sin "Continuar con Google", sin nombre y apellido, sin "gratis, sin tarjeta", sin "PRAXA · COMPANY BRAIN" y sin el pie; panel izquierdo oculto en móvil y sin tarjeta en Crear cuenta. |
| D-MF_FRONTEND-08 | Crear cuenta avisa si el correo ya está registrado; se acepta el riesgo de enumeración (`H-E1-73`). |
| D-MF_FRONTEND-09 | QA sin crear cuentas ni enviar correos reales: solo logins fallidos contra Supabase; el resto, simulado. |
| D-MF_FRONTEND-10 | Corregir redirección abierta, errores en inglés, contraseñas de solo espacios, 404 y retorno a la sección. |
| D-MF_FRONTEND-11 | Mover el proxy a `src/proxy.ts`. |
| D-MF_FRONTEND-12 | Integrar `feat/landing` en `mf/M28.2a` y seguir con M28.2a. |
| D-MF_FRONTEND-13 | Quitar del historial el `env.local` versionado por error antes de cualquier push (`H-E1-81`). |

## Evidencia

Detalle completo, comandos y conteos: [sesion.md](sesion.md).

## Pruebas

| Prueba | Estado |
|---|---|
| `tests/component/landing-nav.test.tsx` (menú móvil) | PASS |
| `tests/component/auth-password-input.test.tsx` (mostrar/ocultar contraseña) | PASS |
| `tests/component/signup-page.test.tsx` (correo ya registrado) | PASS |
| `tests/unit/auth-errors.test.ts` (mensajes de Auth y contraseñas) | PASS |
| `tests/unit/safe-next.test.ts` (casos de M28.2a + QA del frontend) | PASS |
| `tests/unit/proxy-location.test.ts` y guarda de credenciales leyendo `src/proxy.ts` | PASS |
| QA funcional en navegador (85 verificaciones) | 79 OK · 0 FALLA · 6 observaciones |
| Prueba con correos reales (confirmación y recuperación) | PENDIENTE: requiere la casilla del usuario |

## Condición para avanzar

No aplica: no forma parte de la ruta. La ruta sigue con M28.2a.

## Dependencias

Ninguna de la ruta. Se integró sobre `mf/M28.2a`; hereda de ahí `safeNextPath` (`H-E1-49`,
`H-E1-53`) y la guarda de credenciales (`H-E1-58`).

## Intervención requerida del usuario

- Probar el ciclo con correos reales: crear cuenta → confirmar → onboarding → iniciar sesión
  → recuperar contraseña; con sesión iniciada, `/login` tiene que redirigir a `/app`.
- Decidir los pendientes `H-E1-76`, `H-E1-78` y la prevención de `H-E1-81`.

## Hallazgos

`H-E1-73` a `H-E1-81` en [HALLAZGOS.md](../../../HALLAZGOS.md).
