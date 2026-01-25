#!/bin/bash
# QA/Tester Agent - AI-Powered Test Coverage Review

set -euo pipefail

echo "🧪 QA/Tester Agent - DATS Accessible Booking Assistant"
echo "======================================================="
echo ""

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "⚠️  GITHUB_TOKEN not set - cannot use AI analysis"
  exit 1
fi

echo "🤖 Using GitHub Models (GPT-4o) for test coverage analysis"
echo ""

# Find test files and source files
TEST_FILES=$(find . -type f \( -name "*.test.ts" -o -name "*.spec.ts" \) \
  -not -path "*/node_modules/*" 2>/dev/null | head -3 || true)

FILE_COUNT=$(echo "$TEST_FILES" | grep -c . || echo 0)

if [ $FILE_COUNT -eq 0 ]; then
  echo "⚠️  No test files found!"
  echo "Critical: Project has no tests"
  exit 0
fi

echo "📁 Found $FILE_COUNT test files to review"
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
done <<< "$TEST_FILES"
set -e

echo ""
echo "🔍 Analyzing $COUNT test files with GPT-4o..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM_PROMPT="You are a QA expert reviewing test coverage. Check for: edge cases tested, error scenarios covered, happy path and sad path tests, integration tests for critical flows, accessibility tests, boundary value testing. Identify missing test cases."

USER_PROMPT="Review these test files:

$SAMPLES

Provide:
1. Coverage Gaps (missing test cases)
2. Edge Cases Not Tested
3. Critical Flows Without Tests
4. Test Quality Issues"

"$SCRIPT_DIR/ai-helper.sh" "$SYSTEM_PROMPT" "$USER_PROMPT" "gpt-4o" 2>&1

echo ""
echo "Recommendations:"
echo "- Aim for 80% code coverage minimum"
echo "- Test all user-facing flows E2E"
echo "- Run axe-core for accessibility testing"
