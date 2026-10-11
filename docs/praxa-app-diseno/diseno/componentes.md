# Componentes (modo oscuro) — fuente: tablero "Componentes"

Valores ya aplicados en las pantallas de la app. Colores en `tokens.css`.

| Componente | Spec |
|---|---|
| Botón primario | alto mín. 46px, radio 10, fondo `--accent` `#3ECFB8`, texto `#04100E`, 14.5px / 700 |
| Botón secundario | alto mín. 46px, borde `--line-strong` `#27423E`, fondo transparente, 14px / 600 |
| Botón chico ("Chico") | alto mín. 36px, radio 9, 13px / 600 (usado en "Configurar", "Subir nueva foto", "Eliminar foto") |
| Botón deshabilitado | borde `--line-soft` `#152927`, texto `#5F7874`, `cursor: not-allowed` (usado en "Sincronizar" de Inicio) |
| Campo (input / select) | alto mín. 46px, radio 10, borde `#27423E`, fondo `--field` `#0A1413`, 14.5px |
| Ítem de navegación | alto mín. 44px, radio 10. Activo: fondo `--surface-accent` `#12302B`, 14px / 600, sin recuadro detrás del ícono. Inactivo: texto `#9FB5B1`, 14px / 500 |
| Chip de estado (barra superior) | fondo `--surface-sunken` `#09120F`, borde `--line` `#1C3330`, píldora; punto de estado + texto "Meta Ads conectado" |
| Badges | píldora 11px, mayúsculas. "CONECTADO": relleno menta. "NO CONECTADO": solo contorno |
| Opción de tema (Configuración) | 60px de alto; la seleccionada lleva borde `--accent` |
| Enviar (Chat) | cuadrado 44px con ícono de flecha |
| Números de KPI | JetBrains Mono |

## Reglas de contenido de Componentes (leer antes de implementar datos reales)
- "Sin datos reportados" nunca se escribe como "$ 0".
- Ninguna pantalla recomienda (las recomendaciones son fase 2). **Conflicto abierto:** la página Diagnóstico muestra "Oportunidades destacadas"; decidir con SA si es excepción o queda fuera de fase 1.

## Light
Solo existe `AppDiagnosticoClaro` en modo claro (menú activo `#E4F8F3` / texto `#0E6B5C`, chip blanco, bordes `#D4E2DF`). El resto de la app solo está diseñada en oscuro; el toggle de tema en Configuración es visual por ahora.
