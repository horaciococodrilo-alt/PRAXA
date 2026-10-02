import 'server-only';

export type CredentialKeyring = {
  readonly currentVersion: number;
  readonly versions: readonly number[];
  has(version: number): boolean;
  keyFor(version: number): Buffer;
};

type KeyringCode = 'keyring_missing' | 'keyring_invalid' | 'current_invalid';

export class CredentialKeyringError extends Error {
  readonly code: KeyringCode;

  constructor(code: KeyringCode, message: string) {
    super(message);
    this.name = 'CredentialKeyringError';
    this.code = code;
  }
}

export class CredentialKeyVersionUnknownError extends Error {
  readonly code = 'unknown_key_version';

  constructor(version: number) {
    super(`La versión de clave ${version} no está en el llavero.`);
    this.name = 'CredentialKeyVersionUnknownError';
  }
}

const MAX_VERSION = 2_147_483_647;
const VERSION = /^[1-9]\d*$/;
const BASE64_KEY = /^[A-Za-z0-9+/]{43}=$/;

function validVersion(value: string): number | null {
  if (!VERSION.test(value)) return null;
  const version = Number(value);
  return Number.isSafeInteger(version) && version <= MAX_VERSION ? version : null;
}

export function parseCredentialKeyring(keys: string | undefined, current: string | undefined): CredentialKeyring {
  if (!keys?.trim()) throw new CredentialKeyringError('keyring_missing', 'Falta PRAXA_CREDENTIAL_KEYS.');

  const parsed = new Map<number, Buffer>();
  for (const [index, rawPair] of keys.split(',').entries()) {
    const pair = rawPair.trim();
    const parts = pair.split(':');
    if (parts.length !== 2) {
      throw new CredentialKeyringError('keyring_invalid', `Par ${index + 1}: se requiere versión y clave.`);
    }
    const version = validVersion(parts[0].trim());
    if (version === null) {
      throw new CredentialKeyringError('keyring_invalid', `Par ${index + 1}: versión inválida.`);
    }
    if (parsed.has(version)) {
      throw new CredentialKeyringError('keyring_invalid', `Par ${index + 1}: versión repetida.`);
    }
    const encoded = parts[1].trim();
    if (!BASE64_KEY.test(encoded)) {
      throw new CredentialKeyringError('keyring_invalid', `Par ${index + 1}: clave base64 inválida.`);
    }
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== 32 || key.toString('base64') !== encoded) {
      throw new CredentialKeyringError('keyring_invalid', `Par ${index + 1}: la clave debe medir 32 bytes.`);
    }
    parsed.set(version, key);
  }

  const currentVersion = current === undefined ? null : validVersion(current.trim());
  if (currentVersion === null || !parsed.has(currentVersion)) {
    const suffix = currentVersion === null ? '' : ` (${currentVersion})`;
    throw new CredentialKeyringError('current_invalid', `PRAXA_CREDENTIAL_KEY_CURRENT inválida${suffix}.`);
  }

  const versions = Object.freeze([...parsed.keys()].sort((a, b) => a - b));
  return Object.freeze({
    currentVersion,
    versions,
    has(version: number) { return parsed.has(version); },
    keyFor(version: number) {
      const key = parsed.get(version);
      if (!key) throw new CredentialKeyVersionUnknownError(version);
      return Buffer.from(key);
    },
  });
}

let cached: CredentialKeyring | undefined;

export function getCredentialKeyring(): CredentialKeyring {
  return cached ??= parseCredentialKeyring(
    process.env.PRAXA_CREDENTIAL_KEYS,
    process.env.PRAXA_CREDENTIAL_KEY_CURRENT,
  );
}
