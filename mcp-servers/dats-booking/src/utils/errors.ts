/**
 * Error handling utilities
 *
 * Plain language error messages for accessibility (Grade 6 reading level target)
 */

import { ErrorCategory, type ToolError } from '../types.js';

// Re-export for convenience
export { ErrorCategory };

/**
 * Plain language error messages for each category
 * Written at approximately Grade 6 reading level for cognitive accessibility
 */
const PLAIN_LANGUAGE_ERRORS: Record<ErrorCategory, string> = {
  [ErrorCategory.AUTH_FAILURE]:
    'Could not log in to DATS. Please check your client ID and passcode are correct.',
  [ErrorCategory.SESSION_EXPIRED]:
    'Your session ended. Please try again.',
  [ErrorCategory.BOOKING_CONFLICT]:
    'That time is not available. Please try a different time.',
  [ErrorCategory.VALIDATION_ERROR]:
    'Something was not right with your request. Please check the details and try again.',
  [ErrorCategory.NETWORK_ERROR]:
    'Could not connect to DATS. Please check your internet and try again.',
  [ErrorCategory.RATE_LIMITED]:
    'Too many requests. Please wait a moment and try again.',
  [ErrorCategory.SYSTEM_ERROR]:
    'Something went wrong. Please try again later.',
  [ErrorCategory.CREDENTIALS_NOT_FOUND]:
    'Your DATS login is not set up yet. Please provide your client ID and passcode first.',
  [ErrorCategory.BUSINESS_RULE_VIOLATION]:
    'This request does not follow DATS booking rules. Please check the booking times.',
};

/**
 * Get a plain language error message for a category
 */
export function getPlainLanguageError(category: ErrorCategory): string {
  return PLAIN_LANGUAGE_ERRORS[category];
}

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
 *
 * Includes both technical message and plain language message for accessibility.
 * AI clients should prefer showing the plainLanguageMessage to users.
 */
export function createErrorResponse(error: ToolError): {
  content: Array<{ type: 'text'; text: string }>;
} {
  const plainLanguageMessage = getPlainLanguageError(error.category);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: false,
            error: {
              ...error,
              // Plain language message for display to users (Grade 6 reading level)
              plainLanguageMessage,
            },
          },
          null,
          2
        ),
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
