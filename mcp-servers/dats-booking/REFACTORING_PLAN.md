# DATS Booking MCP Server - Refactoring Plan

**Status:** Phase 1 Ready to Start
**Quality Score:** B- (Good foundations, needs refactoring)
**Last Updated:** 2026-01-14

This document tracks the systematic refactoring effort to transform the DATS Booking MCP server from a rapid prototype into production-grade code.

## Quick Reference

| Phase | Status | Duration | Priority |
|-------|--------|----------|----------|
| **Phase 0: Foundation** | ⬜ Not Started | 2 hours | P0 |
| **Phase 1: Quick Wins** | ⬜ Not Started | 3.5 hours | P1 |
| **Phase 2: Test Coverage** | ⬜ Not Started | 10 hours | P0 |
| **Phase 3: Refactor index.ts** | ⬜ Not Started | 14 hours | P1 |
| **Phase 4: Refactor dats-api.ts** | ⬜ Not Started | 22 hours | P1 |

**Total Estimated Effort:** 51.5 hours

---

## Phase 0: Foundation (2 hours) ⬜

**Goal:** Set up testing infrastructure before any refactoring

### Tasks

#### Task 0.1: Install Testing Dependencies (15 min)
```bash
npm install --save-dev vitest @vitest/coverage-v8 @types/node
```

**Verification:** Check `package.json` has new dependencies

#### Task 0.2: Create Test Configuration (15 min)
Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'build/',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
    },
  },
});
```

**Verification:** File exists and is valid TypeScript

#### Task 0.3: Add Test Scripts (10 min)
Update `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

**Verification:** `npm test` runs successfully (even with 0 tests)

#### Task 0.4: Create Test Directory Structure (10 min)
```bash
mkdir -p src/__tests__/{unit,integration,e2e}
mkdir -p src/__tests__/fixtures
```

**Verification:** Directories exist

#### Task 0.5: Write Example Unit Test (30 min)
Create `src/__tests__/unit/plain-language.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { formatTimeWindow } from '../../utils/plain-language';

describe('formatTimeWindow', () => {
  it('should format time window with same period', () => {
    const result = formatTimeWindow({ start: '2:00 PM', end: '2:30 PM' });
    expect(result).toBe('2:00 and 2:30 PM');
  });

  it('should format time window with different periods', () => {
    const result = formatTimeWindow({ start: '11:30 AM', end: '12:00 PM' });
    expect(result).toBe('11:30 AM and 12:00 PM');
  });
});
```

**Verification:** `npm test` passes

#### Task 0.6: Write Example Integration Test (30 min)
Create `src/__tests__/integration/booking-validation.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { validateBookingWindow } from '../../utils/booking-validation';

describe('validateBookingWindow', () => {
  it('should reject bookings more than 3 days in advance', () => {
    // Test implementation
  });

  it('should accept bookings within the 3-day window', () => {
    // Test implementation
  });
});
```

**Verification:** `npm test` passes

#### Task 0.7: Document Testing Approach (20 min)
Create `TESTING.md`:
```markdown
# Testing Guide

## Running Tests
- `npm test` - Run all tests
- `npm run test:watch` - Watch mode for development
- `npm run test:coverage` - Generate coverage report

## Test Organization
- `src/__tests__/unit/` - Pure function tests
- `src/__tests__/integration/` - Multi-module tests
- `src/__tests__/e2e/` - Full workflow tests

## Writing Tests
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Aim for 80%+ coverage on business logic
```

**Verification:** File exists and is clear

#### Task 0.8: Commit Foundation Work
```bash
git add package.json vitest.config.ts src/__tests__ TESTING.md
git commit -m "Add testing infrastructure with vitest

- Install vitest and coverage tooling
- Create test directory structure
- Add example unit and integration tests
- Document testing approach

Part of Phase 0 refactoring effort."
```

**Verification:** Commit exists in git history

---

## Phase 1: Quick Wins (3.5 hours) ⬜

**Goal:** Low-effort improvements that immediately boost maintainability

### Task 1.1: Archive Deprecated Automation Code (30 min)

**Rationale:** `src/automation/` contains deprecated Playwright code, replaced by direct SOAP API calls. This dead code confuses new developers.

**Steps:**
1. Create archive directory:
   ```bash
   mkdir -p archive/2026-01-deprecated-playwright
   ```

