/**
 * Logger utility for DATS Booking MCP Server
 *
 * CRITICAL: Log to stderr, never stdout (stdout is for JSON-RPC)
 * CRITICAL: Never log PII (names, addresses, client numbers)
 */

import type { AuditLogEntry } from '../types.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private readonly level: LogLevel;

  constructor() {
    const envLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
    this.level = (envLevel in LOG_LEVELS ? envLevel : 'info') as LogLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      console.error(this.formatMessage('debug', message));
      if (data) {
        // Truncate long values to prevent log spam
        const truncatedData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'string' && value.length > 2000) {
            truncatedData[key] = value.substring(0, 2000) + '... [truncated]';
          } else {
            truncatedData[key] = value;
          }
        }
        console.error(JSON.stringify(truncatedData, null, 2));
      }
    }
  }

  info(message: string): void {
    if (this.shouldLog('info')) {
      console.error(this.formatMessage('info', message));
    }
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      console.error(this.formatMessage('warn', message));
      if (data) {
        // Truncate long values
        const truncatedData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'string' && value.length > 2000) {
            truncatedData[key] = value.substring(0, 2000) + '... [truncated]';
          } else {
            truncatedData[key] = value;
          }
        }
        console.error(JSON.stringify(truncatedData, null, 2));
      }
    }
  }

  error(message: string, error?: Error | Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message));
      if (error) {
        if (error instanceof Error) {
          console.error(error.stack ?? error.message);
        } else {
          // Truncate long values in error data
          const truncatedData: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(error)) {
            if (typeof value === 'string' && value.length > 2000) {
              truncatedData[key] = value.substring(0, 2000) + '... [truncated]';
            } else {
              truncatedData[key] = value;
            }
          }
          console.error(JSON.stringify(truncatedData, null, 2));
        }
      }
    }
  }

  /**
   * Audit log for security-relevant events
   * Contains no PII - only action types and results
   * POPA COMPLIANCE: Logs session access, consent, and deletion events
   */
  audit(entry: AuditLogEntry): void {
    // Add timestamp if not present
    const enrichedEntry = {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
    };
    
    const message = `AUDIT: ${enrichedEntry.action} - ${enrichedEntry.result}${
      enrichedEntry.errorCode ? ` (${enrichedEntry.errorCode})` : ''
    }${enrichedEntry.sessionIdHash ? ` [session: ${enrichedEntry.sessionIdHash}]` : ''}`;
    console.error(this.formatMessage('info', message));
  }
}

export const logger = new Logger();
