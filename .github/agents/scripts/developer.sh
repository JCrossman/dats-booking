#!/bin/bash
# Developer Agent - AI-Powered Implementation Review

set -euo pipefail

echo "💻 Developer Agent - DATS Accessible Booking Assistant"
echo "======================================================="
echo ""

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "⚠️  GITHUB_TOKEN not set - cannot use AI analysis"
  exit 1
fi

echo "🤖 Using GitHub Models (GPT-4o) for code implementation analysis"
echo ""

# Find TypeScript implementation files
CODE_FILES=$(find . -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/coverage/*" -not -path "*/dist/*" -not -name "*.test.ts" 2>/dev/null | head -3 || true)

FILE_COUNT=$(echo "$CODE_FILES" | grep -c . || echo 0)

if [ $FILE_COUNT -eq 0 ]; then
  echo "ℹ️  No TypeScript files found to review"
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
  CONTENT=$(head -80 "$file" 2>/dev/null || echo "")
  
  if [ -n "$CONTENT" ]; then
    SAMPLES+="File: $FILENAME
$CONTENT

---

"
    ((COUNT++))
    echo "Collected: $FILENAME"
  fi
done <<< "$CODE_FILES"
set -e

echo ""
echo "🔍 Analyzing $COUNT files with GPT-4o..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM_PROMPT="You are a TypeScript developer reviewing code implementation. Check for: TypeScript strict mode compliance, proper error handling, JSDoc comments on public APIs, functions under 50 lines, no `any` types, proper async/await usage, rate limiting for external calls."

USER_PROMPT="Review this TypeScript implementation:

$SAMPLES

Provide:
1. Implementation Issues
2. TypeScript Best Practices Violations
3. Missing Error Handling
4. Code Improvements"

"$SCRIPT_DIR/ai-helper.sh" "$SYSTEM_PROMPT" "$USER_PROMPT" "gpt-4o" 2>&1

echo ""
echo "Recommendations:"
echo "- Use TypeScript strict mode"
echo "- Add JSDoc to all public functions"
echo "- Write unit tests for business logic"
