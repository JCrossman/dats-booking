# Deprecated: Playwright Browser Automation

**Archived:** 2026-01-14
**Reason:** Replaced with direct SOAP API calls

## Background

The initial implementation of the DATS Booking MCP server used Playwright to automate the DATS website through browser interactions. This approach worked but had significant drawbacks:

- **Slow:** ~30 seconds per booking operation
- **Fragile:** UI changes could break automation
- **Resource-intensive:** Required headless Chrome browser
- **Complex:** Needed page object models and element selectors

## Discovery of SOAP API

During development, we discovered that the DATS online booking system uses a SOAP/XML API (Trapeze PASS) for all operations. By reverse-engineering the browser's network requests, we found we could call this API directly.

## Benefits of Direct API Approach

Switching from Playwright automation to direct SOAP API calls provided:

- **Speed:** ~2 seconds per operation (15x faster)
- **Reliability:** Direct API calls don't break with UI changes
- **Simplicity:** No browser management, just HTTP requests
- **Efficiency:** Lower resource usage, easier to test

## Archived Contents

This archive contains the deprecated Playwright-based implementation:

### Files
- **browser-manager.ts** (2,514 bytes)
  - Playwright browser lifecycle management
  - Browser launch, page creation, cleanup

- **rate-limiter.ts** (1,189 bytes)
  - Request rate limiting to avoid overwhelming DATS servers
  - Token bucket algorithm implementation

### Directories
- **pages/** (27,782 bytes total)
  - **login-page.ts** (3,209 bytes) - Login flow automation
  - **booking-page.ts** (6,607 bytes) - Trip booking automation
  - **trips-page.ts** (17,966 bytes) - Trip retrieval and parsing

## Current Implementation

The current implementation uses direct SOAP API calls via:
- `src/api/dats-api.ts` - Main SOAP API client
- `src/api/soap-client.ts` - Generic SOAP request builder

See `CLAUDE.md` for architectural decision documentation.

## Why Preserve This Code?

This code is preserved for:
1. **Historical reference** - Shows the evolution of the project
2. **Learning** - Demonstrates page object pattern implementation
3. **Fallback** - If SOAP API becomes unavailable, we could resurrect this approach
4. **Attribution** - Represents significant development effort

## If You Need to Resurrect This Code

1. Move files back to `src/automation/`
2. Install Playwright: `npm install playwright`
3. Update browser-manager.ts for latest Playwright API
4. Test thoroughly - DATS UI may have changed

**Note:** This is not recommended. The SOAP API approach is superior in every measurable way.

---

**Archived by:** Phase 1 Refactoring (Quick Wins)
**See also:** `.claude/plans/code-quality-review-2026-01-14.md` for full context
