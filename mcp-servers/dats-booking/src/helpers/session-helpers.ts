/**
 * Session Helper Functions
 *
 * Provides session validation and management functions for both
 * local (stdio) and remote (HTTP) transport modes.
 */

import type { SessionManager } from '../auth/session-manager.js';
import { CosmosSessionStore } from '../auth/cosmos-session-store.js';
import { DATSApi } from '../api/dats-api.js';
import { logger } from '../utils/logger.js';

/**
 * Check if running in remote (HTTP) mode based on transport mode
 */
export function isRemoteMode(transportMode: string): boolean {
  return transportMode === 'http';
}

/**
 * Lazy-initialized Cosmos DB session store for remote mode
 */
let cosmosSessionStore: CosmosSessionStore | null = null;

export function getCosmosStore(): CosmosSessionStore {
  if (!cosmosSessionStore) {
    cosmosSessionStore = new CosmosSessionStore();
  }
  return cosmosSessionStore;
}

/**
 * Validate session and return session credentials if valid
 *
 * This function attempts to validate the session by making a test API call.
 * For remote mode, it checks Cosmos DB; for local mode, it checks the file-based session.
 *
 * @param sessionId - Required for remote mode, optional for local mode
 * @param sessionManager - Local session manager (stdio mode)
 * @param isRemote - Whether running in remote mode
 * @returns Session credentials if valid, null if expired/invalid
 */
export async function getValidSession(
  sessionId: string | undefined,
  sessionManager: SessionManager,
  isRemote: boolean
): Promise<{ sessionCookie: string; clientId: string } | null> {
  // Remote mode: use Cosmos DB session store
  if (isRemote) {
    if (!sessionId) {
      return null;
    }

    try {
      const store = getCosmosStore();
      const session = await store.retrieve(sessionId);
      if (!session) {
        return null;
      }

      // Validate session with DATS API
      const api = new DATSApi({ sessionCookie: session.sessionCookie });
      await api.getClientInfo(session.clientId);

      // Refresh TTL on successful use
      await store.refresh(sessionId);

      return {
        sessionCookie: session.sessionCookie,
        clientId: session.clientId,
      };
    } catch {
      // Session invalid - delete from store
      await getCosmosStore().delete(sessionId);
      return null;
    }
  }

  // Local mode: use file-based session manager
  if (!sessionManager.hasSession()) {
    return null;
  }

  try {
    const session = await sessionManager.retrieve();

    // Try to use the session by making a simple API call
    const api = new DATSApi({ sessionCookie: session.sessionCookie });

    // Attempt to get client info as a session validity check
    await api.getClientInfo(session.clientId);

    return {
      sessionCookie: session.sessionCookie,
      clientId: session.clientId,
    };
  } catch (error) {
    // Session is invalid or expired
    logger.info('Session expired or invalid');
    await sessionManager.clear();
    return null;
  }
}
