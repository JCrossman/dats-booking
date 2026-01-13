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

The MCP server supports two transport modes:

### Local Mode (Claude Desktop)
```
┌─────────────────────────────────────────────────────────────┐
│  Claude Desktop / Copilot                                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ MCP Protocol (stdio)
                           ▼
              ┌─────────────────────────┐
              │   DATS Booking MCP      │
              │   (local Node.js)       │
              └───────────┬─────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Azure Auth  │  │ DATS SOAP   │  │ Local File  │
│ Web App     │  │ API         │  │ Session     │
└─────────────┘  └─────────────┘  └─────────────┘
```

### Remote Mode (Claude Mobile/Web)
```
┌─────────────────────────────────────────────────────────────┐
│  Claude iOS / Android / Web                                  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS (Streamable HTTP)
                           ▼
              ┌─────────────────────────┐
              │   Azure Container Apps  │
              │   (Canada Central)      │
              │   dats-mcp-dev-app      │
              └───────────┬─────────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Auth Routes │  │ DATS SOAP   │  │ Cosmos DB   │
│ (same host) │  │ API         │  │ Sessions    │
└─────────────┘  └─────────────┘  └─────────────┘
```

**Remote Mode URL:** `https://dats-mcp-dev-app.livelymeadow-eb849b65.canadacentral.azurecontainerapps.io/mcp`

## MCP Tools

| Tool | Description |
|------|-------------|
| `connect_account` | Opens secure browser page for DATS login (credentials never touch Claude). In remote mode, starts background polling automatically. |
| `complete_connection` | Complete authentication (remote mode only). Rarely needed - background polling handles this automatically. |
| `disconnect_account` | Log out and clear session from this computer |
| `book_trip` | Create a new DATS booking with full options |
| `get_trips` | Retrieve trips with status filtering (active trips by default) |
| `check_availability` | Check available dates and time windows for booking |
| `cancel_trip` | Cancel booking (requires user confirmation first) |
| `get_announcements` | Get DATS system announcements |
| `get_profile` | Get user profile, contacts, saved locations |
| `get_info` | Get general info, fares, privacy policy, service description |

### Flexible Date Formats

The `book_trip`, `get_trips`, and `check_availability` tools accept flexible date formats:

| Format | Example | Description |
|--------|---------|-------------|
| YYYY-MM-DD | `2026-01-15` | Standard ISO date |
| Day name | `thursday` | Next occurrence of that day |
| Relative | `today`, `tomorrow` | Relative to current date |
| Next week | `next monday` | Next week's occurrence |

**Important:** When a user says "Thursday", pass `"thursday"` directly to the tool. The server calculates the correct date using the user's timezone (defaults to America/Edmonton).

### Trip Statuses

DATS uses the following status codes for trips:

| Code | Label | Description | Active? |
|------|-------|-------------|---------|
| S | Scheduled | Trip booked and scheduled successfully | Yes |
| U | Unscheduled | Trip booked but not scheduled yet | Yes |
| A | Arrived | Vehicle has arrived at pickup location | Yes |
| Pn | Pending | Needs to be created from recurring template | Yes |
| Pf | Performed | Trip has been completed | No |
| CA | Cancelled | Trip has been cancelled | No |
| NS | No Show | User did not show up at pickup time | No |
| NM | Missed Trip | Vehicle arrived late, did not transport | No |
| R | Refused | User refused the proposed booking | No |

**Note:** The DATS API doesn't provide real-time status updates. "Performed" status is inferred based on whether the pickup window has passed.

### get_trips Filtering

The `get_trips` tool supports filtering options:
- **Default**: Only active trips (Scheduled, Unscheduled, Arrived, Pending)
- **include_all**: Set to `true` to show all trips including Performed, Cancelled, etc.
- **status_filter**: Filter to specific status(es), e.g., `["Pf"]` for Performed only

### Trip Display Format

