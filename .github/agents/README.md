# DATS Booking Agent Configurations

This directory contains machine-readable agent configuration files for the DATS Booking multi-agent development framework.

## Directory Structure

```
.github/agents/
├── schema/
│   └── agent-schema.json       # JSON Schema for validation
├── run-agent.sh                # Lightweight runner script
├── product-manager.yml         # Product Manager agent config
├── architect.yml               # Architect agent config
├── developer.yml               # Developer agent config
├── security-privacy.yml        # Security & Privacy agent config
├── accessibility-specialist.yml # Accessibility Specialist agent config
├── code-quality.yml            # Code Quality Reviewer agent config
├── qa-tester.yml               # QA/Tester agent config
├── devops-infrastructure.yml   # DevOps/Infrastructure agent config
├── ux-writer.yml               # UX Writer agent config
└── legal-compliance.yml        # Legal/Compliance agent config
```

## Agent Configuration Format

Each agent is defined in a YAML file with the following structure:

```yaml
name: "Agent Name"
description: "Brief description of agent's role"
slash_command: "/project:command-name"
expertise:
  - "Domain 1"
  - "Domain 2"
owner: "team or email"
trigger:
  type: "event"  # or "manual", "schedule"
  event: "pull_request"  # GitHub event name
actions:
  - "Action 1"
  - "Action 2"
permissions:
  pull-requests: "write"
  contents: "read"
secrets_required: []
modes:
  dry_run: true  # REQUIRED for safety
run:
  type: "script"
  entrypoint: ".github/agents/run-agent.sh"
  timeout_minutes: 10
```

## Usage

### Running an Agent Locally

```bash
# Using environment variables
AGENT_NAME=product-manager .github/agents/run-agent.sh

# Using command-line arguments
.github/agents/run-agent.sh --agent architect --dry-run

# With GitHub event context
AGENT_NAME=security-privacy GITHUB_EVENT_NAME=pull_request .github/agents/run-agent.sh
```

### Running via GitHub Actions

Agents are automatically triggered by events or can be manually invoked:

- **Issue events**: `.github/workflows/agents/issue-agent.yml`
- **Pull request events**: `.github/workflows/agents/pull-request-agent.yml`
- **Scheduled**: `.github/workflows/agents/schedule-agent.yml`

### Manual Workflow Dispatch

Navigate to Actions → Select workflow → Run workflow

## Validation

All agent configurations are automatically validated against the JSON schema on:
- Pull requests that modify agent files
- Push to main branch

**Validation workflow**: `.github/workflows/validate-agents.yml`

## Adding a New Agent

1. **Create YAML file** in `.github/agents/` following the schema
2. **Set owner field** (replace TODO placeholders)
3. **Use conservative permissions** (least privilege principle)
4. **Keep `dry_run: true`** for safety
5. **Submit PR** - validation runs automatically
6. **Request review** from security team before production enablement

## Modifying an Agent

1. Edit the YAML file
2. Ensure schema compliance
3. Update owner/contact if needed
4. Keep `dry_run: true` unless approved for production
5. Submit PR with changes
6. Request security review if permissions or behavior change

## Safety Requirements

- All agents MUST have `dry_run: true` by default
- Owner field must be populated (no TODO in production)
- Permissions must follow least-privilege principle
- No secrets should be committed to configuration files
- Security review required before enabling production mode

## Schema Validation

The JSON schema (`.github/agents/schema/agent-schema.json`) enforces:
- Required fields (name, description, owner, trigger, permissions, run)
- Valid permission values (read, write, none)
- Proper trigger configuration
- Entrypoint specification

## Production Rollout Checklist

Before enabling production mode for any agent:

- [ ] Owner field populated (no TODO)
- [ ] Permissions reviewed and minimal
- [ ] Security review completed
- [ ] Test with workflow_dispatch first
- [ ] Monitor execution logs
- [ ] Document any required secrets
- [ ] Update AGENTS.md if behavior changes
- [ ] Set `dry_run: false` only after approval

## Support

For questions or issues with agent configurations:
1. Review the main AGENTS.md documentation
2. Check the JSON schema for validation requirements
3. Test locally with `run-agent.sh` before submitting PR
4. Request review from the agent owner listed in the config

## Related Documentation

- `../../AGENTS.md` - Human-readable agent prompts and personas
- `schema/agent-schema.json` - JSON Schema definition
- `../../workflows/validate-agents.yml` - Validation workflow
- `../../workflows/agents/` - Example execution workflows
