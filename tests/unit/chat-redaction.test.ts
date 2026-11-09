import { describe, expect, it } from 'vitest';

import { redactQuestion } from '@/modules/chat/redaction';

describe('M25a CA-66 — redacción única', () => {
  it.each([
    ['https://ejemplo.test/ruta', '[URL]'],
    ['persona@ejemplo.test', '[EMAIL]'],
    ['EAAabcdefghijklmnop', '[SECRETO]'],
    ['sb_' + 'secret_abcdefghijklmnop', '[SECRETO]'],
    ['sbp_abcdefghijklmnop', '[SECRETO]'],
    ['sk-abcdefghijklmnop', '[SECRETO]'],
    ['eyJabcdefghijklmnop', '[SECRETO]'],
    ['abcdefghijklmnopqrstuvwxyzABCDEF', '[SECRETO]'],
    ['1234567890123456789012', '[CBU]'],
    ['4111 1111 1111 1111', '[TARJETA]'],
    ['20-12345678-9', '[CUIT]'],
    ['+541112345678', '[TELEFONO]'],
    ['act_123456789012', '…9012'],
  ])('redacta %s como %s', (input, expected) => {
    expect(redactQuestion(input)).toBe(expected);
  });

  it('conserva fechas, montos, claves cortas y tarjetas inválidas', () => {
    const text = '01/11/2026 $1.234,56 sk-ropa 4111 1111 1111 1112';
    expect(redactQuestion(text)).toBe(text);
  });

  it('no toma prefijos dentro de palabras', () => {
    const text = 'palabrask-abcdefghijklmnop y EAAcorto';
    expect(redactQuestion(text)).toBe(text);
  });

  it('es idempotente sobre todos sus marcadores', () => {
    const raw = 'persona@ejemplo.test +541112345678 act_123456789012';
    const once = redactQuestion(raw);
    expect(redactQuestion(once)).toBe(once);
  });

  it('redacta antes de recortar incluso un secreto al borde', () => {
    const raw = 'x'.repeat(495) + ' ' + 'sk-abcdefghijklmnop';
    const redacted = redactQuestion(raw);
    expect(redacted).not.toContain('abcdefghijklmnop');
    expect(Array.from(redacted).length).toBeLessThanOrEqual(500);
  });

  it('recorta por puntos de código', () => {
    const raw = '😀'.repeat(501);
    const redacted = redactQuestion(raw);
    expect(Array.from(redacted)).toHaveLength(500);
    expect(redacted.endsWith('😀')).toBe(true);
  });
});
