/**
 * DATS Authentication Client for Azure Functions
 *
 * Direct API login without browser automation.
 * This is a copy of the MCP server's auth-client.ts adapted for Azure Functions.
 *
 * SECURITY: Credentials are used immediately and NEVER stored.
 */

const BASE_URL = 'https://datsonlinebooking.edmonton.ca';
const HIWIRE_URL = `${BASE_URL}/hiwire`;
const PASS_INFO_URL = `${BASE_URL}/PassInfoServer`;

export interface LoginResult {
  success: boolean;
  sessionCookie?: string;
  clientId?: string;
  error?: string;
}

/**
 * Cookie jar for maintaining session state
 */
class CookieJar {
  private cookies = new Map<string, string>();

  extractFromHeaders(headers: Headers): void {
    // Azure Functions uses a different header format
    const setCookie = headers.get('set-cookie');
    if (setCookie) {
      // Handle multiple cookies (may be comma or newline separated)
      const cookieStrings = setCookie.split(/[,\n]/).filter(Boolean);
      for (const cookieStr of cookieStrings) {
        const match = cookieStr.match(/^([^=]+)=([^;]*)/);
        if (match && match[2]) {
          this.cookies.set(match[1].trim(), match[2]);
        }
      }
    }
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
 * Login to DATS portal and get session cookie
 *
 * The login flow requires:
 * 1. GET the login page to establish initial session
 * 2. POST credentials with session cookie
 * 3. Navigate to home page to finalize session
 * 4. Session is now valid for SOAP API calls
 */
export async function loginToDATS(
  clientId: string,
  passcode: string
): Promise<LoginResult> {
  const cookies = new CookieJar();

  try {
    // Step 1: Get initial session from login page
    const initialResponse = await fetch(`${HIWIRE_URL}?.a=pSigninRegister`, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!initialResponse.ok) {
      return {
        success: false,
        error: 'Could not connect to DATS. Please try again later.',
      };
    }

    cookies.extractFromHeaders(initialResponse.headers);

    // Step 2: POST login credentials
    const formData = new URLSearchParams();
    formData.append('.a', 'pSigninSubmit');
    formData.append('Source', 'Web');
    formData.append('UN', clientId);
    formData.append('PW', passcode);
    formData.append('ReCaptchaResponseField', '');

    const loginResponse = await fetch(HIWIRE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Accept: '*/*',
        Origin: BASE_URL,
        Referer: `${HIWIRE_URL}?.a=pSigninRegister`,
        'X-Requested-With': 'XMLHttpRequest',
        Cookie: cookies.toString(),
      },
      body: formData.toString(),
    });

    cookies.extractFromHeaders(loginResponse.headers);

    // Check for login errors in response
    const loginText = await loginResponse.text();
    if (
      loginText.includes('Invalid') ||
      loginText.includes('incorrect') ||
      loginText.includes('NOUSRLOGIN') ||
      loginText.includes('error')
    ) {
      return {
        success: false,
        error: 'Wrong client ID or passcode. Please check and try again.',
      };
    }

    // Step 3: Navigate to home page to finalize session
    const homeResponse = await fetch(`${HIWIRE_URL}?.a=pHome`, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        Cookie: cookies.toString(),
      },
    });

    cookies.extractFromHeaders(homeResponse.headers);

    // Step 4: Verify session with SOAP API
    const sessionCookie = cookies.toString();
    const validatedClientId = await getClientIdFromSession(sessionCookie);

    if (validatedClientId && parseInt(validatedClientId) > 0) {
      return {
        success: true,
        sessionCookie,
        clientId: validatedClientId,
      };
    }

    return {
      success: false,
      error: 'Could not verify your account. Please try again.',
    };
  } catch (error) {
    return {
      success: false,
      error: 'Connection error. Please check your internet and try again.',
    };
  }
}

/**
 * Get client ID from a validated session using PassQueryValidatedClient
 */
async function getClientIdFromSession(
  sessionCookie: string
): Promise<string | undefined> {
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
        Accept: '*/*',
        Cookie: sessionCookie,
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
    // Ignore errors - will return undefined
  }

  return undefined;
}
