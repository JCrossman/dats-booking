#!/bin/bash
# DevOps Agent - AI-Powered Infrastructure Review

set -euo pipefail

echo "🚀 DevOps Agent - DATS Accessible Booking Assistant"
echo "===================================================="
echo ""

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "⚠️  GITHUB_TOKEN not set - cannot use AI analysis"
  exit 1
fi

echo "🤖 Using GitHub Models (GPT-4o) for infrastructure analysis"
echo ""

# Find CI/CD and infrastructure files
INFRA_FILES=$(find . -maxdepth 3 -type f \( \
  -name "*.yml" -o -name "*.yaml" -o -name "Dockerfile" -o -name "docker-compose.yml" \
\) -path "*/.github/workflows/*" -o -name "Dockerfile" 2>/dev/null | head -3 || true)

FILE_COUNT=$(echo "$INFRA_FILES" | grep -c . || echo 0)

if [ $FILE_COUNT -eq 0 ]; then
  echo "ℹ️  No infrastructure files found to review"
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
done <<< "$INFRA_FILES"
set -e

echo ""
echo "🔍 Analyzing $COUNT files with GPT-4o..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEM_PROMPT="You are a DevOps expert reviewing CI/CD and infrastructure. Check for: secrets management (no hardcoded credentials), proper pipeline stages (lint, test, build, deploy), Canadian data residency (Azure Canada Central), security scanning, monitoring setup, automated deployments."

USER_PROMPT="Review this infrastructure configuration:

$SAMPLES

Provide:
1. Security Issues (secrets, permissions)
2. Pipeline Improvements
3. Deployment Risks
4. Best Practice Recommendations"

"$SCRIPT_DIR/ai-helper.sh" "$SYSTEM_PROMPT" "$USER_PROMPT" "gpt-4o" 2>&1

echo ""
echo "Recommendations:"
echo "- Use managed identities (no stored credentials)"
echo "- Deploy to Azure Canada Central for POPA compliance"
echo "- Set up Application Insights monitoring"