When displaying trips, format as a markdown table:
```
| Date | Time | From | To | Status | Confirmation |
|------|------|------|-----|--------|--------------|
| Mon, Jan 12 | 2:30 PM-3:00 PM | McNally High School | 9713 160 St NW | Scheduled | 18789349 |
```
- Use title case for addresses (not ALL CAPS)
- Simplify addresses to street name only
- Use the `statusLabel` field for status display

### Authentication Flow

The `connect_account` tool uses a secure web-based authentication flow:

1. **Browser Opens**: A secure Azure-hosted webpage opens in your browser
2. **Enter Credentials**: You enter your DATS client ID and passcode on the webpage
3. **Session Created**: DATS validates credentials and creates a session
4. **Session Stored**: Only the session cookie is stored locally (encrypted)
5. **Credentials Protected**: Your credentials are NEVER stored or sent to Claude

**Security Benefits:**
- Credentials never appear in Claude conversation history
- Credentials never touch Anthropic's servers
- Only temporary session tokens are stored locally
- Sessions expire when DATS invalidates them (typically daily)

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
When displaying trips, use markdown tables for screen reader compatibility:
- Include columns: Date, Time, From, To, Status, Confirmation
- Use title case for addresses (not ALL CAPS from API)
- Show day of week with date (e.g., "Mon, Jan 12")
- Use `statusLabel` field for status (e.g., "Scheduled", "Performed")

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

- **Credentials are NEVER stored** - only temporary session cookies
- **NEVER** log PII (names, addresses, client numbers)
- Session cookies encrypted with AES-256-GCM at `~/.dats-booking/session.enc`
- Key derived from `DATS_ENCRYPTION_KEY` environment variable
- Azure auth endpoint hosted in Canada Central (POPA data residency)
- Credentials flow: Browser → Azure Function → DATS (never to Claude/Anthropic)

## Directory Structure

```
mcp-servers/dats-booking/
├── src/
│   ├── index.ts              # MCP server entry point (10 tools)
│   ├── types.ts              # TypeScript interfaces
│   ├── api/
│   │   ├── auth-client.ts    # Direct login API
│   │   ├── dats-api.ts       # SOAP API client (booking, trips, profile)
│   │   └── soap-client.ts    # Generic SOAP client
│   ├── auth/
│   │   ├── session-manager.ts    # Local encrypted session storage (stdio mode)
│   │   ├── cosmos-session-store.ts # Cosmos DB session storage (HTTP mode)
│   │   └── web-auth.ts           # Browser launch + Azure polling
│   ├── server/
│   │   ├── http-server.ts        # Express.js HTTP server (remote mode)
│   │   └── auth-routes.ts        # Auth endpoints for Container App
│   └── utils/
│       ├── errors.ts         # Error handling
│       ├── logger.ts         # Stderr logging (no PII)
│       ├── booking-validation.ts # Business rule validation
│       └── plain-language.ts     # User-friendly message formatting
├── static/                   # Auth pages served in HTTP mode
│   ├── index.html            # Login form
│   ├── success.html          # Success page
│   ├── app.js                # Form handler
│   └── styles.css            # Styles
├── Dockerfile                # Container image (~50MB)
├── build/                    # Compiled JavaScript
├── package.json
└── tsconfig.json

azure/dats-mcp/                # Azure Infrastructure (Bicep)
├── main.bicep                 # Container Apps, Cosmos DB, Managed Identity
└── azuredeploy.parameters.json

azure/dats-auth/               # Azure Static Web App (local mode auth)
├── api/                       # Azure Functions
│   ├── auth-login/            # POST /api/auth/login
│   ├── auth-status/           # GET /api/auth/status/{sessionId}
│   └── shared/                # Shared modules
├── src/                       # Static web files
│   ├── index.html             # Accessible login form
│   ├── success.html           # Connection success page
│   ├── styles.css             # WCAG 2.2 AA styles
│   └── app.js                 # Form handler
└── staticwebapp.config.json   # Routing config
```

## Key Files

