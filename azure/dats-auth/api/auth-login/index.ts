/**
 * POST /api/auth/login
 *
 * Receives credentials from the web form, authenticates with DATS,
 * and stores the result for the MCP server to poll.
 *
 * SECURITY:
 * - Credentials are NEVER stored
 * - Credentials are used immediately to authenticate with DATS
 * - Only the session cookie is stored (temporarily, keyed by sessionId)
 * - Session results expire after 5 minutes
 */

import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { createPendingSession, updateSession } from '../shared/session-store';
import { loginToDATS } from '../shared/dats-client';

// Rate limiting: Track requests per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

interface LoginRequest {
  sessionId: string;
  clientId: string;
  passcode: string;
}

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  // CORS headers for Static Web App
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  // Rate limiting
  const clientIp = req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const rateLimit = rateLimitMap.get(clientIp);

  if (rateLimit) {
    if (now > rateLimit.resetAt) {
      rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    } else if (rateLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
      context.log(`Rate limit exceeded for IP: ${clientIp}`);
      context.res = {
        status: 429,
        headers: corsHeaders,
        body: {
          success: false,
          error: 'Too many requests. Please wait a minute and try again.',
        },
      };
      return;
    } else {
      rateLimit.count++;
    }
  } else {
    rateLimitMap.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  try {
    const body = req.body as LoginRequest;
    const { sessionId, clientId, passcode } = body;

    // Validate required fields
    if (!sessionId || !clientId || !passcode) {
      context.res = {
        status: 400,
        headers: corsHeaders,
        body: {
          success: false,
          error: 'Missing required fields.',
        },
      };
      return;
    }

    // Validate sessionId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      context.res = {
        status: 400,
        headers: corsHeaders,
        body: {
          success: false,
          error: 'Invalid session ID.',
        },
      };
      return;
    }

    // Create pending session
    createPendingSession(sessionId);

    // Log attempt (NO credentials logged)
    context.log(`Auth attempt for session: ${sessionId}`);

    // Authenticate with DATS
    // IMPORTANT: Credentials are passed directly to DATS and NOT stored
    const result = await loginToDATS(clientId, passcode);

    // Update session with result
    if (result.success) {
      updateSession(sessionId, {
        status: 'success',
        sessionCookie: result.sessionCookie,
        clientId: result.clientId,
      });
      context.log(`Auth success for session: ${sessionId}`);
    } else {
      updateSession(sessionId, {
        status: 'failed',
        error: result.error,
      });
      context.log(`Auth failed for session: ${sessionId}`);
    }

    // Return success/failure (no sensitive data in response)
    context.res = {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: {
        success: result.success,
        error: result.success ? undefined : result.error,
      },
    };
  } catch (error) {
    context.log.error('Auth error:', error);
    context.res = {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: {
        success: false,
        error: 'Something went wrong. Please try again.',
      },
    };
  }
};

export default httpTrigger;
