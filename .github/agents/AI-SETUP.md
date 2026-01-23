# AI-Powered Agent Setup Guide

The agents use AI via **GitHub Models** (powered by GitHub Copilot infrastructure). No API keys needed!

## ✅ No Setup Required!

The agents automatically use your GitHub Copilot subscription through the `GITHUB_TOKEN` that's provided to all GitHub Actions workflows.

## How It Works

1. You run an agent from GitHub Actions
2. Agent uses `GITHUB_TOKEN` (automatically provided)
3. Calls GitHub Models API (uses Copilot infrastructure)
4. Gets AI-powered analysis back
5. Displays results

## Usage

### Run a Single Agent

1. Go to **Actions** tab
2. Select **"Run Agent (Manual)"**
3. Choose an agent (e.g., `accessibility`)
4. Click **"Run workflow"**
5. Get AI-powered analysis!

### What Each Agent Analyzes

- **accessibility** - WCAG 2.2, AAC, screen reader compatibility
- **security** - POPA compliance, credential security, vulnerabilities
- **code-quality** - Clean code, refactoring, DRY violations
- **pm** - Requirements clarity, user story validation
- **architect** - System design, MCP patterns
- **developer** - Code implementation, best practices
- **qa** - Test coverage, edge cases
- **devops** - Infrastructure security, CI/CD
- **ux-writer** - Plain language, readability
- **legal** - POPA compliance, consent flows

## Cost

✅ **Free!** Uses your existing GitHub Copilot subscription.

No additional API keys or charges required.

## Models Available

- `gpt-4o` (default) - Most capable
- `gpt-4o-mini` - Faster, cheaper
- `o1-preview` - Reasoning model
- `claude-3.5-sonnet` - Anthropic Claude

## Troubleshooting

**Error: "GITHUB_TOKEN environment variable not set"**
- This should never happen in GitHub Actions
- If it does, the workflow configuration is incorrect

**Error: "Unauthorized"**
- Your repository may not have access to GitHub Models
- GitHub Copilot subscription required
- Contact GitHub support

**No files found to review**
- Agent looks for specific file types
- Check agent script to see patterns

## Requirements

- ✅ GitHub Copilot subscription (Individual, Business, or Enterprise)
- ✅ Repository with code to analyze
- ✅ That's it!

## Privacy

- Code is analyzed by GitHub's AI infrastructure
- Same security/privacy as GitHub Copilot
- See: https://docs.github.com/copilot/privacy

## Dry-Run Mode

- **Enabled (default):** Agent analyzes and suggests but makes no changes
- **Disabled:** Agent could potentially make changes (not yet implemented)

Always test with dry-run enabled first!
