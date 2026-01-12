/**
 * Session Store for Authentication Results
 *
 * Uses Azure Blob Storage with SAS token for persistence across
 * serverless function instances. Each session is stored as a small JSON blob.
 *
 * SECURITY: This store NEVER holds credentials - only session results.
 * Credentials are passed through to DATS API and immediately discarded.
 */

// Polyfill for globalThis.crypto in Azure Functions runtime
import * as nodeCrypto from 'crypto';
if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = nodeCrypto.webcrypto;
}

import { ContainerClient, RestError } from '@azure/storage-blob';

export interface AuthResult {
  status: 'pending' | 'success' | 'failed';
  sessionCookie?: string;
  clientId?: string;
  error?: string;
  createdAt: number;
}

// Session expiry time: 5 minutes
const SESSION_EXPIRY_MS = 5 * 60 * 1000;

// Lazy-initialized blob container client
let containerClient: ContainerClient | null = null;

/**
 * Get the blob container client, initializing if needed
 */
function getContainerClient(): ContainerClient {
  if (containerClient) {
    return containerClient;
  }

  // Get container URL with SAS token from environment
  const containerUrl = process.env.STORAGE_CONTAINER_URL;

  if (!containerUrl) {
    throw new Error(
      'STORAGE_CONTAINER_URL not configured. Set it in app settings.'
    );
  }

  containerClient = new ContainerClient(containerUrl);
  return containerClient;
}

/**
 * Get blob name from session ID (sanitized)
 */
function getBlobName(sessionId: string): string {
  // Session IDs are UUIDs, so they're already safe
  return `session-${sessionId}.json`;
}

/**
 * Initialize a pending session
 */
export async function createPendingSession(sessionId: string): Promise<void> {
  const result: AuthResult = {
    status: 'pending',
    createdAt: Date.now(),
  };

  const container = getContainerClient();
  const blobClient = container.getBlockBlobClient(getBlobName(sessionId));

  const data = JSON.stringify(result);
  await blobClient.upload(data, data.length, {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  });
}

/**
 * Update session with authentication result
 */
export async function updateSession(
  sessionId: string,
  result: Omit<AuthResult, 'createdAt'>
): Promise<void> {
  const container = getContainerClient();
  const blobName = getBlobName(sessionId);
  const blobClient = container.getBlockBlobClient(blobName);

  // Try to get existing session to preserve createdAt
  let createdAt = Date.now();
  try {
    const downloadResponse = await blobClient.download(0);
    const existingData = await streamToString(downloadResponse.readableStreamBody);
    const existing = JSON.parse(existingData) as AuthResult;
    createdAt = existing.createdAt;
  } catch {
    // If blob doesn't exist, use current time
  }

  const fullResult: AuthResult = { ...result, createdAt };
  const data = JSON.stringify(fullResult);

  await blobClient.upload(data, data.length, {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  });
}

/**
 * Get and consume session result
 * For completed sessions, deletes the blob after retrieval (one-time use)
 */
export async function consumeSession(sessionId: string): Promise<AuthResult | null> {
  const container = getContainerClient();
  const blobName = getBlobName(sessionId);
  const blobClient = container.getBlockBlobClient(blobName);

  try {
    // Download blob data
    const downloadResponse = await blobClient.download(0);
    const data = await streamToString(downloadResponse.readableStreamBody);
    const result = JSON.parse(data) as AuthResult;

    // Check expiry
    if (Date.now() - result.createdAt > SESSION_EXPIRY_MS) {
      // Expired - delete and return null
      await blobClient.deleteIfExists();
      return null;
    }

    // For pending sessions, don't delete (keep for polling)
    if (result.status === 'pending') {
      return result;
    }

    // For completed sessions (success/failed), delete after retrieval (one-time use)
    await blobClient.deleteIfExists();
    return result;
  } catch (error) {
    // Handle blob not found
    if (error instanceof RestError && error.statusCode === 404) {
      return null;
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Check if a session exists (without consuming)
 */
export async function sessionExists(sessionId: string): Promise<boolean> {
  const container = getContainerClient();
  const blobClient = container.getBlockBlobClient(getBlobName(sessionId));
  return await blobClient.exists();
}

/**
 * Helper to convert stream to string
 */
async function streamToString(
  readableStream: NodeJS.ReadableStream | undefined
): Promise<string> {
  if (!readableStream) {
    return '';
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readableStream.on('data', (data) => {
      chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    readableStream.on('error', reject);
  });
}
