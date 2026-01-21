/**
 * SOAP Request Builder
 *
 * Utilities for building SOAP/XML requests to the DATS PassInfoServer API.
 */

import { logger } from '../../utils/logger.js';

const PASS_INFO_SERVER_URL = 'https://datsonlinebooking.edmonton.ca/PassInfoServer';
const PASS_INFO_SERVER_ASYNC_URL = 'https://datsonlinebooking.edmonton.ca/PassInfoServerAsync';

/**
 * Build a SOAP request envelope for the DATS API
 * @param method - SOAP method name (e.g., 'PassValidatePassword')
 * @param params - Method parameters as key-value pairs
 * @returns Complete SOAP XML string
 */
export function buildSoapRequest(method: string, params: Record<string, unknown>): string {
  const paramsXml = objectToXml(params);

  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <${method}>
      ${paramsXml}
    </${method}>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

/**
 * Convert JavaScript object to XML elements
 * @param obj - Object to convert
 * @param indent - Indentation string for formatting
 * @returns XML string
 */
export function objectToXml(obj: Record<string, unknown>, indent = ''): string {
  let xml = '';
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;

    if (typeof value === 'object' && !Array.isArray(value)) {
      xml += `${indent}<${key}>\n${objectToXml(value as Record<string, unknown>, indent + '  ')}${indent}</${key}>\n`;
    } else {
      xml += `${indent}<${key}>${value}</${key}>\n`;
    }
  }
  return xml;
}

/**
 * Call the DATS SOAP API
 * @param soapBody - SOAP request XML
 * @param sessionCookie - Session cookie for authentication
 * @param async - Use async endpoint
 * @returns Response XML string
 */
export async function callSoapApi(
  soapBody: string,
  sessionCookie: string,
  async = false
): Promise<string> {
  const url = async ? PASS_INFO_SERVER_ASYNC_URL : PASS_INFO_SERVER_URL;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'Accept': 'application/json, text/plain, */*',
        'Cookie': sessionCookie,
      },
      body: soapBody,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(`SOAP API error: ${response.status} - ${errorBody.substring(0, 500)}`);
      return '';
    }

    return await response.text();
  } catch (error) {
    logger.error('Failed to call SOAP API', error instanceof Error ? error : undefined);
    return '';
  }
}

/**
 * Escape special XML characters in text content
 * @param text - Text to escape
 * @returns XML-safe string
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
