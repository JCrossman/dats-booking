/**
 * Shared Encryption Module
 *
 * Provides AES-256-GCM encryption/decryption for session storage.
 * Used by both local file storage and Cosmos DB storage.
 *
 * SECURITY:
 * - AES-256-GCM authenticated encryption
 * - Random IV per encryption
 * - Key derivation using scrypt
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { SECURITY_CONSTANTS } from '../constants.js';

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * @param plaintext - String to encrypt
 * @param key - Encryption key (32 bytes)
 * @returns Encrypted data, IV, and auth tag (all base64-encoded)
 */
export function encrypt(plaintext: string, key: Buffer): EncryptionResult {
  const iv = randomBytes(SECURITY_CONSTANTS.ENCRYPTION_IV_LENGTH);
  const cipher = createCipheriv(SECURITY_CONSTANTS.ENCRYPTION_ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM
 *
 * @param encrypted - Encrypted data (base64-encoded)
 * @param iv - Initialization vector (base64-encoded)
 * @param authTag - Authentication tag (base64-encoded)
 * @param key - Encryption key (32 bytes)
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export function decrypt(encrypted: string, iv: string, authTag: string, key: Buffer): string {
  const decipher = createDecipheriv(
    SECURITY_CONSTANTS.ENCRYPTION_ALGORITHM,
    key,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Derive encryption key from password/key source using scrypt
 *
 * @param keySource - Password or key material
 * @param salt - Salt for key derivation
 * @returns 32-byte encryption key
 */
export function deriveKey(keySource: string, salt: string): Buffer {
  return scryptSync(keySource, salt, SECURITY_CONSTANTS.ENCRYPTION_KEY_LENGTH);
}

/**
 * Generate a random encryption key
 *
 * @returns 32-byte random key (hex-encoded for storage)
 */
export function generateKey(): string {
  return randomBytes(SECURITY_CONSTANTS.ENCRYPTION_KEY_LENGTH).toString('hex');
}
