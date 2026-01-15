/**
 * Browser Manager for Playwright automation
 *
 * Manages browser lifecycle for DATS portal automation.
 * Short-lived sessions, no persistent browser state.
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import { RateLimiter } from './rate-limiter.js';
import { logger } from '../utils/logger.js';

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  rateLimiter: RateLimiter;
}

export class BrowserManager {
  private session: BrowserSession | null = null;

  /**
   * Get or create a browser session
   */
  async getSession(): Promise<BrowserSession> {
    if (this.session) {
      return this.session;
    }

    logger.debug('Creating new browser session');

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-dev-shm-usage',
      ],
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'en-CA',
      timezoneId: 'America/Edmonton',
      permissions: ['geolocation'],
      geolocation: { latitude: 53.5461, longitude: -113.4938 }, // Edmonton
    });

    // Set longer default timeout for all operations
    context.setDefaultTimeout(60000);
    context.setDefaultNavigationTimeout(60000);

    const page = await context.newPage();

    // Mask automation indicators
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    const rateLimiter = new RateLimiter();

    this.session = { browser, context, page, rateLimiter };
    return this.session;
  }

  /**
   * Close the browser session
   */
  async closeSession(): Promise<void> {
    if (this.session) {
      logger.debug('Closing browser session');
      await this.session.browser.close();
      this.session = null;
    }
  }

  /**
   * Execute an operation with a fresh session
   * Session is closed after operation completes
   */
  async withSession<T>(
    operation: (session: BrowserSession) => Promise<T>
  ): Promise<T> {
    const session = await this.getSession();
    try {
      return await operation(session);
    } finally {
      await this.closeSession();
    }
  }
}

export const browserManager = new BrowserManager();
