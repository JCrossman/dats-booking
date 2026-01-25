#!/bin/bash
# UX Writer Agent - AI-Powered Copy Review

set -euo pipefail

echo "✍️  UX Writer Agent - DATS Accessible Booking Assistant"
echo "========================================================"
echo ""

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "⚠️  GITHUB_TOKEN not set - cannot use AI analysis"
  exit 1
fi

echo "🤖 Using GitHub Models (GPT-4o) for UX copy analysis"
echo ""

# Find UI files with user-facing text
UI_FILES=$(find . -type f \( -name "*.tsx" -o -name "*.html" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/coverage/*" 2>/dev/null | head -3 || true)

FILE_COUNT=$(echo "$UI_FILES" | grep -c . || echo 0)

if [ $FILE_COUNT -eq 0 ]; then
  echo "ℹ️  No UI files found to review"
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
  CONTENT=$(head -60 "$file" 2>/dev/null || echo "")
  
  if [ -n "$CONTENT" ]; then
    SAMPLES+="File: $FILENAME
$CONTENT

---

"
    ((COUNT++))
    echo "Collected: $FILENAME"
  fi
done <<< "$UI_FILES"
set -e

echo ""
echo "🔍 Analyzing $COUNT files with GPT-4o..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM_PROMPT="You are a UX writer reviewing user-facing copy for cognitive accessibility. Check for: plain language (Grade 6 reading level), sentences under 20 words, active voice, concrete language, supportive tone (not condescending), clear error messages with recovery steps. Target users: adults with disabilities."

USER_PROMPT="Review the user-facing copy in these files:

$SAMPLES

Provide:
1. Clarity Issues (complex language)
2. Tone Problems (condescending, confusing)
3. Error Message Improvements
4. Rewrite Suggestions"

"$SCRIPT_DIR/ai-helper.sh" "$SYSTEM_PROMPT" "$USER_PROMPT" "gpt-4o" 2>&1

echo ""
echo "Recommendations:"
echo "- Keep sentences under 20 words"
echo "- Use Grade 6 reading level"
echo "- Make error messages actionable"
