/**
 * DATS Authentication Client
 * Direct API login without browser automation
 */

import { logger } from '../utils/logger.js';

const BASE_URL = 'https://datsonlinebooking.edmonton.ca';
const HIWIRE_URL = `${BASE_URL}/hiwire`;
const PASS_INFO_URL = `${BASE_URL}/PassInfoServer`;

export interface LoginResult {
  success: boolean;
  sessionCookie?: string;
  clientId?: string;
  error?: string;
}

export interface AuthClientOptions {
  username: string;
  password: string;
}

/**
 * Cookie jar for maintaining session state
 */
class CookieJar {
  private cookies = new Map<string, string>();

  extractFromResponse(response: Response): void {
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        const match = value.match(/^([^=]+)=([^;]*)/);
        if (match && match[2]) {
          this.cookies.set(match[1], match[2]);
        }
      }
    });
  }

  toString(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  isEmpty(): boolean {
    return this.cookies.size === 0;
  }
}

/**
 * Handles direct authentication to DATS portal
 */
export class AuthClient {
  /**
   * Login to DATS portal and get session cookie
   *
   * The login flow requires:
   * 1. GET the login page to establish initial session
   * 2. POST credentials with session cookie
   * 3. Navigate to home page to finalize session
   * 4. Session is now valid for SOAP API calls
   */
  static async login(options: AuthClientOptions): Promise<LoginResult> {
    const { username, password } = options;
    const cookies = new CookieJar();

    logger.info('Attempting direct API login');

    try {
      // Step 1: Get initial session from login page
      logger.debug('Getting initial session...');
      const initialResponse = await fetch(`${HIWIRE_URL}?.a=pSigninRegister`, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
        },
      });

      if (!initialResponse.ok) {
        return {
          success: false,
          error: `Failed to load login page: HTTP ${initialResponse.status}`,
        };
      }

      cookies.extractFromResponse(initialResponse);

      // Step 2: POST login credentials
      logger.debug('Submitting credentials...');
      const formData = new URLSearchParams();
      formData.append('.a', 'pSigninSubmit');
      formData.append('Source', 'Web');
      formData.append('UN', username);
      formData.append('PW', password);
      formData.append('ReCaptchaResponseField', '');

      const loginResponse = await fetch(HIWIRE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Accept': '*/*',
          'Origin': BASE_URL,
          'Referer': `${HIWIRE_URL}?.a=pSigninRegister`,
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': cookies.toString(),
        },
        body: formData.toString(),
      });

      cookies.extractFromResponse(loginResponse);

      // Check for login errors in response
      const loginText = await loginResponse.text();
      if (loginText.includes('Invalid') || loginText.includes('incorrect') ||
          loginText.includes('NOUSRLOGIN') || loginText.includes('error')) {
        logger.error('Login failed - invalid credentials');
        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      // Step 3: Navigate to home page to finalize session
      logger.debug('Finalizing session...');
      const homeResponse = await fetch(`${HIWIRE_URL}?.a=pHome`, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'Cookie': cookies.toString(),
        },
      });

      cookies.extractFromResponse(homeResponse);

      // Step 4: Verify session with SOAP API
      const sessionCookie = cookies.toString();
      const clientId = await this.getClientIdFromSession(sessionCookie);

      if (clientId && parseInt(clientId) > 0) {
        logger.info('Login successful');
        return {
          success: true,
          sessionCookie,
          clientId,
        };
      }

      logger.error('Login failed - session not established');
      return {
        success: false,
        error: 'Session not established after login',
      };

    } catch (error) {
      logger.error('Login request failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get client ID from a validated session using PassQueryValidatedClient
   */
  private static async getClientIdFromSession(sessionCookie: string): Promise<string | undefined> {
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
          'Accept': '*/*',
          'Cookie': sessionCookie,
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
      logger.error('Failed to get client ID from session');
    }

    return undefined;
  }

  /**
   * Verify if a session cookie is still valid
   */
  static async verifySession(sessionCookie: string): Promise<boolean> {
    const clientId = await this.getClientIdFromSession(sessionCookie);
    return clientId !== undefined && parseInt(clientId) > 0;
  }
}
