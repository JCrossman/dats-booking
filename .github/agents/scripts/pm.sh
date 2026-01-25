#!/bin/bash
# Product Manager Agent - AI-Powered Requirements Review

set -euo pipefail

echo "📋 Product Manager Agent - DATS Accessible Booking Assistant"
echo "============================================================="
echo ""

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "⚠️  GITHUB_TOKEN not set - cannot use AI analysis"
  exit 1
fi

echo "🤖 Using GitHub Models (GPT-4o) for requirements analysis"
echo ""

# Find documentation files
DOC_FILES=$(find . -maxdepth 2 -type f \( \
  -name "README.md" -o -name "PRD.md" -o -name "*REQUIREMENTS*" -o -name "*FEATURES*" \
\) 2>/dev/null | head -3 || true)

FILE_COUNT=$(echo "$DOC_FILES" | grep -c . || echo 0)

if [ $FILE_COUNT -eq 0 ]; then
  echo "ℹ️  No documentation files found to review"
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
done <<< "$DOC_FILES"
set -e

echo ""
echo "🔍 Analyzing $COUNT files with GPT-4o..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM_PROMPT="You are a Product Manager reviewing requirements and features. Check for: clear user stories, measurable acceptance criteria, prioritization (P0/P1/P2), accessibility requirements explicit (not assumed), edge cases identified. Target users: adults with disabilities."

USER_PROMPT="Review these project documents:

$SAMPLES

Provide:
1. Missing Requirements
2. Unclear Acceptance Criteria
3. Accessibility Gaps
4. Prioritization Suggestions"

"$SCRIPT_DIR/ai-helper.sh" "$SYSTEM_PROMPT" "$USER_PROMPT" "gpt-4o" 2>&1

echo ""
echo "Recommendations:"
echo "- Write user stories in Given/When/Then format"
echo "- Make accessibility explicit in every feature"
echo "- Define clear success metrics"
