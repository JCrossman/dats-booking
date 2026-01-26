# E2E Testing Guide

## Overview

E2E (End-to-End) tests validate the DATS Booking MCP server against the **real DATS API** using actual credentials. 

**🛡️ SAFETY:** Tests are **READ-ONLY** and **DO NOT create any real bookings**. This prevents accidental trips from being created.

## Current Test Details

### What Gets Tested

**✅ Safe Read-Only Tests:**
- **Authentication:** Validates login with DATS credentials
- **Profile Information:** Retrieves client details (name, home address)
- **Saved Locations:** Lists saved destinations
- **Announcements:** Retrieves DATS service announcements
- **Booking Windows:** Gets available booking dates (no booking created)
- **Session Persistence:** Verifies session stays active across multiple calls

**❌ Tests Removed for Safety:**
- ~~Booking creation~~ (removed to prevent accidental trips)
- ~~Booking cancellation~~ (no bookings created, nothing to cancel)
- ~~Address geocoding with bookings~~ (tested via profile data instead)

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

### Option 3: Run Locally

```bash
cd mcp-servers/dats-booking

# Set your credentials (used for authentication and profile data only)
export DATS_TEST_CLIENT_ID="your-client-id"
export DATS_TEST_PASSCODE="your-passcode"
export LOG_LEVEL=debug

# Run E2E tests
npm run test:e2e
```

**Note:** Local runs use the same credentials but won't trigger a deployment. No bookings are created.

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
✓ DATS API E2E Tests > DATS Authentication > should reject invalid credentials
✓ DATS API E2E Tests > Get Booking Windows (Read-Only) > should retrieve booking days window
✓ DATS API E2E Tests > Get Announcements (Read-Only) > should retrieve DATS announcements
✓ DATS API E2E Tests > Profile Information > should retrieve client profile information
✓ DATS API E2E Tests > Profile Information > should retrieve saved locations
✓ DATS API E2E Tests > Session Persistence > should maintain session across multiple API calls

Test Files  1 passed (1)
     Tests  7 passed (7)
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

### Test Fails with Authentication Error

**Cause:** Invalid credentials or DATS account issue.

**Solution:** 
- Verify GitHub Secrets are configured correctly
- Test credentials manually via DATS portal: https://mypass.trapezecs.com/
- If portal login works but tests fail, contact DATS support

### Test Hangs or Times Out

**Cause:** DATS API may be slow or down.

**Solution:** 
- Check DATS portal is accessible: https://mypass.trapezecs.com/
- Re-run the workflow
- If persistent, contact DATS support

### Profile/Saved Locations Returns Empty

**Cause:** Normal behavior if account is new or has no saved locations.

**Solution:** This is expected and not an error. Tests verify the API call succeeds, not that data exists.

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
- **Safety:** Tests are **READ-ONLY** - **NO bookings are created**
- **Test details:** Login, profile retrieval, booking windows, announcements
- **Credentials:** Uses your DATS account from GitHub Secrets
- **Frequency:** Run when making API/auth changes or investigating bugs

**Last Updated:** January 26, 2026
