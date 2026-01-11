/**
 * AES-256-GCM Credential Manager
 *
 * Encrypts and stores DATS credentials securely.
 * Credentials stored at ~/.dats-booking/credentials.enc
 *
 * SECURITY REQUIREMENTS:
 * - AES-256-GCM encryption
 * - Key from DATS_ENCRYPTION_KEY env var
 * - Never log credentials or PII
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
import type {
  DATSCredentials,
  EncryptedCredentials,
  AuditLogEntry,
} from '../types.js';
import { logger } from '../utils/logger.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT = 'dats-booking-salt';

export class CredentialManager {
  private readonly storagePath: string;
  private readonly storageDir: string;
  private readonly key: Buffer;

  constructor() {
    const encryptionKey = process.env.DATS_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('DATS_ENCRYPTION_KEY environment variable is required');
    }

    this.key = scryptSync(encryptionKey, SALT, KEY_LENGTH);
    this.storageDir = join(homedir(), '.dats-booking');
    this.storagePath = join(this.storageDir, 'credentials.enc');

    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { mode: 0o700 });
    }
  }

  /**
   * Store encrypted credentials
   */
  async store(credentials: DATSCredentials): Promise<void> {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const plaintext = JSON.stringify(credentials);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    const encryptedData: EncryptedCredentials = {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      data: encrypted.toString('base64'),
      createdAt: new Date().toISOString(),
    };

    writeFileSync(this.storagePath, JSON.stringify(encryptedData), {
      mode: 0o600,
    });

    this.auditLog({ action: 'credential_stored', result: 'success' });
  }

  /**
   * Retrieve and decrypt credentials
   */
  async retrieve(): Promise<DATSCredentials> {
    if (!existsSync(this.storagePath)) {
      this.auditLog({
        action: 'credential_accessed',
        result: 'failure',
        errorCode: 'NOT_FOUND',
      });
      throw new Error('Credentials not found. Use setup_credentials tool first.');
    }

    try {
      const encryptedData: EncryptedCredentials = JSON.parse(
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

      this.auditLog({ action: 'credential_accessed', result: 'success' });
      return JSON.parse(decrypted.toString('utf8')) as DATSCredentials;
    } catch {
      this.auditLog({
        action: 'credential_accessed',
        result: 'failure',
        errorCode: 'DECRYPT_FAILED',
      });
      throw new Error('Failed to decrypt credentials. Key may have changed.');
    }
  }

  /**
   * Check if credentials exist
   */
  hasCredentials(): boolean {
    return existsSync(this.storagePath);
  }

  /**
   * Delete stored credentials
   */
  async delete(): Promise<void> {
    if (existsSync(this.storagePath)) {
      unlinkSync(this.storagePath);
    }
  }

  /**
   * Get storage path (for testing)
   */
  getStoragePath(): string {
    return this.storagePath;
  }

  private auditLog(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    const logEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    logger.audit(logEntry);
  }
}
