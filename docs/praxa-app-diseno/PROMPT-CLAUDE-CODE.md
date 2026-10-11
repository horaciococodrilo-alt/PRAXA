# Prompt para pegar en Claude Code

(Abrí Claude Code en la carpeta del proyecto frontend, descomprimí este paquete adentro como `./praxa-app-diseno/` y pegá lo de abajo.)

---

Tenés en `./praxa-app-diseno/` el diseño de la app web de PRAXA (producto B2B SaaS de mejora operativa con IA para ecommerce argentino). Es la **fuente de verdad visual**; implementalo fielmente.

Leé en este orden antes de escribir código:
1. `README.md` y `PANTALLAS.md` — mapa de pantallas, comportamientos y qué es placeholder.
2. `diseno/tokens.css` y `diseno/componentes.md` — tokens y specs de componentes (oscuro; claro solo para Diagnóstico).
3. `referencia/capturas/*.png` — cómo se ve cada pantalla.
4. `referencia/html/*.html` — HTML/CSS ya renderizado de cada pantalla (abrilos en el navegador; usalos para copiar medidas, espaciados y estructura). `referencia/fuentes-dc/*.dc.html` es el formato original de la herramienta de diseño: solo para leer CSS, no se ejecuta.

Qué hacer:
- Armá la app con **React + TypeScript + Vite + React Router** (si el repo ya tiene otro stack, usá ese y avisame). Tokens como CSS variables tomadas de `tokens.css`; fuentes Manrope y JetBrains Mono.
- Componentes reutilizables: `AppShell` (sidebar + topbar), `NavItem`, `Button` (primary / secondary / small / disabled), `Field`, `Select`, `Badge`, `StatusChip`, `Card`, `KpiCard`, `BarChart`. Respetá las medidas de `diseno/componentes.md`.
- Rutas: `/`, `/chat`, `/diagnostico`, `/uso-y-costos`, `/integraciones`, `/configuracion`, `/perfil` (tabla en `PANTALLAS.md`). El diseño de Diagnóstico claro es el único light; implementá el tema con `data-theme` pero no inventes el resto del modo claro.
- Comportamientos a replicar tal cual están en `PANTALLAS.md` (Chat con Enter/Shift+Enter y sin respuesta, selector 7/30/90 en Uso y costos, "Configurar" → `/configuracion`, avatar y fila de usuario → `/perfil`, "Sincronizar" deshabilitado, colapsable del Diagnóstico).
- Datos: todo en cero / vacío como en `AppUsoCostosCero`. **No uses los números de `AppUsoCostos` ni el texto del Diagnóstico como si fueran reales** (son placeholders; el texto del Resumen ejecutivo parece salida cruda de un LLM). Dejá una capa de datos (hooks o funciones `getX()`) con datos mock claramente marcados para enchufar después el backend (FastAPI).
- No agregues campana de notificaciones, ni secciones Ventas / Marketing / Productos en el menú, ni nada que no esté en las capturas.
- Reglas de contenido de `diseno/componentes.md`: "Sin datos reportados" nunca como "$ 0"; las recomendaciones son fase 2 (hay un conflicto abierto con la página Diagnóstico: no lo resuelvas por tu cuenta, listalo en el resumen final).
- Accesibilidad: `<button>`, `<a>`, `<label>` reales; foco visible; contraste según los tokens.

Proceso: primero proponé en pocas líneas la estructura de carpetas y componentes; después implementá pantalla por pantalla empezando por `AppShell` + Inicio, y comparando cada una contra su captura (Playwright o similar a 1320px de ancho). Al terminar, dame: qué quedó igual, qué difiere y por qué, y las decisiones que necesitan respuesta mía.
