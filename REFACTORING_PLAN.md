# Code Quality Refactoring Plan - DATS Booking MCP Server

**Created:** 2026-01-13
**Overall Quality Score:** B- (Good foundations, needs refactoring)
**Total Effort:** 49.5 hours across 4 phases
**Status:** Phase 1 - In Progress

---

## Quick Reference

### Current Phase: Phase 1 - Quick Wins (3.5 hours)

**Tasks:**
- [ ] 1. Archive automation/ directory (1 hour)
- [ ] 2. Extract date helpers from index.ts (1.5 hours)
- [ ] 3. Create constants.ts for magic numbers (1 hour)

**Expected Impact:**
- Removes ~400 LOC dead code
- Reduces index.ts by ~160 lines
- Eliminates 15+ magic numbers

**Risk Level:** Low

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
| **Phase 1** | 1 week | 3.5 | 🟡 In Progress | Dead code removed, helpers extracted, constants centralized |
| **Phase 2** | 2 weeks | 10 | ⚪ Not Started | Session validator, XML parser, crypto service |
| **Phase 3** | 3 weeks | 14 | ⚪ Not Started | Tool handlers organized, factory pattern |
| **Phase 4** | 4 weeks | 22 | ⚪ Not Started | Services extracted, strict typing |

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

**Phase 1 Completion:** 0 of 3 tasks complete

### Completed Tasks
- None yet

### In Progress
- Ready to start

### Blocked
- None

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

**Phase 2: Foundation (10 hours)**
1. Extract session validation middleware (3 hours)
2. Extract XML parser from dats-api.ts (4 hours)
3. Extract crypto service (3 hours)

**Start Phase 2 when:**
- All Phase 1 tasks verified ✓
- All tests passing ✓
- Code committed and pushed ✓

---

## Documentation

**Detailed Plan:** `/Users/jeremycrossman/.claude/plans/hazy-honking-peacock.md`
**Code Review Report:** Included in detailed plan above
**Todo List:** Active in Claude session

---

## Notes

- **Strengths observed:** TypeScript strict mode, good test coverage, excellent security practices
- **Main weakness:** God objects from rapid feature development
- **Recommendation:** Complete Phase 1 first (low risk, high visibility)
- **Estimated completion:** 10 weeks total (if working ~5 hours/week)

---

**Last Updated:** 2026-01-13
**Next Review:** After Phase 1 completion