2. Move automation files:
   ```bash
   mv src/automation/* archive/2026-01-deprecated-playwright/
   rmdir src/automation
   ```

3. Create archive README:
   ```bash
   cat > archive/2026-01-deprecated-playwright/README.md << 'EOF'
   # Deprecated: Playwright Browser Automation

   **Archived:** 2026-01-14
   **Reason:** Replaced with direct SOAP API calls

   ## Background
   Initial implementation used Playwright to automate the DATS website.
   Upon discovering the SOAP/XML API, we switched to direct API calls
   for better performance (~2s vs ~30s) and reliability.

   ## Contents
   - browser-manager.ts - Playwright browser lifecycle
   - rate-limiter.ts - Request rate limiting
   - pages/ - Page object models

   This code is preserved for historical reference but is not used
   in the current implementation.
   EOF
   ```

4. Update `.gitignore` if needed

**Verification:**
- [ ] `src/automation/` no longer exists
- [ ] Files moved to `archive/`
- [ ] README.md explains why code was archived
- [ ] Build still passes: `npm run build`

**Commit:**
```bash
git add archive/ src/
git commit -m "Archive deprecated Playwright automation code

Moved browser-based automation to archive. This code was replaced
with direct SOAP API calls when we discovered the Trapeze PASS API.

Preserves history while removing confusing dead code from src/.

Part of Phase 1 refactoring (quick wins)."
```

---

### Task 1.2: Remove Duplicate Backup Files (15 min)

**Rationale:** Files with " 2" suffix are accidental backups tracked by git.

**Steps:**
1. Find all duplicates:
   ```bash
   find . -name "* 2.*" -type f
   ```

2. Delete them:
   ```bash
   rm "azure/dats-auth/src/staticwebapp.config 2.json"
   rm "azure/dats-mcp/main 2.bicep"
   rm "azure/dats-mcp/parameters.prod 2.json"
   rm "business/Modernizing Legacy Government Services with AI.docx"
   rm "business/infographic-dats-overview 2.png"
   rm "mcp-servers/dats-booking/.dockerignore 2"
   rm "mcp-servers/dats-booking/Dockerfile 2"
   rm "mcp-servers/dats-booking/src/auth/cosmos-session-store 2.ts"
   rm "mcp-servers/dats-booking/src/server/http-server 2.ts"
   ```

**Verification:**
- [ ] No files with " 2" in name
- [ ] Build still passes

**Commit:**
```bash
git add -A
git commit -m "Remove accidental backup files

Deleted files with ' 2' suffix. Git tracks history, so backups
are unnecessary and confusing.

Part of Phase 1 refactoring (quick wins)."
```

---

### Task 1.3: Create Constants File (1 hour)

**Rationale:** Magic numbers scattered throughout codebase make business rules hard to find and change.

**Steps:**
1. Create `src/constants.ts`:
   ```typescript
   /**
    * DATS Business Rules and System Constants
    *
    * This file centralizes all magic numbers and configuration values
    * used throughout the application. Update these values when DATS
    * policies change.
    */

   /**
    * DATS booking and cancellation policies
    */
   export const DATS_BUSINESS_RULES = {
     /** Maximum days in advance you can book a trip */
     ADVANCE_BOOKING_MAX_DAYS: 3,

     /** Minimum hours notice for same-day bookings */
     SAME_DAY_MIN_HOURS: 2,

     /** Minimum hours notice to cancel a trip */
     CANCELLATION_MIN_HOURS: 2,

     /** Hour when day-ahead booking cutoff occurs (noon) */
     NOON_CUTOFF_HOUR: 12,

     /** Duration of pickup time window in minutes */
     PICKUP_WINDOW_MINUTES: 30,

     /** Maximum time vehicle waits at pickup in minutes */
     VEHICLE_WAIT_MINUTES: 5,
   } as const;

   /**
    * Time conversion constants
    */
   export const TIME_CONSTANTS = {
     MINUTES_PER_HOUR: 60,
     HOURS_PER_DAY: 24,
     DAYS_PER_WEEK: 7,
     MILLISECONDS_PER_SECOND: 1000,
     MILLISECONDS_PER_MINUTE: 60_000,
   } as const;

   /**
    * API and system configuration
    */
   export const API_CONSTANTS = {
     /** DATS SOAP API base URL */
     DATS_API_URL: 'https://datsonlinebooking.edmonton.ca/PassInfoServer',

     /** DATS async API URL */
     DATS_API_ASYNC_URL: 'https://datsonlinebooking.edmonton.ca/PassInfoServerAsync',

     /** DATS remarks/announcements endpoint */
     DATS_REMARKS_URL: 'https://datsonlinebooking.edmonton.ca/Remarks',

     /** Maximum characters for debug log truncation */
     DEBUG_LOG_MAX_LENGTH: 500,

     /** Default HTTP server port */
     DEFAULT_HTTP_PORT: 3000,

     /** Default timezone for DATS users */
     DEFAULT_TIMEZONE: 'America/Edmonton',
   } as const;

   /**
    * Month name to number mapping for date parsing
    */
   export const MONTH_NAMES: Record<string, string> = {
     jan: '01',
     feb: '02',
     mar: '03',
     apr: '04',
     may: '05',
     jun: '06',
     jul: '07',
     aug: '08',
     sep: '09',
     oct: '10',
     nov: '11',
     dec: '12',
   } as const;

   /**
    * Day names for date parsing
    */
   export const DAY_NAMES = [
     'sunday',
     'monday',
     'tuesday',
     'wednesday',
     'thursday',
     'friday',
     'saturday',
   ] as const;
   ```

