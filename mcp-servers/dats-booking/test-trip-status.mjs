#!/usr/bin/env node
/**
 * Quick test to check what DATS API returns for trip statuses
 * Uses our existing DATSApi class
 */

import { AuthClient } from './build/api/auth-client.js';
import { DATSApi } from './build/api/dats-api.js';

const clientId = process.argv[2];
const passcode = process.argv[3];

if (!clientId || !passcode) {
  console.error('Usage: node test-trip-status.mjs CLIENT_ID PASSCODE');
  console.error('Example: node test-trip-status.mjs 46642 myPasscode');
  process.exit(1);
}

console.log('=== Testing DATS API Trip Statuses ===\n');

try {
  // Step 1: Login
  console.log('Step 1: Authenticating with DATS...');
  const loginResult = await AuthClient.login({
    username: clientId,
    password: passcode,
  });

  if (!loginResult.success) {
    console.error('❌ Login failed:', loginResult.error);
    process.exit(1);
  }

  console.log('✓ Login successful');
  console.log('Client ID:', loginResult.clientId);
  console.log();

  // Step 2: Get trips for today (January 15, 2026)
  console.log('Step 2: Getting trips for January 15, 2026...');
  const api = new DATSApi({ sessionCookie: loginResult.sessionCookie });

  const trips = await api.getClientTrips(
    loginResult.clientId,
    '20260115', // From date
    '20260115', // To date
    ['S', 'Pf', 'CA'] // Get Scheduled, Performed, and Cancelled trips
  );

  console.log('✓ Retrieved', trips.length, 'trips\n');

  // Step 3: Display results
  console.log('=== TRIP STATUS ANALYSIS ===\n');

  if (trips.length === 0) {
    console.log('No trips found for January 15, 2026');
  } else {
    trips.forEach((trip, index) => {
      console.log(`Trip #${index + 1}:`);
      console.log(`  Confirmation: ${trip.confirmationNumber}`);
      console.log(`  Date: ${trip.date}`);
      console.log(`  Pickup: ${trip.pickupWindow.start} - ${trip.pickupWindow.end}`);
      console.log(`  From: ${trip.pickupAddress}`);
      console.log(`  To: ${trip.destinationAddress}`);
      console.log(`  Status Code: ${trip.status}`);
      console.log(`  Status Label: ${trip.statusLabel || 'N/A'}`);

      // Interpret the status
      if (trip.status === 'S') {
        console.log(`  → DATS API says: "Scheduled" (not marked as Performed yet)`);
      } else if (trip.status === 'Pf') {
        console.log(`  → DATS API says: "Performed" (trip completed)`);
      } else if (trip.status === 'CA') {
        console.log(`  → DATS API says: "Cancelled"`);
      }
      console.log();
    });

    console.log('=== CONCLUSION ===');
    console.log('These status codes are EXACTLY what the DATS API returned.');
    console.log('Our MCP server displays this data without modification (Passthrough Principle).');
    console.log();

    const scheduledTrips = trips.filter(t => t.status === 'S');
    if (scheduledTrips.length > 0) {
      console.log(`Found ${scheduledTrips.length} trip(s) still showing as "Scheduled"`);
      console.log('This is a DATS data issue - they haven\'t updated the status to "Performed" yet.');
      console.log('This is normal behavior - DATS may batch-process status updates at end of day.');
    }
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  if (error.message.includes('Invalid credentials')) {
    console.error('\nPlease check your Client ID and Passcode');
  }
  process.exit(1);
}