| Path | Purpose |
|------|---------|
| `mcp-servers/dats-booking/src/index.ts` | MCP server with 10 tools (stdio + HTTP) |
| `mcp-servers/dats-booking/src/api/dats-api.ts` | SOAP API client |
| `mcp-servers/dats-booking/src/auth/session-manager.ts` | Local encrypted session storage |
| `mcp-servers/dats-booking/src/auth/cosmos-session-store.ts` | Cosmos DB session storage (remote) |
| `mcp-servers/dats-booking/src/auth/web-auth.ts` | Browser launch + Azure polling |
| `mcp-servers/dats-booking/src/server/http-server.ts` | Express HTTP server (remote mode) |
| `mcp-servers/dats-booking/src/server/auth-routes.ts` | Auth API endpoints |
| `mcp-servers/dats-booking/Dockerfile` | Container image for Azure |
| `azure/dats-mcp/main.bicep` | Azure infrastructure (Container Apps, Cosmos DB) |
| `azure/dats-auth/api/auth-login/index.ts` | Azure Function: authenticate with DATS |

## Environment Variables

### Local Mode (stdio)
```bash
# Optional (encryption key auto-generated if not provided)
DATS_ENCRYPTION_KEY=         # Override auto-generated AES-256 key
DATS_AUTH_URL=               # Azure auth endpoint (has default)
LOG_LEVEL=info               # debug | info | warn | error
```

### Remote Mode (HTTP)
```bash
MCP_TRANSPORT=http           # Enable HTTP mode
PORT=3000                    # Server port
HOST=0.0.0.0                 # Server host

# Cosmos DB (session storage)
COSMOS_ENDPOINT=             # Cosmos DB endpoint URL
COSMOS_DATABASE=dats-sessions
COSMOS_CONTAINER=sessions
COSMOS_ENCRYPTION_KEY=       # AES-256 key for session encryption

# Azure Managed Identity
AZURE_CLIENT_ID=             # User-assigned managed identity client ID

LOG_LEVEL=info               # debug | info | warn | error
```

### Future (calendar integration)
```bash
AZURE_CLIENT_ID=             # Microsoft Entra app registration
AZURE_CLIENT_SECRET=         # Microsoft Entra client secret
AZURE_TENANT_ID=             # Microsoft Entra tenant
```

## Distribution

### Claude Mobile/Web (Remote Connector)

The easiest way to use DATS Booking on mobile devices:

1. Go to [claude.ai](https://claude.ai) → Settings → Connectors
2. Click "Add custom connector"
3. Enter URL: `https://dats-mcp-dev-app.livelymeadow-eb849b65.canadacentral.azurecontainerapps.io/mcp`
4. Name it "DATS Booking"
5. The connector syncs to Claude iOS/Android automatically

**No installation required** - works on any device with Claude access.

### MCPB Bundle (One-Click Install for Desktop)

For Claude Desktop users who prefer local installation:

```bash
cd mcp-servers/dats-booking
npm install -g @anthropic-ai/mcpb
npm run build
mcpb pack .
```

This creates `dats-booking.mcpb` (~26MB) that users can double-click to install.

**Known issues:**
- Icon not showing in install preview (may require verified signing)
- "Access to everything" warning (standard for all MCPs)

### Manual Installation (Developers)

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dats-booking": {
      "command": "node",
      "args": ["/path/to/mcp-servers/dats-booking/build/index.js"]
    }
  }
}
```

Note: Encryption keys are auto-generated. No environment variables required.

### Docker Deployment (Remote Server)

Build and run the remote MCP server:

```bash
cd mcp-servers/dats-booking

# Build image
docker build --platform linux/amd64 -t dats-mcp .

# Run locally for testing
docker run -p 3000:3000 \
  -e MCP_TRANSPORT=http \
  -e COSMOS_ENDPOINT=<endpoint> \
  -e COSMOS_ENCRYPTION_KEY=<key> \
  dats-mcp

# Push to Azure Container Registry
az acr login --name datsmcpregistry
docker tag dats-mcp datsmcpregistry.azurecr.io/dats-mcp:latest
docker push datsmcpregistry.azurecr.io/dats-mcp:latest
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
