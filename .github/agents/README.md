# GitHub Agents for DATS Booking Assistant

This directory contains 10 specialized agents based on the multi-agent development framework defined in `/AGENTS.md`.

## Available Agents

| Agent | File | Purpose |
|-------|------|---------|
| **Product Manager** | `pm.yml` | Requirements analysis, user stories, acceptance criteria |
| **Architect** | `architect.yml` | System design, MCP patterns, integration architecture |
| **Developer** | `developer.yml` | TypeScript implementation, SOAP API integration, testing |
| **Security & Privacy** | `security.yml` | POPA compliance, credential security, threat modeling |
| **Accessibility** | `accessibility.yml` | WCAG 2.2, AAC integration, screen readers |
| **Code Quality** | `code-quality.yml` | Clean code, refactoring, DRY principles |
| **QA/Tester** | `qa.yml` | Test strategy, E2E testing, edge cases |
| **DevOps** | `devops.yml` | CI/CD, Azure deployment, monitoring |
| **UX Writer** | `ux-writer.yml` | Plain language, cognitive accessibility, microcopy |
| **Legal/Compliance** | `legal.yml` | POPA interpretation, ToS analysis, consent |

## How to Use

### Manual Invocation

Each agent can be triggered manually via GitHub Actions:

1. Go to **Actions** tab in GitHub
2. Select the agent workflow (e.g., "pm")
3. Click **Run workflow**
4. Review the agent's output in the workflow logs

### From Other Workflows

Agents can be invoked from other workflows using `workflow_dispatch`:

```yaml
- name: Run Security Review
  uses: ./.github/workflows/security.yml
  with:
    dry_run: true
```

### Agent Configuration

All agents are currently in **dry-run mode** (`dry_run: true`), meaning they:
- ✅ Provide suggestions and recommendations
- ✅ Output review findings
- ❌ Do NOT make code changes
- ❌ Do NOT commit or push

To enable execution mode for an agent:
1. Edit the agent's YAML file (e.g., `pm.yml`)
2. Change `dry_run: true` to `dry_run: false`
3. Commit and push

## Agent Scripts

Agent logic is contained in executable shell scripts under `scripts/`:

- `scripts/pm.sh` - Product Manager instructions
- `scripts/architect.sh` - Architect instructions
- `scripts/developer.sh` - Developer instructions
- etc.

Each script displays the agent's role, expertise, review criteria, and output format.

## Multi-Agent Workflow

For complex changes requiring multiple perspectives, use the consensus process defined in `/AGENTS.md`:

| Change Type | Required Reviews |
|-------------|------------------|
| **New feature** | PM → Architect → Developer → (parallel: Security, Accessibility, Code Quality) → QA |
| **Security-sensitive** | Developer → Security → Code Quality |
| **UI change** | Developer → Accessibility → UX Writer → Code Quality |
| **Bug fix** | Developer → QA → Code Quality |
| **Infrastructure** | DevOps → Security |
| **Privacy/consent** | Legal → Security → PM |

## Permissions

All agents use minimal permissions by default:
- `contents: read` - Can read repository code
- No write permissions in dry-run mode
- No secrets access unless explicitly configured

## Audit Logging

All agent runs are audited:
- `audit.enabled: true` on all agents
- Logs include: timestamp, user, inputs, outputs
- Log destination: TODO (configure based on requirements)

## Extending Agents

To add capabilities to an agent:

1. **Edit the YAML** (e.g., `pm.yml`):
   - Add required `permissions`
   - Add `secrets_required` if needed
   - Update `description`

2. **Edit the script** (e.g., `scripts/pm.sh`):
   - Add new logic/instructions
   - Update review criteria
   - Modify output format

3. **Test**:
   - Run manually from Actions tab
   - Verify output meets expectations
   - Iterate as needed

## Reference

- Full agent definitions: `/AGENTS.md`
- Project guidance: `/COPILOT.md`
- Architecture: `/ARCHITECTURE.md`
- GitHub Actions docs: https://docs.github.com/en/actions
