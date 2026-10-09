const BASE = 'http://praxa.invalid';

/**
 * Destino interno seguro para redirigir después de autenticarse.
 *
 * `next` llega en la URL y lo controla cualquiera que arme el enlace. Además de exigir que
 * empiece con una sola `/`, se rechaza la barra invertida (el navegador convierte `/\x` en
 * `//x`, una URL de otro dominio) y los caracteres de control, y se comprueba que la ruta
 * resuelta siga en el mismo origen. Si algo falla, se usa `fallback`.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/app'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return fallback;
  }

  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  return url.pathname + url.search + url.hash;
}
