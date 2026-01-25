#!/bin/bash
# Architect Agent - AI-Powered System Design Review

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

# Find architecture docs and main entry points
ARCH_FILES=$(find . -maxdepth 2 -type f \( \
  -name "ARCHITECTURE.md" -o -name "*DESIGN*" -o -name "index.ts" -o -name "server.ts" \
\) 2>/dev/null | head -3 || true)

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
  CONTENT=$(head -100 "$file" 2>/dev/null || echo "")
  
  if [ -n "$CONTENT" ]; then
    SAMPLES+="File: $FILENAME
$CONTENT

---

"
    ((COUNT++))
    echo "Collected: $FILENAME"
  fi
done <<< "$ARCH_FILES"
set -e

echo ""
echo "🔍 Analyzing $COUNT files with GPT-4o..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM_PROMPT="You are a software architect reviewing system design. Check for: clear component boundaries, proper separation of concerns, scalability considerations, error propagation, MCP best practices (stateless servers), testability. Focus on maintainability and extensibility."

USER_PROMPT="Review this system architecture:

$SAMPLES

Provide:
1. Architecture Issues
2. Coupling/Cohesion Problems
3. Scalability Concerns
4. Design Recommendations"

"$SCRIPT_DIR/ai-helper.sh" "$SYSTEM_PROMPT" "$USER_PROMPT" "gpt-4o" 2>&1

echo ""
echo "Recommendations:"
echo "- Keep MCP servers stateless"
echo "- Use dependency injection"
echo "- Document component interfaces"
