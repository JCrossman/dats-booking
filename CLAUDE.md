# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP-based accessible booking assistant for Edmonton's Disabled Adult Transit Service (DATS). Enables natural language booking via Claude/Copilot clients, with accessibility-first design for users with disabilities.

**Architecture Decision:** Originally planned for Playwright browser automation, but discovered DATS uses a SOAP/XML API (Trapeze PASS). The implementation uses direct API calls for speed and reliability (~2 seconds vs ~30 seconds for browser automation).

## Multi-Agent Development

This project uses a multi-agent consensus approach for development. Invoke agents via slash commands:

| Command | Agent | Use For |
|---------|-------|---------|
| `/project:pm-review` | Product Manager | Requirements, user stories |
| `/project:architect-review` | Architect | System design, MCP patterns |
| `/project:implement` | Developer | Feature implementation |
| `/project:security-review` | Security & Privacy | POPA compliance, credentials |
| `/project:accessibility-review` | Accessibility | WCAG 2.2 AA, AAC |
| `/project:code-quality-review` | Code Quality | Clean code, DRY |
| `/project:qa-review` | QA/Tester | Test coverage, edge cases |
| `/project:devops-review` | DevOps | CI/CD, Azure deployment |
| `/project:ux-writing-review` | UX Writer | Plain language (Grade 6) |
| `/project:legal-review` | Legal | POPA, consent |
| `/project:multi-agent-review` | Workflow | Full review process |

**Workflow:** `PM → Architect → Developer → [Security + Accessibility + Code Quality] → QA → Human`

See `AGENTS.md` for full agent definitions.

## Build Commands

