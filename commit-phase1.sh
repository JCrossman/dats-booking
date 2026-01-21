#!/bin/bash
# Commit Phase 1 Critical Fixes (Tasks 1.1 & 1.2)

cd "/Users/jeremycrossman/Desktop/DATS Booking"

echo "=== Git Status ==="
git status

echo ""
echo "=== Adding files ==="
# Code changes
git add mcp-servers/dats-booking/src/tools/check-connection.ts
git add mcp-servers/dats-booking/src/tools/connect-account.ts
git add mcp-servers/dats-booking/src/tools/index.ts
git add mcp-servers/dats-booking/src/types.ts
git add mcp-servers/dats-booking/src/auth/cosmos-session-store.ts

# Documentation changes
git add CHANGELOG.md
git add STATUS.md
git add COPILOT.md
git add README.md
git add PHASE1-SUMMARY.md

echo ""
echo "=== Committing ==="
git commit -m "fix: Add check_connection tool and fix Cosmos DB error handling (Phase 1 - v1.0.2)

Task 1.1: Fix Auth Race Condition
- Add check_connection tool to verify session readiness
- Polls Cosmos DB every 2s for up to 30s
- Updated connect_account forAssistant instructions
- Prevents 'session not found' errors when user says 'done'

Task 1.2: Fix Cosmos DB Error Swallowing
- Add STORAGE_ERROR to ErrorCategory enum
- Cosmos DB non-404 errors now throw instead of returning null
- Callers can distinguish 'not found' from 'database failure'

Phase 1 of multi-agent review findings. Addresses critical race condition
and error handling issues identified in architect/developer reviews.

Documentation updated: CHANGELOG, STATUS, COPILOT, README + summary"

echo ""
echo "=== Pushing to origin main ==="
git push origin main

echo ""
echo "=== Done! ==="
git log -1 --oneline
echo ""
echo "GitHub Actions will now:"
echo "  1. Run tests"
echo "  2. Build Docker image"
echo "  3. Deploy to Azure Container Apps"
echo "  4. Verify health endpoint"
echo ""
echo "Deployment ETA: 3-5 minutes"
echo "Monitor: gh run watch"

