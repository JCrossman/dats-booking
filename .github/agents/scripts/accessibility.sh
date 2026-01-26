#!/bin/bash
# Accessibility Specialist Agent - AI-Powered WCAG Review

set -euo pipefail

echo "♿ Accessibility Specialist Agent - DATS Accessible Booking Assistant"
echo "===================================================================="
echo ""

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "⚠️  GITHUB_TOKEN not set - cannot use AI analysis"
  exit 1
fi

echo "🤖 Using GitHub Models (GPT-4o) for accessibility analysis"
echo ""

# Find UI and component files
# Priority: React components, HTML, CSS, accessibility-related code
A11Y_FILES=$(find . -type f \( \
  -name "*.tsx" -o \
  -name "*.jsx" -o \
  -name "*.html" -o \
  -name "*.css" -o \
  -name "*accessibility*.ts" -o \
  -name "*a11y*.ts" \
\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/coverage/*" -not -path "*/dist/*" 2>/dev/null | head -5 || true)

FILE_COUNT=$(echo "$A11Y_FILES" | grep -c . || echo 0)

if [ $FILE_COUNT -eq 0 ]; then
  echo "ℹ️  No UI files found to review"
  echo "Note: This project may not have a web UI (MCP server only)"
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
  
  # Include more lines for UI review (100)
  CONTENT=$(head -100 "$file" 2>/dev/null || echo "")
  
  if [ -n "$CONTENT" ]; then
    SAMPLES+="File: $FILEPATH
$CONTENT

---

"
    ((COUNT++))
    echo "Collected: $FILEPATH"
  fi
done <<< "$A11Y_FILES"
set -e

echo ""
echo "🔍 Analyzing $COUNT files with GPT-4o..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM_PROMPT="You are an accessibility expert reviewing WCAG 2.2 AA compliance for users with disabilities.

Target users:
- Adults with motor disabilities (may use switches, eye gaze)
- Non-verbal users (need symbol-based interfaces)
- Users with cognitive disabilities (need simplified flows)
- Screen reader users (need proper ARIA)

Check for:
1. Keyboard accessibility (all functions keyboard accessible, logical focus order, visible focus)
2. Color contrast (text 4.5:1, UI components 3:1, no color-only information)
3. Semantic HTML (headings, landmarks, form labels)
4. ARIA usage (only where HTML insufficient, proper live regions)
5. Cognitive load (plain language Grade 6, max 3 steps per task, clear errors)
6. AAC/symbol support (text equivalents, large targets 44x44px)
7. Switch scanning compatibility (no time-dependent interactions)

Context: DATS booking assistant for Edmonton transit service for people with disabilities."

USER_PROMPT="Review these UI files for accessibility:

$SAMPLES

Provide:
1. WCAG Violations (with specific criterion reference like 2.4.7 Focus Visible)
2. AAC Compatibility Issues (symbol support, switch access)
3. Cognitive Accessibility Concerns (reading level, task complexity)
4. Screen Reader Issues (missing labels, incorrect ARIA)
5. Required Changes (with specific file/line references)"

"$SCRIPT_DIR/ai-helper.sh" "$SYSTEM_PROMPT" "$USER_PROMPT" "gpt-4o" 2>&1

echo ""
echo "📋 Recommendations:"
echo "- Run axe-core automated tests (npm install --save-dev axe-core)"
echo "- Test with NVDA/VoiceOver screen readers"
echo "- Ensure 44x44px touch targets (WCAG 2.5.5)"
echo "- Use plain language (Grade 6 reading level)"
echo "- Test keyboard navigation (Tab, Enter, Escape)"
