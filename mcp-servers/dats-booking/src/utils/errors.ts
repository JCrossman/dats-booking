/**
 * Error handling utilities
 */

import { ErrorCategory, type ToolError } from '../types.js';

// Re-export for convenience
export { ErrorCategory };

export class DATSError extends Error {
  public readonly category: ErrorCategory;
  public readonly recoverable: boolean;
  public readonly retryAfterMs?: number;

  constructor(
    category: ErrorCategory,
    message: string,
    recoverable = false,
    retryAfterMs?: number
  ) {
    super(message);
    this.name = 'DATSError';
    this.category = category;
    this.recoverable = recoverable;
    this.retryAfterMs = retryAfterMs;
  }

  toToolError(): ToolError {
    return {
      category: this.category,
      message: this.message,
      recoverable: this.recoverable,
      retryAfterMs: this.retryAfterMs,
    };
  }
}

/**
 * Create error response for MCP tools
 */
export function createErrorResponse(error: ToolError): {
  content: Array<{ type: 'text'; text: string }>;
} {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: false, error }, null, 2),
      },
    ],
  };
}

/**
 * Wrap unknown errors into typed DATSError
 */
export function wrapError(error: unknown): DATSError {
  if (error instanceof DATSError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('timeout') || message.includes('net::')) {
    return new DATSError(ErrorCategory.NETWORK_ERROR, message, true);
  }

  if (
    message.includes('login') ||
    message.includes('password') ||
    message.includes('authentication')
  ) {
    return new DATSError(ErrorCategory.AUTH_FAILURE, 'Authentication failed', true);
  }

  return new DATSError(ErrorCategory.SYSTEM_ERROR, message, false);
}
