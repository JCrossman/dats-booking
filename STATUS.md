# Project Status

**Last Updated:** 2026-01-15
**Current Work:** Status & Provider Extraction Fixes - Complete ✅

---

## 🚧 Where We Are

**Status & Provider Extraction Fixes Completed** ✅ (2026-01-15)
- Fixed trip status showing "Scheduled" instead of "Performed"
- Fixed provider name not displaying in trip listings
- Added Provider column to trip display format
- All fixes deployed to Azure Container App and verified on Claude iOS

**Timezone Bug Fixes Completed** ✅ (2026-01-14)
- Fixed systematic timezone bugs across entire codebase
- 2 commits, 6 files modified, 98 lines changed
- Deployed to Azure and verified on iPhone
- All date calculations now timezone-neutral using UTC methods

**Code Quality Refactoring - Phase 3 Complete** ✅
- Status: 3 of 4 phases complete
- index.ts reduced from 1,432 to 100 lines (93% reduction)
- All 11 MCP tools extracted to separate files in `src/tools/`
- See `REFACTORING_PLAN.md` for Phase 4 details

---

## ✅ Recent Fixes (2026-01-15)

### Issue 1: Status Showing "Scheduled" Instead of "Performed"
**Problem:** Completed trips displayed "Scheduled" status even after being completed
**Cause:** Code was extracting `SchedStatusF` from top-level XML, not from `EventsInfo` within `PickUpLeg`
**Fix:** Extract status from `EventsInfo.SchedStatusF` (the actual trip execution status)
**Files:** `src/api/dats-api.ts` (lines 1168-1179)
**Deployment:** Azure Container App was running old revision - deployed new revision `status-fix-v2-1768534254`

### Issue 2: Provider Name Not Displaying
**Problem:** Provider column was empty in trip listings (e.g., "PRESTIGE" not shown)
**Cause:** Code looked for `EventsProviderInfo` in wrong location (inside EventsInfo instead of as sibling)
**Fix:** Extract from `pickupXml` with fallback to `PassBooking` level
**Files:**
- `src/api/dats-api.ts` - Provider extraction with fallback
- `src/utils/plain-language.ts` - Added Provider column to display guidelines

---

## ✅ Previous Fixes (2026-01-14)

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

**Completed Refactoring (Phases 0-3):**
- ✅ 170+ comprehensive tests (including 11 timezone tests)
- ✅ `src/index.ts` reduced from 1,432 to 100 lines (93% reduction)
- ✅ All 11 MCP tools extracted to `src/tools/`
- ✅ Tool factory pattern with dependency injection
- ✅ Session helpers extracted to `src/helpers/session-helpers.ts`

**Remaining Work (Phase 4):**
1. `src/api/dats-api.ts` (1,451 LOC) - Split into service classes
2. Remove remaining `any` types
3. Extract shared XML parsers
4. Final strict typing and cleanup

**Refactoring Roadmap:**
- Phase 1: Quick wins ✅ Complete
- Phase 2: Foundation ✅ Complete
- Phase 3: Tool Handler Organization ✅ Complete
- Phase 4: God Object Splitting ← **Ready to start**

---

## 🔄 Recent Updates

**2026-01-15:**
- ✅ Fixed status extraction bug (trips showing "Scheduled" instead of "Performed")
- ✅ Fixed provider name not displaying (e.g., "PRESTIGE" now shows)
- ✅ Added Provider column to trip display format
- ✅ Documented XML structure for status/provider extraction in CLAUDE.md
- ✅ Deployed new Azure Container App revision `status-fix-v2-1768534254`
- ✅ Verified all fixes working on Claude iOS

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

**Next Review:** Phase 4 refactoring - split dats-api.ts god object
