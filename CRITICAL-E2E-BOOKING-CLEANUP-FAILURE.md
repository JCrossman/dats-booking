# CRITICAL: E2E Test Booking Cleanup Failure Analysis & Fix Plan

**Date:** 2026-01-26  
**Severity:** CRITICAL  
**Impact:** Real DATS drivers dispatched to test bookings

---

## Problem

E2E tests create real DATS bookings for testing but fail to cancel all of them, resulting in:
- Real drivers dispatched
- Wasted resources  
- User confusion
- Potential safety issues

**Evidence from logs:**
- Multiple runs created bookings: 18846735, 18846736, 18846738, 18846739, 18846785, 18846808, 18846812
- Some were cancelled (735, 738), others were NOT (736, 739)
- User reported uncancelled bookings: 18846857, 18846858 (from yet another run)

---

## Root Causes

### 1. **`afterAll()` Hook Limitation**

```typescript
afterAll(async () => {
  if (testBookingId && api) {
    await api.cancelTrip(...);
  }
});
```

**Problems:**
- Only cancels IF `testBookingId` is set
- Only cancels ONE booking (the last successful one)
- If test throws exception before setting testBookingId, cleanup never runs
- If Vitest process is killed, afterAll never runs

### 2. **Test Creates Multiple Bookings**

Looking at the DATS booking flow:
1. PassCreateTrip - creates draft (BookingId assigned)
2. PassScheduleTrip - gets solutions  
3. PassSaveSolution - confirms booking

**Problem:** Each step can succeed independently. If PassScheduleTrip fails after PassCreateTrip succeeds, we have a draft booking that wasn't confirmed but also wasn't cleaned up.

### 3. **No Centralized Booking Tracker**

Tests don't maintain a list of ALL created bookings, only the "current" one. If multiple tests run or a test retries, previous booking IDs are lost.

---

## Immediate Actions Required

### 1. Manual Cleanup (NOW)

```bash
# Cancel the two uncancelled bookings
# Need your DATS credentials to do this
```

**Booking IDs to cancel:**
- 18846857 (Jan 28, 5:00 PM)
- 18846858 (Jan 28, 7:00 PM)

### 2. Audit All Test Runs

Find ALL booking IDs created by E2E tests and verify they were cancelled.

---

## Permanent Solution

### Fix #1: Track ALL Bookings with Global Cleanup

```typescript
// Global array to track ALL bookings created during test run
const createdBookingIds: string[] = [];

// Register cleanup BEFORE any tests run
beforeAll(() => {
  // Register cleanup to run on process exit
  process.on('exit', async () => {
    await cleanup AllBookings();
  });
  process.on('SIGINT', async () => {
    await cleanupAllBookings();
    process.exit();
  });
});

// After creating ANY booking
function trackBooking(bookingId: string) {
  if (!createdBookingIds.includes(bookingId)) {
    createdBookingIds.push(bookingId);
    console.log(`📝 Tracked booking for cleanup: ${bookingId}`);
  }
}

// Cleanup function
async function cleanupAllBookings() {
  console.log(`🧹 Cleaning up ${createdBookingIds.length} test bookings...`);
  
  for (const bookingId of createdBookingIds) {
    try {
      await api.cancelTrip(CLIENT_ID!, bookingId, 'E2E test cleanup');
      console.log(`✅ Cancelled: ${bookingId}`);
    } catch (error) {
      console.error(`❌ Failed to cancel ${bookingId}:`, error);
      // Continue to next booking
    }
  }
}

// Call after EVERY successful booking creation
afterEach(async () => {
  // Attempt cleanup after each test
  await cleanupAllBookings();
  createdBookingIds.length = 0; // Clear the list
});

// Final safety net
afterAll(async () => {
  await cleanupAllBookings();
});
```

### Fix #2: Wrap Booking Creation

```typescript
async function createTestBooking(params) {
  const result = await api.bookTrip(CLIENT_ID!, params);
  
  if (result.success && result.bookingId) {
    trackBooking(result.bookingId);
  }
  
  return result;
}
```

### Fix #3: Add Booking Cleanup Verification

