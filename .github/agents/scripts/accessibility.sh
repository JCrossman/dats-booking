#!/bin/bash
# Accessibility Specialist Agent - DATS Accessible Booking Assistant
# Reviews codebase for WCAG 2.2 AA compliance and accessibility best practices
# Uses GitHub Models API (GPT-4o) for intelligent analysis

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "♿ Accessibility Specialist Agent - DATS Accessible Booking Assistant"
echo "===================================================================="
echo ""

# Check for AI capabilities
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "⚠️  No GITHUB_TOKEN - falling back to basic checks"
  USE_AI=false
else
  echo "🤖 Using GitHub Models (GPT-4o) for intelligent accessibility analysis"
  USE_AI=true
fi
echo ""

echo "📁 Finding UI files to review..."
# Find all UI-related files using null delimiter for safety with spaces
UI_FILES_LIST=$(find "$REPO_ROOT" -type f \( \
  -name "*.tsx" -o \
  -name "*.jsx" -o \
  -name "*.html" -o \
  -name "*.vue" \
\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/coverage/*" 2>/dev/null)

FILE_COUNT=$(echo "$UI_FILES_LIST" | grep -c . || echo 0)
echo "Found $FILE_COUNT files to check"
echo ""

if [ "$USE_AI" = true ] && [ $FILE_COUNT -gt 0 ]; then
  # Use AI-powered analysis
  echo "🔍 Running AI-Powered Accessibility Analysis..."
  echo ""
  
  # Collect file contents (limit to first 2 files to avoid token limits)
  FILE_LIST=""
  COUNT=0
  SAMPLES=""
  
  # Use while read to properly handle filenames with spaces
  while IFS= read -r file; do
    if [ $COUNT -lt 2 ] && [ -f "$file" ]; then
      FILENAME=$(basename "$file")
      FILE_LIST="${FILE_LIST}- ${FILENAME}\n"
      
      # Get first 50 lines of the file
      CONTENT=$(head -50 "$file" 2>/dev/null || echo "")
      SAMPLES="${SAMPLES}File: ${FILENAME}\n${CONTENT}\n\n---\n\n"
      ((COUNT++))
    fi
  done <<< "$UI_FILES_LIST"
  
  if [ $COUNT -eq 0 ]; then
    echo "⚠️  No files could be read, falling back to basic checks"
    USE_AI=false
  else
    echo "Analyzing $COUNT sample files with AI..."
    
    # Simple, short prompts to avoid escaping issues
    SYSTEM_PROMPT="You are an accessibility expert. Review HTML/JSX code for WCAG 2.2 AA compliance. Focus on: missing alt text, unlabeled inputs, keyboard access, semantic HTML, ARIA. Be specific and actionable."
    
    USER_PROMPT="Review these files for accessibility issues:\n\nFiles ($FILE_COUNT total, showing $COUNT):\n$FILE_LIST\n\nCode samples:\n$SAMPLES\n\nProvide:\n1. Critical issues\n2. Warnings\n3. Recommendations"
    
    # Use printf to properly handle newlines
    RESPONSE=$("$SCRIPT_DIR/ai-helper.sh" "$(printf '%b' "$SYSTEM_PROMPT")" "$(printf '%b' "$USER_PROMPT")" "gpt-4o" 2>&1)
    EXIT_CODE=$?
    
    echo "## AI Accessibility Review Results"
    echo ""
    
    if [ $EXIT_CODE -ne 0 ]; then
      echo "⚠️  AI call failed (exit code: $EXIT_CODE)"
      echo "Error: $RESPONSE"
      USE_AI=false
    elif echo "$RESPONSE" | head -1 | grep -qi "^error\|❌.*error"; then
      echo "⚠️  AI API returned an error"
      echo "$RESPONSE"
      USE_AI=false
    else
      echo "$RESPONSE"
      echo ""
    fi
  fi
fi

if [ "$USE_AI" = false ]; then
  # Fallback to basic grep-based checks
  echo "🔍 Running Basic Accessibility Checks..."
  echo ""
  
  CRITICAL_ISSUES=0
  WARNINGS=0
  
  # Check 1: Images without alt text
  echo "## Check 1: Image Alt Text"
  MISSING_ALT_COUNT=0
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    if grep -q '<img' "$file" 2>/dev/null && ! grep -q 'alt=' "$file" 2>/dev/null; then
      echo "⚠️  Missing alt: $(basename "$file")"
      ((MISSING_ALT_COUNT++))
    fi
  done <<< "$UI_FILES_LIST"
  
  if [ $MISSING_ALT_COUNT -gt 0 ]; then
    ((WARNINGS++))
  else
    echo "✅ All images have alt text"
  fi
  echo ""
  
  # Check 2: Form inputs without labels  
  echo "## Check 2: Form Input Labels"
  UNLABELED_COUNT=0
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    if grep -q '<input' "$file" 2>/dev/null && \
       ! grep -q 'aria-label\|aria-labelledby\|type="hidden"' "$file" 2>/dev/null; then
      echo "⚠️  Potential unlabeled input: $(basename "$file")"
      ((UNLABELED_COUNT++))
    fi
  done <<< "$UI_FILES_LIST"
  
  if [ $UNLABELED_COUNT -gt 0 ]; then
    echo "ℹ️  Found $UNLABELED_COUNT files (manual review needed)"
    ((WARNINGS++))
  else
    echo "✅ All inputs appear to have labels"
  fi
  echo ""
  
  # Check 3: Buttons without text
  echo "## Check 3: Button Text"
  EMPTY_BUTTON_COUNT=0
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    if grep -q '<button[^>]*></button>' "$file" 2>/dev/null; then
      echo "⚠️  Empty button: $(basename "$file")"
      ((EMPTY_BUTTON_COUNT++))
    fi
  done <<< "$UI_FILES_LIST"
  
  if [ $EMPTY_BUTTON_COUNT -gt 0 ]; then
    ((CRITICAL_ISSUES++))
  else
    echo "✅ No empty buttons found"
  fi
  echo ""
  
  # Summary
  echo "=========================================="
  echo "BASIC ACCESSIBILITY REVIEW SUMMARY"
  echo "=========================================="
  echo ""
  echo "Files checked: $FILE_COUNT"
  echo "Critical issues: $CRITICAL_ISSUES"
  echo "Warnings: $WARNINGS"
  echo ""
  
  if [ $CRITICAL_ISSUES -eq 0 ]; then
    echo "✅ Basic checks passed"
  else
    echo "⚠️  Issues found - review needed"
  fi
  
  echo ""
  echo "💡 For comprehensive AI analysis, ensure MODELS_TOKEN secret is set correctly"
fi

echo ""
echo "Recommendations:"
echo "- Run axe-core for comprehensive WCAG audit"
echo "- Test with screen readers (NVDA, VoiceOver)"
echo "- Verify keyboard navigation"
echo "- Check color contrast ratios"
