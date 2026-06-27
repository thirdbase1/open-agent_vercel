import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Server-only AES-256-GCM encryption for BYOK API keys.
 *
 * Keys are encrypted at rest in the database and never returned to the client.
 * The encryption key is derived from BETTER_AUTH_SECRET (already required by
 * the app) via scrypt, so no additional secret needs to be configured.
 */

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const VERSION = "v1";
// Fixed, non-secret salt. The real secret is BETTER_AUTH_SECRET; the salt only
// needs to be stable so the derived key is reproducible across processes.
const SCRYPT_SALT = "open-agents.byok.v1";

let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length === 0) {
    throw new Error(
      "BETTER_AUTH_SECRET is required to encrypt BYOK API keys. Set it in your environment.",
    );
  }

  cachedKey = scryptSync(secret, SCRYPT_SALT, KEY_LENGTH);
  return cachedKey;
}

/**
 * Encrypt a plaintext secret. Returns a self-describing string:
 * "v1:<ivBase64>:<authTagBase64>:<ciphertextBase64>".
 */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a value produced by `encryptSecret`. Throws if the payload is
 * malformed or has been tampered with (GCM auth tag mismatch).
 */
export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Invalid encrypted secret format");
  }

  const [, ivBase64, authTagBase64, ciphertextBase64] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const ciphertext = Buffer.from(ciphertextBase64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

/** Returns true when a string looks like an `encryptSecret` payload. */
export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(`${VERSION}:`) && value.split(":").length === 4;
}

/** Produce a masked preview of a key for display, e.g. "sk-…a1b2". */
export function maskKey(plaintext: string): string {
  if (plaintext.length <= 4) {
    return "••••";
  }
  return `••••${plaintext.slice(-4)}`;
}
