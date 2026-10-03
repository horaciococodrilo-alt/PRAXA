/** Devuelve únicamente una ruta interna apta para redirigir tras autenticar. */
export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/app';
  }

  try {
    const base = 'https://praxa.invalid';
    const parsed = new URL(value, base);
    if (parsed.origin !== base) return '/app';
    // La normalización convierte `/.//evil.example` en `//evil.example`, que el navegador
    // interpreta como URL relativa al protocolo (H-E1-53).
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return path.startsWith('//') ? '/app' : path;
  } catch {
    return '/app';
  }
}