2. Update `src/utils/booking-validation.ts` to use constants:
   ```typescript
   import { DATS_BUSINESS_RULES, TIME_CONSTANTS } from '../constants';

   // Replace hardcoded numbers with constants
   if (daysUntilPickup > DATS_BUSINESS_RULES.ADVANCE_BOOKING_MAX_DAYS) {
     // ...
   }
   ```

3. Update `src/index.ts` to use constants:
   ```typescript
   import { MONTH_NAMES, DAY_NAMES, API_CONSTANTS } from './constants';
   ```

4. Update other files with magic numbers

**Verification:**
- [ ] All magic numbers replaced with named constants
- [ ] Build passes
- [ ] Tests pass
- [ ] Constants file has JSDoc comments

**Commit:**
```bash
git add src/constants.ts src/utils/booking-validation.ts src/index.ts
git commit -m "Extract magic numbers to constants file

Centralize all business rules, time conversions, and configuration
values in src/constants.ts. Makes policies easier to find and update.

Replaced hardcoded values in:
- booking-validation.ts
- index.ts

Part of Phase 1 refactoring (quick wins)."
```

---

### Task 1.4: Extract Encryption to Shared Module (1 hour)

**Rationale:** Both `session-manager.ts` and `cosmos-session-store.ts` duplicate encryption logic (~60 lines each).

**Steps:**
1. Create `src/auth/encryption.ts`:
   ```typescript
   /**
    * Session Encryption Utilities
    *
    * Provides AES-256-GCM encryption/decryption for session data.
    * Used by both local (file-based) and remote (Cosmos DB) session stores.
    */

   import {
     createCipheriv,
     createDecipheriv,
     randomBytes,
     scryptSync,
   } from 'crypto';
   import { logger } from '../utils/logger';

   const ALGORITHM = 'aes-256-gcm';
   const KEY_LENGTH = 32;
   const IV_LENGTH = 16;
   const SALT = 'dats-booking-mcp-salt';

   export interface EncryptedData {
     encrypted: string;
     iv: string;
     authTag: string;
   }

   export class SessionEncryption {
     private key: Buffer;

     constructor(keySource: string) {
       this.key = scryptSync(keySource, SALT, KEY_LENGTH);
     }

     /**
      * Encrypt plaintext string
      */
     encrypt(plaintext: string): EncryptedData {
       const iv = randomBytes(IV_LENGTH);
       const cipher = createCipheriv(ALGORITHM, this.key, iv);

       const encrypted = Buffer.concat([
         cipher.update(plaintext, 'utf8'),
         cipher.final(),
       ]);

       const authTag = cipher.getAuthTag();

       return {
         encrypted: encrypted.toString('base64'),
         iv: iv.toString('base64'),
         authTag: authTag.toString('base64'),
       };
     }

     /**
      * Decrypt encrypted data
      */
     decrypt(encrypted: string, iv: string, authTag: string): string {
       try {
         const decipher = createDecipheriv(
           ALGORITHM,
           this.key,
           Buffer.from(iv, 'base64')
         );
         decipher.setAuthTag(Buffer.from(authTag, 'base64'));

         const decrypted = Buffer.concat([
           decipher.update(Buffer.from(encrypted, 'base64')),
           decipher.final(),
         ]);

         return decrypted.toString('utf8');
       } catch (error) {
         logger.error('Decryption failed', error instanceof Error ? error : undefined);
         throw new Error('Failed to decrypt session data');
       }
     }
   }
   ```

