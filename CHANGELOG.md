# Changelog

All notable changes to the DATS Booking MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] - 2026-01-16 - Production Release

### 🚀 Production Deployment Complete

**Major milestone: Fully automated CI/CD pipeline and production infrastructure deployed.**

#### Added

**CI/CD Pipeline (GitHub Actions)**
- `.github/workflows/deploy-to-azure.yml` - Automated deployment workflow
  - Runs tests on every push to main
  - Builds Docker images for linux/amd64 platform
  - Pushes to Azure Container Registry
  - Deploys to Azure Container Apps
  - Verifies deployment health
  - Total deployment time: ~2-3 minutes
- Azure Service Principal configured with Contributor role
- GitHub Secrets configured:
  - `AZURE_CREDENTIALS` - Azure authentication
  - `AZURE_STATIC_WEB_APPS_API_TOKEN` - Static site deployment

**Monitoring Infrastructure**
- Application Insights resource: `dats-mcp-prod-insights`
- Connected to Log Analytics Workspace
- 30-day log retention
- Audit logging verification (no PII)
- Health probes configured (liveness + readiness at `/health`)

**Documentation**
- `DEPLOYMENT-COMPLETE.md` - Complete operations manual
- `AZURE-ASSESSMENT.md` - Infrastructure analysis and findings
- `AZURE-DEPLOYMENT-BEST-PRACTICES.md` - CI/CD patterns
- `IMPLEMENTATION-SUMMARY.md` - What was delivered
- Migrated from Claude Code to GitHub Copilot
  - Renamed `CLAUDE.md` → `COPILOT.md`
  - Updated `AGENTS.md` for Copilot CLI
  - Created `.github/copilot-instructions.md`
  - Removed `.claude/` directory

#### Changed

**Infrastructure Updates (Azure)**
- Fixed `DATS_AUTH_URL` → Now points to Static Web App (green-sky-0e461ed10.1.azurestaticapps.net)
- Changed `LOG_LEVEL=debug` → `LOG_LEVEL=info` for production
- Added `APPLICATIONINSIGHTS_CONNECTION_STRING` environment variable
- Updated `azure/dats-mcp/main.bicep` - Added Application Insights resource
- Docker images now built for correct platform (linux/amd64)

**Deployment Process**
- Before: Manual deployments via Azure CLI
- After: Push to `main` branch = automatic deployment
- Zero-touch deployments with health verification

#### Fixed

**Critical Environment Variable Issues**
- `DATS_AUTH_URL` was pointing to Container App instead of Static Web App (OAuth callback failure)
- `LOG_LEVEL=debug` caused performance issues in production
- Missing Application Insights connection

**Deployment Pipeline Issues**
- Docker images were multi-arch (causing deployment failures)
- Service Principal JSON had warnings in output
- Workflow had lint step without eslint configured

---

## [Unreleased]

### Added - 2026-01-16

#### POPA Compliance Implementation

**Full Protection of Privacy Act (Alberta) compliance for remote mode (Claude Mobile/Web).**

**New Files:**
- `src/auth/consent-manager.ts` - Consent management for POPA compliance
- `azure/dats-auth/src/privacy.html` - Privacy policy page (WCAG 2.2 AA compliant)
- `POPA-COMPLIANCE.md` - Complete compliance documentation

**Enhanced Files:**
- `src/tools/connect-account.ts` - Added consent flow for remote mode
  - Privacy notice shown before storing session
  - User must explicitly consent with `consent_given: true`
  - Audit logging for consent events
  - Local mode unchanged (no consent needed)
- `src/tools/disconnect-account.ts` - Enhanced with POPA deletion rights messaging
  - Audit logging for deletion events
  - Emphasizes permanent deletion
- `src/utils/logger.ts` - Enhanced audit logging
  - Hashed session IDs (no PII)
  - Timestamp enrichment
  - POPA-compliant formatting
- `src/types.ts` - Updated AuditLogEntry interface
  - Added `sessionIdHash`, `privacyPolicyVersion` fields
  - Removed duplicate interface

**Documentation Updates:**
- `README.md` - Added Privacy & Compliance section
- `COPILOT.md` - Updated with POPA compliance notes (pending)

**Compliance Status:**
- ✅ NFR-2.6: Consent collection before credential storage
- ✅ NFR-2.4: Audit logging (access, modifications)
- ✅ NFR-2.7: Data deletion capability (immediate via `disconnect_account`)
- ✅ NFR-2.3: Canadian data residency (already implemented)
- ✅ NFR-2.1: AES-256-GCM encryption (already implemented)

**Key Features:**
- **Differentiated compliance:** Full POPA for remote mode, minimal for local mode
- **User rights:** Explicit consent, immediate deletion, privacy notice access
- **No PII in logs:** Session IDs hashed with SHA-256
- **24-hour TTL:** Automatic session expiration (already implemented)

**Testing:** Manual testing required for consent flow in Claude mobile app.

---

### Fixed - 2026-01-15

#### Status Extraction Bug Fix

**Problem:** Completed trips showed "Scheduled" instead of "Performed" status.

**Root Cause:** The code was extracting `SchedStatusF` from the top-level `PassBooking` element, which always shows "Scheduled" (the status when the trip was created). The correct status comes from `EventsInfo.SchedStatusF` within `PickUpLeg`.

**XML Structure Discovery:**
```xml
<PassBooking>
  <SchedStatusF>Scheduled</SchedStatusF>  <!-- ❌ WRONG - booking creation status -->
  <PickUpLeg>
    <EventsInfo>
      <SchedStatusF>Performed</SchedStatusF>  <!-- ✅ CORRECT - actual trip status -->
    </EventsInfo>
  </PickUpLeg>
</PassBooking>
```

**Solution:**
- Fixed `src/api/dats-api.ts` (lines 1168-1179) to extract status from `EventsInfo.SchedStatusF`
- Added fallback to top-level status if EventsInfo is missing

**Commits:**
- Code fix was already in repo but Azure Container App was running old revision from 2026-01-13
- Deployed new revision `status-fix-v2-1768534254` to use latest image

---

#### Provider Name Extraction Fix

**Problem:** Provider name (e.g., "PRESTIGE") was not displaying in trip listings.

**Root Cause:** Code was looking for `EventsProviderInfo` inside `EventsInfo`, but it's actually a sibling element within `PickUpLeg`. Additionally, some trips have provider info at the `PassBooking` level instead.

**XML Structure:**
```xml
<PickUpLeg>
  <EventsInfo>...</EventsInfo>
  <EventsProviderInfo>  <!-- Sibling, NOT nested inside EventsInfo -->
    <ProviderName>PRESTIGE</ProviderName>
  </EventsProviderInfo>
</PickUpLeg>
```

**Solution:**
- Fixed extraction to look in `pickupXml` (PickUpLeg) instead of `eventsInfoXml`
- Added fallback to check full `xml` (PassBooking level) if not found in PickUpLeg
- Added Provider column to trip display format

**Files Modified:**
- `src/api/dats-api.ts` - Provider extraction with fallback
- `src/utils/plain-language.ts` - Added Provider column to display guidelines

**Commits:**
- `89c28e1` - Fix provider extraction + add Provider column to trip display
- `34aa7dd` - Add fallback for EventsProviderInfo at PassBooking level

---

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
