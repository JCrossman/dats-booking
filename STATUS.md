# Project Status

**Last Updated:** 2026-01-14
**Current Work:** Timezone Bug Fixes - Complete ✅

---

## 🚧 Where We Are

**Timezone Bug Fixes Completed** ✅
- Fixed systematic timezone bugs across entire codebase
- 2 commits, 6 files modified, 98 lines changed
- Deployed to Azure and verified on iPhone
- All date calculations now timezone-neutral using UTC methods

**Code Quality Refactoring Plan** ⏸️
- Status: Pending (on hold while fixing critical bugs)
- 4-phase plan ready to start when needed
- See `REFACTORING_PLAN.md` for details

---

## ✅ Recent Fixes (2026-01-14)

### Issue 1: Date Offset Bug
**Problem:** Dates showing +1 day ahead in iPhone app vs Desktop
**Cause:** Creating Date objects in server's local timezone
**Fix:** Use Date.UTC() for timezone-neutral day-of-week calculation
**Files:** `CLAUDE.md`, `src/api/dats-api.ts`

### Issue 2: "Thursday" Resolving to Wrong Date
**Problem:** "Thursday" interpreted as Jan 16 instead of Jan 15
**Cause:** Systematic timezone bugs in date arithmetic across codebase
**Fix:** Converted ALL date operations to use UTC methods
**Files:**
- `src/index.ts` - parseFlexibleDate(), formatDateYMD()
- `src/utils/booking-validation.ts` - Date validation logic
- `src/utils/plain-language.ts` - Date formatting
- `src/utils/validation.ts` - Business rule validation
- `src/api/dats-api.ts` - API date formatting
- `src/api/soap-client.ts` - SOAP date formatting

---

## 📁 Key Documentation

| File | Purpose |
|------|---------|
| `CLAUDE.md` | **Updated!** Development guidance + passthrough principle |
| `REFACTORING_PLAN.md` | Detailed refactoring tasks (pending) |
| `.claude/plans/hazy-honking-peacock.md` | Code quality review report |
| `README.md` | End-user documentation |

---

## 🎯 Technical Details

### Passthrough Principle (Added)
- Documented in `CLAUDE.md` (prominent section)
- MCP server is a simple passthrough - no business logic
- Trust DATS API for all data (dates, times, statuses)
- Only format data for display

### Timezone Fix Pattern
Changed ALL date operations from local timezone to UTC:
```typescript
// Before (❌ Bug)
new Date(year, month - 1, day)  // Server's local timezone
date.getDay()                    // Local timezone

// After (✅ Fixed)
new Date(Date.UTC(year, month - 1, day))  // Timezone-neutral
date.getUTCDay()                          // UTC
```

**Why this works:** Date components from `Intl.DateTimeFormat` are already in user's timezone. Using UTC prevents re-interpretation in server's timezone.

---

## 🔄 Next Steps

1. **Monitor** - Verify timezone fixes work correctly in production
2. **Resume Refactoring** - Start Phase 1 when ready (see `REFACTORING_PLAN.md`)
3. **Testing** - Consider adding timezone-specific test cases

---

## 📊 Code Quality Status

**Main Issues (Still Pending):**
1. `src/api/dats-api.ts` (1,451 LOC) - God object
2. `src/index.ts` (1,432 LOC) - God object
3. Duplicated encryption logic
4. Magic numbers everywhere
5. Dead Playwright code in `src/automation/`

**Refactoring Roadmap:**
- Phase 1: Quick wins (3.5h) ← **Ready to start**
- Phase 2: Foundation (10h)
- Phase 3: Reorganization (14h)
- Phase 4: Major refactor (22h)

---

## 🔄 Recent Updates

**2026-01-14:**
- ✅ Fixed date offset bug (dates +1 day ahead in iPhone app)
- ✅ Fixed "Thursday" date parsing bug (Jan 16 → Jan 15)
- ✅ Applied UTC fix across 6 files systematically
- ✅ Documented passthrough principle in CLAUDE.md
- ✅ Deployed to Azure and verified on iPhone
- ✅ Removed status inference code (passthrough violation)

**2026-01-13:**
- Completed code quality review (B- score)
- Created 4-phase refactoring plan
- Updated CLAUDE.md and README.md

---

**Next Review:** After timezone fixes monitored in production
