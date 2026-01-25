#!/bin/bash
# Security & Privacy Agent - AI-Powered Security Review

set -euo pipefail

echo "🔒 Security & Privacy Agent - DATS Accessible Booking Assistant"
echo "================================================================"
echo ""

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "⚠️  GITHUB_TOKEN not set - cannot use AI analysis"
  exit 1
fi

echo "🤖 Using GitHub Models (GPT-4o) for security analysis"
echo ""

# Find code files (prioritize security-sensitive files)
CODE_FILES=$(find . -type f \( \
  -name "*.ts" -o -name "*.js" -o -name "*.env*" -o -name "*config*" \
\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/coverage/*" -not -path "*/dist/*" 2>/dev/null | grep -E "(auth|credential|secret|password|token|key|config)" | head -3 || true)

if [ -z "$CODE_FILES" ]; then
  CODE_FILES=$(find . -type f \( -name "*.ts" -o -name "*.js" \) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/coverage/*" 2>/dev/null | head -3 || true)
fi

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
SYSTEM_PROMPT="You are a security expert reviewing code for vulnerabilities and POPA compliance (Alberta privacy law). Check for: hardcoded secrets, credential leaks, SQL injection, XSS vulnerabilities, insecure API usage, PII handling issues. Focus on authentication and data protection."

USER_PROMPT="Review these files for security issues:

$SAMPLES

Provide:
1. Critical Security Issues (vulnerabilities)
2. Privacy Concerns (POPA compliance)
3. Recommendations"

"$SCRIPT_DIR/ai-helper.sh" "$SYSTEM_PROMPT" "$USER_PROMPT" "gpt-4o" 2>&1

echo ""
echo "Recommendations:"
echo "- Review OWASP Top 10"
echo "- Scan dependencies with npm audit"
echo "- Test authentication flows"
