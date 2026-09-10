import { describe, expect, it } from 'vitest';

import { fingerprint } from '@/components/onboarding-wizard';

/**
 * Detección de cambios sin guardar en el onboarding.
 *
 * El problema que resuelve: la pantalla de Revisión mostraba el estado local del
 * formulario, mientras que "Confirmar contexto" activa lo que está guardado en la base.
 * Se podía ver un objetivo y confirmar otro. Ahora se comparan las huellas y, si
 * difieren, no se deja confirmar.
 *
 * La huella tiene que ser sensible al contenido e insensible a lo que no se persiste.
 */

const base = {
  companyName: 'Mi Tienda',
  systems: [{ system_key: 'shopify', label: 'Shopify', notes: null }],
  hasDefinedObjective: true,
  objectives: [
    {
      kind: 'primary' as const,
      title: 'Aumentar la conversión',
      description: null,
      priority: 'high' as const,
      horizon: 'short' as const,
      indicator_name: null,
      target_value: null,
      target_unit: null,
      position: 0,
    },
  ],
  problems: 'Carritos abandonados',
  constraints: '',
  additionalContext: '',
};

describe('detección de cambios sin guardar', () => {
  it('el mismo contenido produce la misma huella', () => {
    expect(fingerprint(base)).toBe(fingerprint({ ...base }));
  });

  it('cambiar el título de un objetivo la cambia', () => {
    const edited = {
      ...base,
      objectives: [{ ...base.objectives[0], title: 'Reducir faltantes' }],
    };
    expect(fingerprint(edited)).not.toBe(fingerprint(base));
  });

  it('cambiar el nombre de la empresa la cambia', () => {
    expect(fingerprint({ ...base, companyName: 'Otra Tienda' })).not.toBe(fingerprint(base));
  });

  it('agregar un problema la cambia', () => {
    expect(fingerprint({ ...base, problems: 'Carritos abandonados\nDemoras' })).not.toBe(
      fingerprint(base),
    );
  });

  it('marcar "sin objetivo definido" la cambia', () => {
    expect(fingerprint({ ...base, hasDefinedObjective: false })).not.toBe(fingerprint(base));
  });

  it('el orden de los sistemas no la cambia: no es contenido', () => {
    const dos = {
      ...base,
      systems: [
        { system_key: 'shopify', label: 'Shopify', notes: null },
        { system_key: 'meta-ads', label: 'Meta Ads', notes: null },
      ],
    };
    const invertido = { ...dos, systems: [...dos.systems].reverse() };
    expect(fingerprint(invertido)).toBe(fingerprint(dos));
  });

  it('los espacios al borde no la cambian: se normalizan al guardar', () => {
    expect(fingerprint({ ...base, companyName: '  Mi Tienda  ' })).toBe(fingerprint(base));
  });

  it('un objetivo vacío a medio escribir no la cambia: no se persiste', () => {
    const conVacio = {
      ...base,
      objectives: [...base.objectives, { ...base.objectives[0], kind: 'secondary' as const, title: '   ' }],
    };
    expect(fingerprint(conVacio)).toBe(fingerprint(base));
  });

  it('con "sin objetivo definido", los objetivos cargados no cuentan', () => {
    const sinObjetivo = { ...base, hasDefinedObjective: false };
    const sinObjetivoConBasura = {
      ...sinObjetivo,
      objectives: [{ ...base.objectives[0], title: 'Algo que quedó escrito' }],
    };
    expect(fingerprint(sinObjetivoConBasura)).toBe(fingerprint(sinObjetivo));
  });
});
