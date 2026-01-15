# Code Quality Review: DATS Booking MCP Server
**Date:** 2026-01-14
**Reviewer:** Code Quality Agent
**Codebase Version:** main branch (commit 157a151)

## Executive Summary

**Quality Score: B-** (Good foundations, needs significant refactoring)

The DATS Booking MCP server demonstrates solid architectural patterns and security-conscious design, but suffers from several maintainability issues common in rapid prototyping. The codebase has grown organically without sufficient modularization, resulting in god objects, duplicated logic, and missing test coverage.

**Strengths:**
- ✅ Strong security architecture (passthrough principle, encrypted sessions)
- ✅ Clear separation of concerns at the high level (api/, auth/, utils/)
- ✅ TypeScript strict mode compliance
- ✅ Comprehensive error handling
- ✅ Accessibility-first design

**Critical Issues:**
- ❌ Two massive god objects (1,400+ LOC each)
- ❌ Zero test coverage
- ❌ Duplicated encryption logic
- ❌ Dead code in automation/
- ❌ Magic numbers throughout
- ❌ No constants file

---

## Detailed Findings

### 1. God Objects (Critical)

#### Issue 1.1: `src/index.ts` (1,464 LOC)
**Severity:** High
**Impact:** Maintainability, testability, readability

This file contains:
- 10 MCP tool handlers
- 6 utility functions (date parsing, formatting)
- Session validation logic
- Server setup and initialization
- Transport mode switching

**Problems:**
- Impossible to unit test individual tools
- High cognitive load when making changes
- Violates Single Responsibility Principle
- Merge conflicts likely in team environment

**Recommended Split:**
```
src/
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
  helpers/
    date-helpers.ts
    session-helpers.ts
  server/
    setup.ts
    transport.ts
```

#### Issue 1.2: `src/api/dats-api.ts` (1,413 LOC, 49 methods)
**Severity:** High
**Impact:** Maintainability, testability, understandability

This class handles:
- Authentication (2 methods)
- Client info (3 methods)
- Trip operations (3 methods)
- Booking flow (4 methods)
- Geocoding (1 method)
- Trip tracking (2 methods)
- XML parsing (20+ methods)
- SOAP request building (3 methods)
- Date/time formatting (5 methods)

**Problems:**
- Violates Single Responsibility Principle
- Hard to test individual components
- Difficult to find specific functionality
- High risk of unintended side effects

**Recommended Split:**
```
src/api/
  dats-client.ts        # Main client coordination
  services/
    auth-service.ts     # Authentication operations
    trip-service.ts     # Trip CRUD operations
    booking-service.ts  # 3-step booking flow
    tracking-service.ts # Real-time tracking
  parsers/
    xml-parser.ts       # Generic XML utilities
    trip-parser.ts      # Trip-specific parsing
    booking-parser.ts   # Booking response parsing
  utils/
    soap-builder.ts     # SOAP request construction
    geocoding.ts        # Address geocoding
    formatters.ts       # Date/time formatting
```

---

### 2. DRY Violations (High Priority)

#### Issue 2.1: Duplicated Encryption Logic
**Severity:** Medium-High
**Files:** `src/auth/session-manager.ts`, `src/auth/cosmos-session-store.ts`

Both files implement identical AES-256-GCM encryption/decryption:
- Key derivation from environment variable
- IV generation
- encrypt() method
- decrypt() method
- Error handling

**Impact:**
- Bug fixes must be applied twice
- Inconsistent implementations can lead to security issues
- Violates DRY principle

**Lines of Duplication:** ~60 lines

**Recommended Fix:**
Create `src/auth/encryption.ts`:
```typescript
export class SessionEncryption {
  private key: Buffer;

  constructor(keySource: string) {
    this.key = scryptSync(keySource, SALT, KEY_LENGTH);
  }

  encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
    // Single implementation
  }

  decrypt(encrypted: string, iv: string, authTag: string): string {
    // Single implementation
  }
}
```

---

### 3. Dead Code (Medium Priority)

#### Issue 3.1: Deprecated Automation Directory
**Severity:** Medium
**Directory:** `src/automation/`

Contains Playwright-based browser automation code that was replaced with direct SOAP API calls. Files include:
- `browser-manager.ts` (2,514 bytes)
- `rate-limiter.ts` (1,189 bytes)
- `pages/` directory

