# Landing PRAXA — paquete estático

Una carpeta, cero dependencias de build. `index.html` + `assets/`.

## Qué trae
- Cuatro variantes en un solo archivo: escritorio y móvil, cada una en claro y oscuro. Se muestra una sola.
- Corte escritorio/móvil: **768 px**.
- Tema: sigue al sistema (`prefers-color-scheme`). Para fijarlo a mano desde tu app:
  - `praxaTema('dark')` / `praxaTema('light')` lo fija y lo guarda en `localStorage` (`praxa-tema`).
  - `praxaTema()` vuelve a automático.
- Sin JavaScript se muestra la versión clara.
- Fuentes Manrope y JetBrains Mono: se cargan desde Google Fonts (el `<link>` está en el `<head>`). Si preferís autoalojarlas, descargalas y cambiá ese link.
- La conversación del chat arranca cuando el chat entra en pantalla.

## Cómo usarla
- **Estática:** copiá la carpeta a donde sirvas archivos estáticos y listo.
- **FastAPI:** `app.mount("/", StaticFiles(directory="praxa-landing", html=True), name="landing")` (montalo después de tus rutas de API).
- **React/Vite:** copiá `assets/` a `public/` y `index.html` como página aparte, o pasá el contenido a un componente.

## Links a reemplazar
Los links internos apuntan a rutas que tenés que definir (o cambiar):
`/login`, `/solicitar-acceso`, `/legal`, `/producto`, `/seguridad`, `/` (logo).
También hay un `mailto:hola@praxa.com.ar`.

## Ojo con
- Los números y textos del chat, de los gráficos y de las tarjetas son de ejemplo (el pie de página lo dice).
- "Leer completo →" en la captura del diagnóstico es parte de la imagen, no un botón.
- Cada variante repite el HTML: el archivo pesa unos 840 KB sin comprimir (unos 110 KB con gzip).
