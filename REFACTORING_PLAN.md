# Code Quality Refactoring Plan - DATS Booking MCP Server

**Created:** 2026-01-13
**Overall Quality Score:** A- (Excellent structure after refactoring)
**Total Effort:** 49.5 hours across 4 phases
**Status:** Phase 3 Complete - Phase 4 Ready to Start
**Last Updated:** 2026-01-15

---

## Quick Reference

### Current Phase: Phase 3 Complete ✅

**Status:** Phases 0-3 complete (27.5 hours), Phase 4 ready to start (22 hours remaining)

**Phase 3 Achievements:**
- ✅ All 11 MCP tools extracted to separate files
- ✅ index.ts reduced from 1,432 to 100 lines (93% reduction!)
- ✅ Session helpers extracted to dedicated module
- ✅ Tool factory pattern implemented
- ✅ All 159 tests passing

**Next Phase:** Phase 4 - God object splitting (22 hours)

---

## Top 5 Code Quality Issues Identified

### 🔴 HIGH SEVERITY

1. **God Object: dats-api.ts (1,451 LOC)**
   - 52+ methods handling ALL SOAP operations
   - Violates Single Responsibility Principle
   - **Fix:** Split into 6 service classes + shared parsers (Phase 4, 16 hours)

2. **God Object: index.ts (1,432 LOC)**
   - 10 MCP tool handlers in one file
   - Session validation duplicated 8 times
   - **Fix:** Extract to tool files + factory pattern (Phase 3, 14 hours)

### 🟡 MEDIUM SEVERITY

3. **Duplicated Encryption Logic**
   - AES-256-GCM code duplicated in session-manager.ts and cosmos-session-store.ts
   - **Fix:** Create shared crypto-service.ts (Phase 2, 3 hours)

4. **Magic Numbers Throughout Codebase**
   - 15+ instances of hardcoded values (60000, 3600, etc.)
   - **Fix:** Create constants.ts (Phase 1, 1 hour) ← **CURRENT PHASE**

5. **TypeScript `any` Types**
   - 3 instances defeating type safety
   - **Fix:** Remove and add proper types (Phase 4, 1 hour)

### 🟢 LOW SEVERITY (Easy Win)

6. **Dead Code: automation/ Directory (~400 LOC)**
   - Deprecated Playwright automation code
   - **Fix:** Archive to separate branch (Phase 1, 1 hour) ← **CURRENT PHASE**

---

## 4-Phase Roadmap

| Phase | Duration | Hours | Status | Key Deliverables |
|-------|----------|-------|--------|------------------|
| **Phase 0** | N/A | N/A | ✅ Complete | Testing infrastructure (159 tests, 70%+ coverage) |
| **Phase 1** | 1 week | 3.5 | ✅ Complete | Dead code removed, helpers extracted, constants centralized |
| **Phase 2** | 2 weeks | 10 | ✅ Complete | Test coverage increased, code organization improved |
| **Phase 3** | 3 weeks | 14 | ✅ Complete | Tool handlers organized, factory pattern, index.ts reduced 93% |
| **Phase 4** | 4 weeks | 22 | ⚪ Not Started | Services extracted, strict typing, dats-api.ts refactored |

---

## Phase 1 Details (Current)

### Task 1: Archive automation/ Directory (1 hour)

**Files to archive:**
- `src/automation/browser-manager.ts`
- `src/automation/rate-limiter.ts`
- `src/automation/pages/login-page.ts`
- `src/automation/pages/booking-page.ts`
- `src/automation/pages/trips-page.ts`

**Steps:**
1. Create branch: `archive/playwright-automation`
2. Move automation/ directory to branch
3. Delete from main branch
4. Verify no active imports reference automation code

**Verification:**
- [ ] Branch created with automation code
- [ ] No imports of automation code in active src/
- [ ] All existing tests pass

---

### Task 2: Extract Date Helpers (1.5 hours)

**Functions to extract from index.ts:**
- `parseFlexibleDate()`
- `normalizeTripDate()`
- `formatDateYMD()`
- `getCurrentDateInfo()`

**New file:** `src/utils/date-helpers.ts`

**Steps:**
1. Create new file with exported functions
2. Update imports in index.ts
3. Run existing tests to verify
4. Add unit tests if needed

**Verification:**
- [ ] date-helpers.ts created with all functions
- [ ] index.ts reduced by ~160 lines
- [ ] All existing tests pass
- [ ] Functions properly exported/imported

---

### Task 3: Create Constants File (1 hour)

**New file:** `src/constants.ts`

**Constants to extract:**

