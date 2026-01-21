/**
 * Authentication Service
 * Handles DATS authentication operations
 */

import { buildSoapRequest, callSoapApi } from '../utils/soap-builder.js';

export interface AuthServiceOptions {
  sessionCookie: string;
}

/**
 * Service for DATS authentication operations
 */
export class AuthService {
  private sessionCookie: string;

  constructor(options: AuthServiceOptions) {
    this.sessionCookie = options.sessionCookie;
  }

  /**
   * Validate client credentials
   * @param clientId - DATS client ID
   * @param password - Client password
   * @returns True if credentials are valid
   */
  async validatePassword(clientId: string, password: string): Promise<boolean> {
    const soap = buildSoapRequest('PassValidatePassword', {
      ClientId: clientId,
      Password: password,
    });

    const response = await callSoapApi(soap, this.sessionCookie);
    return response.includes('RESULTOK') || response.includes('<Valid>1</Valid>');
  }

  /**
   * Log out the client
   * @param clientId - DATS client ID
   */
  async logoff(clientId: string): Promise<void> {
    const soap = buildSoapRequest('PassClientLogoff', {
      ClientId: clientId,
    });
    await callSoapApi(soap, this.sessionCookie);
  }
}
