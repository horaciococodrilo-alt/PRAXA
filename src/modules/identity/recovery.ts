'use server';

import { getWorkerApi } from '@/modules/integrations/db/worker-api';

/**
 * ¿El correo tiene cuenta? Lo usa «olvidé mi contraseña» para avisar que no existe (riesgo
 * aceptado H-E1-259, como H-E1-73 en el registro). Consulta `worker_api.email_has_account`
 * con el rol acotado del servidor; la función no está expuesta por la Data API.
 *
 * Devuelve solo el estado. Un correo mal formado o un fallo de la base es «desconocido», y la
 * pantalla sigue con el envío de siempre: la comprobación nunca bloquea la recuperación.
 */
export type EstadoCorreo = 'existe' | 'no_existe' | 'desconocido';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAXIMO = 320;

export async function correoTieneCuenta(email: unknown): Promise<EstadoCorreo> {
  if (typeof email !== 'string') return 'desconocido';
  const normalizado = email.trim().toLowerCase();
  if (normalizado.length > MAXIMO || !CORREO.test(normalizado)) return 'desconocido';
  try {
    const filas = await getWorkerApi().call<{ email_has_account: unknown }>('email_has_account', [normalizado]);
    const valor = filas[0]?.email_has_account;
    if (filas.length !== 1 || typeof valor !== 'boolean') return 'desconocido';
    return valor ? 'existe' : 'no_existe';
  } catch {
    // Sin el detalle: ni el mensaje de la base ni el correo llegan a los registros.
    return 'desconocido';
  }
}