2. Update `session-manager.ts` to use shared encryption
3. Update `cosmos-session-store.ts` to use shared encryption
4. Remove duplicated encryption methods

**Verification:**
- [ ] Build passes
- [ ] Session encryption tests pass
- [ ] No duplicate encryption code

**Commit:**
```bash
git add src/auth/encryption.ts src/auth/session-manager.ts src/auth/cosmos-session-store.ts
git commit -m "Extract shared encryption utilities

Create SessionEncryption class to eliminate duplication between
session-manager and cosmos-session-store.

Reduces code duplication by ~60 lines and ensures consistent
encryption implementation.

Part of Phase 1 refactoring (quick wins)."
```

---

### Task 1.5: Extract Date Helpers (45 min)

**Rationale:** Date parsing and formatting functions in `index.ts` should be reusable utilities.

**Steps:**
1. Create `src/helpers/date-helpers.ts`:
   ```typescript
   /**
    * Date and Time Helpers
    *
    * Utilities for parsing flexible date inputs, formatting dates,
    * and handling timezone conversions.
    */

   import { MONTH_NAMES, DAY_NAMES, TIME_CONSTANTS } from '../constants';

   /**
    * Parse a flexible date string to YYYY-MM-DD format
    *
    * Accepts:
    * - YYYY-MM-DD (returns as-is)
    * - Day names: "monday", "thursday" (next occurrence)
    * - Relative: "today", "tomorrow"
    * - Next week: "next monday"
    *
    * @param dateStr - Date string to parse
    * @param timezone - Timezone for calculations (default: America/Edmonton)
    * @returns YYYY-MM-DD formatted date
    */
   export function parseFlexibleDate(
     dateStr: string,
     timezone: string = 'America/Edmonton'
   ): string {
     // Implementation from index.ts
   }

   /**
    * Format a Date object as YYYY-MM-DD
    */
   export function formatDateYMD(date: Date): string {
     // Implementation from index.ts
   }

   /**
    * Normalize a trip date string to YYYY-MM-DD
    * Handles formats like "Tue, Jan 13, 2026" from DATS API
    */
   export function normalizeTripDate(dateStr: string): string {
     // Implementation from index.ts
   }

   /**
    * Get current date information for a timezone
    */
   export function getCurrentDateInfo(
     timezone: string = 'America/Edmonton'
   ): { today: string; dayOfWeek: string } {
     // Implementation from index.ts
   }
   ```

2. Move implementations from `index.ts`
3. Update `index.ts` to import from helpers
4. Add unit tests for date helpers

**Verification:**
- [ ] All date functions moved to helpers
- [ ] index.ts imports from helpers
- [ ] Build passes
- [ ] Tests pass

**Commit:**
```bash
git add src/helpers/ src/index.ts src/__tests__/unit/date-helpers.test.ts
git commit -m "Extract date helpers to separate module

Move date parsing and formatting functions from index.ts to
src/helpers/date-helpers.ts for reusability.

Functions moved:
- parseFlexibleDate
- formatDateYMD
- normalizeTripDate
- getCurrentDateInfo

Includes unit tests for all helper functions.

Part of Phase 1 refactoring (quick wins)."
```

---

### Phase 1 Completion Checklist

- [ ] Task 1.1: Automation code archived
- [ ] Task 1.2: Backup files removed
- [ ] Task 1.3: Constants file created
- [ ] Task 1.4: Encryption extracted
- [ ] Task 1.5: Date helpers extracted
- [ ] All commits pushed to GitHub
- [ ] Build passes: `npm run build`
- [ ] Tests pass: `npm test`
- [ ] Documentation updated

**Success Criteria:**
- Code is more maintainable
- No duplicate code for encryption
- Magic numbers eliminated
- Dead code removed
- index.ts reduced by ~150 lines

---

## Phase 2: Test Coverage (10 hours) ⬜

**Goal:** Achieve 60%+ test coverage on business logic before major refactoring