```typescript
afterAll(async () => {
  // Verify all bookings were cancelled
  const trips = await api.getTrips(CLIENT_ID!, {
    startDate: todayStr,
    endDate: futureStr,
    status: 'scheduled'
  });
  
  const uncancelledTestBookings = trips.filter(trip => 
    createdBookingIds.includes(trip.bookingId)
  );
  
  if (uncancelledTestBookings.length > 0) {
    console.error(`❌ ${uncancelledTestBookings.length} test bookings still active!`);
    console.error('Booking IDs:', uncancelledTestBookings.map(t => t.bookingId));
    throw new Error('Test bookings not cleaned up');
  }
});
```

### Fix #4: Add Timeout Protection

```typescript
// If cleanup takes too long, force it
const CLEANUP_TIMEOUT = 30000; // 30 seconds

async function cleanupWithTimeout() {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Cleanup timeout')), CLEANUP_TIMEOUT)
  );
  
  try {
    await Promise.race([
      cleanupAllBookings(),
      timeoutPromise
    ]);
  } catch (error) {
    console.error('⚠️ Cleanup failed:', error);
    // Log remaining booking IDs for manual cleanup
    console.error('Manual cleanup required for:', createdBookingIds);
  }
}
```

---

## Testing Strategy Changes

### Option A: Use Test Accounts (Preferred)

Request DATS provide a test account that:
- Has special flag marking it as "test only"
- Bookings auto-cancel after 1 hour
- Drivers are never dispatched

### Option B: Reduce E2E Booking Tests

- Only test booking creation + cancellation in E2E
- Test full booking flow in unit tests with mocked API
- Limits real bookings to absolute minimum

### Option C: Separate "Dry Run" Mode

Add a DRY_RUN flag that:
- Creates draft (PassCreateTrip)
- Gets solutions (PassScheduleTrip)  
- **SKIPS** PassSaveSolution (no confirmed booking)
- Draft expires automatically after 24 hours

---

## Monitoring & Alerts

### Add Post-Test Audit

```typescript
// After E2E tests complete
async function auditTestBookings() {
  const allTrips = await api.getTrips(CLIENT_ID!, {
    startDate: todayStr,
    endDate: future30Days,
    status: 'all'
  });
  
  // Check for trips with typical test patterns
  const suspiciousTrips = allTrips.filter(trip =>
    trip.pickup.address.includes('160 STREET') &&
    trip.dropoff.address.includes('170 STREET')
  );
  
  if (suspiciousTrips.length > 0) {
    console.warn('⚠️ Potential uncancelled test bookings found');
    // Send notification, fail CI, etc.
  }
}
```

### GitHub Actions Notification

```yaml
- name: Check for uncancelled bookings
  if: always()
  run: |
    # Call audit endpoint
    # If uncancelled bookings found, fail the job
    # Send Slack/email notification
```

---

## Implementation Priority

| Priority | Fix | Effort | Impact |
|----------|-----|--------|--------|
| **P0** | Track ALL bookings in global array | 2 hours | Prevents all leaks |
| **P0** | Add process exit handlers | 1 hour | Cleanup on crash |
| **P1** | Wrap booking creation | 1 hour | Easier tracking |
| **P1** | Add cleanup verification | 2 hours | Detects failures |
| **P2** | Add timeout protection | 1 hour | Handles hangs |
| **P2** | Post-test audit | 2 hours | Monitoring |
| **P3** | Request test account from DATS | ? | Best long-term solution |

---

## Rollout Plan

1. **Immediate (Today)**
   - Manually cancel 18846857, 18846858
   - Disable E2E tests with booking creation until fix is deployed

2. **Within 24 hours**
   - Implement P0 fixes
   - Test locally with real bookings
   - Verify cleanup works even on process kill

3. **Within 1 week**
   - Implement P1 fixes
   - Add monitoring/alerts
   - Re-enable E2E tests

4. **Within 1 month**
   - Request test account from DATS
   - Implement dry-run mode as backup

---

## Success Criteria

- [ ] Zero uncancelled test bookings in next 10 E2E runs
- [ ] Cleanup runs even if tests crash
- [ ] All booking IDs tracked from creation to cancellation
- [ ] Alerts trigger if cleanup fails
- [ ] Documentation updated with cleanup procedures

---

## Lessons Learned

1. **Never rely solely on afterAll()** - it doesn't run on crashes
2. **Track ALL side effects** - maintain global state of created resources  
3. **Test cleanup code** - verify it actually runs and works
4. **Add monitoring** - don't assume cleanup succeeded
5. **Use test accounts** - production data is risky for testing
