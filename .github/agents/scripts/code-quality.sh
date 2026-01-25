#!/bin/bash
# Code Quality Agent - AI-Powered Code Review

set -euo pipefail

echo "✨ Code Quality Agent - DATS Accessible Booking Assistant"
echo "=========================================================="
echo ""

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "⚠️  GITHUB_TOKEN not set - cannot use AI analysis"
  exit 1
fi

echo "🤖 Using GitHub Models (GPT-4o) for code quality analysis"
echo ""

# Find TypeScript/JavaScript files
CODE_FILES=$(find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/coverage/*" -not -path "*/dist/*" 2>/dev/null | head -3 || true)

FILE_COUNT=$(echo "$CODE_FILES" | grep -c . || echo 0)

if [ $FILE_COUNT -eq 0 ]; then
  echo "ℹ️  No code files found to review"
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
SYSTEM_PROMPT="You are a code quality expert reviewing TypeScript/JavaScript code. Check for: functions over 50 lines, duplicated logic, magic numbers, poor naming, missing error handling, console.logs in production, no `any` types (TypeScript strict mode). Focus on maintainability and clean code principles."

USER_PROMPT="Review these files for code quality issues:

$SAMPLES

Provide:
1. Critical Issues (bugs, errors)
2. Code Smells (maintainability)
3. Best Practice Recommendations"

"$SCRIPT_DIR/ai-helper.sh" "$SYSTEM_PROMPT" "$USER_PROMPT" "gpt-4o" 2>&1

echo ""
echo "Recommendations:"
echo "- Run eslint for automated checks"
echo "- Keep functions under 50 lines"
echo "- Use TypeScript strict mode"
