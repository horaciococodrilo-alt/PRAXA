import { maskExternalAccountId } from '@/modules/integrations/contract/connection';

import { CHAT_LIMITS } from './limits';

function passesLuhn(value: string): boolean {
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let total = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = digits.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    total += digit;
    double = !double;
  }
  return total % 10 === 0;
}

export function redactQuestion(raw: string): string {
  const redacted = raw
    .replace(/\b(?:https?:\/\/|www\.)[^\s<>]+/giu, '[URL]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, '[EMAIL]')
    .replace(/(?<![A-Za-z0-9_-])(?:EAA|sb_secret_|sbp_|sk-|eyJ)[A-Za-z0-9_-]{16,}(?![A-Za-z0-9_-])/g, '[SECRETO]')
    .replace(/(?<![A-Za-z0-9_-])(?!act_)[A-Za-z0-9_-]{32,}(?![A-Za-z0-9_-])/g, '[SECRETO]')
    .replace(/(?<!\d)\d{22}(?!\d)/g, '[CBU]')
    .replace(/(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g, (candidate) =>
      passesLuhn(candidate) ? '[TARJETA]' : candidate)
    .replace(/(?<!\d)\d{2}-\d{8}-\d(?!\d)/g, '[CUIT]')
    .replace(/(?<![A-Za-z0-9_])\+(?:\d[ -]?){7,14}\d(?!\d)/g, (candidate) => {
      const digits = candidate.replace(/\D/g, '');
      return digits.length >= 8 && digits.length <= 15 ? '[TELEFONO]' : candidate;
    })
    .replace(/\bact_[A-Za-z0-9_-]{1,64}\b/g, (id) => maskExternalAccountId(id));
  return Array.from(redacted).slice(0, CHAT_LIMITS.maxQuestionChars).join('');
}
