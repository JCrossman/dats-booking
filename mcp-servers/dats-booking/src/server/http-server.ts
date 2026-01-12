/**
 * HTTP Server for Remote MCP Mode
 *
 * Express.js server with StreamableHTTPServerTransport for remote MCP access.
 * Enables Claude iOS/Android and web clients to connect.
 *
 * SECURITY:
 * - CORS configured for allowed origins
 * - Session isolation via mcp-session-id header
 * - HTTPS enforced in production (via Azure Container Apps)
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger } from '../utils/logger.js';

// Map of active transports by MCP session ID
const transports = new Map<string, StreamableHTTPServerTransport>();

// Configuration
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || ['*'];
const SESSION_HEADER = 'mcp-session-id';

/**
 * Create and configure the Express HTTP server for MCP
 */
export function createHttpServer(mcpServer: McpServer): Application {
  const app = express();

  // Trust proxy for Azure Container Apps
  app.set('trust proxy', true);

  // CORS configuration
  app.use(
    cors({
      origin: CORS_ORIGINS.includes('*') ? true : CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', SESSION_HEADER, 'Authorization'],
      exposedHeaders: [SESSION_HEADER],
    })
  );

  // JSON body parser
  app.use(express.json({ limit: '1mb' }));

  // Request logging (no PII)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint (for container health probes)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      activeSessions: transports.size,
    });
  });

  // MCP endpoint - handles all MCP protocol traffic
  app.all('/mcp', async (req: Request, res: Response) => {
    const sessionId = req.headers[SESSION_HEADER] as string | undefined;

    try {
      if (req.method === 'POST') {
        await handleMcpPost(req, res, sessionId, mcpServer);
      } else if (req.method === 'GET') {
        await handleMcpGet(req, res, sessionId);
      } else if (req.method === 'DELETE') {
        await handleMcpDelete(res, sessionId);
      } else {
        res.status(405).json({ error: 'Method not allowed' });
      }
    } catch (error) {
      logger.error('MCP request error', error as Error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

/**
 * Handle POST requests (MCP client requests)
 */
async function handleMcpPost(
  req: Request,
  res: Response,
  sessionId: string | undefined,
  mcpServer: McpServer
): Promise<void> {
  let transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    // New MCP session - create transport
    const newSessionId = randomUUID();
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
    });

    transports.set(newSessionId, transport);
    await mcpServer.connect(transport);

    res.setHeader(SESSION_HEADER, newSessionId);
    logger.info(`New MCP session: ${newSessionId.substring(0, 8)}...`);
  }

  await transport.handleRequest(req, res, req.body);
}

/**
 * Handle GET requests (SSE for server-to-client notifications)
 */
async function handleMcpGet(
  req: Request,
  res: Response,
  sessionId: string | undefined
): Promise<void> {
  if (!sessionId) {
    res.status(400).json({ error: 'Session ID required' });
    return;
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  await transport.handleRequest(req, res);
}

/**
 * Handle DELETE requests (session termination)
 */
async function handleMcpDelete(
  res: Response,
  sessionId: string | undefined
): Promise<void> {
  if (!sessionId) {
    res.status(400).json({ error: 'Session ID required' });
    return;
  }

  const transport = transports.get(sessionId);
  if (transport) {
    await transport.close();
    transports.delete(sessionId);
    logger.info(`MCP session closed: ${sessionId.substring(0, 8)}...`);
  }

  res.status(204).end();
}

/**
 * Start the HTTP server
 */
export function startHttpServer(
  app: Application,
  port: number,
  host: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      logger.info(`DATS Booking MCP Server (HTTP) running on http://${host}:${port}`);
      logger.info(`MCP endpoint: http://${host}:${port}/mcp`);
      logger.info(`Health check: http://${host}:${port}/health`);
      resolve();
    });

    server.on('error', (error) => {
      logger.error('Server error', error);
      reject(error);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  });
}

/**
 * Get active session count (for monitoring)
 */
export function getActiveSessionCount(): number {
  return transports.size;
}

/**
 * Clean up a specific MCP transport session
 */
export async function cleanupSession(sessionId: string): Promise<void> {
  const transport = transports.get(sessionId);
  if (transport) {
    await transport.close();
    transports.delete(sessionId);
  }
}
