import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { buildCredentialAad, type CredentialAadInput } from '@/modules/integrations/contract';
import type { CredentialKeyring } from './keyring';

export type SealedCredential = {
  ciphertext: string;
  iv: string;
  auth_tag: string;
  key_version: number;
};

export class CredentialMaterialError extends Error {
  readonly code: 'invalid_plaintext' | 'invalid_material';

  constructor(code: 'invalid_plaintext' | 'invalid_material') {
    super(code === 'invalid_plaintext' ? 'Texto de credencial inválido.' : 'Material de credencial inválido.');
    this.name = 'CredentialMaterialError';
    this.code = code;
  }
}

export class CredentialDecryptionError extends Error {
  readonly code = 'decryption_failed';

  constructor() {
    super('No se pudo autenticar la credencial cifrada.');
    this.name = 'CredentialDecryptionError';
  }
}

const inspectCustom: unique symbol = Symbol.for('nodejs.util.inspect.custom') as never;

export class SecretValue {
  readonly #value: string;

  constructor(value: string) { this.#value = value; }
  reveal(): string { return this.#value; }
  toString(): '[redactado]' { return '[redactado]'; }
  toJSON(): '[redactado]' { return '[redactado]'; }
  [inspectCustom](): '[redactado]' { return '[redactado]'; }
}

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function decodeBase64(value: unknown, length?: number): Buffer | null {
  if (typeof value !== 'string' || value.length === 0 || !BASE64.test(value)) return null;
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value || (length !== undefined && decoded.length !== length)) return null;
  return decoded;
}

function aadBytes(aad: CredentialAadInput): Buffer {
  try { return Buffer.from(buildCredentialAad(aad), 'utf8'); }
  catch { throw new CredentialMaterialError('invalid_material'); }
}

export function sealCredential(plaintext: string, aad: CredentialAadInput, keyring: CredentialKeyring): SealedCredential {
  if (typeof plaintext !== 'string' || plaintext.length === 0) throw new CredentialMaterialError('invalid_plaintext');
  const aadBuffer = aadBytes(aad);
  const version = keyring.currentVersion;
  const key = keyring.keyFor(version);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  cipher.setAAD(aadBuffer);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    auth_tag: cipher.getAuthTag().toString('base64'),
    key_version: version,
  };
}

export function openCredential(sealed: SealedCredential, aad: CredentialAadInput, keyring: CredentialKeyring): SecretValue {
  const material = sealed as Partial<SealedCredential> | null;
  const ciphertext = decodeBase64(material?.ciphertext);
  const iv = decodeBase64(material?.iv, 12);
  const authTag = decodeBase64(material?.auth_tag, 16);
  if (!ciphertext || !iv || !authTag || !Number.isInteger(material?.key_version) ||
      (material?.key_version ?? 0) <= 0 || (material?.key_version ?? 0) > 2_147_483_647) {
    throw new CredentialMaterialError('invalid_material');
  }
  const aadBuffer = aadBytes(aad);
  const key = keyring.keyFor(material!.key_version!);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    decipher.setAAD(aadBuffer);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return new SecretValue(plaintext.toString('utf8'));
  } catch {
    throw new CredentialDecryptionError();
  }
}
