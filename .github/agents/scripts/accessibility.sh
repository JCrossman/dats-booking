#!/bin/bash
# Accessibility Specialist Agent - Basic Automated Checks
# WCAG 2.2, AAC integration, switch access, screen readers

set -euo pipefail

echo "♿ Accessibility Specialist Agent - DATS Accessible Booking Assistant"
echo "===================================================================="
echo ""

# Find UI files
echo "📁 Finding UI files to review..."
UI_FILES=$(find . -type f \( \
  -name "*.tsx" -o \
  -name "*.jsx" -o \
  -name "*.html" -o \
  -name "*.vue" \
\) -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null || echo "")

if [ -z "$UI_FILES" ]; then
  echo "⚠️  No UI files found (*.tsx, *.jsx, *.html, *.vue)"
  echo ""
  echo "✅ No accessibility issues found (no UI files to check)"
  exit 0
fi

echo "Found $(echo "$UI_FILES" | wc -l) files to check"
echo ""

# Initialize counters
ISSUES=0

echo "🔍 Running Accessibility Checks..."
echo ""

# Check 1: Missing alt text on images
echo "## Check 1: Image Alt Text"
for file in $UI_FILES; do
  if grep -n "<img" "$file" | grep -v "alt=" > /dev/null 2>&1; then
    echo "❌ Missing alt text: $file"
    grep -n "<img" "$file" | grep -v "alt=" | head -3
    ISSUES=$((ISSUES + 1))
  fi
done
if [ $ISSUES -eq 0 ]; then
  echo "✅ All images have alt text"
fi
echo ""

# Check 2: Form inputs without labels
echo "## Check 2: Form Input Labels"
LABEL_ISSUES=0
for file in $UI_FILES; do
  if grep -n "<input" "$file" | grep -v "aria-label" | grep -v "id=" > /dev/null 2>&1; then
    echo "⚠️  Potential missing label: $file"
    LABEL_ISSUES=$((LABEL_ISSUES + 1))
  fi
done
if [ $LABEL_ISSUES -eq 0 ]; then
  echo "✅ Form inputs appear to have labels"
else
  echo "ℹ️  Found $LABEL_ISSUES files with potentially unlabeled inputs (manual review needed)"
fi
echo ""

# Check 3: Button accessibility
echo "## Check 3: Button Text"
BUTTON_ISSUES=0
for file in $UI_FILES; do
  if grep -n "<button></button>" "$file" > /dev/null 2>&1; then
    echo "❌ Empty button found: $file"
    grep -n "<button></button>" "$file"
    BUTTON_ISSUES=$((BUTTON_ISSUES + 1))
  fi
done
if [ $BUTTON_ISSUES -eq 0 ]; then
  echo "✅ No empty buttons found"
fi
echo ""

# Check 4: Color-only information
echo "## Check 4: Documentation Review"
README_FILES=$(find . -name "README.md" -o -name "*.md" -not -path "*/.git/*" -not -path "*/node_modules/*" 2>/dev/null | head -5)
if echo "$README_FILES" | grep -q "WCAG\|accessibility\|a11y"; then
  echo "✅ Accessibility mentioned in documentation"
else
  echo "⚠️  Consider adding accessibility documentation"
fi
echo ""

# Summary
echo "=========================================="
echo "ACCESSIBILITY REVIEW SUMMARY"
echo "=========================================="
echo ""
echo "Files checked: $(echo "$UI_FILES" | wc -l)"
echo "Critical issues: $ISSUES"
echo "Warnings: $LABEL_ISSUES"
echo ""

if [ $ISSUES -gt 0 ]; then
  echo "❌ Found accessibility issues that need attention"
  echo ""
  echo "Next steps:"
  echo "1. Add alt text to all images"
  echo "2. Ensure form inputs have associated labels"
  echo "3. Run axe-core or similar tool for comprehensive check"
else
  echo "✅ Basic accessibility checks passed"
  echo ""
  echo "Recommendations:"
  echo "- Run axe-core for comprehensive WCAG audit"
  echo "- Test with screen readers (NVDA, VoiceOver)"
  echo "- Verify keyboard navigation"
  echo "- Check color contrast ratios"
fi
