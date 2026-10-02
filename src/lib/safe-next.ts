/** Devuelve únicamente una ruta interna apta para redirigir tras autenticar. */
export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/app';
  }

  try {
    const base = 'https://praxa.invalid';
    const parsed = new URL(value, base);
    if (parsed.origin !== base) return '/app';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/app';
  }
}
