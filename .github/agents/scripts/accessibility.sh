#!/bin/bash
# Accessibility Specialist Agent - AI-Powered WCAG 2.2 AA Review

set -euo pipefail

echo "♿ Accessibility Specialist Agent - DATS Accessible Booking Assistant"
echo "===================================================================="
echo ""

# Check for AI capability
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "⚠️  GITHUB_TOKEN not set - cannot use AI analysis"
  exit 1
fi

echo "🤖 Using GitHub Models (GPT-4o) for intelligent accessibility analysis"
echo ""

# Find HTML files
HTML_FILES=$(find . -type f -name "*.html" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/coverage/*" -not -path "*/dist/*" 2>/dev/null | head -3 || true)

FILE_COUNT=$(echo "$HTML_FILES" | grep -c . || echo 0)

if [ -z "$HTML_FILES" ] || [ "$FILE_COUNT" -eq 0 ]; then
  echo "ℹ️  No HTML files found to review"
  echo "Searching in: $(pwd)"
  echo "Files in repo:"
  find . -maxdepth 3 -type f -name "*.html" 2>/dev/null | head -10 || echo "No HTML files at all"
  exit 0
fi

echo "📁 Found $FILE_COUNT files to review"
echo ""

# Collect samples
SAMPLES=""
COUNT=0
while IFS= read -r file; do
  [ -z "$file" ] && continue
  FILENAME=$(basename "$file")
  CONTENT=$(head -50 "$file" 2>/dev/null || true)
  SAMPLES+="File: $FILENAME
$CONTENT

---

"
  ((COUNT++))
  echo "Collected: $FILENAME"
done <<< "$HTML_FILES"

echo ""
echo "🔍 Analyzing $FILE_COUNT files with GPT-4o..."
echo ""

# Call AI
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM_PROMPT="You are an accessibility expert reviewing HTML for WCAG 2.2 AA compliance. Check for: missing alt text, unlabeled inputs, keyboard navigation, semantic HTML, ARIA attributes. Be specific and actionable."

USER_PROMPT="Review these files for accessibility issues:

$SAMPLES

Provide:
1. Critical Issues (WCAG violations)
2. Warnings
3. Recommendations"

"$SCRIPT_DIR/ai-helper.sh" "$SYSTEM_PROMPT" "$USER_PROMPT" "gpt-4o" 2>&1

echo ""
echo "Recommendations:"
echo "- Test with screen readers (NVDA, VoiceOver)"
echo "- Verify keyboard navigation"  
echo "- Check color contrast ratios"
