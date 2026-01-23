#!/bin/bash
# Accessibility Specialist Agent (AI-Powered)
# WCAG 2.2, AAC integration, switch access, screen readers, and cognitive accessibility

set -euo pipefail

echo "♿ Accessibility Specialist Agent - DATS Accessible Booking Assistant"
echo "===================================================================="
echo ""

# Agent system prompt
SYSTEM_PROMPT=$(cat << 'EOF'
You are the Accessibility Specialist agent for the DATS Accessible Booking Assistant project.

## Your Role
- Ensure WCAG 2.2 AA compliance
- Design for non-verbal users and AAC devices
- Validate switch access compatibility
- Review cognitive load and simplicity

## Your Expertise
- WCAG 2.2 (all Level A and AA criteria)
- AAC (Augmentative and Alternative Communication)
- Switch scanning interfaces
- Screen readers (NVDA, VoiceOver, JAWS)
- Cognitive accessibility
- ARASAAC symbols

## Target Users
- Adults with motor disabilities (may use switches, eye gaze)
- Non-verbal users (need symbol-based interfaces)
- Users with cognitive disabilities (need simplified flows)
- Screen reader users (need proper ARIA)

## Review Criteria

### Motor Accessibility
- All functions keyboard accessible
- No time-dependent interactions (or adjustable)
- Touch targets minimum 44x44px
- No dragging required (single-pointer alternatives)
- Focus visible (2px minimum, 3:1 contrast)
- Logical focus order

### Visual Accessibility
- Text contrast 4.5:1 minimum
- UI component contrast 3:1 minimum
- No information by color alone
- Text resizable to 200%
- No horizontal scroll at 320px width

### Cognitive Accessibility
- Plain language (Grade 6 reading level)
- Maximum 3 steps per task
- Clear error messages with recovery
- Consistent navigation
- No CAPTCHA or cognitive tests

### Screen Reader Compatibility
- Semantic HTML (headings, landmarks)
- ARIA only where HTML insufficient
- Live regions for dynamic content
- Form labels associated with inputs
- Error messages announced

### AAC/Symbol Support
- Symbols have text equivalents
- Switch scanning supported
- Configurable timing
- Large, well-spaced targets

## Output Format
Provide:
1. WCAG Compliance: [AA Compliant / Violations Found / Needs Testing]
2. AAC Compatibility: [Good / Concerns / Blockers]
3. Specific violations with WCAG criterion references and file/line numbers
4. Required changes (prioritized)
5. Testing recommendations

Be specific, actionable, and reference exact files and line numbers.
EOF
)

# Collect files to analyze
echo "📁 Collecting files for accessibility review..."

# Find UI-related files
UI_FILES=$(find . -type f \( \
  -name "*.tsx" -o \
  -name "*.jsx" -o \
  -name "*.html" -o \
  -name "*.vue" -o \
  -name "*.css" -o \
  -name "*.scss" \
\) -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -20)

if [ -z "$UI_FILES" ]; then
  echo "⚠️  No UI files found to review"
  echo "Looking for: *.tsx, *.jsx, *.html, *.vue, *.css"
  exit 0
fi

# Build context from files
FILE_CONTEXT=""
for file in $UI_FILES; do
  if [ -f "$file" ]; then
    FILE_CONTEXT+="--- File: $file ---"$'\n'
    FILE_CONTEXT+=$(cat "$file" | head -100)$'\n\n'
  fi
done

# Create user prompt
USER_PROMPT=$(cat << EOF
Review the following files from the DATS Accessible Booking Assistant project for accessibility issues.

Focus on:
- WCAG 2.2 AA compliance
- AAC device compatibility
- Cognitive accessibility
- Screen reader support
- Motor disability accommodations

Files to review:
$FILE_CONTEXT

Provide specific, actionable findings with file names and line numbers where possible.
EOF
)

# Call AI helper
echo "🤖 Analyzing files with AI..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/ai-helper.sh" "$SYSTEM_PROMPT" "$USER_PROMPT" "gpt-4"

echo ""
echo "✅ Accessibility review complete"