```bash
cd mcp-servers/dats-booking

npm install              # Install dependencies
npm run build            # Build TypeScript to JavaScript
npm test                 # Run tests

npm run lint             # ESLint
npm run format           # Prettier
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  AI Clients (Claude Desktop, Copilot, Custom Web UI)        │
└──────────────────────────┬──────────────────────────────────┘
                           │ MCP Protocol (stdio)
                           ▼
              ┌─────────────────────────┐
              │   DATS Booking MCP      │
              │                         │
              │  setup_credentials      │
              │  book_trip              │
              │  get_trips              │
              │  cancel_trip            │
              │  get_announcements      │
              │  get_profile            │
              │  get_info               │
              └───────────┬─────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ DATS SOAP   │  │ Remarks     │  │ Static HTML │
│ API         │  │ API         │  │ Pages       │
│ /PassInfo   │  │ /Remarks    │  │ /Public/... │
│ Server      │  │             │  │             │
└─────────────┘  └─────────────┘  └─────────────┘
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `setup_credentials` | Store encrypted DATS client ID and passcode |
| `book_trip` | Create a new DATS booking with full options |
| `get_trips` | Retrieve upcoming trips (cancelled hidden by default) |
| `check_availability` | Check available dates and time windows for booking |
| `cancel_trip` | Cancel booking (requires user confirmation first) |
| `get_announcements` | Get DATS system announcements |
| `get_profile` | Get user profile, contacts, saved locations |
| `get_info` | Get general info, fares, privacy policy, service description |

### Booking Options

The `book_trip` tool supports:
- **Basic**: date, time, pickup address, destination address
- **Mobility**: wheelchair, scooter, walker, or none
- **Callbacks**: pickup phone, dropoff phone
- **Comments**: pickup instructions, dropoff instructions
- **Passengers**: escort, PCA (personal care attendant), or guest

## DATS API Details

### SOAP Endpoints
- **PassInfoServer**: `/PassInfoServer` - Main booking/trip operations
- **Remarks**: `/Remarks` - Announcements (GetActivePassRemarks)
- **Static HTML**: `/Public/Paratransit/HTML/` - Info pages

### 3-Step Booking Flow
1. `PassCreateTrip` - Create draft with addresses, time, passengers
2. `PassScheduleTrip` - Get available time slots
3. `PassSaveSolution` - Confirm the booking

### Address Geocoding
Addresses are geocoded via OpenStreetMap Nominatim API, then sent to DATS in ZZ (geocoded) format with lat/lon coordinates.

## DATS Business Rules

| Rule | Constraint |
|------|------------|
| Advance booking | Up to 3 days ahead, cutoff at noon day before |
| Same-day booking | 2-hour minimum notice, not guaranteed |
| Cancellation | 2-hour minimum notice required |
| Pickup window | 30 minutes (vehicle waits 5 minutes max) |

## Accessibility Guidelines

### Response Formatting
When displaying trips, format for screen reader compatibility:
- Group trips by date with day of week (e.g., "Sunday, January 12")
- Lead each trip with the pickup time window
- Use "to" instead of arrows (→) between locations
- Put confirmation number at the end in brackets
- Example: `7:50-8:20 AM: Home to McNally High School [#18789348]`

### Cancellation Flow
Always confirm with user before cancelling:
1. Summarize trip details (date, time, pickup, destination)
2. Ask "Are you sure you want to cancel this trip?"
3. Only proceed after explicit confirmation

### WCAG 2.2 AA Compliance
- Plain language (Grade 6 reading level where possible)
- No information conveyed by symbols alone
- Logical reading order for screen readers

## Security (POPA Compliance)

- **NEVER** store credentials in code, logs, or comments
- **NEVER** log PII (names, addresses, client numbers)
- Credentials encrypted with AES-256-GCM at `~/.dats-booking/credentials.enc`
- Key derived from `DATS_ENCRYPTION_KEY` environment variable

## Directory Structure

```
mcp-servers/dats-booking/
├── src/
│   ├── index.ts              # MCP server entry point (7 tools)
│   ├── types.ts              # TypeScript interfaces
│   ├── api/
│   │   ├── auth-client.ts    # Direct login API
│   │   └── dats-api.ts       # SOAP API client (booking, trips, profile)
│   ├── auth/
│   │   └── credential-manager.ts  # AES-256-GCM encryption
│   └── utils/
│       ├── errors.ts         # Error handling
│       └── logger.ts         # Stderr logging (no PII)
├── build/                    # Compiled JavaScript
├── package.json
└── tsconfig.json
```

## Key Files

| Path | Purpose |
|------|---------|
| `mcp-servers/dats-booking/src/index.ts` | MCP server with all 7 tools |
| `mcp-servers/dats-booking/src/api/dats-api.ts` | SOAP API client |
| `mcp-servers/dats-booking/src/api/auth-client.ts` | Direct login (no browser) |
| `mcp-servers/dats-booking/src/auth/credential-manager.ts` | Credential encryption |
| `mcp-servers/dats-booking/src/types.ts` | All TypeScript interfaces |

## Environment Variables

```bash
# Required
DATS_ENCRYPTION_KEY=         # AES-256 key for credential storage

# Optional (for future calendar integration)
AZURE_CLIENT_ID=             # Microsoft Entra app registration
AZURE_CLIENT_SECRET=         # Microsoft Entra client secret
AZURE_TENANT_ID=             # Microsoft Entra tenant

# Optional
LOG_LEVEL=info               # debug | info | warn | error
```

## Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dats-booking": {
      "command": "node",
      "args": ["/path/to/mcp-servers/dats-booking/build/index.js"],
      "env": {
        "DATS_ENCRYPTION_KEY": "your-32-byte-key-here"
      }
    }
  }
}
```

## Testing

```bash
# Build first
npm run build

# Test login and trip retrieval
node -e "
const { AuthClient } = require('./build/api/auth-client.js');
const { DATSApi } = require('./build/api/dats-api.js');

async function test() {
  const login = await AuthClient.login({ username: 'CLIENT_ID', password: 'PASSCODE' });
  if (login.success) {
    const api = new DATSApi({ sessionCookie: login.sessionCookie });
    const trips = await api.getClientTrips(login.clientId);
    console.log('Trips:', trips);
  }
}
test();
"
```