### Task 2.1: Unit Tests for booking-validation.ts (2 hours)

Create `src/__tests__/unit/booking-validation.test.ts`

**Test Cases:**
- [ ] Validate 3-day advance booking limit
- [ ] Validate 2-hour same-day notice
- [ ] Validate noon cutoff rule
- [ ] Validate weekend/weekday logic
- [ ] Validate cancellation 2-hour rule
- [ ] Edge cases: exactly at cutoff times
- [ ] Edge cases: different timezones

**Verification:** 80%+ coverage on booking-validation.ts

---

### Task 2.2: Unit Tests for plain-language.ts (1.5 hours)

Create `src/__tests__/unit/plain-language.test.ts`

**Test Cases:**
- [ ] formatTimeWindow - same period
- [ ] formatTimeWindow - different periods
- [ ] formatTripsForUser - empty list
- [ ] formatTripsForUser - multiple trips
- [ ] formatSavedLocations - empty list
- [ ] formatSavedLocations - multiple locations
- [ ] simplifyAddress - various formats
- [ ] toTitleCase - ALL CAPS input

**Verification:** 80%+ coverage on plain-language.ts

---

### Task 2.3: Unit Tests for Date Helpers (2 hours)

Create `src/__tests__/unit/date-helpers.test.ts`

**Test Cases:**
- [ ] parseFlexibleDate - YYYY-MM-DD passthrough
- [ ] parseFlexibleDate - "today", "tomorrow"
- [ ] parseFlexibleDate - day names
- [ ] parseFlexibleDate - "next monday"
- [ ] normalizeTripDate - various formats
- [ ] formatDateYMD - UTC dates
- [ ] getCurrentDateInfo - different timezones

**Verification:** 80%+ coverage on date-helpers.ts

---

### Task 2.4: Unit Tests for Encryption (1 hour)

Create `src/__tests__/unit/encryption.test.ts`

**Test Cases:**
- [ ] Encrypt and decrypt roundtrip
- [ ] Different plaintexts
- [ ] Invalid auth tag throws error
- [ ] Invalid IV throws error
- [ ] Consistent encryption key derivation

**Verification:** 80%+ coverage on encryption.ts

---

### Task 2.5: Integration Tests for Key Tools (3 hours)

Create `src/__tests__/integration/tools.test.ts`

**Test Cases:**
- [ ] book_trip tool validation (mock DATS API)
- [ ] get_trips tool filtering (mock response)
- [ ] cancel_trip tool with 2-hour check (mock)

**Verification:** Core tool logic tested

---

### Task 2.6: Document Testing Patterns (30 min)

Update `TESTING.md` with:
- How to mock DATS API
- How to test MCP tools
- How to test session management
- Coverage expectations

---

### Phase 2 Completion Checklist

- [ ] All unit tests written
- [ ] Integration tests for 3 main tools
- [ ] Coverage report generated
- [ ] 60%+ coverage achieved
- [ ] Testing patterns documented

**Success Criteria:**
- `npm run test:coverage` shows 60%+ coverage
- All business logic has tests
- Can refactor confidently

---

## Phase 3: Refactor index.ts (14 hours) ⬜

**Goal:** Split 1,464-line god object into modular, testable tool handlers

**Current Structure:**
```
index.ts (1,464 LOC)
├── Helper functions (6 functions, 120 LOC)
├── Session management (1 function, 50 LOC)
├── Tool: connect_account (120 LOC)
├── Tool: complete_connection (80 LOC)
├── Tool: disconnect_account (80 LOC)
├── Tool: book_trip (170 LOC)
├── Tool: get_trips (100 LOC)
├── Tool: track_trip (120 LOC)
├── Tool: check_availability (70 LOC)
├── Tool: cancel_trip (100 LOC)
├── Tool: get_announcements (60 LOC)
├── Tool: get_profile (90 LOC)
├── Tool: get_info (100 LOC)
└── Server setup (3 functions, 60 LOC)
```

**Target Structure:**
```
index.ts (~150 LOC - just server setup)
tools/
  connect-account.ts
  book-trip.ts
  get-trips.ts
  track-trip.ts
  cancel-trip.ts
  check-availability.ts
  get-profile.ts
  get-announcements.ts
  get-info.ts
  complete-connection.ts (remote only)
  disconnect-account.ts
helpers/
  session-helpers.ts
  transport-helpers.ts
```

