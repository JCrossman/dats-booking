# GitHub Actions Workflows

This directory contains automated workflows for the DATS Booking Assistant project.

## Available Workflows

### 🤖 Multi-Agent Review (`multi-agent-review.yml`)

Runs multiple AI agents sequentially to review code, architecture, security, and accessibility.

**Trigger:** Manual (`workflow_dispatch`)

**Inputs:**
- `agents` (string): Comma-separated list of agent names
  - Example: `pm,architect,security,accessibility`
  - Available: `pm`, `architect`, `developer`, `security`, `accessibility`, `code-quality`, `qa`, `devops`, `ux-writer`, `legal`
- `dry_run` (boolean): If true, only provides suggestions without making changes

**Usage:**
```
1. Go to Actions → "Multi-Agent Review"
2. Click "Run workflow"
3. Enter agents: "pm,architect,developer"
4. Select dry_run: true
5. Click "Run workflow"
```

**Output:** Review results appear in GitHub Actions job summary

---

### 🔍 Run Agent (Manual) (`run-agent-manual.yml`)

Runs a single AI agent for targeted review.

**Trigger:** Manual (`workflow_dispatch`)

**Inputs:**
- `agent` (choice): Select from dropdown
- `dry_run` (boolean): Suggestions-only mode

**Usage:**
```
1. Go to Actions → "Run Agent (Manual)"
2. Click "Run workflow"
3. Select agent from dropdown
4. Click "Run workflow"
```

---

### 🚀 Deploy to Azure (`deploy-to-azure.yml`)

Builds and deploys the MCP server to Azure Container Apps.

**Trigger:** 
- Push to `main` branch (paths: `mcp-servers/dats-booking/**`, `azure/**`, workflow file)
- Manual (`workflow_dispatch`)

**Inputs (manual only):**
- `environment`: `production` or `staging`
- `run_e2e`: Run E2E tests with real DATS credentials

**Jobs:**
1. Unit tests
2. E2E tests (if enabled)
3. Build and push Docker image
4. Deploy to Azure

---

## Agent Scripts

Agent scripts are located in `.github/agents/scripts/`:

| Script | Purpose |
|--------|---------|
| `pm.sh` | Product Manager - requirements review |
| `architect.sh` | Architect - system design review |
| `developer.sh` | Developer - implementation review |
| `security.sh` | Security & Privacy - POPA compliance |
| `accessibility.sh` | Accessibility - WCAG 2.2 AA review |
| `code-quality.sh` | Code Quality - clean code principles |
| `qa.sh` | QA/Tester - test coverage review |
| `devops.sh` | DevOps - CI/CD and infrastructure |
| `ux-writer.sh` | UX Writer - plain language review |
| `legal.sh` | Legal/Compliance - POPA compliance |
| `ai-helper.sh` | AI Helper - makes LLM API calls |

All agents use the GitHub Models API (GPT-4o) for analysis.

---

## Testing Agents Locally

```bash
cd .github/agents/scripts

# Test all agents
./test-agents.sh

# Run single agent (requires GITHUB_TOKEN)
export GITHUB_TOKEN=your_token_here
./architect.sh
```

---

## Troubleshooting

### "GITHUB_TOKEN not set" Error
- **Cause:** Workflow missing `GITHUB_TOKEN` environment variable
- **Fix:** Add to workflow:
  ```yaml
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  ```

### "Agent not found" Error
- **Cause:** Script file missing or misnamed
- **Fix:** Verify file exists at `.github/agents/scripts/{agent}.sh`

### "Permission denied" Error
- **Cause:** Script not executable
- **Fix:** `chmod +x .github/agents/scripts/*.sh`

### API Rate Limit Error
- **Cause:** Too many API calls to GitHub Models
- **Fix:** Wait 1 hour, or reduce number of files analyzed per agent

---

## Configuration

### Required Secrets

| Secret | Purpose | Required For |
|--------|---------|--------------|
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions | All agent workflows |
| `MODELS_TOKEN` | GitHub Models API access | `run-agent-manual.yml` |
| `DATS_TEST_CLIENT_ID` | DATS test account | E2E tests |
| `DATS_TEST_PASSCODE` | DATS test account | E2E tests |

### Permissions

Agent workflows require:
```yaml
permissions:
  contents: read      # Read repository code
  id-token: write     # Authenticate with GitHub Models API
```

---

## Adding New Agents

1. Create script in `.github/agents/scripts/{agent}.sh`
2. Follow template from existing agents
3. Add to workflow dropdown in `run-agent-manual.yml`
4. Update `AGENTS.md` with agent definition
5. Test with `./test-agents.sh`
