# Changelog

All notable changes to the DATS Booking MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Fixed - 2026-01-14

#### Comprehensive Timezone Bug Fixes

**Problem:** Systematic timezone bugs causing incorrect date calculations in remote mode (Azure deployment).

**Symptoms:**
- Dates showing +1 day ahead in iPhone app compared to Desktop app
- "Thursday" being interpreted as January 16, 2026 instead of January 15, 2026
- Date offset issues when server timezone differs from client timezone

**Root Cause:**
When `Intl.DateTimeFormat` returns date components (year, month, day), these values are already in the user's timezone (America/Edmonton). Creating JavaScript Date objects with `new Date(year, month - 1, day)` re-interprets these components in the server's local timezone, causing offset bugs in remote mode where the Azure server's timezone differs from the client's.

**Solution:**
Systematically converted all date operations to use UTC methods, making date arithmetic timezone-neutral throughout the codebase.

**Files Modified (6 total):**
- `src/index.ts` - Fixed parseFlexibleDate() and formatDateYMD()
- `src/utils/booking-validation.ts` - Fixed date validation and comparison logic
- `src/utils/plain-language.ts` - Fixed date object creation from string formats
- `src/utils/validation.ts` - Fixed business rule validation dates
- `src/api/dats-api.ts` - Fixed API date formatting
- `src/api/soap-client.ts` - Fixed SOAP request date formatting

**Pattern Applied:**
```typescript
// Before (Bug)
new Date(year, month - 1, day)  // Server's local timezone
date.getDay()                    // Local timezone
date.setDate(x)                  // Local timezone

// After (Fixed)
new Date(Date.UTC(year, month - 1, day))  // Timezone-neutral
date.getUTCDay()                          // UTC
date.setUTCDate(x)                        // UTC
```

**Testing:**
- ✅ Local build successful
- ✅ Deployed to Azure Container Apps
- ✅ Verified on iPhone: "Thursday" now correctly resolves to January 15, 2026
- ✅ Dates match between iPhone and Desktop apps

**Impact:**
- Eliminates all timezone-related date calculation bugs
- Reinforces passthrough principle: trust input data, avoid re-interpretation
- Makes date arithmetic consistent across all deployment modes

**Commits:**
- `1cad24e` - Fix date offset bug and enforce passthrough principle
- `cda2127` - Fix comprehensive timezone bugs across entire codebase

---

#### Passthrough Principle Documentation

**Added:** Prominent "Passthrough Principle" section to `CLAUDE.md`

**Problem:** Status inference code was adding business logic to the MCP server, violating the passthrough principle and causing timezone-sensitive bugs.

**Solution:**
- Documented that DATS Booking MCP is a simple passthrough service
- Removed status inference code (trust DATS API for status)
- Added clear DO/DON'T guidelines for future development
- Updated trip status documentation to reflect passthrough approach

**Files Modified:**
- `CLAUDE.md` - Added "⚠️ Passthrough Principle - READ THIS FIRST" section
- `CLAUDE.md` - Removed contradictory status inference documentation

**Key Principle:**
The MCP server's ONLY job is to:
1. Accept requests from Claude/clients
2. Call the DATS API
3. Format the response for display
4. Return the data to Claude/clients

No business logic, inference, or interpretation should be added.

---

## [1.1.1] - 2026-01-13

### Fixed
- Plain-language tests updated to match simplified formatTripsForUser
- Auth flow improved with background polling and auto-close browser
- Fixed auth URL in Bicep deployment

### Changed
- Reverted to non-blocking auth after testing blocking approach

---

## [1.1.0] - Previous Releases

See git history for earlier changes.
