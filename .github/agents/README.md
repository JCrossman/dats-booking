# DATS Multi-Agent Framework - Configuration Directory

This directory contains machine-readable agent configurations for the DATS Accessible Booking Assistant's multi-agent development framework.

## 📁 Directory Structure

```
.github/agents/
├── schema/
│   └── agent-schema.json          # JSON Schema Draft 7 for validation
├── accessibility-specialist.yml   # WCAG, AAC, cognitive accessibility
├── architect.yml                  # System design, MCP patterns
├── code-quality.yml               # Clean code, refactoring
├── developer.yml                  # Implementation, testing
├── devops-infrastructure.yml      # CI/CD, Azure, monitoring
├── legal-compliance.yml           # POPA, ToS, consent
├── product-manager.yml            # Requirements, user stories
├── qa-tester.yml                  # Testing, edge cases
├── run-agent.sh                   # Executable runner script
├── security-privacy.yml           # Security, POPA compliance
└── ux-writer.yml                  # Plain language, microcopy
```

## 🤖 Agent Configurations

Each YAML file defines one specialized agent with:

- **name** - Unique identifier (lowercase-with-hyphens)
- **description** - Purpose and expertise area
- **owner** - GitHub username/team responsible
- **trigger** - Events that invoke the agent
- **actions** - List of agent capabilities
- **permissions** - Required GitHub Actions permissions
- **secrets_required** - Required secrets (empty for dry_run)
- **modes** - Operating modes (dry_run, production)
- **run** - Execution configuration
- **metadata** - Version, tags, documentation links

## 🔒 Safety Features

All agents are configured with safety-first principles:

- ✅ **dry_run: true** by default (non-destructive)
- ✅ **production: false** by default
- ✅ **Conservative permissions** (read-only)
- ✅ **No secrets required** in dry_run mode
- ✅ **Schema validation** on every change

## 🚀 Usage

### From GitHub Actions UI

**Manual Run:**
1. Go to **Actions** → **Agent - Manual Run**
2. Select agent from dropdown
3. Optionally provide context (PR #, issue #, file paths)
4. Click **Run workflow**

**Orchestrated Run:**
1. Go to **Actions** → **Agent - Orchestrated Review**
2. Enter comma-separated agent names
3. Click **Run workflow**

### From Command Line

```bash
# Run individual agent
AGENT_NAME="security-privacy" DRY_RUN="true" .github/agents/run-agent.sh

# Run with custom role/focus
AGENT_NAME="architect" \
AGENT_ROLE="System Architect" \
AGENT_FOCUS="MCP patterns and scalability" \
DRY_RUN="true" \
.github/agents/run-agent.sh
```

## 📋 Schema Validation

Agent configurations are validated against `schema/agent-schema.json` on every push and pull request.

**To validate manually:**

```bash
# Install validation tools
npm install -g js-yaml ajv-cli

# Validate YAML syntax
js-yaml product-manager.yml

# Validate against schema
js-yaml product-manager.yml > /tmp/pm.json
ajv validate -s schema/agent-schema.json -d /tmp/pm.json
```

## 🔧 Runner Script

The `run-agent.sh` script provides a lightweight execution wrapper.

**Environment Variables:**
- `AGENT_NAME` - Agent to run (required)
- `DRY_RUN` - Set to "false" for production mode (default: "true")
- `AGENT_ROLE` - Human-readable role name (optional)
- `AGENT_FOCUS` - Focus areas (optional)

**Current Implementation:**
- ✅ Logs execution plan in dry_run mode
- ✅ Provides clear output for debugging
- ⚠️ Production logic is a placeholder (requires implementation)

## ⚠️ Production Enablement

**Before enabling production mode:**

1. ✅ Review and approve runner script logic
2. ✅ Implement actual agent functionality
3. ✅ Add GitHub API authentication
4. ✅ Update `owner` fields if needed
5. ✅ Security review of permissions
6. ✅ Test in staging environment
7. ✅ Set `modes.production: true` in configs
8. ✅ Change workflow `dry_run` defaults
9. ✅ Get maintainer approval

## 📖 Documentation

For complete documentation, see:
- [AGENTS.md](../../AGENTS.md) - Full agent definitions and prompts
- [Workflows README](.github/workflows/agents/README.md) - Workflow documentation
- [JSON Schema](schema/agent-schema.json) - Schema specification

## 🐛 Troubleshooting

**Agent not found:**
```bash
# List available agents
ls -1 .github/agents/*.yml
```

**Schema validation fails:**
```bash
# Check required fields
grep -E "^(name|description|owner|trigger|run):" <agent>.yml
```

**Runner script not executable:**
```bash
# Make executable
chmod +x .github/agents/run-agent.sh
```

## 🤝 Contributing

When adding or modifying agent configurations:

1. Follow the schema requirements
2. Maintain dry_run defaults
3. Use conservative permissions
4. Add comprehensive metadata
5. Update documentation
6. Run validation workflow

## 📝 Version History

- **1.0.0** - Initial machine-readable agent configs
  - 10 agent YAML configs
  - JSON Schema validation
  - Runner script implementation
  - GitHub Actions workflows
  - Documentation migration

---

**Last Updated:** 2026-01-23
**Status:** Active (Dry-run mode)
**Owner:** JCrossman
