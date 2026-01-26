# Cleanup Analysis - Remaining Files

**Analysis Date:** 2026-01-26  
**Status:** Detailed investigation complete

---

## 1. `azure/dats-auth/` - **KEEP (Still Active)**

### Status: ✅ STILL IN USE

**Size:** 62MB (includes node_modules)

### Evidence

1. **Static Web App is Live:**
   ```bash
   $ curl https://green-sky-0e461ed10.1.azurestaticapps.net/privacy.html
   HTTP 200 OK
   ```

2. **CI/CD Deployment Active:**
   - Workflow job: `deploy-static-site` (lines 306-338 in deploy-to-azure.yml)
   - Triggers when `azure/dats-auth/src/privacy.html` is modified
   - Deploys to Azure Static Web App using SWA CLI
   - Last verified: Jan 26, 2026 (site is accessible)

3. **Duplicate Privacy Policy:**
   - `azure/dats-auth/src/privacy.html` (older version)
   - `mcp-servers/dats-booking/static/privacy.html` (copied Jan 25, 2026)
   - **Files are identical**

### Why Two Privacy Policies?

**Legacy Architecture:**
- Originally had a **separate** Azure Static Web App for authentication (`dats-auth`)
- URL: `https://green-sky-0e461ed10.1.azurestaticapps.net`

**Current Architecture:**
- Authentication is now **embedded** in the main MCP server
- Privacy policy served from: `https://dats-mcp-app.whitewater-072cffec.canadacentral.azurecontainerapps.io/privacy`

**Why dats-auth Still Exists:**
- Old auth links may still point to it
- Provides backward compatibility
- Not actively breaking anything

### Recommendation: ⚠️ MIGRATE THEN DELETE

**Migration Plan:**
1. Update any external links to use new MCP server URL
2. Add HTTP redirect from old Static Web App to new URL
3. Monitor access logs for 30 days
4. If no traffic, decommission Static Web App
5. Delete `azure/dats-auth/` directory

**OR Keep for Now:**
- No harm in keeping both deployments active
- Provides redundancy
- Old links continue working

---

## 2. `azure/dats-mcp/` - **REFERENCE ONLY (Not Used in CI/CD)**

### Status: 📚 KEEP AS REFERENCE

**Size:** 16KB

**Files:**
- `main.bicep` (9KB) - Azure infrastructure template
- `parameters.prod.json` (712 bytes) - Production parameters

### Evidence

1. **Not Used in CI/CD:**
   ```bash
   $ grep -r "bicep\|az deployment" .github/workflows/
   # No results
   ```

2. **Current Deployment Method:**
   - Uses `az containerapp up` (imperative)
   - No infrastructure-as-code (IaC) in workflow

3. **Purpose:**
   - Declarative infrastructure definition
   - Useful for **recreating** environment if destroyed
   - Documents the Azure resources being used

### Recommendation: ✅ KEEP

**Reasons:**
1. **Disaster Recovery:** Can rebuild Azure environment from scratch
2. **Documentation:** Shows what resources are deployed
3. **Future IaC Migration:** If you want to move to proper Bicep deployments
4. **Small Size:** Only 16KB

**Alternative:** If you want to clean up, move to `.archive/` folder

---

## 3. `AVAILABLE-FEATURES.md` - **OUTDATED BUT USEFUL**

### Status: ⚠️ UPDATE OR DELETE

**Size:** 6KB

### Findings

#### ✅ Accurate Content (Lines 1-116)
- Lists all available DATS features correctly
- Documents what's NOT available (billing, statements)
- Explains terminology differences (trips vs appointments)
- Lists correct SOAP operations

#### ❌ Inaccurate Tool List (Lines 127-141)

**Listed in document:**
```
- connect_account
- complete_connection [DEPRECATED but listed as available]
- check_connection [NOT LISTED]
- disconnect_account
- book_trip
- get_trips
- track_trip
- cancel_trip
- check_availability
- get_announcements
- get_profile
- get_info
- get_saved_locations
- get_frequent_trips
- get_booking_options
```

