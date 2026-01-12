/**
 * In-Memory Session Store for Authentication Results
 *
 * Stores authentication results keyed by session ID.
 * Results expire after 5 minutes and are one-time use.
 *
 * SECURITY: This store NEVER holds credentials - only session results.
 * Credentials are passed through to DATS API and immediately discarded.
 */

export interface AuthResult {
  status: 'pending' | 'success' | 'failed';
  sessionCookie?: string;
  clientId?: string;
  error?: string;
  createdAt: number;
}

// In-memory store (for Azure Functions consumption plan)
// For production with multiple instances, consider Azure Redis Cache
const store = new Map<string, AuthResult>();

// Session expiry time: 5 minutes
const SESSION_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Initialize a pending session
 */
export function createPendingSession(sessionId: string): void {
  store.set(sessionId, {
    status: 'pending',
    createdAt: Date.now(),
  });

  // Auto-cleanup after expiry
  setTimeout(() => {
    store.delete(sessionId);
  }, SESSION_EXPIRY_MS);
}

/**
 * Update session with authentication result
 */
export function updateSession(
  sessionId: string,
  result: Omit<AuthResult, 'createdAt'>
): void {
  const existing = store.get(sessionId);
  if (existing) {
    store.set(sessionId, {
      ...result,
      createdAt: existing.createdAt,
    });
  }
}

/**
 * Get and consume session result (one-time use)
 * Returns the result and deletes it from the store
 */
export function consumeSession(sessionId: string): AuthResult | null {
  const result = store.get(sessionId);

  if (!result) {
    return null;
  }

  // Check if expired
  if (Date.now() - result.createdAt > SESSION_EXPIRY_MS) {
    store.delete(sessionId);
    return null;
  }

  // Only consume (delete) if the auth is complete
  if (result.status !== 'pending') {
    store.delete(sessionId);
  }

  return result;
}

/**
 * Check if a session exists (without consuming)
 */
export function sessionExists(sessionId: string): boolean {
  return store.has(sessionId);
}

/**
 * Get session count (for monitoring)
 */
export function getSessionCount(): number {
  return store.size;
}
