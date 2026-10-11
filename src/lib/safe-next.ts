/** Adonde se va después de entrar o confirmar la cuenta si no hay otro destino válido. */
export const DESTINO_TRAS_ENTRAR = '/app/perfil';

/** Devuelve únicamente una ruta interna apta para redirigir tras autenticar. */
export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return DESTINO_TRAS_ENTRAR;
  }

  try {
    const base = 'https://praxa.invalid';
    const parsed = new URL(value, base);
    if (parsed.origin !== base) return DESTINO_TRAS_ENTRAR;
    // La normalización convierte `/.//evil.example` en `//evil.example`, que el navegador
    // interpreta como URL relativa al protocolo (H-E1-53).
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return path.startsWith('//') ? DESTINO_TRAS_ENTRAR : path;
  } catch {
    return DESTINO_TRAS_ENTRAR;
  }
}
