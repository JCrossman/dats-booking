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
# Find all UI-related files
UI_FILES=$(find "$REPO_ROOT" -type f \( \
  -name "*.tsx" -o \
  -name "*.jsx" -o \
  -name "*.html" -o \
  -name "*.vue" \
\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*")

FILE_COUNT=$(echo "$UI_FILES" | grep -c '^' || echo 0)
echo "Found $FILE_COUNT files to check"
echo ""

if [ "$USE_AI" = true ] && [ $FILE_COUNT -gt 0 ]; then
  # Use AI-powered analysis
  echo "🔍 Running AI-Powered Accessibility Analysis..."
  echo ""
  
  # Collect file contents (limit to first 3 files to avoid token limits)
  CODE_SAMPLE=""
  FILE_LIST=""
  COUNT=0
  for file in $UI_FILES; do
    if [ $COUNT -lt 3 ]; then
      FILE_LIST="${FILE_LIST}\n- $file"
      CODE_SAMPLE="${CODE_SAMPLE}\n\n### File: $file\n\`\`\`\n$(cat "$file" | head -100)\n\`\`\`"
      ((COUNT++))
    fi
  done
  
  # Call AI helper with accessibility review prompt
  SYSTEM_PROMPT="You are an Accessibility Specialist reviewing code for WCAG 2.2 AA compliance.
Focus on:
- Missing alt text on images
- Unlabeled form inputs
- Keyboard navigation issues
- Color contrast problems
- Semantic HTML usage
- ARIA attributes
- Screen reader compatibility

Target users: Adults with disabilities using screen readers, keyboards, switches, and AAC devices.

Provide specific, actionable findings with file names and line numbers where possible."

  USER_PROMPT="Review these UI files for accessibility issues:

Files found ($FILE_COUNT total, showing first $COUNT):$FILE_LIST

$CODE_SAMPLE

Provide:
1. Critical Issues (WCAG violations)
2. Warnings (potential issues)
3. Recommendations
4. Overall assessment"
  
  AI_RESPONSE=$("$SCRIPT_DIR/ai-helper.sh" "$SYSTEM_PROMPT" "$USER_PROMPT" "gpt-4o" 2>&1 || echo "AI analysis failed")
  
  echo "## AI Accessibility Review Results"
  echo ""
  echo "$AI_RESPONSE"
  echo ""
  
  if echo "$AI_RESPONSE" | grep -q "AI analysis failed\|Error"; then
    echo "⚠️  AI analysis encountered an issue, falling back to basic checks..."
    USE_AI=false
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
  MISSING_ALT=$(echo "$UI_FILES" | xargs grep -l '<img' 2>/dev/null | xargs grep '<img' 2>/dev/null | grep -v 'alt=' || true)
  if [ -n "$MISSING_ALT" ]; then
    echo "⚠️  Found images potentially missing alt text:"
    echo "$MISSING_ALT" | head -5
    ((WARNINGS++))
  else
    echo "✅ All images have alt text"
  fi
  echo ""
  
  # Check 2: Form inputs without labels
  echo "## Check 2: Form Input Labels"
  UNLABELED_INPUTS=$(echo "$UI_FILES" | xargs grep -l '<input' 2>/dev/null | xargs grep '<input' 2>/dev/null | grep -v 'aria-label\|aria-labelledby' | grep -v 'type="hidden"' || true)
  if [ -n "$UNLABELED_INPUTS" ]; then
    echo "⚠️  Potential missing labels found (manual review needed)"
    ((WARNINGS++))
  else
    echo "✅ All inputs appear to have labels"
  fi
  echo ""
  
  # Check 3: Buttons without text
  echo "## Check 3: Button Text"
  EMPTY_BUTTONS=$(echo "$UI_FILES" | xargs grep -l '<button' 2>/dev/null | xargs grep '<button[^>]*></button>' 2>/dev/null || true)
  if [ -n "$EMPTY_BUTTONS" ]; then
    echo "⚠️  Found buttons without text"
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
  echo "💡 For comprehensive analysis, ensure MODELS_TOKEN secret is set"
fi

echo ""
echo "Recommendations:"
echo "- Run axe-core for comprehensive WCAG audit"
echo "- Test with screen readers (NVDA, VoiceOver)"
echo "- Verify keyboard navigation"
echo "- Check color contrast ratios"
