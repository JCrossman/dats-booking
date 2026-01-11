Run multi-agent review process for a feature or change.

## Process
This command guides you through the multi-agent consensus workflow:

1. **Clarify Requirements** (if new feature)
   - Run `/project:pm-review` to validate requirements
   
2. **Design Architecture** (if structural change)
   - Run `/project:architect-review` to validate design
   
3. **Implement**
   - Run `/project:implement` to create the code
   
4. **Parallel Reviews** (run all applicable)
   - `/project:security-review` - REQUIRED for credential/data handling
   - `/project:accessibility-review` - REQUIRED for UI changes
   - `/project:code-quality-review` - RECOMMENDED always
   
5. **Test Coverage**
   - Run `/project:qa-review` to validate tests
   
6. **Optional Reviews**
   - `/project:ux-writing-review` - for user-facing text
   - `/project:legal-review` - for privacy/consent changes
   - `/project:devops-review` - for infrastructure changes

## Quality Gates (Must Pass)
- Security: No Critical/High findings
- Accessibility: No WCAG violations
- QA: Coverage requirements met
- Legal: No non-compliance (if applicable)

## Workflow
```
PM → Architect → Developer → [Security + Accessibility + Code Quality] → QA → Human
```

## Usage
After implementation, run each review command and address findings before merge.

Feature to review: $ARGUMENTS
