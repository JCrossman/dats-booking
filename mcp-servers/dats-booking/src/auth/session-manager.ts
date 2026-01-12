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

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { logger } from '../utils/logger.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT = 'dats-session-salt';

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
      return scryptSync(envKey, SALT, KEY_LENGTH);
    }

    // Auto-generate key if it doesn't exist
    if (existsSync(this.keyPath)) {
      const storedKey = readFileSync(this.keyPath, 'utf8').trim();
      return Buffer.from(storedKey, 'hex');
    }

    // Generate new random key
    const newKey = randomBytes(KEY_LENGTH);
    writeFileSync(this.keyPath, newKey.toString('hex'), { mode: 0o600 });
    logger.info('Generated new encryption key');
    return newKey;
  }

  /**
   * Store encrypted session
   */
  async store(session: StoredSession): Promise<void> {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const plaintext = JSON.stringify(session);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const encryptedData: EncryptedSession = {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      data: encrypted.toString('base64'),
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

      const iv = Buffer.from(encryptedData.iv, 'base64');
      const authTag = Buffer.from(encryptedData.authTag, 'base64');
      const encrypted = Buffer.from(encryptedData.data, 'base64');

      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return JSON.parse(decrypted.toString('utf8')) as StoredSession;
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
