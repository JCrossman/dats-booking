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

  debug(message: string): void {
    if (this.shouldLog('debug')) {
      console.error(this.formatMessage('debug', message));
    }
  }

  info(message: string): void {
    if (this.shouldLog('info')) {
      console.error(this.formatMessage('info', message));
    }
  }

  warn(message: string): void {
    if (this.shouldLog('warn')) {
      console.error(this.formatMessage('warn', message));
    }
  }

  error(message: string, error?: Error): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message));
      if (error) {
        console.error(error.stack ?? error.message);
      }
    }
  }

  /**
   * Audit log for security-relevant events
   * Contains no PII - only action types and results
   */
  audit(entry: AuditLogEntry): void {
    const message = `AUDIT: ${entry.action} - ${entry.result}${
      entry.errorCode ? ` (${entry.errorCode})` : ''
    }`;
    console.error(this.formatMessage('info', message));
  }
}

export const logger = new Logger();
