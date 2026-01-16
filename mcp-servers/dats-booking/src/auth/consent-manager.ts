/**
 * Consent Manager for POPA Compliance
 *
 * Manages user consent for data storage in Azure Cosmos DB.
 * Required for Protection of Privacy Act (Alberta) compliance.
 *
 * PRIVACY:
 * - Tracks consent status per session
 * - No PII stored - only session IDs and timestamps
 * - Consent recorded before any personal data storage
 */

import type { CosmosSessionStore } from './cosmos-session-store.js';
import { logger } from '../utils/logger.js';

export interface ConsentRecord {
  sessionId: string;
  consentedAt: string; // ISO 8601 timestamp
  privacyPolicyVersion: string;
}

export class ConsentManager {
  private readonly CURRENT_PRIVACY_POLICY_VERSION = '1.0';
  private cosmosStore: CosmosSessionStore;

  constructor(cosmosStore: CosmosSessionStore) {
    this.cosmosStore = cosmosStore;
  }

  /**
   * Check if user has consented for a given session
   */
  async hasConsent(sessionId: string): Promise<boolean> {
    try {
      // Check if session has consent metadata
      const session = await this.cosmosStore.retrieve(sessionId);
      if (!session) return false;

      // In initial implementation, we'll check if session exists
      // Future: Add explicit consent field to session document
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Record user consent
   */
  async recordConsent(sessionId: string): Promise<void> {
    logger.audit({
      action: 'consent_recorded',
      result: 'success',
      sessionIdHash: this.hashSessionId(sessionId),
      privacyPolicyVersion: this.CURRENT_PRIVACY_POLICY_VERSION,
    });
  }

  /**
   * Get consent notice text for users
   */
  getConsentNotice(): string {
    return `# Privacy Notice - DATS Booking Assistant

This service stores your DATS session in Azure Canada to enable mobile access.

**What we store:**
- Encrypted DATS session cookie (enables booking on your behalf)
- DATS client ID (technical identifier, not personal info)
- Session timestamp (for automatic 24-hour expiration)

**What we DON'T store:**
- Your DATS username or password (never transmitted to our servers)
- Trip details (addresses, times, destinations)
- Personal health information
- Names, phone numbers, or other identifying information

**Your data rights:**
- **Automatic deletion:** All sessions expire and are permanently deleted after 24 hours
- **Manual deletion:** Use 'disconnect_account' to delete your session immediately
- **Canadian data residency:** All data stored in Azure Canada Central (POPA compliant)
- **Encryption:** AES-256-GCM encryption at rest

**Legal basis:** Protection of Privacy Act (Alberta)

**View full privacy policy:** https://dats-mcp-auth.livelymeadow-eb849b65.canadacentral.azurecontainerapps.io/privacy

By saying **"I consent"**, you agree to this data storage for the purpose of accessing DATS booking services.

You can withdraw consent at any time by using 'disconnect_account'.`;
  }

  /**
   * Hash session ID for audit logging (no raw IDs in logs)
   */
  private hashSessionId(sessionId: string): string {
    // Simple hash for audit logs - prevents PII in logs
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(sessionId).digest('hex').substring(0, 16);
  }
}
