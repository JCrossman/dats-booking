# AI-Powered Agent Setup Guide

The agents use AI/LLM (OpenAI GPT-4 by default) to perform intelligent code analysis.

## Setup Instructions

### 1. Get an OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key (starts with `sk-`)

### 2. Add API Key to GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Name: `OPENAI_API_KEY`
5. Value: Paste your API key
6. Click **Add secret**

### 3. Run an Agent

1. Go to **Actions** tab
2. Select **"Run Agent (Manual)"**
3. Click **"Run workflow"**
4. Select an agent (e.g., `accessibility`)
5. Leave dry-run checked
6. Click **"Run workflow"**

## What Happens

When you run an agent:

1. **Collects relevant files** from your repository
2. **Sends to AI** with the agent's specialized instructions
3. **Receives analysis** with specific findings, file/line references
4. **Displays results** in the workflow log

## Supported Agents

Currently AI-powered:
- ✅ **accessibility** - WCAG 2.2, AAC, screen reader analysis

Coming soon (same pattern):
- **security** - POPA compliance, credential security
- **code-quality** - Clean code, refactoring opportunities
- **pm** - Requirements analysis, user story validation
- **architect** - System design review
- **developer** - Code implementation review
- **qa** - Test coverage gaps
- **devops** - Infrastructure security
- **ux-writer** - Plain language, readability
- **legal** - POPA compliance, consent flows

## Cost Considerations

- OpenAI charges per token used
- GPT-4: ~$0.03 per 1K input tokens, ~$0.06 per 1K output tokens
- Typical agent run: 2K-5K tokens = $0.10-0.30 per run
- Monitor usage at: https://platform.openai.com/usage

## Alternative LLMs

To use Claude, Gemini, or other LLMs:

1. Edit `.github/agents/scripts/ai-helper.sh`
2. Replace the API endpoint and authentication
3. Update the model name
4. Add the new API key as a GitHub Secret

## Troubleshooting

**Error: "OPENAI_API_KEY environment variable not set"**
- You haven't added the API key to GitHub Secrets
- Follow step 2 above

**Error: "API Error: Incorrect API key provided"**
- The API key is invalid or expired
- Generate a new key and update the secret

**No files found to review**
- The repository doesn't have files matching the agent's patterns
- Check the agent script to see what file types it looks for

## Security

- ✅ API keys stored as encrypted GitHub Secrets
- ✅ Only accessible during workflow runs
- ✅ Not exposed in logs
- ✅ Code is sent to OpenAI (review their privacy policy)
- ⚠️ Don't use on repositories with sensitive/proprietary code without approval

## Dry-Run Mode

- **Enabled (default):** Agent analyzes and suggests but makes no changes
- **Disabled:** Agent could potentially make changes (not yet implemented)

Always test with dry-run enabled first!
