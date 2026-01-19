/**
 * get_info Tool
 *
 * Gets DATS general information including service description, fares, and privacy policy.
 * Fetches info from DATS static HTML pages.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { wrapError, createErrorResponse } from '../utils/errors.js';
import type { ToolRegistration } from './types.js';

export function createGetInfoTool(): ToolRegistration {
  return {
    register(server: McpServer) {
      server.tool(
        'get_info',
        `Get DATS general information including service description, fares, and privacy policy.

AVAILABLE INFORMATION:
- General service information
- Fare structure
- Privacy policy
- Service description

NOT AVAILABLE (out of scope):
- Account statements or transaction history (DATS handles billing separately)
- Payment processing (handled by DATS directly, not through this system)
- Communication preferences (use MCP tool settings, not portal data)

Note: DATS uses "trips" not "appointments". For scheduled trips, use get_trips.`,
        {
          topic: z
            .enum(['general', 'fares', 'privacy', 'service', 'all'])
            .optional()
            .describe('Specific topic to retrieve (defaults to all)'),
        },
        async ({ topic = 'all' }) => {
          try {
            const baseUrl = 'https://datsonlinebooking.edmonton.ca/Public/Paratransit/HTML/general-information';

            const topics: Record<string, { url: string; title: string }> = {
              general: { url: `${baseUrl}/general-info-view-en.html`, title: 'General Information' },
              fares: { url: `${baseUrl}/fares-view-en.html`, title: 'Fares' },
              privacy: { url: `${baseUrl}/privacy-view-en.html`, title: 'Privacy Policy' },
              service: { url: `${baseUrl}/service-description-view-en.html`, title: 'Service Description' },
            };

            const fetchTopic = async (key: string): Promise<{ title: string; content: string }> => {
              const { url, title } = topics[key];
              try {
                const response = await fetch(url);
                if (!response.ok) {
                  return { title, content: `Failed to load ${title}` };
                }
                const html = await response.text();
                // Strip HTML tags for cleaner output
                const textContent = html
                  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                return { title, content: textContent };
              } catch {
                return { title, content: `Error loading ${title}` };
              }
            };

            let result: Record<string, { title: string; content: string }>;

            if (topic === 'all') {
              const results = await Promise.all(
                Object.keys(topics).map(async (key) => ({
                  key,
                  data: await fetchTopic(key),
                }))
              );
              result = Object.fromEntries(results.map(({ key, data }) => [key, data]));
            } else {
              result = { [topic]: await fetchTopic(topic) };
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true, info: result }, null, 2),
                },
              ],
            };
          } catch (error) {
            const datsError = wrapError(error);
            return createErrorResponse(datsError.toToolError());
          }
        }
      );
    },
  };
}
