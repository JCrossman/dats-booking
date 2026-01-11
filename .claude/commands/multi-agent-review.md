Run multi-agent review process for a feature or change.

## Workflow Overview

```
PM → Architect → Developer → [Security + Accessibility + Code Quality] → QA → Human
```

## Process

Follow this workflow based on the type of change:

### 1. Clarify Requirements (if new feature)
Run `/project:pm-review` to validate requirements and write user stories.

### 2. Design Architecture (if structural change)
Run `/project:architect-review` to validate system design.

### 3. Implement
Run `/project:implement` to create the code.

### 4. Parallel Reviews (run all applicable)
- `/project:security-review` - **REQUIRED** for credential/data handling
- `/project:accessibility-review` - **REQUIRED** for UI changes
- `/project:code-quality-review` - **RECOMMENDED** always

### 5. Test Coverage
Run `/project:qa-review` to validate tests.

### 6. Optional Reviews
- `/project:ux-writing-review` - for user-facing text
- `/project:legal-review` - for privacy/consent changes
- `/project:devops-review` - for infrastructure changes

## Quality Gates (Must Pass)

| Gate | Criteria | Blocker? |
|------|----------|----------|
| Security | No Critical/High findings | Yes |
| Accessibility | No WCAG violations | Yes |
| Code Quality | Score B or better | No (warning) |
| QA | Coverage requirements met | Yes |
| Legal | No non-compliance findings | Yes |

## Review Matrix by Change Type

| Change Type | Required Reviews |
|-------------|------------------|
| New feature | PM → Architect → Developer → Security + Accessibility + Code Quality → QA |
| Security-sensitive | Developer → Security → Code Quality |
| UI change | Developer → Accessibility → UX Writer → Code Quality |
| Bug fix | Developer → QA → Code Quality |
| Infrastructure | DevOps → Security |
| Privacy/consent | Legal → Security → PM |

## Disagreement Resolution

1. Document each agent's position
2. Identify specific concerns
3. Propose compromise solution
4. Escalate to human reviewer if unresolved

## Usage

After implementation, run each review command and address findings before merge.

---

## Feature to Review

$ARGUMENTS
