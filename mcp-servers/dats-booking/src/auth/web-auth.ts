/**
 * Web-Based Authentication Flow
 *
 * Implements OAuth-like device flow for secure credential entry:
 * 1. Generate unique session ID
 * 2. Open browser to Azure-hosted auth page
 * 3. Poll Azure for authentication result
 * 4. Return session cookie (credentials never touch this code)
 *
 * SECURITY:
 * - Credentials are entered in browser, not Claude chat
 * - Credentials never stored - only session cookie is returned
 * - Session IDs are one-time use and expire after 5 minutes
 */

import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

// Azure Static Web App URL - set via environment or use default
const AUTH_BASE_URL =
  process.env.DATS_AUTH_URL || 'https://green-sky-0e461ed10.1.azurestaticapps.net';

// Polling configuration
const POLL_INTERVAL_MS = 2000; // 2 seconds between polls
const POLL_TIMEOUT_MS = 3 * 60 * 1000; // 3 minute timeout (reduced for MCP tool timeouts)

export interface WebAuthResult {
  success: boolean;
  sessionCookie?: string;
  clientId?: string;
  error?: string;
}

interface AuthStatusResponse {
  status: 'pending' | 'success' | 'failed';
  sessionCookie?: string;
  clientId?: string;
  error?: string;
}

/**
 * Open the system's default browser to a URL
 * Uses dynamic import to handle ESM/CJS compatibility
 */
async function openBrowser(url: string): Promise<void> {
  try {
    // Dynamic import of 'open' package
    const open = (await import('open')).default;
    await open(url);
  } catch (error) {
    // Fallback for systems where 'open' package fails
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const platform = process.platform;
    let command: string;

    if (platform === 'darwin') {
      command = `open "${url}"`;
    } else if (platform === 'win32') {
      command = `start "" "${url}"`;
    } else {
      command = `xdg-open "${url}"`;
    }

    await execAsync(command);
  }
}

/**
 * Poll Azure for authentication status
 */
async function pollAuthStatus(sessionId: string): Promise<AuthStatusResponse> {
  const statusUrl = `${AUTH_BASE_URL}/api/auth/status/${sessionId}`;

  const response = await fetch(statusUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      // Session not found yet - user hasn't submitted form
      // Return pending to continue polling (NOT failed!)
      return { status: 'pending' };
    }
    throw new Error(`Failed to check auth status: ${response.status}`);
  }

  return (await response.json()) as AuthStatusResponse;
}

/**
 * Wait for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Initiate web-based authentication flow
 *
 * Opens browser to Azure auth page and polls for completion.
 * Returns session cookie when user successfully authenticates.
 *
 * @returns WebAuthResult with session cookie on success, error on failure
 */
export async function initiateWebAuth(): Promise<WebAuthResult> {
  // Generate unique session ID
  const sessionId = randomUUID();

  // Build auth URL with session ID
  const authUrl = `${AUTH_BASE_URL}/?sid=${sessionId}`;

  logger.info('Starting web authentication flow');
  logger.debug(`Auth URL: ${authUrl}`);

  try {
    // Open browser to auth page
    await openBrowser(authUrl);
    logger.info('Opened browser for authentication');

    // Poll for authentication result
    const startTime = Date.now();
    let pollCount = 0;

    logger.info(`Polling for auth result (session: ${sessionId.substring(0, 8)}...)`);

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      await sleep(POLL_INTERVAL_MS);
      pollCount++;

      try {
        const status = await pollAuthStatus(sessionId);
        logger.info(`Poll #${pollCount}: status=${status.status}`);

        if (status.status === 'success') {
          logger.info('Authentication successful - session cookie received');
          return {
            success: true,
            sessionCookie: status.sessionCookie,
            clientId: status.clientId,
          };
        }

        if (status.status === 'failed') {
          logger.warn(`Authentication failed: ${status.error}`);
          return {
            success: false,
            error: status.error || 'Authentication failed',
          };
        }

        // status === 'pending' - continue polling
      } catch (pollError) {
        // Network error or 404 during poll - continue trying
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        logger.debug(`Poll #${pollCount} error after ${elapsed}s (retrying): ${pollError}`);
      }
    }

    // Timeout reached
    logger.warn('Authentication timed out');
    return {
      success: false,
      error: 'Authentication timed out. Please try again.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Web auth error: ${message}`);
    return {
      success: false,
      error: `Failed to start authentication: ${message}`,
    };
  }
}

/**
 * Get the auth page URL for display purposes
 * Useful when browser can't be opened automatically
 */
export function getAuthUrl(): string {
  const sessionId = randomUUID();
  return `${AUTH_BASE_URL}/?sid=${sessionId}`;
}

/**
 * Check if web auth is available (Azure endpoint reachable)
 */
export async function isWebAuthAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${AUTH_BASE_URL}/`, {
      method: 'HEAD',
    });
    return response.ok;
  } catch {
    return false;
  }
}
