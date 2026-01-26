#!/bin/bash
# Architect Agent - AI-Powered Architecture Review

set -euo pipefail

echo "🏗️  Architect Agent - DATS Accessible Booking Assistant"
echo "========================================================"
echo ""

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "⚠️  GITHUB_TOKEN not set - cannot use AI analysis"
  exit 1
fi

echo "🤖 Using GitHub Models (GPT-4o) for architecture analysis"
echo ""

# Find architecture-relevant files
# Priority: architecture docs, main entry points, API clients
ARCH_FILES=$(find . -maxdepth 3 -type f \( \
  -name "ARCHITECTURE.md" -o \
  -name "*DESIGN*.md" -o \
  -name "index.ts" -o \
  -name "server.ts" -o \
  -name "*-api.ts" -o \
  -name "dats-api.ts" \
\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" 2>/dev/null | head -5 || true)

FILE_COUNT=$(echo "$ARCH_FILES" | grep -c . || echo 0)

if [ $FILE_COUNT -eq 0 ]; then
  echo "ℹ️  No architecture files found to review"
  exit 0
fi

echo "📁 Found $FILE_COUNT files to review"
echo ""

# Collect samples
SAMPLES=""
COUNT=0
set +e
while IFS= read -r file; do
  [ -z "$file" ] && continue
  [ ! -f "$file" ] && continue
  
  FILENAME=$(basename "$file")
  FILEPATH=$(echo "$file" | sed 's|^\./||')
  
  # For architecture review, include more lines (120)
  CONTENT=$(head -120 "$file" 2>/dev/null || echo "")
  
  if [ -n "$CONTENT" ]; then
    SAMPLES+="File: $FILEPATH
$CONTENT

---

"
    ((COUNT++))
    echo "Collected: $FILEPATH"
  fi
done <<< "$ARCH_FILES"
set -e

echo ""
echo "🔍 Analyzing $COUNT files with GPT-4o..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM_PROMPT="You are a system architect reviewing MCP (Model Context Protocol) server design. 

Check for:
1. Clear component boundaries (single responsibility)
2. Proper separation of concerns (API layer, auth layer, tools layer)
3. MCP best practices (stateless tools, well-typed interfaces, idempotent operations)
4. Error propagation across layers (typed errors, no swallowed exceptions)
5. Testability (dependency injection, mockable interfaces)
6. Scalability concerns (N+1 queries, rate limiting, caching)
7. Security architecture (private networking, managed identities, data residency)

Context: This is a DATS booking assistant using SOAP API. It must follow the Passthrough Principle (no business logic, just format DATS data)."

USER_PROMPT="Review this architecture:

$SAMPLES

Provide:
1. Architecture Issues (coupling, god objects, unclear boundaries)
2. MCP Pattern Violations (stateful tools, missing types, side effects)
3. Scalability Concerns (performance bottlenecks, resource leaks)
4. Security Architecture Gaps (public endpoints, hardcoded credentials)
5. Design Recommendations (with specific file/function references)"

"$SCRIPT_DIR/ai-helper.sh" "$SYSTEM_PROMPT" "$USER_PROMPT" "gpt-4o" 2>&1

echo ""
echo "📋 Recommendations:"
echo "- Keep MCP servers stateless (no instance variables for requests)"
echo "- Use dependency injection (pass DATSApi to tools, not global)"
echo "- Ensure proper error typing (DATSAuthError, DATSApiError)"
echo "- Follow Passthrough Principle (no business logic, just format)"
echo "- Use private networking for Azure services (VNet, Private Endpoints)"
