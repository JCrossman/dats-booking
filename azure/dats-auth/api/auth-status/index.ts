/**
 * GET /api/auth/status/{sessionId}
 *
 * Returns the authentication result for a session ID.
 * Used by the MCP server to poll for completion.
 *
 * SECURITY:
 * - Session results are one-time use (deleted after successful retrieval)
 * - Session IDs expire after 5 minutes
 * - No credentials are ever stored or returned
 */

import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { consumeSession } from '../shared/session-store';

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders };
    return;
  }

  const sessionId = context.bindingData.sessionId as string;

  // Validate sessionId
  if (!sessionId) {
    context.res = {
      status: 400,
      headers: corsHeaders,
      body: {
        status: 'error',
        error: 'Missing session ID.',
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
        status: 'error',
        error: 'Invalid session ID format.',
      },
    };
    return;
  }

  // Get and consume session (one-time use for success/failed states)
  const result = consumeSession(sessionId);

  if (!result) {
    // Session not found or expired
    context.res = {
      status: 404,
      headers: corsHeaders,
      body: {
        status: 'not_found',
        error: 'Session not found or expired.',
      },
    };
    return;
  }

  // Return result based on status
  switch (result.status) {
    case 'pending':
      // Still waiting - don't consume (delete) yet
      context.res = {
        status: 202, // Accepted - still processing
        headers: corsHeaders,
        body: {
          status: 'pending',
        },
      };
      break;

    case 'success':
      // Authentication successful - return session cookie
      context.log(`Session consumed successfully: ${sessionId}`);
      context.res = {
        status: 200,
        headers: corsHeaders,
        body: {
          status: 'success',
          sessionCookie: result.sessionCookie,
          clientId: result.clientId,
        },
      };
      break;

    case 'failed':
      // Authentication failed - return error
      context.log(`Session failed: ${sessionId}`);
      context.res = {
        status: 200, // Still 200 - the request succeeded, auth failed
        headers: corsHeaders,
        body: {
          status: 'failed',
          error: result.error,
        },
      };
      break;

    default:
      context.res = {
        status: 500,
        headers: corsHeaders,
        body: {
          status: 'error',
          error: 'Unknown session status.',
        },
      };
  }
};

export default httpTrigger;
