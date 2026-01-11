# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP-based accessible booking assistant for Edmonton's Disabled Adult Transit Service (DATS). Enables natural language booking via Claude/Copilot clients, with multi-modal accessibility support (AAC devices, switch access, symbols) and Microsoft Outlook calendar integration.

**Why web automation?** DATS uses Trapeze PASS with no public API. Playwright automation with user consent is the only viable integration path.

## Build Commands

```bash
npm install              # Install dependencies
npm run build            # Build all MCP servers
npm run dev              # Start MCP servers locally

npm test                 # Run all tests (includes accessibility)
npm test -- --watch      # Watch mode
npm test -- path/to/file # Run single test file

npm run test:e2e         # Playwright E2E tests against DATS portal
npm run test:a11y        # Accessibility audit (axe-core)

npm run lint             # ESLint
npm run format           # Prettier
```

## Architecture

Three MCP servers, each independently deployable:

```
┌─────────────────────────────────────────────────────────────┐
│  AI Clients (Claude Desktop, Copilot, Custom Web UI)        │
└──────────────────────────┬──────────────────────────────────┘
                           │ MCP Protocol (stdio/HTTP+SSE)
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ DATS        │    │ Calendar    │    │ Accessibility│
│ Booking     │    │ Sync        │    │             │
│             │    │             │    │             │
│ book_trip   │    │ create_event│    │ get_symbols │
│ get_trips   │    │ check_busy  │    │ text_to_speech│
│ cancel_trip │    │ sync_trip   │    │ simplify_text│
└──────┬──────┘    └──────┬──────┘    └─────────────┘
       │                  │
       ▼                  ▼
┌─────────────┐    ┌─────────────┐
│ DATS Portal │    │ Microsoft   │
│ (Playwright)│    │ Graph API   │
└─────────────┘    └─────────────┘
```

**Key patterns:**
- **Page Objects** (`mcp-servers/dats-booking/src/automation/`) encapsulate all DATS portal interactions
- **Credential Manager** (`auth/CredentialManager.ts`) handles AES-256-GCM encryption; credentials never leave unencrypted
- **MCP tools** are stateless; state lives in external systems (DATS, Graph)

## DATS Business Rules

These constraints are enforced by the DATS portal and must be respected:

| Rule | Constraint |
|------|------------|
| Advance booking | Up to 3 days ahead, cutoff at noon day before |
| Same-day booking | 2-hour minimum notice, not guaranteed |
| Cancellation | 2-hour minimum notice required |
| Pickup window | 30 minutes (vehicle waits 5 minutes max) |
| Rate limiting | Minimum 3-second delay between requests (`DATS_RATE_LIMIT_MS`) |

## Critical Development Rules

### Security (POPA Compliance)
- **NEVER** store credentials in code, logs, or comments
- **NEVER** log PII (names, addresses, client numbers)
- Use encrypted storage for DATS credentials (AES-256-GCM)
- Canadian data residency required (Azure Canada / AWS ca-central-1)

### Accessibility (WCAG 2.2 AA)
- Run `npm run test:a11y` before PR
- Minimum touch target: 44x44px
- Support keyboard navigation (no mouse-only interactions)
- Include `aria-live` regions for dynamic content
- Semantic HTML first; ARIA only where HTML semantics insufficient

### TypeScript & Code Quality
- Strict mode enabled; **never** use `any` type
- Functions under 50 lines; extract helpers
- Run `npm run lint` before committing

### MCP Tools
- Input validation on all parameters
- Return typed, structured responses
- Idempotent where possible
- JSDoc comments on all public APIs
- Log invocations with timestamps (no PII)

## Multi-Agent Review

Before merging significant changes, invoke the appropriate review agents:

| Change Type | Required Reviews |
|-------------|------------------|
| Credential/data handling | `/project:security-review` |
| UI/UX changes | `/project:accessibility-review` |
| Architecture decisions | `/project:code-quality-review` → `/project:architect-review` |
| New features | `/project:pm-review` |
| Test coverage | `/project:qa-review` |

Human approval required for all merges.

## Environment Variables

```bash
# Required
DATS_ENCRYPTION_KEY=         # AES-256 key for credential storage
AZURE_CLIENT_ID=             # Microsoft Entra app registration
AZURE_CLIENT_SECRET=         # Microsoft Entra client secret
AZURE_TENANT_ID=             # Microsoft Entra tenant

# Optional
LOG_LEVEL=info               # debug | info | warn | error
DATS_RATE_LIMIT_MS=3000      # Minimum delay between DATS requests
```

## Key Files

| Path | Purpose |
|------|---------|
| `mcp-servers/dats-booking/src/server.ts` | DATS MCP server entry point |
| `mcp-servers/dats-booking/src/automation/` | Playwright page objects |
| `mcp-servers/dats-booking/src/auth/CredentialManager.ts` | Credential encryption |
| `mcp-servers/calendar-sync/src/oauth/GraphAuth.ts` | Microsoft Graph OAuth |
| `shared/types/` | Shared TypeScript interfaces |
| `ARCHITECTURE.md` | Full system diagrams and data flows |
| `AGENTS.md` | Multi-agent definitions and prompts |
| `PRD.md` | Product requirements and user stories |
