/**
 * Authentication Routes for Container App
 *
 * Handles the authentication flow directly in the Container App,
 * so session cookies are created from the same IP that uses them.
 *
 * Endpoints:
 * - POST /api/auth/login - Authenticate with DATS
 * - GET /api/auth/status/:sessionId - Check auth status
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

const BASE_URL = 'https://datsonlinebooking.edmonton.ca';
const HIWIRE_URL = `${BASE_URL}/hiwire`;
const PASS_INFO_URL = `${BASE_URL}/PassInfoServer`;

// In-memory session store for pending auth sessions
// Sessions expire after 5 minutes
interface PendingSession {
  status: 'pending' | 'success' | 'failed';
  sessionCookie?: string;
  clientId?: string;
  error?: string;
  createdAt: number;
}

const pendingSessions = new Map<string, PendingSession>();
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;

// Cleanup expired sessions every minute
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of pendingSessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      pendingSessions.delete(sessionId);
    }
  }
}, 60 * 1000);

/**
 * Cookie jar for maintaining session state during login
 */
class CookieJar {
  private cookies = new Map<string, string>();

  extractFromHeaders(headers: Headers): void {
    const setCookie = headers.get('set-cookie');
    if (setCookie) {
      const cookieStrings = setCookie.split(/[,\n]/).filter(Boolean);
      for (const cookieStr of cookieStrings) {
        const match = cookieStr.match(/^([^=]+)=([^;]*)/);
        if (match && match[2]) {
          this.cookies.set(match[1].trim(), match[2]);
        }
      }
    }
  }

  toString(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

/**
 * Login to DATS and get session cookie
 */
async function loginToDATS(
  clientId: string,
  passcode: string
): Promise<{ success: boolean; sessionCookie?: string; clientId?: string; error?: string }> {
  const cookies = new CookieJar();

  try {
    // Step 1: Get initial session from login page
    const initialResponse = await fetch(`${HIWIRE_URL}?.a=pSigninRegister`, {
      method: 'GET',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });

    if (!initialResponse.ok) {
      return { success: false, error: 'Could not connect to DATS. Please try again later.' };
    }
    cookies.extractFromHeaders(initialResponse.headers);

    // Step 2: POST login credentials
    const formData = new URLSearchParams();
    formData.append('.a', 'pSigninSubmit');
    formData.append('Source', 'Web');
    formData.append('UN', clientId);
    formData.append('PW', passcode);
    formData.append('ReCaptchaResponseField', '');

    const loginResponse = await fetch(HIWIRE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: '*/*',
        Origin: BASE_URL,
        Referer: `${HIWIRE_URL}?.a=pSigninRegister`,
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookies.toString(),
      },
      body: formData.toString(),
    });

    cookies.extractFromHeaders(loginResponse.headers);

    // Check for login errors
    const loginText = await loginResponse.text();
    if (
      loginText.includes('Invalid') ||
      loginText.includes('incorrect') ||
      loginText.includes('NOUSRLOGIN') ||
      loginText.includes('error')
    ) {
      return { success: false, error: 'Wrong client ID or passcode. Please check and try again.' };
    }

    // Step 3: Navigate to home page to finalize session
    const homeResponse = await fetch(`${HIWIRE_URL}?.a=pHome`, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        Cookie: cookies.toString(),
      },
    });
    cookies.extractFromHeaders(homeResponse.headers);

    // Step 4: Verify session with SOAP API
    const sessionCookie = cookies.toString();
    const validatedClientId = await getClientIdFromSession(sessionCookie);

    if (validatedClientId && parseInt(validatedClientId) > 0) {
      return { success: true, sessionCookie, clientId: validatedClientId };
    }

    return { success: false, error: 'Could not verify your account. Please try again.' };
  } catch (error) {
    logger.error('Login error', error as Error);
    return { success: false, error: 'Connection error. Please check your internet and try again.' };
  }
}

/**
 * Get client ID from session using SOAP API
 */
async function getClientIdFromSession(sessionCookie: string): Promise<string | undefined> {
  const soap = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <PassQueryValidatedClient/>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

  try {
    const response = await fetch(PASS_INFO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        Accept: '*/*',
        Cookie: sessionCookie,
      },
      body: soap,
    });

    if (response.ok) {
      const xml = await response.text();
      const clientIdMatch = xml.match(/<ClientId>(\d+)<\/ClientId>/);
      if (clientIdMatch && parseInt(clientIdMatch[1]) > 0) {
        return clientIdMatch[1];
      }
    }
  } catch {
    // Ignore errors
  }
  return undefined;
}

/**
 * Create auth router
 */
export function createAuthRouter(): Router {
  const router = Router();

  // POST /api/auth/login
  router.post('/login', async (req: Request, res: Response) => {
    // Rate limiting
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown';
    const now = Date.now();
    const rateLimit = rateLimitMap.get(clientIp);

    if (rateLimit) {
      if (now > rateLimit.resetAt) {
        rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      } else if (rateLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
        logger.warn(`Rate limit exceeded for IP`);
        res.status(429).json({
          success: false,
          error: 'Too many requests. Please wait a minute and try again.',
        });
        return;
      } else {
        rateLimit.count++;
      }
    } else {
      rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    }

    const { sessionId, clientId, passcode } = req.body;

    // Validate required fields
    if (!sessionId || !clientId || !passcode) {
      res.status(400).json({ success: false, error: 'Missing required fields.' });
      return;
    }

    // Validate sessionId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      res.status(400).json({ success: false, error: 'Invalid session ID.' });
      return;
    }

    // Create pending session
    pendingSessions.set(sessionId, { status: 'pending', createdAt: Date.now() });
    logger.info(`Auth attempt for session: ${sessionId.substring(0, 8)}...`);

    // Authenticate with DATS
    const result = await loginToDATS(clientId, passcode);

    // Update session with result
    if (result.success) {
      pendingSessions.set(sessionId, {
        status: 'success',
        sessionCookie: result.sessionCookie,
        clientId: result.clientId,
        createdAt: Date.now(),
      });
      logger.info(`Auth success for session: ${sessionId.substring(0, 8)}...`);
    } else {
      pendingSessions.set(sessionId, {
        status: 'failed',
        error: result.error,
        createdAt: Date.now(),
      });
      logger.info(`Auth failed for session: ${sessionId.substring(0, 8)}...`);
    }

    res.json({
      success: result.success,
      error: result.success ? undefined : result.error,
    });
  });

  // GET /api/auth/status/:sessionId
  router.get('/status/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;

    // Validate sessionId format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      res.status(400).json({ status: 'error', error: 'Invalid session ID format.' });
      return;
    }

    const session = pendingSessions.get(sessionId);

    if (!session) {
      res.status(404).json({ status: 'not_found', error: 'Session not found or expired.' });
      return;
    }

    // Check if expired
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
      pendingSessions.delete(sessionId);
      res.status(404).json({ status: 'not_found', error: 'Session expired.' });
      return;
    }

    switch (session.status) {
      case 'pending':
        res.status(202).json({ status: 'pending' });
        break;
      case 'success':
        // Consume the session (one-time use)
        pendingSessions.delete(sessionId);
        res.json({
          status: 'success',
          sessionCookie: session.sessionCookie,
          clientId: session.clientId,
        });
        break;
      case 'failed':
        pendingSessions.delete(sessionId);
        res.json({ status: 'failed', error: session.error });
        break;
    }
  });

  return router;
}
