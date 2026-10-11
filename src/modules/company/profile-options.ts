/**
 * Opciones de rubro, país y moneda de Configuración.
 *
 * Son las del diseño (docs/praxa-app-diseno/PANTALLAS.md): placeholders, no una lista
 * aprobada. Por eso viven acá y no en la base (0013 solo exige texto no vacío).
 */
export const RUBROS = [
  'Electrónica y tecnología',
  'Indumentaria y calzado',
  'Hogar y decoración',
  'Belleza y salud',
  'Alimentos y bebidas',
  'Otro',
] as const;

export const PAISES = ['Argentina', 'Chile', 'Uruguay', 'Paraguay', 'México'] as const;

export const MONEDAS = ['Pesos', 'Dólares'] as const;