**Evidence:**
- No imports found in active codebase
- CLAUDE.md explicitly states "discovered DATS uses a SOAP/XML API (Trapeze PASS)"
- Architecture decision documented: "uses direct API calls for speed and reliability"

**Impact:**
- Confuses new developers
- Increases bundle size unnecessarily
- Creates false positives in code search

**Recommended Action:**
Archive to `archive/` directory with documentation:
```bash
mkdir -p archive/2026-01-deprecated-playwright
mv src/automation archive/2026-01-deprecated-playwright/
git add archive/
git commit -m "Archive deprecated Playwright automation code"
```

---

### 4. Magic Numbers & Strings (Medium Priority)

#### Issue 4.1: DATS Business Rules Hardcoded
**Severity:** Medium
**Files:** `src/utils/booking-validation.ts`, `src/index.ts`

Magic numbers found:
- `3` - Max days advance booking (multiple locations)
- `2` - Hours notice required for same-day/cancellation (multiple locations)
- `60` - Minutes conversion factor (multiple locations)
- `24` - Hours in a day (multiple locations)
- `30` - Pickup window minutes
- `5` - Max wait time minutes
- `7` - Days in a week
- `12` - Noon cutoff hour
- `500` - Debug log truncation length

**Impact:**
- Hard to change business rules
- No single source of truth
- Difficult to understand context

**Recommended Fix:**
Create `src/constants.ts`:
```typescript
export const DATS_BUSINESS_RULES = {
  ADVANCE_BOOKING_MAX_DAYS: 3,
  SAME_DAY_MIN_HOURS: 2,
  CANCELLATION_MIN_HOURS: 2,
  PICKUP_WINDOW_MINUTES: 30,
  VEHICLE_WAIT_MINUTES: 5,
  NOON_CUTOFF_HOUR: 12,
} as const;

export const TIME_CONSTANTS = {
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24,
  DAYS_PER_WEEK: 7,
  MILLISECONDS_PER_SECOND: 1000,
  MILLISECONDS_PER_MINUTE: 60_000,
} as const;

export const API_CONSTANTS = {
  DEBUG_LOG_MAX_LENGTH: 500,
  DATS_API_URL: 'https://datsonlinebooking.edmonton.ca/PassInfoServer',
} as const;
```

#### Issue 4.2: Month Name Mapping in index.ts
**Lines:** 141-142

Hardcoded month abbreviation mapping:
```typescript
const monthNames: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};
```

Should be extracted to `src/helpers/date-helpers.ts` or constants file.

---

### 5. Missing Test Coverage (Critical)

#### Issue 5.1: Zero Unit Tests
**Severity:** Critical
**Current Coverage:** 0%

No test files found in `src/` directory.

**Impact:**
- Cannot refactor confidently
- Regressions not caught
- Business logic changes are risky
- New contributors afraid to modify code

**Recommended Priority Tests:**

1. **Unit Tests (High Priority):**
   - `booking-validation.ts` - Business rule validation
   - `plain-language.ts` - Formatting functions
   - `date-helpers.ts` (when extracted) - Date parsing logic
   - XML parsers - Trip/booking parsing

2. **Integration Tests (Medium Priority):**
   - Tool handlers - Full MCP tool workflows
   - API client - SOAP request/response handling
   - Session management - Encryption/decryption

3. **E2E Tests (Lower Priority):**
   - Full booking flow
   - Authentication flow
   - Trip retrieval and formatting

**Suggested Testing Stack:**
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "ts-node": "^10.9.0"
  }
}
```

**Example Test Structure:**
```
src/
  __tests__/
    unit/
      booking-validation.test.ts
      plain-language.test.ts
      encryption.test.ts
    integration/
      book-trip-tool.test.ts
      dats-api.test.ts
    e2e/
      booking-flow.test.ts
```

---

### 6. Code Organization (Medium Priority)

#### Issue 6.1: Flat Helper Functions in index.ts
**Lines:** 58-186

Six helper functions defined at module level:
- `parseFlexibleDate()` - 61 lines
- `formatDateYMD()` - 4 lines
- `normalizeTripDate()` - 28 lines
- `getCurrentDateInfo()` - 16 lines
- `isRemoteMode()` - 3 lines
- `getCosmosStore()` - 8 lines

**Problems:**
- Cannot be unit tested independently
- Not reusable by other modules
- Clutters main file

**Recommended Fix:**
```
src/helpers/
  date-helpers.ts      # parseFlexibleDate, formatDateYMD, normalizeTripDate, getCurrentDateInfo
  transport-helpers.ts # isRemoteMode
  session-helpers.ts   # getCosmosStore, getValidSession
