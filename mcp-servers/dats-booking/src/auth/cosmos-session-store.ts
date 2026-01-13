/**
 * Cosmos DB Session Store for Remote MCP Mode
 *
 * Multi-user session storage with encryption at rest.
 * Used when MCP server runs remotely (Azure Container Apps).
 *
 * SECURITY:
 * - Sessions encrypted using AES-256-GCM before storage
 * - 24-hour TTL with automatic cleanup via Cosmos DB TTL
 * - POPA compliant: Data residency in Canada Central
 * - Partition key = session ID for isolation
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';
import { logger } from '../utils/logger.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT = 'cosmos-session-salt';
const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export interface StoredSession {
  sessionCookie: string;
  clientId: string;
  createdAt: string;
}

interface CosmosSessionDocument {
  id: string; // Session ID (partition key)
  encryptedCookie: string; // Encrypted DATS session cookie
  clientId: string; // DATS client ID (not sensitive)
  iv: string; // Encryption IV
  authTag: string; // Encryption auth tag
  createdAt: number; // Unix timestamp
  ttl: number; // TTL in seconds for Cosmos DB auto-cleanup
}

export class CosmosSessionStore {
  private container: Container | null = null;
  private database: Database | null = null;
  private encryptionKey: Buffer;
  private readonly cosmosEndpoint: string;
  private readonly databaseName: string;
  private readonly containerName: string;
  private initialized = false;

  constructor() {
    // Get configuration from environment
    this.cosmosEndpoint = process.env.COSMOS_ENDPOINT || '';
    this.databaseName = process.env.COSMOS_DATABASE || 'dats-sessions';
    this.containerName = process.env.COSMOS_CONTAINER || 'sessions';

    // Derive encryption key from environment
    const keySource =
      process.env.COSMOS_ENCRYPTION_KEY || process.env.DATS_ENCRYPTION_KEY;
    if (!keySource) {
      throw new Error(
        'COSMOS_ENCRYPTION_KEY or DATS_ENCRYPTION_KEY environment variable required'
      );
    }
    this.encryptionKey = scryptSync(keySource, SALT, KEY_LENGTH);
  }

  /**
   * Initialize Cosmos DB connection (lazy initialization)
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.cosmosEndpoint) {
      throw new Error('COSMOS_ENDPOINT environment variable required');
    }

    try {
      // Use Managed Identity for Azure authentication
      const credential = new DefaultAzureCredential();
      const client = new CosmosClient({
        endpoint: this.cosmosEndpoint,
        aadCredentials: credential,
      });

      this.database = client.database(this.databaseName);
      this.container = this.database.container(this.containerName);

      // Verify connection by reading container metadata
      await this.container.read();
      this.initialized = true;
      logger.info('Cosmos DB session store initialized');
    } catch (error) {
      logger.error('Failed to initialize Cosmos DB', error as Error);
      throw new Error('Failed to connect to Cosmos DB session store');
    }
  }

  /**
   * Encrypt session cookie before storage
   */
  private encrypt(plaintext: string): {
    encrypted: string;
    iv: string;
    authTag: string;
  } {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  /**
   * Decrypt session cookie after retrieval
   */
  private decrypt(encrypted: string, iv: string, authTag: string): string {
    const decipher = createDecipheriv(
      ALGORITHM,
      this.encryptionKey,
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
   * Store a new session
   */
  async store(sessionId: string, session: StoredSession): Promise<void> {
    await this.initialize();

    const { encrypted, iv, authTag } = this.encrypt(session.sessionCookie);

    const document: CosmosSessionDocument = {
      id: sessionId,
      encryptedCookie: encrypted,
      clientId: session.clientId,
      iv,
      authTag,
      createdAt: Date.now(),
      ttl: SESSION_TTL_SECONDS,
    };

    await this.container!.items.upsert(document);
    logger.info(`Session stored: ${sessionId.substring(0, 8)}...`);
  }

  /**
   * Retrieve a session by ID
   */
  async retrieve(sessionId: string): Promise<StoredSession | null> {
    await this.initialize();

    try {
      const { resource } = await this.container!.item(
        sessionId,
        sessionId
      ).read<CosmosSessionDocument>();

      if (!resource) {
        return null;
      }

      // Decrypt the session cookie
      const sessionCookie = this.decrypt(
        resource.encryptedCookie,
        resource.iv,
        resource.authTag
      );

      return {
        sessionCookie,
        clientId: resource.clientId,
        createdAt: new Date(resource.createdAt).toISOString(),
      };
    } catch (error) {
      // 404 means session not found
      if ((error as { code?: number }).code === 404) {
        return null;
      }
      logger.error('Failed to retrieve session', error as Error);
      return null;
    }
  }

  /**
   * Check if a session exists
   */
  async hasSession(sessionId: string): Promise<boolean> {
    const session = await this.retrieve(sessionId);
    return session !== null;
  }

  /**
   * Delete a session
   */
  async delete(sessionId: string): Promise<void> {
    await this.initialize();

    try {
      await this.container!.item(sessionId, sessionId).delete();
      logger.info(`Session deleted: ${sessionId.substring(0, 8)}...`);
    } catch (error) {
      // Ignore 404 (session already deleted)
      if ((error as { code?: number }).code !== 404) {
        logger.error('Failed to delete session', error as Error);
      }
    }
  }

  /**
   * Refresh session TTL (extend expiration on activity)
   */
  async refresh(sessionId: string): Promise<void> {
    await this.initialize();

    try {
      // Patch just the TTL field to extend session
      await this.container!.item(sessionId, sessionId).patch([
        { op: 'replace', path: '/ttl', value: SESSION_TTL_SECONDS },
        { op: 'replace', path: '/createdAt', value: Date.now() },
      ]);
      logger.debug(`Session refreshed: ${sessionId.substring(0, 8)}...`);
    } catch (error) {
      // Ignore errors - session may have expired
      logger.debug('Failed to refresh session (may be expired)');
    }
  }

  /**
   * Get session age in milliseconds
   */
  async getSessionAge(sessionId: string): Promise<number | null> {
    await this.initialize();

    try {
      const { resource } = await this.container!.item(
        sessionId,
        sessionId
      ).read<CosmosSessionDocument>();

      if (!resource) {
        return null;
      }

      return Date.now() - resource.createdAt;
    } catch {
      return null;
    }
  }

  /**
   * Create a pending session placeholder (for auth flow)
   * Used when user starts connect_account but hasn't completed auth yet
   */
  async createPending(sessionId: string): Promise<void> {
    await this.initialize();

    const document: CosmosSessionDocument = {
      id: sessionId,
      encryptedCookie: '', // Empty until auth completes
      clientId: '',
      iv: '',
      authTag: '',
      createdAt: Date.now(),
      ttl: 300, // 5 minutes for auth flow
    };

    await this.container!.items.upsert(document);
    logger.info(`Pending session created: ${sessionId.substring(0, 8)}...`);
  }

  /**
   * Update a pending session with auth result
   */
  async completePending(
    sessionId: string,
    session: StoredSession
  ): Promise<void> {
    const { encrypted, iv, authTag } = this.encrypt(session.sessionCookie);

    await this.container!.item(sessionId, sessionId).patch([
      { op: 'replace', path: '/encryptedCookie', value: encrypted },
      { op: 'replace', path: '/clientId', value: session.clientId },
      { op: 'replace', path: '/iv', value: iv },
      { op: 'replace', path: '/authTag', value: authTag },
      { op: 'replace', path: '/ttl', value: SESSION_TTL_SECONDS },
    ]);

    logger.info(`Session completed: ${sessionId.substring(0, 8)}...`);
  }
}
