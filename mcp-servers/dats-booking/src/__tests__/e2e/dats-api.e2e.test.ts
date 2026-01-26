/**
 * DATS API End-to-End Tests
 * 
 * These tests make REAL calls to the DATS SOAP API.
 * They require valid credentials to run.
 * 
 * SAFETY:
 * - Tests are READ-ONLY to prevent accidental bookings
 * - No bookings are created or cancelled
 * - Only tests authentication and data retrieval
 * 
 * SECURITY:
 * - Credentials come from environment variables (never committed)
 * - Tests skip gracefully if credentials not available
 * 
 * RUN LOCALLY:
 *   DATS_TEST_CLIENT_ID=your_id DATS_TEST_PASSCODE=your_pass LOG_LEVEL=debug npm run test:e2e
 * 
 * RUN IN CI:
 *   Uses GitHub Secrets: DATS_TEST_CLIENT_ID, DATS_TEST_PASSCODE
 * 
 * @tags e2e, requires-credentials, read-only
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DATSApi } from '../../api/dats-api.js';
import { AuthClient } from '../../api/auth-client.js';

// Check for credentials
const CLIENT_ID = process.env.DATS_TEST_CLIENT_ID;
const PASSCODE = process.env.DATS_TEST_PASSCODE;
const HAS_CREDENTIALS = CLIENT_ID && PASSCODE;

// Skip message for CI visibility
const SKIP_REASON = 'Skipped: DATS_TEST_CLIENT_ID and DATS_TEST_PASSCODE environment variables required';

describe.skipIf(!HAS_CREDENTIALS)('DATS API E2E Tests', () => {
  let sessionCookie: string;
  let api: DATSApi;

  beforeAll(async () => {
    if (!HAS_CREDENTIALS) return;

    console.log('Setting up E2E tests with real DATS credentials...');

    // Authenticate with DATS using AuthClient
    const authResult = await AuthClient.login({
      username: CLIENT_ID!,
      password: PASSCODE!,
    });

    if (!authResult.success || !authResult.sessionCookie) {
      throw new Error(`Failed to authenticate with DATS: ${authResult.error || 'Unknown error'}`);
    }

    sessionCookie = authResult.sessionCookie;
    api = new DATSApi({ sessionCookie });

    console.log('✅ Authenticated with DATS successfully');
  });

  afterAll(async () => {
    // Session cleanup handled by DATS (sessions expire naturally)
    console.log('E2E tests complete');
  });

  // ==================== Authentication Tests ====================

  describe('Authentication', () => {
    it('should have valid session from setup', () => {
      expect(sessionCookie).toBeTruthy();
      expect(sessionCookie.length).toBeGreaterThan(10);
    });

    it('should reject invalid credentials', async () => {
      const result = await AuthClient.login({
        username: 'INVALID_ID',
        password: 'INVALID_PASS',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should retrieve client info with valid session', async () => {
      const clientInfo = await api.getClientInfo(CLIENT_ID!);

      expect(clientInfo).not.toBeNull();
      if (clientInfo) {
        expect(clientInfo.clientId).toBe(CLIENT_ID);
        expect(clientInfo.firstName).toBeTruthy();
        expect(clientInfo.lastName).toBeTruthy();
      }
    });
  });

  // ==================== Read-Only Tests (Safe) ====================

  describe('Get Booking Windows (Read-Only)', () => {
    it('should retrieve booking days window without error', async () => {
      const bookingDays = await api.getBookingDaysWindow('pickup');

      expect(bookingDays).toBeTruthy();
      expect(bookingDays.availableDates).toBeTruthy();
      expect(Array.isArray(bookingDays.availableDates)).toBe(true);

      console.log(`Booking days available: ${bookingDays.availableDates.length} days`);
    });

    it('should retrieve announcements', async () => {
      const announcements = await api.getAnnouncements();

      // Should return an array (may be empty)
      expect(Array.isArray(announcements)).toBe(true);

      console.log(`Found ${announcements.length} announcements`);
    });
  });

  // ==================== Profile Information Test ====================

  describe('Profile Information', () => {
    it('should retrieve client profile information', async () => {
      const clientInfo = await api.getClientInfo(CLIENT_ID!);
      
      expect(clientInfo).toBeTruthy();
      if (clientInfo) {
        expect(clientInfo.clientId).toBe(CLIENT_ID);
        expect(clientInfo.firstName).toBeTruthy();
        expect(clientInfo.lastName).toBeTruthy();
        expect(clientInfo.address).toBeTruthy();
        expect(clientInfo.address.streetNo).toBeTruthy();
        expect(clientInfo.address.street).toBeTruthy();
        
        console.log(`✅ Retrieved profile for: ${clientInfo.firstName} ${clientInfo.lastName}`);
        console.log(`   Home: ${clientInfo.address.streetNo} ${clientInfo.address.street}`);
      }
    });

    it('should retrieve saved locations', async () => {
      const locations = await api.getClientLocationsMerged(CLIENT_ID!);
      
      expect(Array.isArray(locations)).toBe(true);
      console.log(`✅ Retrieved ${locations.length} saved locations`);
      
      if (locations.length > 0) {
        const firstLocation = locations[0];
        expect(firstLocation.locationName).toBeTruthy();
        expect(firstLocation.address).toBeTruthy();
        console.log(`   Example: ${firstLocation.locationName} - ${firstLocation.address}`);
      }
    });
  });

  // ==================== Session Persistence Test ====================

  describe('Session Persistence', () => {
    it('should maintain session across multiple API calls', async () => {
      // Make multiple API calls in sequence
      const call1 = await api.getClientInfo(CLIENT_ID!);
      const call2 = await api.getAnnouncements();
      const call3 = await api.getBookingDaysWindow('pickup');

      // All should succeed without re-authentication
      expect(call1).not.toBeNull();
      if (call1) {
        expect(call1.clientId).toBe(CLIENT_ID);
      }
      expect(Array.isArray(call2)).toBe(true);
      expect(call3.availableDates).toBeTruthy();

      console.log('✅ Session persisted across 3 API calls');
    });
  });
});

// Log skip reason if no credentials
if (!HAS_CREDENTIALS) {
  console.log(`\n⚠️ ${SKIP_REASON}\n`);
}
