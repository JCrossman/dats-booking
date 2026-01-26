# Project Cleanup - Files to Remove

**Review Date:** 2026-01-26  
**Purpose:** Identify obsolete/redundant files for deletion

---

## 🔴 HIGH CONFIDENCE - Safe to Delete

### 1. Backup Files

```bash
mcp-servers/dats-booking/src/index.ts.bak
```
**Reason:** Backup file from refactoring. The refactored version is in git history.  
**Size:** ~3KB  
**Action:** DELETE

---

### 2. Old Implementation Summaries (Superseded by Current Status)

```bash
DEPLOYMENT-FIX.md
IMPLEMENTATION-SUMMARY.md
PHASE1-SUMMARY.md
DOCUMENTATION-UPDATE-SUMMARY.md
```

**Reason:** These were "work in progress" summaries from earlier development phases. All info is now in:
- `STATUS.md` - Current project status
- `CHANGELOG.md` - Version history
- `CONTRIBUTING.md` - Development workflow

**Combined Size:** ~15KB  
**Action:** DELETE (info preserved in git history)

---

### 3. Agent Review Artifacts

```bash
accessibility-review.md
multi-agent-review.md
pm-review.md
security-review.md
```

**Reason:** These are AI-generated review outputs from early development. The actual agent definitions are in `AGENTS.md`. These are snapshots of specific review sessions, not living documentation.  
**Combined Size:** ~5KB  
**Action:** DELETE or ARCHIVE (move to `.archive/` folder if you want to keep)

---

### 4. Old Commit Script

```bash
commit-phase1.sh
```

**Reason:** Manual commit script for Phase 1. We now use proper CI/CD via GitHub Actions. Workflow is documented in `CONTRIBUTING.md`.  
**Size:** 1.7KB  
**Action:** DELETE

---

### 5. Business Case Temporary File

```bash
business/~$se-study-dats-ai-modernization.docx
```

**Reason:** Word lock file (temp file created when document is open). Should not be committed.  
**Size:** 162 bytes  
**Action:** DELETE and add to .gitignore

---

## 🟡 MEDIUM CONFIDENCE - Review Before Deleting

### 6. Azure dats-auth Service (Potentially Obsolete)

```bash
azure/dats-auth/
```

**Status:** This was a **separate Azure Static Web App** for authentication.  
**Current Architecture:** Authentication is now **embedded** in the MCP server itself (see `mcp-servers/dats-booking/src/server/http-server.ts` and `static/` folder).

**Evidence:**
- Privacy page moved from `azure/dats-auth/src/privacy.html` to `mcp-servers/dats-booking/static/privacy.html` (committed Jan 25)
- Auth routes are in `mcp-servers/dats-booking/src/server/auth-routes.ts`
- Workflow mentions dats-auth deployment but condition is never met

**Files:**
```
azure/dats-auth/
  ├── README.md (6.8KB)
  ├── api/ (Azure Functions for auth)
  ├── src/ (Static auth pages - now in mcp-servers/dats-booking/static/)
  └── staticwebapp.config.json
```

**Questions:**
1. Is the Azure Static Web App `dats-mcp-auth.livelymeadow-eb849b65.*` still deployed?
   - **Answer from earlier:** NO, DNS doesn't resolve - it was deleted
2. Are there any references to this service in production?
   - **Answer:** The old URL was removed from code on Jan 25

**Action:** DELETE (architecture has consolidated auth into main MCP server)

---

### 7. Azure dats-mcp Bicep Templates

```bash
azure/dats-mcp/
  ├── main.bicep (9KB)
  └── parameters.prod.json (712 bytes)
```

**Status:** Infrastructure-as-Code for Azure Container Apps.  
**Current Deployment:** GitHub Actions workflow deploys via `az containerapp up` command, **not** via Bicep.

**Evidence:**
- Workflow file (`.github/workflows/deploy-to-azure.yml`) uses imperative commands
- No `az deployment group create` in workflow
- Bicep file dated Jan 16, but deployments since then don't use it

**Questions:**
1. Was this used for initial setup only?
2. Is it kept for reference or future IaC migration?

**Action:** KEEP for now (might be useful for recreating environment) OR move to `.archive/` folder

---

## 🟢 LOW CONFIDENCE - Keep (Active/Reference)

### 8. Business Case Documents

```bash
business/
  ├── case-study-dats-ai-modernization.docx (22KB)
  ├── case-study-dats-ai-modernization.md (markdown version)
  ├── Modernizing Legacy Government Services with AI.docx (32KB)
  ├── infographic-dats-overview.png
  └── infographic-dats-overview.svg
```

**Purpose:** Marketing/presentation materials for stakeholders.  
**Action:** KEEP (not code, but valid project assets)

---

### 9. Refactoring Plan

```bash
REFACTORING_PLAN.md
```

**Purpose:** Tracks code quality refactoring work (Phases 0-4).  
**Status:** Phase 4 is IN PROGRESS (per STATUS.md).  
**Action:** KEEP until Phase 4 complete, then archive or delete

---

### 10. Available Features Doc

```bash
AVAILABLE-FEATURES.md
```

**Purpose:** Lists all MCP tools and their capabilities.  
**Status:** Unknown if this is up-to-date with current toolset.  
**Action:** REVIEW and either UPDATE or DELETE (info may be redundant with README)

---

## Summary

### Immediate Deletions (Safe)
- `mcp-servers/dats-booking/src/index.ts.bak`
- `DEPLOYMENT-FIX.md`
- `IMPLEMENTATION-SUMMARY.md`
- `PHASE1-SUMMARY.md`
- `DOCUMENTATION-UPDATE-SUMMARY.md`
- `commit-phase1.sh`
- `business/~$se-study-dats-ai-modernization.docx`
- `accessibility-review.md`
- `multi-agent-review.md`
- `pm-review.md`
- `security-review.md`

**Total Savings:** ~25KB + reduced clutter

### Review Before Deleting
- `azure/dats-auth/` (entire directory - architecture change makes it obsolete)
- `azure/dats-mcp/` (Bicep templates not used in current workflow)
- `AVAILABLE-FEATURES.md` (may be outdated)

---

## Recommended .gitignore Additions

Add these patterns to prevent future temp files:

```gitignore
# Word temp files
~$*.docx
~$*.doc

# Backup files
*.bak
*.old
*.tmp

# macOS
.DS_Store
```

---

## Next Steps

1. **Review this list** with the project owner
2. **Create `.archive/` folder** for files to keep but not in root
3. **Delete approved files**
4. **Update .gitignore**
5. **Commit cleanup** with clear message
