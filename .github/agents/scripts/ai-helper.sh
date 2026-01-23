#!/bin/bash
# AI Helper - Makes LLM API calls for agent analysis using GitHub Models
# Usage: ./ai-helper.sh "system prompt" "user prompt" [model]

set -euo pipefail

SYSTEM_PROMPT="${1:-}"
USER_PROMPT="${2:-}"
MODEL="${3:-gpt-4o}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ Error: GITHUB_TOKEN environment variable not set"
  echo "This should be automatically provided by GitHub Actions"
  exit 1
fi

if [ -z "$SYSTEM_PROMPT" ] || [ -z "$USER_PROMPT" ]; then
  echo "Usage: $0 'system prompt' 'user prompt' [model]"
  exit 1
fi

# Call GitHub Models API (uses Copilot infrastructure)
response=$(curl -s https://models.inference.ai.azure.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -d @- <<EOF
{
  "model": "$MODEL",
  "messages": [
    {
      "role": "system",
      "content": $(echo "$SYSTEM_PROMPT" | jq -Rs .)
    },
    {
      "role": "user",
      "content": $(echo "$USER_PROMPT" | jq -Rs .)
    }
  ],
  "temperature": 0.3,
  "max_tokens": 4000
}
EOF
)

# Check for errors
if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
  echo "❌ API Error:"
  echo "$response" | jq -r '.error.message'
  exit 1
fi

# Extract and print the response
echo "$response" | jq -r '.choices[0].message.content'
