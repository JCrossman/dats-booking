# Multi-Agent System - README

This directory contains machine-readable configurations for the DATS Booking multi-agent system.

## 📁 Directory Structure

```
.github/agents/
├── schema/
│   └── agent-schema.json          # JSON Schema (draft-07) for validating agent configs
├── *.yml                          # Individual agent configuration files (10 total)
├── run-agent.sh                   # Agent runner script (executable)
└── README.md                      # This file
```

## 🤖 Available Agents

| Agent ID | Name | Purpose |
|----------|------|---------|
| `product-manager` | Product Manager | Requirements analysis, user stories, prioritization |
| `architect` | Architect | System design, MCP patterns, integration architecture |
| `developer` | Developer | TypeScript implementation, testing, bug fixes |
| `security-privacy` | Security & Privacy | POPA compliance, security reviews, threat modeling |
| `accessibility-specialist` | Accessibility Specialist | WCAG 2.2, AAC, screen readers, cognitive accessibility |
| `code-quality` | Code Quality Reviewer | Clean code, refactoring, maintainability |
| `qa-tester` | QA/Tester | Test strategy, E2E testing, edge cases |
| `devops-infrastructure` | DevOps/Infrastructure | CI/CD, Azure deployment, monitoring |
| `ux-writer` | UX Writer | Plain language, microcopy, symbol mapping |
| `legal-compliance` | Legal/Compliance | POPA interpretation, ToS analysis, consent |

## 🚀 Quick Start

### Run an Agent Locally

```bash
# Dry-run mode (safe, default)
AGENT_NAME=product-manager DRY_RUN=true .github/agents/run-agent.sh

# Try different agents
AGENT_NAME=security-privacy DRY_RUN=true .github/agents/run-agent.sh
AGENT_NAME=accessibility-specialist DRY_RUN=true .github/agents/run-agent.sh
```

### Run via GitHub Actions

1. **Single Agent**: Go to Actions → "Run Agent Manually" → Select agent → Run workflow
2. **Multiple Agents**: Go to Actions → "Orchestrate Agents" → Enter agent list → Run workflow

## 📋 Configuration Schema

Each agent configuration (`.yml` file) follows this structure:

```yaml
agent:
  name: "Human-readable name"
  id: "machine-readable-id"
  version: "1.1"
  description: "Brief purpose statement"

metadata:
  owner: "JCrossman"                    # GitHub username or team
  status: active                        # active | deprecated | experimental
  tags: ["tag1", "tag2"]
  slash_command: "/project:command"

expertise:
  domains: ["domain1", "domain2"]       # Areas of expertise
  triggers: ["event1", "event2"]        # When to invoke this agent

permissions:
  read: ["resource1", "resource2"]      # What the agent can read
  write: ["resource1"]                  # What the agent can write
  restricted: ["secrets", "credentials"] # What the agent must not access

modes:
  dry_run: true                         # Simulate actions (required: true by default)
  interactive: false                    # Can prompt for input
  auto_approve: false                   # Can auto-approve actions

run:
  entrypoint: .github/agents/run-agent.sh
  timeout: 600                          # Maximum execution time (seconds)
  environment:
    AGENT_TYPE: "agent-id"

review_criteria:
  - "Criterion 1"
  - "Criterion 2"

output_format:
  type: markdown                        # markdown | json | yaml | text
  template: "Output structure..."
```

## 🔒 Safety Features

### Dry-Run Mode (Default)

All agents run in **dry-run mode by default**. This means:
- ✅ Agents simulate their actions
- ✅ No actual changes are made
- ✅ Safe to test and experiment
- ⚠️ Live mode requires explicit `DRY_RUN=false` (not yet implemented)

### Permissions Model

Each agent declares:
- **Read permissions**: What resources it can read
- **Write permissions**: What it can modify
- **Restrictions**: What it must never access (credentials, secrets, etc.)

### Validation

All agent configs are automatically validated against the JSON schema on:
- Every push to `.github/agents/*.yml`
- Every pull request modifying agent configs
- See `.github/workflows/validate-agents.yml`

## 📚 Documentation

For detailed information about each agent's role, expertise, and review criteria, see:
- **Main documentation**: `/AGENTS.md`
- **Each agent config**: `.github/agents/<agent-id>.yml`

## 🛠️ Workflows

### Validation Workflow
- **Path**: `../.github/workflows/validate-agents.yml`
- **Trigger**: Push/PR to agent configs
- **Purpose**: Validate YAML against schema

### Manual Run Workflow
- **Path**: `../.github/workflows/agents/run-agent-manual.yml`
- **Trigger**: Manual (workflow_dispatch)
- **Purpose**: Run single agent on demand

### Orchestration Workflow
- **Path**: `../.github/workflows/agents/orchestrate-agents.yml`
- **Trigger**: Manual (workflow_dispatch)
- **Purpose**: Run multiple agents in sequence or parallel

### Example Triggers
- **Issue Agent**: `../.github/workflows/agents/issue-agent.yml`
- **PR Agent**: `../.github/workflows/agents/pull-request-agent.yml`
- **Scheduled Agent**: `../.github/workflows/agents/schedule-agent.yml`

## 🔧 Customization

### Adding a New Agent

1. Copy an existing agent config as a template
2. Update all fields (name, id, expertise, etc.)
3. Set `metadata.owner` to your GitHub username
4. Ensure `modes.dry_run: true`
5. Run validation: `git add . && git commit` (validation runs automatically)

### Modifying Owner Fields

If you're a maintainer, update the `metadata.owner` field in each agent config:

```yaml
metadata:
  owner: your-github-username  # or your-org/your-team
```

### Enabling Live Mode

⚠️ **Note**: Live mode is not yet implemented. The runner script (`run-agent.sh`) currently only supports dry-run mode.

To enable live mode in the future:
1. Implement AI model integration in `run-agent.sh`
2. Add GitHub API authentication
3. Test thoroughly in dry-run first
4. Set `DRY_RUN=false` when ready

## 🐛 Troubleshooting

### Agent config not found

```bash
# List available agents
ls -1 .github/agents/*.yml | xargs -n1 basename | sed 's/.yml//'
```

### Validation errors

```bash
# Validate a specific agent
yq eval -o=json .github/agents/product-manager.yml > /tmp/agent.json
ajv validate -s .github/agents/schema/agent-schema.json -d /tmp/agent.json
```

### Runner script not executable

```bash
chmod +x .github/agents/run-agent.sh
```

## 📖 Additional Resources

- **Agent Definitions**: See `/AGENTS.md` for detailed agent personas and prompts
- **Project Architecture**: See `/ARCHITECTURE.md`
- **Contributing**: See `/CONTRIBUTING.md`

## 🎯 Future Enhancements

Planned features:
- [ ] AI model integration (GPT-4, Claude, etc.)
- [ ] GitHub API integration for automated reviews
- [ ] Context gathering from issues/PRs
- [ ] Agent chaining with output passing
- [ ] Performance metrics and feedback loops
- [ ] Custom prompt templates
- [ ] Agent collaboration protocols

---

**Version**: 1.0.0
**Status**: Production
**Last Updated**: 2026-01-23
