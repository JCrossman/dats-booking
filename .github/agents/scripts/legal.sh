#!/bin/bash
# Legal/Compliance Agent - AI-Powered POPA Compliance Review

set -euo pipefail

echo "⚖️  Legal/Compliance Agent - DATS Accessible Booking Assistant"
echo "=============================================================="
echo ""

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "⚠️  GITHUB_TOKEN not set - cannot use AI analysis"
  exit 1
fi

echo "🤖 Using GitHub Models (GPT-4o) for compliance analysis"
echo ""

# Find privacy/legal docs and auth code
LEGAL_FILES=$(find . -maxdepth 2 -type f \( \
  -name "*POPA*" -o -name "*PRIVACY*" -o -name "*COMPLIANCE*" -o -name "README.md" \
\) 2>/dev/null | head -2 || true)

# Also check auth-related code
AUTH_CODE=$(find . -type f -name "*auth*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" 2>/dev/null | head -1 || true)

if [ -n "$AUTH_CODE" ]; then
  LEGAL_FILES="$LEGAL_FILES
$AUTH_CODE"
fi

FILE_COUNT=$(echo "$LEGAL_FILES" | grep -c . || echo 0)

if [ $FILE_COUNT -eq 0 ]; then
  echo "⚠️  No compliance documentation found!"
  echo "Critical: Project needs POPA compliance documentation"
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
done <<< "$LEGAL_FILES"
set -e

echo ""
echo "🔍 Analyzing $COUNT files with GPT-4o..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM_PROMPT="You are a legal compliance expert reviewing POPA (Alberta Protection of Privacy Act) compliance. Check for: purpose of collection stated, data minimization, consent obtained, security safeguards documented, Canadian data residency, breach response procedure. This is guidance, not legal advice."

USER_PROMPT="Review this project for POPA compliance:

$SAMPLES

Provide:
1. POPA Compliance Issues
2. Missing Documentation
3. Consent Flow Concerns
4. Recommendations

Disclaimer: This is compliance guidance, not legal advice."

"$SCRIPT_DIR/ai-helper.sh" "$SYSTEM_PROMPT" "$USER_PROMPT" "gpt-4o" 2>&1

echo ""
echo "Recommendations:"
echo "- Document purpose of data collection"
echo "- Obtain explicit consent for disability data"
echo "- Ensure Canadian data residency (Azure Canada)"
echo ""
echo "⚠️  Disclaimer: This is not legal advice. Consult a lawyer."
