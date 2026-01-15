/**
 * Session Manager
 *
 * Stores and retrieves the DATS session cookie.
 * Session cookies are encrypted at rest using AES-256-GCM.
 *
 * SECURITY:
 * - Only stores session cookies, NEVER credentials
 * - Session cookies are encrypted with DATS_ENCRYPTION_KEY
 * - Stored at ~/.dats-booking/session.enc
 * - Sessions expire when DATS invalidates them (typically daily)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { logger } from '../utils/logger.js';
import { encrypt, decrypt, deriveKey, generateKey } from './encryption.js';
import { SECURITY_CONSTANTS } from '../constants.js';

export interface StoredSession {
  sessionCookie: string;
  clientId: string;
  createdAt: string;
}

interface EncryptedSession {
  iv: string;
  authTag: string;
  data: string;
  createdAt: string;
}

export class SessionManager {
  private readonly storagePath: string;
  private readonly storageDir: string;
  private readonly keyPath: string;
  private readonly key: Buffer;

  constructor() {
    this.storageDir = join(homedir(), '.dats-booking');
    this.storagePath = join(this.storageDir, 'session.enc');
    this.keyPath = join(this.storageDir, '.key');

    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { mode: 0o700 });
    }

    this.key = this.getOrCreateKey();
  }

  /**
   * Get existing encryption key or generate a new one.
   * Key is stored locally so users don't need to configure anything.
   */
  private getOrCreateKey(): Buffer {
    // Check for legacy environment variable (backward compatibility)
    const envKey = process.env.DATS_ENCRYPTION_KEY;
    if (envKey) {
      return deriveKey(envKey, SECURITY_CONSTANTS.ENCRYPTION_SALT);
    }

    // Auto-generate key if it doesn't exist
    if (existsSync(this.keyPath)) {
      const storedKey = readFileSync(this.keyPath, 'utf8').trim();
      return Buffer.from(storedKey, 'hex');
    }

    // Generate new random key
    const newKeyHex = generateKey();
    writeFileSync(this.keyPath, newKeyHex, { mode: 0o600 });
    logger.info('Generated new encryption key');
    return Buffer.from(newKeyHex, 'hex');
  }

  /**
   * Store encrypted session
   */
  async store(session: StoredSession): Promise<void> {
    const plaintext = JSON.stringify(session);
    const { encrypted, iv, authTag } = encrypt(plaintext, this.key);

    const encryptedData: EncryptedSession = {
      iv,
      authTag,
      data: encrypted,
      createdAt: new Date().toISOString(),
    };

    writeFileSync(this.storagePath, JSON.stringify(encryptedData), {
      mode: 0o600,
    });

    logger.info('Session stored successfully');
  }

  /**
   * Retrieve and decrypt session
   */
  async retrieve(): Promise<StoredSession> {
    if (!existsSync(this.storagePath)) {
      throw new Error('No session found. Please connect your DATS account first.');
    }

    try {
      const encryptedData: EncryptedSession = JSON.parse(
        readFileSync(this.storagePath, 'utf8')
      );

      const decrypted = decrypt(
        encryptedData.data,
        encryptedData.iv,
        encryptedData.authTag,
        this.key
      );

      return JSON.parse(decrypted) as StoredSession;
    } catch {
      throw new Error('Failed to decrypt session. The session may be corrupted.');
    }
  }

  /**
   * Check if a session exists
   */
  hasSession(): boolean {
    return existsSync(this.storagePath);
  }

  /**
   * Delete stored session
   */
  async clear(): Promise<void> {
    if (existsSync(this.storagePath)) {
      unlinkSync(this.storagePath);
      logger.info('Session cleared');
    }
  }

  /**
   * Get session age in milliseconds
   */
  async getSessionAge(): Promise<number | null> {
    if (!this.hasSession()) {
      return null;
    }

    try {
      const encryptedData: EncryptedSession = JSON.parse(
        readFileSync(this.storagePath, 'utf8')
      );
      const createdAt = new Date(encryptedData.createdAt);
      return Date.now() - createdAt.getTime();
    } catch {
      return null;
    }
  }

  /**
   * Get storage path (for testing/debugging)
   */
  getStoragePath(): string {
    return this.storagePath;
  }

  /**
   * Migrate from old credentials.enc to session.enc
   * Called during upgrade to delete old credential storage
   */
  async migrateFromCredentials(): Promise<boolean> {
    const oldPath = join(this.storageDir, 'credentials.enc');
    if (existsSync(oldPath)) {
      unlinkSync(oldPath);
      logger.info('Migrated: Deleted old credentials.enc file');
      return true;
    }
    return false;
  }
}
