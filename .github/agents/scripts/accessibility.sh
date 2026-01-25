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
HTML_FILES=$(find . -type f -name "*.html" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/coverage/*" -not -path "*/dist/*" 2>/dev/null | head -3)

if [ -z "$HTML_FILES" ]; then
  echo "No HTML files found to review"
  exit 0
fi

echo "📁 Found files to review"
echo ""

# Collect samples
SAMPLES=""
FILE_COUNT=0
for file in $HTML_FILES; do
  FILENAME=$(basename "$file")
  CONTENT=$(head -50 "$file" 2>/dev/null || true)
  SAMPLES+="File: $FILENAME
$CONTENT

---

"
  ((FILE_COUNT++))
  echo "Collected: $FILENAME"
done

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
