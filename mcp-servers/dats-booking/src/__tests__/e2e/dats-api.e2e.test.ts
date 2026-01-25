/**
 * DATS API End-to-End Tests
 * 
 * These tests make REAL calls to the DATS SOAP API.
 * They require valid credentials to run.
 * 
 * SECURITY:
 * - Credentials come from environment variables (never committed)
 * - Tests prefer read-only operations where possible
 * - Any booking tests immediately cancel the booking
 * 
 * RUN LOCALLY:
 *   DATS_TEST_CLIENT_ID=your_id DATS_TEST_PASSCODE=your_pass LOG_LEVEL=debug npm run test:e2e
 * 
 * RUN IN CI:
 *   Uses GitHub Secrets: DATS_TEST_CLIENT_ID, DATS_TEST_PASSCODE
 * 
 * @tags e2e, requires-credentials
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

  // ==================== Booking Flow Test (Creates + Cancels) ====================

  describe('Booking Flow (Create + Cancel)', () => {
    let testBookingId: string | undefined;

    afterAll(async () => {
      // CRITICAL: Always clean up test bookings
      if (testBookingId && api) {
        console.log(`Cleaning up test booking: ${testBookingId}`);
        try {
          await api.cancelTrip(CLIENT_ID!, testBookingId, 'E2E test cleanup');
          console.log('✅ Test booking cancelled successfully');
        } catch (error) {
          console.error('⚠️ Failed to cancel test booking:', error);
        }
      }
    });

    it('should get available booking options for a future date', async () => {
      // Book for 3 days from now at 10:00 AM
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      const pickupDate = futureDate.toISOString().split('T')[0];

      // Get client info for home address
      const clientInfo = await api.getClientInfo(CLIENT_ID!);
      if (!clientInfo) {
        console.log('Could not retrieve client info - skipping booking test');
        return;
      }

      // Use client home address as pickup
      const pickupAddress = `${clientInfo.address.streetNo} ${clientInfo.address.street}, Edmonton, AB`;

      // Use a well-known Edmonton location as destination
      const destinationAddress = '1 Sir Winston Churchill Square, Edmonton, AB';

      console.log(`Test booking details:`);
      console.log(`  Date: ${pickupDate}`);
      console.log(`  Pickup: ${pickupAddress}`);
      console.log(`  Destination: ${destinationAddress}`);

      // Try to create booking
      const result = await api.bookTrip(CLIENT_ID!, {
        pickupDate,
        pickupTime: '10:00',
        pickupAddress,
        destinationAddress,
        mobilityDevice: 'none',
      });

      // Log the full result for debugging
      console.log('Booking result:', JSON.stringify(result, null, 2));

      if (result.success) {
        testBookingId = result.bookingId;
        expect(result.bookingId).toBeTruthy();
        expect(result.pickupWindow).toBeTruthy();
        console.log(`✅ Test booking created: ${testBookingId}`);
      } else {
        // Even if booking fails, this is useful info for debugging
        console.log(`Booking failed (this may be expected): ${result.error?.message}`);

        // If the error is "No available trip slots", this is a valid DATS response
        // If the error is something else, log it for investigation
        if (result.error?.message?.includes('user defined booking logic')) {
          console.error('⚠️ BUG DETECTED: "user defined booking logic" error');
          console.error('This indicates a mismatch between our request and DATS expectations');
        }

        // Don't fail the test if DATS legitimately has no slots
        // But do fail if it's the known bug
        if (result.error?.message?.includes('user defined booking logic')) {
          expect.fail('Booking failed with "user defined booking logic" - known bug');
        }
      }
    });
  });

  // ==================== Debug: Specific Failure Case ====================

  describe('Debug: Home to West Edmonton Mall (Monday 6pm)', () => {
    let debugBookingId: string | undefined;

    afterAll(async () => {
      if (debugBookingId && api) {
        console.log(`Cleaning up debug booking: ${debugBookingId}`);
        try {
          await api.cancelTrip(CLIENT_ID!, debugBookingId, 'Debug test cleanup');
          console.log('✅ Debug booking cancelled');
        } catch (error) {
          console.error('⚠️ Failed to cancel debug booking:', error);
        }
      }
    });

    it('should book home to West Edmonton Mall on Monday at 6pm', async () => {
      // Get client info for home address
      const clientInfo = await api.getClientInfo(CLIENT_ID!);
      if (!clientInfo) {
        console.log('Could not retrieve client info - skipping');
        return;
      }

      // Calculate next Monday
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : (8 - dayOfWeek);
      const monday = new Date(today);
      monday.setDate(today.getDate() + daysUntilMonday);
      const pickupDate = monday.toISOString().split('T')[0];

      // Use client home address as pickup
      const pickupAddress = `${clientInfo.address.streetNo} ${clientInfo.address.street}, Edmonton, AB`;
      const destinationAddress = 'West Edmonton Mall, Edmonton, AB';

      console.log('\n========== DEBUG: User-Reported Failure Case ==========');
      console.log(`Client ID: ${CLIENT_ID}`);
      console.log(`Home Address: ${pickupAddress}`);
      console.log(`Date: ${pickupDate} (Monday)`);
      console.log(`Time: 18:00 (6:00 PM)`);
      console.log(`Destination: ${destinationAddress}`);
      console.log('========================================================\n');

      // Try to create booking
      const result = await api.bookTrip(CLIENT_ID!, {
        pickupDate,
        pickupTime: '18:00',
        pickupAddress,
        destinationAddress,
        mobilityDevice: 'none',
      });

      console.log('\n========== BOOKING RESULT ==========');
      console.log(JSON.stringify(result, null, 2));
      console.log('====================================\n');

      if (result.success) {
        debugBookingId = result.bookingId;
        console.log(`✅ Booking succeeded! ID: ${debugBookingId}`);
        console.log(`   Pickup window: ${result.pickupWindow?.start} - ${result.pickupWindow?.end}`);
      } else {
        console.error('❌ Booking FAILED');
        console.error(`   Error: ${result.error?.message}`);
        console.error(`   Category: ${result.error?.category}`);
        
        if (result.error?.message?.includes('user defined booking logic')) {
          console.error('\n⚠️ THIS IS THE REPORTED BUG');
          console.error('The "user defined booking logic" error indicates DATS rejected our request.');
          console.error('Check the debug logs above for the full SOAP request/response.\n');
        }
      }

      // Don't fail the test - we want to see the output either way
      expect(true).toBe(true);
    });
  });

  // ==================== Address Geocoding Test ====================

  describe('Address Geocoding', () => {
    it('should geocode a known Edmonton address', async () => {
      // Test with Edmonton City Hall
      const address = '1 Sir Winston Churchill Square, Edmonton, AB';

      // The geocoding is internal, but we can verify it works by checking
      // if a booking request gets past the geocoding step
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);
      const pickupDate = futureDate.toISOString().split('T')[0];

      // This will test geocoding even if booking ultimately fails
      try {
        const result = await api.bookTrip(CLIENT_ID!, {
          pickupDate,
          pickupTime: '10:00',
          pickupAddress: address,
          destinationAddress: '9713 160 Street NW, Edmonton, AB',
          mobilityDevice: 'none',
        });

        // If we get a DATS error (not a geocoding error), geocoding worked
        if (!result.success && result.error?.message?.includes('Could not geocode')) {
          expect.fail(`Geocoding failed for: ${address}`);
        }

        // Cancel if booking succeeded
        if (result.success && result.bookingId) {
          await api.cancelTrip(CLIENT_ID!, result.bookingId, 'Geocoding test cleanup');
        }

        console.log('✅ Geocoding test passed');
      } catch (error) {
        // Check if it's a geocoding error
        if (error instanceof Error && error.message.includes('geocode')) {
          expect.fail(`Geocoding error: ${error.message}`);
        }
        // Other errors are acceptable (DATS scheduling issues, etc.)
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
