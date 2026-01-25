# E2E Testing Guide

## Overview

E2E (End-to-End) tests validate the DATS Booking MCP server against the **real DATS API** using actual credentials. These tests create and cancel real bookings to ensure the integration works correctly.

## Current Test Details

### What Gets Tested

**Test Booking:**
- **Pickup Address:** Your home address (from your DATS profile)
- **Destination:** 1 Sir Winston Churchill Square (Edmonton City Hall)
- **Date:** 3 days from test run date
- **Time:** 10:00 AM
- **Mobility Device:** None
- **Action:** Booking is created, then **immediately cancelled**

**Additional Tests:**
- Authentication with DATS
- Session persistence
- Booking window retrieval (read-only)
- Address geocoding
- Client profile retrieval

### Credentials Used

Tests use the GitHub Secrets you configured:
- `DATS_TEST_CLIENT_ID` - Your DATS client ID
- `DATS_TEST_PASSCODE` - Your DATS passcode

**Security:** Credentials are encrypted in GitHub and never appear in logs.

---

## How to Run E2E Tests

### Option 1: Manual Trigger via GitHub Actions UI

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. Select **Deploy to Azure** workflow from the left sidebar
4. Click the **Run workflow** button (top right)
5. Select options:
   - **Environment:** `production` (or `staging`)
   - **Run E2E tests:** ✅ **Check this box**
6. Click **Run workflow**

### Option 2: Manual Trigger via GitHub CLI

```bash
gh workflow run "Deploy to Azure" --field run_e2e=true --field environment=production
```

### Option 3: Run Locally (No Real Booking Created)

```bash
cd mcp-servers/dats-booking

# Set your credentials (these will be used to test authentication only)
export DATS_TEST_CLIENT_ID="your-client-id"
export DATS_TEST_PASSCODE="your-passcode"
export LOG_LEVEL=debug

# Run E2E tests
npm run test:e2e
```

**Note:** Local runs use the same credentials but won't trigger a deployment.

---

## When to Run E2E Tests

### ✅ Run E2E Tests When:

- Making changes to the DATS API client (`src/api/dats-api.ts`)
- Modifying booking logic (`src/tools/book-trip.ts`)
- Updating authentication flow (`src/auth/`)
- Deploying a major feature
- Investigating a reported booking failure
- Before a production release

### ❌ Skip E2E Tests When:

- Making documentation changes
- Updating CI/CD config
- Fixing typos or comments
- Making UI-only changes (if applicable)
- Deploying urgent hotfixes that don't affect booking

---

## Test Results

### Successful Run Example

```
✓ DATS API E2E Tests > DATS Authentication > should authenticate with valid credentials
✓ DATS API E2E Tests > Session Persistence > session should remain valid for subsequent calls
✓ DATS API E2E Tests > Get Booking Windows (Read-Only) > should retrieve booking days window
✓ DATS API E2E Tests > Booking Flow (Create + Cancel) > should get available booking options
✓ DATS API E2E Tests > Address Geocoding > should geocode a known Edmonton address

Test booking created: 18846735
✅ Test booking cancelled successfully

Test Files  1 passed (1)
     Tests  8 passed (8)
```

### Viewing Test Logs

1. Go to **Actions** tab in GitHub
2. Click on the workflow run
3. Click **E2E Integration Tests** job
4. Expand **Run E2E tests against DATS API** step
5. View detailed logs with SOAP request/response data

---

## Test Frequency

**Current Configuration:**
- **Automatic runs:** Disabled (to conserve your DATS account)
- **Manual runs:** Enabled via workflow trigger

**Previous Behavior:** E2E tests ran on every push to `main`.

**Change Date:** January 25, 2026

---

## Troubleshooting

### Test Fails with "Restrict users from booking trips for the next day(s)"

**Cause:** DATS booking cutoff time has passed.

**Solution:** This is expected behavior after DATS's daily cutoff (typically around noon). The test books 3 days ahead to minimize this, but if you run tests late on a Friday, Monday might be past cutoff.

### Test Fails with "No available trip slots"

**Cause:** DATS has no availability at the requested time.

**Solution:** This is a valid DATS response. The test won't fail for this - it's just logged.

### Test Hangs or Times Out

**Cause:** DATS API may be slow or down.

**Solution:** 
- Check DATS portal is accessible: https://mypass.trapezecs.com/
- Re-run the workflow
- If persistent, contact DATS support

### Test Creates Booking but Can't Cancel

**Cause:** Network issue or DATS API error during cancellation.

**Action Required:** 
1. Check the test logs for the booking ID
2. Manually cancel the trip via DATS portal or phone
3. Report the issue for investigation

---

## Future Improvements

### Potential Enhancements

1. **Separate Test Account:** Request a dedicated test account from DATS (if available)
2. **Test Data Randomization:** Use different destinations to test more scenarios
3. **Scheduled Test Runs:** Run E2E tests weekly via cron instead of per-deployment
4. **Test Metrics Dashboard:** Track booking success rate over time
5. **Parallel Test Execution:** Run multiple booking scenarios simultaneously

### Feedback

If you have suggestions for improving E2E tests, please:
- Open an issue on GitHub
- Discuss in the project roadmap document
- Contact the development team

---

## Summary

- **Default:** E2E tests are **OFF** (don't run automatically)
- **Manual trigger:** Go to Actions → Run workflow → Check "Run E2E tests"
- **Test details:** Books home → City Hall, 3 days ahead at 10 AM, immediately cancels
- **Credentials:** Uses your DATS account from GitHub Secrets
- **Frequency:** Run when making API/booking changes or investigating bugs

**Last Updated:** January 25, 2026