**Actually Registered Tools (from src/tools/index.ts):**
```
- connect_account ✅
- check_connection ✅ [MISSING FROM DOC]
- complete_connection ✅ [DEPRECATED - doc should note this]
- disconnect_account ✅
- book_trip ✅
- get_trips ✅
- track_trip ✅
- cancel_trip ✅
- check_availability ✅
- get_announcements ✅
- get_profile ✅
- get_info ✅
- get_saved_locations ✅
- get_frequent_trips ✅
- get_booking_options ✅
```

### Recommendation: ✏️ UPDATE

**Changes Needed:**
1. Add `check_connection` to tool list (line 128)
2. Mark `complete_connection` as `[DEPRECATED - Do NOT use]`
3. Update date to 2026-01-26
4. Add note about Phase 1 auth changes

**OR Delete:** The README.md already lists tools. This may be redundant.

---

## 4. `complete-connection.ts` Tool - **DEPRECATED BUT REGISTERED**

### Status: ⚠️ REGISTERED BUT RETURNS IMMEDIATE ERROR

**File:** `mcp-servers/dats-booking/src/tools/complete-connection.ts`

### Current State

1. **Still Registered:**
   - Line 44 in `src/tools/index.ts`: `createCompleteConnectionTool(deps).register(server)`
   - Tool appears in Claude's tool list

2. **Marked Deprecated:**
   - Tool description says `[DEPRECATED] This tool is NO LONGER NEEDED`
   - Returns immediate error if called
   - Prevents 3-minute hangs

3. **Why Still There:**
   - **For backward compatibility** - Claude may have cached the tool
   - Returns helpful error instead of crashing
   - Documents the change for debugging

### Recommendation: ✅ KEEP FOR NOW

**Reasons:**
1. **Safe:** Returns error immediately, doesn't hang
2. **Informative:** Error message explains to use `check_connection` instead
3. **Backward Compatible:** Won't break existing Claude sessions
4. **Small:** Only 64 lines

**Future:** Remove in v2.0.0 (breaking change)

---

## Summary Table

| Item | Status | Size | Action | Priority |
|------|--------|------|--------|----------|
| `azure/dats-auth/` | Active deployment | 62MB | Migrate then delete | Low |
| `azure/dats-mcp/` | Reference docs | 16KB | Keep (or archive) | None |
| `AVAILABLE-FEATURES.md` | Outdated | 6KB | Update tool list | Medium |
| `complete-connection.ts` | Deprecated but safe | 1KB | Keep until v2.0 | None |

---

## Recommended Actions

### Immediate (Priority: Medium)
1. **Update AVAILABLE-FEATURES.md:**
   - Add `check_connection` to tool list
   - Mark `complete_connection` as deprecated
   - Update date

### Near Future (Priority: Low)
2. **Migrate dats-auth:**
   - Add redirects from old Static Web App to new MCP server
   - Monitor for 30 days
   - If no traffic, decommission and delete

### No Action Needed
3. **Keep:**
   - `azure/dats-mcp/` (useful reference)
   - `complete-connection.ts` (safe deprecation pattern)

---

## Total Potential Cleanup

- **Immediate:** 0 bytes (update AVAILABLE-FEATURES.md only)
- **Future:** ~62MB (if dats-auth is decommissioned)

---

## Conclusion

**All remaining files serve a purpose:**
- `azure/dats-auth/` - Active deployment (backward compatibility)
- `azure/dats-mcp/` - Infrastructure reference (disaster recovery)
- `AVAILABLE-FEATURES.md` - Feature documentation (needs minor update)
- `complete-connection.ts` - Deprecated tool (safe error handling)

**No files are obsolete garbage** - they're either active, useful references, or safe deprecations.