```typescript
// Time constants
export const TIME_CONSTANTS = {
  MS_PER_SECOND: 1000,
  SECONDS_PER_HOUR: 3600,
  HOURS_PER_DAY: 24,
};

// Business rules
export const BUSINESS_RULES = {
  MAX_ADVANCE_BOOKING_DAYS: 3,
  MIN_CANCELLATION_NOTICE_HOURS: 2,
  SAME_DAY_MIN_NOTICE_HOURS: 2,
};

// Polling/timeout values
export const TIMEOUTS = {
  POLL_TIMEOUT_MS: 60000,
  SESSION_TTL_MS: 86400000, // 24 hours
  RATE_LIMIT_WINDOW_MS: 60000,
};
```

**Files to update (~15 locations):**
- `src/index.ts`
- `src/utils/booking-validation.ts`
- `src/auth/web-auth.ts`
- `src/auth/session-manager.ts`

**Verification:**
- [ ] constants.ts created with all values
- [ ] Magic numbers replaced in 15+ locations
- [ ] All existing tests pass
- [ ] No hardcoded values remaining

---

## Progress Tracking

**Overall Completion:** Phases 0-3 complete (100%), Phase 4 pending (0%)

### Completed Phases

**Phase 0: Testing Infrastructure** ✅
- 159 comprehensive tests implemented
- 70%+ code coverage achieved
- Integration tests for all MCP tools
- Unit tests for core business logic

**Phase 1: Quick Wins** ✅
- constants.ts created with all magic numbers centralized
- Date helpers extracted to utils/date-helpers.ts
- Encryption logic shared across session stores
- Dead code archived

**Phase 2: Foundation** ✅
- Test coverage maintained at 70%+
- Code organization improved
- Build pipeline stable

**Phase 3: Tool Handler Organization** ✅
- All 11 MCP tools extracted to separate files in src/tools/
- Tool factory pattern with dependency injection implemented
- Session helpers extracted to src/helpers/session-helpers.ts
- index.ts reduced from 1,432 to 100 lines (93% reduction)
- All tests passing (159 tests)

### In Progress
- None (Phase 3 complete)

### Next Up: Phase 4
- Split dats-api.ts god object into 6 service classes
- Remove remaining `any` types
- Extract shared XML parsers
- Final cleanup and documentation

---

## Testing Strategy

After each task:
1. Run `npm run build` to verify TypeScript compilation
2. Run `npm test` to verify all unit tests pass
3. Test MCP server locally (stdio mode)
4. Test MCP server remotely (Azure deployment) - if needed

---

## Commit Strategy

After each phase completion:
1. Commit with descriptive message
2. Reference this refactoring plan
3. Include effort spent
4. Tag with phase number

Example:
```
Phase 1: Code quality improvements - Quick wins

- Archive automation/ directory to separate branch
- Extract date helpers to utils/date-helpers.ts
- Create constants.ts for magic numbers

Removes ~560 LOC, improves maintainability.
Part of code quality refactoring plan (Phase 1/4).

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Next Phase Preview

**Phase 4: God Object Splitting (22 hours)** ← **READY TO START**

**Objectives:**
1. Split dats-api.ts (1,451 LOC) into 6 service classes
   - BookingService (trip creation, scheduling, confirmation)
   - TripService (get trips, track trips, cancel trips)
   - ProfileService (client info, contacts, saved locations)
   - AnnouncementService (remarks, system messages)
   - AddressService (geocoding, address validation)
   - XMLParserService (shared SOAP parsing utilities)

2. Remove remaining `any` types (3 instances)
3. Extract shared XML parsers
4. Final strict typing and cleanup

**Start Phase 4 when:**
- Phase 3 committed and pushed ✓
- All 159 tests passing ✓
- Documentation updated ✓

---

## Documentation

**Detailed Plan:** `/Users/jeremycrossman/.claude/plans/hazy-honking-peacock.md`
**Code Review Report:** Included in detailed plan above
**Todo List:** Active in Claude session

---

## Notes

- **Strengths observed:** TypeScript strict mode, excellent test coverage (159 tests), excellent security practices
- **Progress:** Phases 0-3 complete! Major milestone achieved.
- **Key achievements:**
  - index.ts reduced by 93% (1,432 → 100 lines)
  - All MCP tools properly modularized
  - Tool factory pattern with dependency injection
  - Session helpers extracted
  - 70%+ test coverage maintained throughout
- **Remaining work:** Phase 4 - Split dats-api.ts god object (22 hours)
- **Recommendation:** Phase 4 can be done incrementally as time permits

---

**Last Updated:** 2026-01-15
**Next Review:** Before starting Phase 4
