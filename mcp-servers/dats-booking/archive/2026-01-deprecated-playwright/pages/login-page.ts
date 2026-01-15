/**
 * LoginPage - Page Object for DATS authentication
 *
 * Portal URL: https://datsonlinebooking.edmonton.ca/
 */

import type { Page } from 'playwright';
import type { DATSCredentials } from '../../types.js';
import { DATSError, ErrorCategory } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { RateLimiter } from '../rate-limiter.js';

const DATS_URL = 'https://datsonlinebooking.edmonton.ca/';
const LOGIN_TIMEOUT = 60000;

export class LoginPage {
  constructor(
    private readonly page: Page,
    private readonly rateLimiter: RateLimiter
  ) {}

  /**
   * Navigate to DATS portal and log in
   */
  async login(credentials: DATSCredentials): Promise<void> {
    logger.info('Navigating to DATS portal');

    await this.rateLimiter.execute(async () => {
      await this.page.goto(DATS_URL, { waitUntil: 'domcontentloaded', timeout: LOGIN_TIMEOUT });
    });

    // Wait for page to stabilize
    await this.page.waitForTimeout(2000);

    await this.dismissAnnouncementDialog();

    // Wait for login form using the actual label text
    await this.page.getByRole('textbox', { name: /client id or email/i }).waitFor({ timeout: LOGIN_TIMEOUT });

    logger.info('Filling login form');

    await this.rateLimiter.execute(async () => {
      await this.page.getByRole('textbox', { name: /client id or email/i }).fill(credentials.clientId);
    });

    await this.rateLimiter.execute(async () => {
      await this.page.getByRole('textbox', { name: /password/i }).fill(credentials.passcode);
    });

    await this.rateLimiter.execute(async () => {
      await this.page.getByRole('button', { name: 'Sign in' }).click();
    });

    try {
      // Wait for navigation away from auth page
      await this.page.waitForURL((url) => !url.href.includes('/auth/'), { timeout: LOGIN_TIMEOUT });
      logger.info('Login successful');
    } catch {
      const errorMessage = await this.getLoginError();
      throw new DATSError(
        ErrorCategory.AUTH_FAILURE,
        errorMessage ?? 'Login failed. Please check credentials.',
        true
      );
    }
  }

  /**
   * Check if user is currently logged in
   */
  async isLoggedIn(): Promise<boolean> {
    const url = this.page.url();
    return (
      url.includes('/home') ||
      url.includes('/booking') ||
      url.includes('/trips')
    );
  }

  private async dismissAnnouncementDialog(): Promise<void> {
    try {
      // The actual button text is "Close dialog"
      const closeButton = this.page.getByRole('button', { name: 'Close dialog' });
      if (await closeButton.isVisible({ timeout: 3000 })) {
        await closeButton.click();
        await this.page.waitForTimeout(500);
        logger.debug('Dismissed announcement dialog');
      }
    } catch {
      // Dialog not present
    }
  }

  private async getLoginError(): Promise<string | null> {
    try {
      const errorElement = this.page
        .locator('.error-message, [class*="error"], [role="alert"]')
        .first();
      if (await errorElement.isVisible({ timeout: 2000 })) {
        return await errorElement.textContent();
      }
    } catch {
      // No error message found
    }
    return null;
  }
}
