# Pantallas de la app

Todas comparten el mismo shell: sidebar izquierda (logo → Inicio · Chat · Diagnóstico · Uso y costos · Integraciones; abajo Configuración y fila de usuario → Mi perfil) y barra superior derecha con chip "Meta Ads conectado" + avatar "GM" (→ Mi perfil). Integraciones y Configuración no tienen barra superior. No hay campana de notificaciones (se quitó a propósito). Ancho de diseño 1320px; páginas fluidas.

Referencia visual de cada una: `referencia/capturas/<Nombre>.png`; HTML/CSS ya renderizado: `referencia/html/<Nombre>.html` (estático); fuente original: `referencia/fuentes-dc/<Nombre>.dc.html` (formato propio de la herramienta de diseño: sirve para leer CSS y estructura, no se ejecuta).

| Ruta sugerida | Archivo de referencia | Qué es |
|---|---|---|
| `/` | AppInicio | Resumen de cuenta |
| `/chat` | AppChat, AppChatBuscando | Chat |
| `/diagnostico` | AppDiagnostico (oscuro), AppDiagnosticoClaro | Diagnóstico |
| `/uso-y-costos` | AppUsoCostosCero (estado real vacío), AppUsoCostos (ejemplo con números) | Uso y costos |
| `/integraciones` | AppIntegraciones | Integraciones |
| `/configuracion` | AppConfiguracion | Configuración |
| `/perfil` | AppPerfil | Mi perfil |

## Inicio
- Tres tarjetas: **Empresa** (Tecnofast SRL; Rubro Electrónica y tecnología; País Argentina; Moneda Pesos), **Integraciones** (Meta Ads CONECTADO, Google Analytics CONECTADO, Google Ads NO CONECTADO), **Uso de la IA** (US$ 0,00 · Consultas 0 · Latencia promedio 0 s · Costo por consulta US$ 0,00).
- Tarjeta "Próximo paso — Sincronizá tus datos" con botón **Sincronizar deshabilitado** (todavía no hay nada que sincronizar).
- Esta pantalla la armó el diseño sin captura de referencia de SA: confirmar contenido con él.

## Chat
- Título "Tu marketing, en una sola conversación.", subtítulo, tag "Meta Ads", 4 sugerencias ("¿Qué campañas están rindiendo mejor?", "¿Por qué bajó el ROAS esta semana?", "¿Qué anuncios generan más ventas?", "¿Cómo viene el rendimiento vs. el mes pasado?").
- Textarea "Escribí tu pregunta acá…": se envía con el botón o con **Enter** (Shift+Enter = salto de línea). El botón solo está activo si hay texto.
- Click en una sugerencia → la copia en el textarea (no la envía).
- Al enviar se agrega la burbuja del usuario con hora (HH:MM) y avatar GM. **No hay respuesta todavía** (backend pendiente).
- `AppChatBuscando` es el estado "pensando" que debe mostrar el asistente mientras responde: "Buscando en internet…" con avatar robot.
- El historial vive solo en memoria del componente (se pierde al navegar).

## Diagnóstico (oscuro y claro)
- Titular de resumen + 2 párrafos, "Oportunidades destacadas" (3 ítems), y panel colapsable "Análisis completo del diagnóstico" con "Resumen ejecutivo" y 4 módulos (Adquisición, Conversión y ventas, Productos, Clientes y comportamiento).
- La captura original de SA llega solo hasta el ítem 4 de la lista; no hay más contenido definido.
- **Problema de contenido:** el texto del Resumen ejecutivo parece salida cruda de un LLM ("El briefing adjunto te define… no aplico el fallback de proponer temas alternativos"). No debe llegar a producción; se debe generar o redactar de nuevo.
- El panel se abre/cierra (estado `open`).

## Uso y costos
- Selector de rango "Últimos 30 días" (desplegable con 7 / 30 / 90 días) sincronizado con el control segmentado "7 días · 30 días · 3 meses". Los labels del eje X se calculan desde la fecha de hoy según el rango.
- 4 KPIs (Costo total este mes, Consultas totales, Latencia promedio, Costo promedio), gráfico de barras "Costo por día", y 4 métricas de "Rendimiento de la IA" (latencia promedio, P95, consultas procesadas %, errores %).
- `AppUsoCostosCero` = estado real con todo en 0 (US$ 0,00 es costo de uso de IA, no un dato de Meta). `AppUsoCostos` tiene números de ejemplo (US$ 18,42; 1.284 consultas; 2,4 s…): **son placeholders de diseño, no datos reales**.

## Integraciones
- Banner "Conectá tus herramientas" con robot y botón "Ver guía de integraciones"; sección "Marketing y analítica" con 3 tarjetas: Meta Ads (CONECTADO, Configurar), Google Analytics (CONECTADO, Configurar), Google Ads (NO CONECTADO, Conectar).
- "Configurar" (Meta Ads y Google Analytics) → navega a `/configuracion`. "Conectar", "Ver guía" y los menús de tres puntos están sin acción.

## Configuración
- Tarjeta "General": Nombre de la empresa (input), Rubro, País, Moneda (selects), Tema (Oscuro / Claro).
- Las opciones de los selects (Rubro: Electrónica y tecnología, Indumentaria y calzado, Hogar y decoración, Belleza y salud, Alimentos y bebidas, Otro; País: Argentina, Chile, Uruguay, Paraguay, México; Moneda: Pesos, Dólares) son **placeholders del diseño**, no una lista aprobada.
- "Guardar cambios" sin acción por ahora.

## Mi perfil
- Cabecera con avatar de iniciales (se calculan del nombre/apellido en vivo), nombre completo, email, "Miembro desde ago. 2024" y "Guardar cambios".
- Tarjetas: Información personal (Nombre, Apellido, Email), Seguridad (Cambiar contraseña), Foto de perfil (Subir nueva foto / Eliminar foto; JPG o PNG, máx. 5 MB).
- Datos de ejemplo (Gonzalo Mayer, gonzalo@praxa.test) son placeholders.

## Estado del prototipo (qué es real y qué no)
Real en la maqueta: navegación entre páginas, escritura/envío en Chat, selector de rango, links de "Configurar", edición de campos de Configuración y Perfil en memoria, colapsable del Diagnóstico. No existe backend, autenticación, persistencia ni integración real con Meta/GA/Google Ads.