```

#### Issue 6.2: Duplicate Files with " 2" Suffix
**Files:**
- `src/auth/cosmos-session-store 2.ts`
- `src/server/http-server 2.ts`
- Multiple files in project root

**Action:** Delete these backup files, they're tracked by git.

---

### 7. TypeScript Quality (Good)

✅ **Strengths:**
- Strict mode enabled
- No `any` types found in main code
- Proper interface definitions in `types.ts`
- Good use of union types for status codes
- Zod schemas for runtime validation

⚠️ **Minor Issues:**
- Some optional chaining could be simplified
- A few places where explicit types could improve clarity

**Example (src/index.ts:1316):**
```typescript
// Current
clientInfo ? `Name: ${clientInfo.firstName} ${clientInfo.lastName}` : '',

// Could add null safety
clientInfo?.firstName ? `Name: ${clientInfo.firstName} ${clientInfo.lastName}` : '',
```

---

### 8. Error Handling (Good)

✅ **Strengths:**
- Comprehensive error wrapper system (`utils/errors.ts`)
- Error categorization (NETWORK, AUTH, VALIDATION, etc.)
- User-friendly error messages
- Proper error propagation

**No significant issues found.**

---

### 9. Security (Excellent)

✅ **Strengths:**
- Passthrough principle enforced
- No credential storage
- AES-256-GCM encryption for sessions
- Session expiration handled
- POPA compliance (data residency)
- Private networking in Azure architecture

**No security issues found.**

---

### 10. Accessibility (Good)

✅ **Strengths:**
- Plain language formatting (Grade 6 level)
- Markdown table output for screen readers
- WCAG 2.2 AA compliance considerations
- Clear, descriptive tool descriptions

**No accessibility issues found.**

---

## Positive Patterns Observed

### 1. Clear Architectural Boundaries
Despite god objects, the project maintains logical separation:
- `/api` - External service communication
- `/auth` - Authentication & session management
- `/server` - HTTP server & routing
- `/utils` - Shared utilities

### 2. Plain Language Module
`src/utils/plain-language.ts` is excellently designed:
- Single responsibility (formatting)
- Accessibility-focused
- Reusable functions
- Clear documentation

**This should be the model for other modules.**

### 3. Error Handling Strategy
`src/utils/errors.ts` demonstrates best practices:
- Error categorization
- User-friendly messages
- Structured error responses
- Proper typing

### 4. Type Safety
`src/types.ts` is comprehensive and well-structured:
- Clear interface definitions
- Discriminated unions for status
- Documentation comments
- Proper exports

---

## Refactoring Priority Matrix

| Issue | Severity | Effort | Impact | Priority |
|-------|----------|--------|--------|----------|
| Zero test coverage | Critical | High | High | **P0** |
| God object: index.ts | High | Medium | High | **P1** |
| God object: dats-api.ts | High | High | High | **P1** |
| Duplicated encryption | Medium | Low | Medium | **P2** |
| Dead code (automation/) | Medium | Low | Low | **P2** |
| Magic numbers | Medium | Low | Medium | **P3** |
| Helper extraction | Low | Low | Low | **P3** |
| Duplicate backup files | Low | Low | Low | **P4** |

---

## Recommended Refactoring Phases

### Phase 0: Foundation (2 hours)
**Goal:** Set up testing infrastructure

- [ ] Install vitest and coverage tools
- [ ] Create test directory structure
- [ ] Write 3 example tests (one unit, one integration, one e2e)
- [ ] Add test scripts to package.json
- [ ] Document testing approach

**Success Criteria:** `npm test` runs successfully

---

### Phase 1: Quick Wins (3.5 hours)
**Goal:** Low-effort, high-impact improvements

- [ ] Archive `src/automation/` directory (30 min)
- [ ] Delete duplicate " 2" files (15 min)
- [ ] Create `src/constants.ts` and extract magic numbers (1 hour)
- [ ] Extract encryption to `src/auth/encryption.ts` (1 hour)
- [ ] Extract date helpers to `src/helpers/date-helpers.ts` (45 min)

**Success Criteria:**
- Build passes
- Existing functionality unchanged
- Code more maintainable

---

### Phase 2: Test Coverage (10 hours)
**Goal:** Achieve 60%+ test coverage on business logic

- [ ] Unit tests for `booking-validation.ts` (2 hours)
- [ ] Unit tests for `plain-language.ts` (1.5 hours)
- [ ] Unit tests for date helpers (2 hours)
- [ ] Unit tests for encryption (1 hour)
- [ ] Integration tests for 3 main tools (3 hours)
- [ ] Document testing patterns (30 min)

**Success Criteria:**
- 60%+ coverage on utils/
- Key business logic tested
- CI/CD integration ready

---

### Phase 3: Refactor index.ts (14 hours)
**Goal:** Split god object into modular tool handlers

- [ ] Create `src/tools/` directory structure (1 hour)
- [ ] Extract tool: connect_account (1.5 hours)
- [ ] Extract tool: book_trip (2 hours)
- [ ] Extract tool: get_trips (1.5 hours)
- [ ] Extract tool: track_trip (1 hour)
- [ ] Extract tool: cancel_trip (1.5 hours)
- [ ] Extract tool: check_availability (1 hour)
- [ ] Extract tool: get_profile (1 hour)
- [ ] Extract remaining tools (1.5 hours)
- [ ] Create tool registry/index (1 hour)
- [ ] Update main server setup (1 hour)

**Success Criteria:**
- index.ts < 200 LOC
- Each tool in separate file
- All tests pass
- MCP server works identically

---

### Phase 4: Refactor dats-api.ts (22 hours)
**Goal:** Split monolithic API class into focused services

- [ ] Create service directory structure (1 hour)
- [ ] Extract XML parsing utilities (3 hours)
- [ ] Extract SOAP builder (2 hours)
- [ ] Create AuthService (2 hours)
- [ ] Create TripService (3 hours)
- [ ] Create BookingService (4 hours)
- [ ] Create TrackingService (2 hours)
- [ ] Create date/time formatters (1.5 hours)
- [ ] Create main DATSClient coordinator (2 hours)
- [ ] Update all imports (1 hour)
- [ ] Integration testing (30 min)

**Success Criteria:**
- dats-api.ts < 300 LOC (coordinator only)
- Each service < 400 LOC
- Single responsibility per class
- All tests pass

---

## Estimated Total Effort

| Phase | Hours | Priority |
|-------|-------|----------|
| Phase 0: Foundation | 2 | P0 |
| Phase 1: Quick Wins | 3.5 | P1 |
| Phase 2: Test Coverage | 10 | P0 |
| Phase 3: Refactor index.ts | 14 | P1 |
| Phase 4: Refactor dats-api.ts | 22 | P1 |
| **Total** | **51.5** | - |

**Recommended Schedule:**
- **Week 1:** Phase 0 + Phase 1 (5.5 hours)
- **Week 2:** Phase 2 (10 hours)
- **Week 3:** Phase 3 (14 hours)
- **Week 4-5:** Phase 4 (22 hours)

---

## Long-Term Recommendations

### 1. Continuous Refactoring
Implement "Boy Scout Rule": Leave code better than you found it.

### 2. Code Review Checklist
- [ ] No functions > 50 lines
- [ ] No magic numbers
- [ ] Tests included
- [ ] Types explicit
- [ ] Comments explain "why"

### 3. Architecture Decision Records (ADRs)
Document major decisions like:
- Why SOAP over Playwright
- Passthrough principle
- Encryption strategy

### 4. Documentation
- API documentation (JSDoc)
- Architecture diagrams
- Development guide
- Contribution guidelines

---

## Conclusion

The DATS Booking MCP server has **strong architectural foundations** but suffers from **rapid prototyping debt**. The codebase demonstrates security consciousness, accessibility awareness, and solid TypeScript practices.

**Key Strengths:**
- Security-first design
- Clear architectural intent
- Good error handling
- Accessibility focus

**Critical Gaps:**
- Zero test coverage
- God objects limiting maintainability
- Duplicated code
- Magic numbers

**Next Steps:**
1. Set up testing infrastructure (Phase 0)
2. Quick wins for immediate improvement (Phase 1)
3. Build test coverage (Phase 2)
4. Systematic refactoring (Phases 3-4)

With disciplined refactoring over 4-5 weeks, this codebase can achieve **A-grade quality** while maintaining its excellent security and accessibility characteristics.

---

**Reviewed by:** Code Quality Agent
**Date:** 2026-01-14
**Review Scope:** Full codebase analysis
**Next Review:** After Phase 2 completion
