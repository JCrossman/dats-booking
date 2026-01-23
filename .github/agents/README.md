# DATS Multi-Agent Framework - Machine-Readable Configs

This directory contains machine-readable agent configurations for the DATS Accessible Booking Assistant project's multi-agent development framework.

## 📁 Directory Structure

```
.github/agents/
├── schema/
│   └── agent-schema.json         # JSON Schema for agent validation
├── *.yml                         # 10 agent configuration files
├── run-agent.sh                  # Non-destructive runner script
└── README.md                     # This file
```

## 🤖 Available Agents

| Agent | File | Purpose |
|-------|------|---------|
| Product Manager | `product-manager.yml` | Requirements analysis, user stories, acceptance criteria |
| Architect | `architect.yml` | System design, MCP patterns, integration architecture |
| Developer | `developer.yml` | TypeScript implementation, MCP tools, testing |
| Security & Privacy | `security-privacy.yml` | POPA compliance, credential security, threat modeling |
| Accessibility Specialist | `accessibility-specialist.yml` | WCAG 2.2, AAC integration, switch access |
| Code Quality Reviewer | `code-quality.yml` | Clean code, refactoring, DRY principles |
| QA/Tester | `qa-tester.yml` | Test strategy, E2E testing, edge cases |
| DevOps/Infrastructure | `devops-infrastructure.yml` | CI/CD, Azure deployment, monitoring |
| UX Writer | `ux-writer.yml` | Plain language, cognitive accessibility, microcopy |
| Legal/Compliance | `legal-compliance.yml` | POPA interpretation, ToS analysis, consent |

## 🚀 Usage

### Running Agents via GitHub Actions

#### 1. Manual Single Agent Run

Go to: **Actions → "Run Agent Manually"**

- Select agent from dropdown
- Choose dry_run mode (default: `true`)
- Click "Run workflow"

#### 2. Orchestrated Agent Sequence

Go to: **Actions → "Orchestrate Agent Sequence"**

- Specify agents: `product-manager,architect,developer,security-privacy`
- Or leave empty for default orchestration order
- Choose dry_run mode (default: `true`)
- Click "Run workflow"

Default orchestration order:
1. Product Manager (requirements)
2. Architect (design)
3. Developer (implementation)
4. Security & Privacy (security review)

### Running Agents via Command Line

```bash
# Navigate to agents directory
cd .github/agents

# Run single agent (dry-run mode)
AGENT_NAME=product-manager ./run-agent.sh

# Run with live mode (not yet implemented)
AGENT_NAME=security-privacy DRY_RUN=false ./run-agent.sh

# Show help
./run-agent.sh --help

# List available agents
./run-agent.sh --help | grep "  - "
```

## 🔍 Validation

### Automatic Validation

The `validate-agents.yml` workflow automatically validates all agent configs on:
- Push to `.github/agents/**`
- Pull requests touching `.github/agents/**`

### Manual Validation

```bash
# Install validation tools
npm install -g ajv-cli ajv-formats

# Validate single agent
yq eval -o=json product-manager.yml > /tmp/product-manager.json
ajv validate -s schema/agent-schema.json -d /tmp/product-manager.json --strict=false

# Validate all agents
for agent_file in *.yml; do
  echo "Validating: $agent_file"
  json_file="/tmp/${agent_file%.yml}.json"
  yq eval -o=json "$agent_file" > "$json_file"
  ajv validate -s schema/agent-schema.json -d "$json_file" --strict=false
done
```

## 📝 Agent Config Structure

Each agent YAML file follows this structure:

```yaml
name: agent-name                    # Lowercase with hyphens
version: 1.0.0                      # Semantic versioning

metadata:
  display_name: Agent Display Name
  slash_command: /project:command
  description: Brief description
  owner: GitHubUsername             # Update to your username

expertise:                          # List of expertise areas
  - Expertise 1
  - Expertise 2

triggers:                           # Events that trigger this agent
  - Trigger 1
  - Trigger 2

role:
  summary: Brief role summary
  responsibilities:
    - Responsibility 1
    - Responsibility 2

review_criteria:                    # Criteria for agent reviews
  checklist:                        # Optional
    - Criterion 1
  categories:                       # Optional
    category_name:
      - Item 1
  red_flags:                        # Optional
    - Red flag 1

output_format:                      # Expected output format
  sections:
    - Section 1
    - Section 2

context:                            # Optional project context
  project_name: Project Name
  key_facts:
    - Fact 1
  constraints:
    - Constraint 1

modes:
  dry_run: true                     # Always true for safety
  interactive: false                # Whether human interaction required

dependencies:                       # Optional agent dependencies
  - other-agent
```

## 🔒 Safety Features

### Default Safety Settings

- **All agents default to `dry_run: true`** for safety
- Runner script is non-destructive (simulation only)
- Workflows have read-only permissions by default
- No secrets or credentials in configs

### Permissions

Workflows use minimal permissions:
```yaml
permissions:
  contents: read
  issues: read        # Only for issue-agent
  pull-requests: read # Only for pull-request-agent
```

## 🛠️ Customization

### Update Owner Field

The `owner` field in each agent config is set to `JCrossman`. Update this to your GitHub username:

```bash
# Update all agent configs at once
for agent_file in *.yml; do
  sed -i 's/owner: JCrossman/owner: YourUsername/g' "$agent_file"
done
```

### Add New Agent

1. Create new YAML file following the structure above
2. Ensure it validates against `schema/agent-schema.json`
3. Add to workflow dropdowns in:
   - `.github/workflows/agents/run-agent-manual.yml`
4. Update documentation

### Modify Schema

Edit `schema/agent-schema.json` to add/modify required fields.

**Note:** Schema changes may require updating existing agent configs.

## 🔄 Event-Triggered Workflows

| Workflow | Trigger | Agent | Purpose |
|----------|---------|-------|---------|
| `issue-agent.yml` | Issue opened/edited/labeled | Product Manager | Analyze new issues |
| `pull-request-agent.yml` | PR opened/synchronized | Code Quality | Review code changes |
| `schedule-agent.yml` | Weekly (Mon 9am UTC) | DevOps | Infrastructure check |

All event-triggered workflows run in **dry-run mode** by default.

## 📊 Workflow Status

Check workflow runs:
- Go to **Actions** tab in GitHub
- Select workflow from left sidebar
- View run history and logs

## 🐛 Troubleshooting

### Agent not found error

```
[ERROR] Agent configuration not found: /path/to/agent.yml
```

**Solution:** Ensure agent name matches a `.yml` file in this directory.

### Validation failed

```
✗ agent-name.yml validation failed
```

**Solution:** Check agent config against schema. Common issues:
- Missing required fields (`name`, `version`, `metadata`, `expertise`, `triggers`, `review_criteria`, `modes`)
- Invalid format (e.g., version not matching `X.Y.Z`)
- Invalid slash command pattern (must be `/project:*`)

### Script not executable

```
bash: ./run-agent.sh: Permission denied
```

**Solution:**
```bash
chmod +x run-agent.sh
git add run-agent.sh
git commit -m "Make run-agent.sh executable"
```

## 📚 Related Documentation

- `AGENTS.md` - Human-readable agent definitions and prompts
- `COPILOT.md` - Full project guidance
- `ARCHITECTURE.md` - System design

## 🤝 Contributing

When adding or modifying agent configs:

1. Validate against schema
2. Test with runner script
3. Update documentation
4. Ensure `dry_run: true` by default
5. Submit PR with clear description

---

**Version:** 1.0.0  
**Last Updated:** 2026-01-23  
**Maintainer:** JCrossman