### Task 3.1: Create Tool Infrastructure (1 hour)

1. Create directory structure:
   ```bash
   mkdir -p src/tools
   mkdir -p src/helpers
   ```

2. Create tool type definitions in `src/tools/types.ts`:
   ```typescript
   import { z } from 'zod';
   import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

   export type ToolHandler = (params: any) => Promise<{
     content: Array<{ type: 'text'; text: string }>;
   }>;

   export interface ToolDefinition {
     name: string;
     description: string;
     schema: z.ZodObject<any>;
     handler: ToolHandler;
   }

   export function registerTool(
     server: McpServer,
     definition: ToolDefinition
   ): void {
     server.tool(
       definition.name,
       definition.description,
       definition.schema.shape,
       definition.handler
     );
   }
   ```

3. Create tool registry in `src/tools/index.ts`:
   ```typescript
   import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
   import { connectAccountTool } from './connect-account';
   import { bookTripTool } from './book-trip';
   // ... import other tools

   export function registerAllTools(server: McpServer): void {
     connectAccountTool.register(server);
     bookTripTool.register(server);
     // ... register other tools
   }
   ```

**Verification:**
- [ ] Directory structure created
- [ ] Type definitions in place
- [ ] Registry pattern established

---

### Task 3.2: Extract connect_account Tool (1.5 hours)

Create `src/tools/connect-account.ts`:
```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../utils/logger';
import { wrapError, createErrorResponse } from '../utils/errors';
import { ErrorCategory } from '../types';
// ... other imports

const schema = z.object({
  // No parameters for stdio mode
});

async function handler(params: z.infer<typeof schema>) {
  // Move implementation from index.ts
}

export const connectAccountTool = {
  register(server: McpServer) {
    server.tool(
      'connect_account',
      `Connect your DATS account securely...`,
      schema.shape,
      handler
    );
  },
};
```

**Verification:**
- [ ] File created
- [ ] Implementation moved
- [ ] Imports correct
- [ ] Build passes

---

### Task 3.3-3.10: Extract Remaining Tools (8 hours)

Repeat Task 3.2 pattern for:
- Task 3.3: book_trip (2 hours - most complex)
- Task 3.4: get_trips (1.5 hours)
- Task 3.5: track_trip (1 hour)
- Task 3.6: cancel_trip (1.5 hours)
- Task 3.7: check_availability (1 hour)
- Task 3.8: get_profile (1 hour)
- Task 3.9: get_announcements (45 min)
- Task 3.10: get_info + complete_connection + disconnect_account (1.25 hours)

**Verification (each tool):**
- [ ] Separate file created
- [ ] Implementation moved
- [ ] Exported for registry
- [ ] Build passes

---

### Task 3.11: Extract Session & Transport Helpers (1 hour)

Create `src/helpers/session-helpers.ts`:
```typescript
import type { CosmosSessionStore } from '../auth/cosmos-session-store';
import { DATSApi } from '../api/dats-api';

export async function getValidSession(
  sessionId?: string
): Promise<{ sessionCookie: string; clientId: string } | null> {
  // Move from index.ts
}
```

Create `src/helpers/transport-helpers.ts`:
```typescript
let cosmosSessionStore: CosmosSessionStore | null = null;

export function isRemoteMode(): boolean {
  // Move from index.ts
}

export function getCosmosStore(): CosmosSessionStore {
  // Move from index.ts
}
```

**Verification:**
- [ ] Helpers extracted
- [ ] Tools updated to use helpers

---

### Task 3.12: Update Main index.ts (1 hour)

Simplify `index.ts` to just server setup:
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './utils/logger';
import { registerAllTools } from './tools';
import { createHttpServer, startHttpServer } from './server/http-server';

const TRANSPORT_MODE = (process.env.MCP_TRANSPORT || 'stdio') as 'stdio' | 'http';
const HTTP_PORT = parseInt(process.env.PORT || '3000', 10);
const HTTP_HOST = process.env.HOST || '0.0.0.0';

const server = new McpServer({
  name: 'dats-booking',
  version: '1.0.0',
});

// Register all MCP tools
registerAllTools(server);

async function startStdioServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('DATS Booking MCP Server running on stdio');
}

