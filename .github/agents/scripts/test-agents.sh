#!/bin/bash
# Test all agents to ensure they're properly structured

set -euo pipefail

echo "🧪 Agent Validation Test Suite"
echo "=============================="
echo ""

AGENTS=("pm" "architect" "developer" "security" "accessibility" "code-quality" "qa" "devops" "ux-writer" "legal")
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

FAILED=0
PASSED=0

for agent in "${AGENTS[@]}"; do
  SCRIPT="$SCRIPT_DIR/$agent.sh"
  
  echo -n "Testing $agent.sh... "
  
  # Check 1: File exists
  if [ ! -f "$SCRIPT" ]; then
    echo "❌ MISSING"
    FAILED=$((FAILED + 1))
    continue
  fi
  
  # Check 2: Executable
  if [ ! -x "$SCRIPT" ]; then
    echo "⚠️  Not executable (chmod +x needed)"
    chmod +x "$SCRIPT"
  fi
  
  # Check 3: Has GITHUB_TOKEN check
  if ! grep -q 'GITHUB_TOKEN' "$SCRIPT"; then
    echo "❌ Missing GITHUB_TOKEN check"
    FAILED=$((FAILED + 1))
    continue
  fi
  
  # Check 4: Uses ai-helper.sh
  if ! grep -q 'ai-helper.sh' "$SCRIPT"; then
    echo "⚠️  Doesn't use ai-helper.sh (static agent?)"
  fi
  
  # Check 5: Syntax check
  if ! bash -n "$SCRIPT" 2>/dev/null; then
    echo "❌ Syntax error"
    FAILED=$((FAILED + 1))
    continue
  fi
  
  echo "✅ PASSED"
  PASSED=$((PASSED + 1))
done

echo ""
echo "Results: $PASSED passed, $FAILED failed"
echo ""

if [ $FAILED -gt 0 ]; then
  echo "❌ Some agents failed validation"
  exit 1
fi

echo "✅ All agents validated successfully"