async function startRemoteServer(): Promise<void> {
  logger.info('Starting DATS Booking MCP Server in HTTP mode');
  const app = createHttpServer(server);
  await startHttpServer(app, HTTP_PORT, HTTP_HOST);
}

async function main(): Promise<void> {
  logger.info(`Transport mode: ${TRANSPORT_MODE}`);

  if (TRANSPORT_MODE === 'http') {
    await startRemoteServer();
  } else {
    await startStdioServer();
  }
}

main().catch((error) => {
  logger.error('Fatal error', error instanceof Error ? error : undefined);
  process.exit(1);
});
```

**Verification:**
- [ ] index.ts < 200 LOC
- [ ] All tools registered
- [ ] Build passes
- [ ] MCP server works

---

### Phase 3 Completion Checklist

- [ ] All 11 tools extracted
- [ ] Helper modules created
- [ ] Tool registry implemented
- [ ] index.ts simplified
- [ ] Build passes
- [ ] All tests pass
- [ ] MCP server functionality verified

**Success Criteria:**
- index.ts reduced from 1,464 to ~150 LOC
- Each tool in separate, testable file
- Clear separation of concerns
- All existing functionality works

---

## Phase 4: Refactor dats-api.ts (22 hours) ⬜

**Goal:** Split 1,413-line god object into focused, single-responsibility services

**Current Structure:**
```
dats-api.ts (1,413 LOC, 49 methods)
├── Authentication (2 methods)
├── Client info (3 methods)
├── Trip operations (3 methods)
├── Booking flow (4 methods)
├── Geocoding (1 method)
├── Tracking (2 methods)
├── SOAP utilities (3 methods)
├── XML parsing (20+ methods)
├── Date/time formatting (5 methods)
```

**Target Structure:**
```
api/
  dats-client.ts (~200 LOC - coordinator)
  services/
    auth-service.ts
    trip-service.ts
    booking-service.ts
    tracking-service.ts
  parsers/
    xml-parser.ts
    trip-parser.ts
    booking-parser.ts
  utils/
    soap-builder.ts
    geocoding.ts
    formatters.ts
```

### Task 4.1: Create Service Infrastructure (1 hour)

1. Create directory structure
2. Define base service class
3. Create dependency injection pattern

---

### Task 4.2: Extract XML Parsing Utilities (3 hours)

Create generic XML parsing utilities that all services can use.

---

### Task 4.3: Extract SOAP Builder (2 hours)

Create reusable SOAP request builder.

---

### Task 4.4-4.7: Create Service Classes (11 hours)

- Task 4.4: AuthService (2 hours)
- Task 4.5: TripService (3 hours)
- Task 4.6: BookingService (4 hours)
- Task 4.7: TrackingService (2 hours)

---

### Task 4.8: Create Date/Time Formatters (1.5 hours)

Extract formatting utilities.

---

### Task 4.9: Create Main DATSClient Coordinator (2 hours)

Create thin coordinator that delegates to services.

---

### Task 4.10: Update All Imports (1 hour)

Update tool files to use new structure.

---

### Task 4.11: Integration Testing (30 min)

Verify all functionality still works.

---

### Phase 4 Completion Checklist

- [ ] All services created
- [ ] dats-api.ts < 300 LOC
- [ ] Each service < 400 LOC
- [ ] Single responsibility per class
- [ ] All tests pass
- [ ] Integration tests updated

**Success Criteria:**
- Clear separation of concerns
- Testable service classes
- Maintainable code structure

---

## Progress Tracking

### Overall Status

**Phase 0:** ⬜ Not Started
**Phase 1:** ⬜ Not Started
**Phase 2:** ⬜ Not Started
**Phase 3:** ⬜ Not Started
**Phase 4:** ⬜ Not Started

**Total Progress:** 0% (0 / 51.5 hours)

---

## How to Resume

1. Check current phase status above
2. Open the corresponding phase section
3. Start with the first incomplete task
4. Follow the task steps exactly
5. Run verification steps after each task
6. Commit after each task completion
7. Update this file with ✅ when done

---

## References

- **Detailed Review:** `.claude/plans/code-quality-review-2026-01-14.md`
- **Testing Guide:** `TESTING.md` (created in Phase 0)
- **Project Documentation:** `CLAUDE.md`
- **Architecture Decisions:** `AGENTS.md`

---

**Last Updated:** 2026-01-14
**Next Review:** After Phase 2 completion
