# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP-based accessible booking assistant for Edmonton's Disabled Adult Transit Service (DATS). Enables natural language booking via Claude/Copilot clients, with accessibility-first design for users with disabilities.

**Architecture Decision:** Originally planned for Playwright browser automation, but discovered DATS uses a SOAP/XML API (Trapeze PASS). The implementation uses direct API calls for speed and reliability (~2 seconds vs ~30 seconds for browser automation).

## Security-First Architecture

**Architectural security is of the utmost importance.** Always consider security deeply when making architectural decisions. Never take shortcuts that compromise security, even if they seem faster or easier.

### Guiding Principles

1. **Private by Default**: All internal communication between Azure services must use private networking (VNet, Private Endpoints). Never expose databases or internal services to the public internet.

2. **Least Privilege**: Use managed identities with minimal required permissions. Never use connection strings with embedded credentials when managed identity is available.

3. **Defense in Depth**: Layer security controls. Even if one layer fails, others should protect the system.

4. **Data Residency**: All data must remain in Canada (Canada Central region) for POPA compliance. No exceptions.

5. **No Security Shortcuts**: If a secure solution requires more effort, take the time to do it right. Quick fixes that bypass security controls are never acceptable.

### Azure Network Security

- Container Apps must use VNet integration
- Cosmos DB, Storage, and other data services must use Private Endpoints
- Public network access to data services must be disabled
- Use Network Security Groups (NSGs) to restrict traffic between subnets

## ⚠️ Passthrough Principle - READ THIS FIRST

**THIS IS A PASSTHROUGH MCP SERVER - NO BUSINESS LOGIC OR INFERENCE ALLOWED**

The DATS Booking MCP server is a **simple passthrough** to the DATS SOAP API. Its ONLY job is to:
1. Accept requests from Claude/clients
2. Call the DATS API
3. Format the response for display
4. Return the data to Claude/clients

### What This Means

**✅ DO:**
- Trust the DATS API completely for all data (dates, times, statuses, trip details)
- Format data for display (e.g., convert "20260113" to "Mon, Jan 13, 2026")
- Convert time formats (e.g., seconds since midnight to "2:30 PM")
- Validate user input before sending to DATS API
- Handle errors and present them clearly

**❌ DO NOT:**
- Infer or calculate trip status based on dates/times
- Add business logic to "improve" or "correct" DATS data
- Make assumptions about what the data means
- Perform timezone conversions (DATS returns dates/times already in Edmonton/MST)
- Add date/time calculations beyond simple formatting
- Second-guess the DATS API

### Why This Matters

When you add business logic or inference:
1. **Bugs happen** - Different timezones, edge cases, incorrect assumptions
2. **Maintenance burden** - Logic must be kept in sync with DATS behavior
3. **Trust issues** - Users expect data to match what DATS shows
4. **Scope creep** - The MCP server is not the source of truth

### Passthrough Principle Enforcement (2026-01-15)

**Bug Fixed:** Previously, the code validated booking/cancellation times client-side before calling DATS API. This caused a critical bug where trips were incorrectly marked as "already passed" due to timezone handling issues.

**What Was Removed:**
- `validateBookingWindow()` in book-trip tool - removed time-based validation
- `validateCancellation()` in cancel-trip tool - removed trip status inference
- `src/utils/validation.ts` - deleted entire dead code file

**Current Behavior:**
- ✅ book_trip: Sends request to DATS API, displays DATS error if booking is invalid
- ✅ cancel_trip: Sends request to DATS API, displays DATS error if cancellation is invalid
- ✅ All validation handled by DATS API (source of truth)
- ✅ No client-side time comparisons or status inference

**Example DATS Errors (now passed through):**
- "Booking is outside the 3-day advance window"
- "Cancellation requires 2-hour minimum notice"
- "Trip has already been completed"

These errors come directly from DATS and are always accurate and up-to-date with their business rules.

### If Asked to Add Logic

**If a request seems to contradict this principle, STOP and ask:**
- "This would add business logic to the MCP server. The DATS API should provide this information directly. Can we get this from DATS instead?"
- "This creates a passthrough violation. Is there a simpler way that just formats existing DATS data?"

**Remember:** The DATS API is the source of truth. We're just the messenger.

## Timezone Handling

**All DATS operations occur in Edmonton timezone (America/Edmonton = MST/MDT).**

### Core Principle

DATS returns all dates and times in Edmonton local time. Our MCP server:
1. ✅ **Accepts dates/times in Edmonton timezone** from Claude and users
2. ✅ **Sends dates/times to DATS API in Edmonton timezone** (no conversion needed)
3. ✅ **Returns dates/times to Claude with timezone context** so they display correctly
4. ❌ **Does NOT convert timezones** - DATS data is already in the correct timezone

### Why Edmonton Timezone Only?

DATS is a local service operating exclusively in Edmonton, Alberta, Canada. Users are either:
- **In Edmonton** - local residents using the service
- **Planning for Edmonton trips** - caregivers/family booking remotely

All pickup times, ETAs, and schedules are in Edmonton timezone regardless of where the user accesses the service from.

### Timezone Context in Tool Responses

Tools that return time-sensitive data include a `dateContext` object:

```json
{
  "dateContext": {
    "currentDate": "2026-01-15",
    "currentDayOfWeek": "Thursday",
    "timezone": "America/Edmonton",
    "note": "All DATS times are in Edmonton timezone (MST/MDT)"
  }
}
```

**Tools with dateContext:**
- `get_trips` - Shows current date/timezone for trip filtering
- `track_trip` - Shows current date/timezone for ETA interpretation
- `check_availability` - Shows current date for availability windows

This helps Claude understand the correct timezone context when displaying times to users.

### Date Format Handling

**Input (from users/Claude):**
- ISO format: `2026-01-15` (always interpreted as Edmonton date)
- Relative: `today`, `tomorrow`, `thursday` (calculated in Edmonton timezone)
- Natural: `next monday` (next occurrence in Edmonton timezone)

**Output (to Claude/users):**
- Human-friendly: `Thu, Jan 15, 2026` (from DATS API)
- ISO format: `2026-01-15` (for programmatic use)
- UTC timestamps: `2026-01-15T16:58:00.000Z` (only for `lastChecked` field)

### DST (Daylight Saving Time) Handling

Edmonton observes DST with these transitions:
- **Spring forward:** Second Sunday in March, 2:00 AM MST → 3:00 AM MDT (UTC-7 → UTC-6)
- **Fall back:** First Sunday in November, 2:00 AM MDT → 1:00 AM MST (UTC-6 → UTC-7)

**Edge cases handled:**
1. **Non-existent times (spring forward):** 2:30 AM on transition day doesn't exist
   - JavaScript's `Date` object handles this by jumping to 3:30 AM MDT
   - DATS validation would reject invalid booking times

2. **Ambiguous times (fall back):** 1:30 AM occurs twice on transition day
   - First occurrence: MDT (before transition)
   - Second occurrence: MST (after transition)
   - JavaScript uses system rules to disambiguate
   - DATS API handles the actual transition logic

### Midnight Boundary Edge Cases

**Critical for date comparisons:**

- **11:59 PM MST** on Jan 15 = **6:59 AM UTC** on Jan 16
  - Edmonton date: Jan 15
  - UTC date: Jan 16
  - ✅ We use Edmonton date (Jan 15)

- **12:01 AM MST** on Jan 16 = **7:01 AM UTC** on Jan 16
  - Edmonton date: Jan 16
  - UTC date: Jan 16
  - ✅ Both match (coincidence)

**Implementation:**
```typescript
// Get current date in Edmonton timezone
const dateInfo = getCurrentDateInfo('America/Edmonton');
// Returns: { today: '2026-01-15', dayOfWeek: 'Thursday' }
```

The `getCurrentDateInfo()` helper uses `Intl.DateTimeFormat` with explicit timezone to ensure correct date calculation even when system time is in different timezone.

### Testing Timezone Handling

**Comprehensive test coverage includes:**
- ✅ Midnight boundary tests (UTC vs Edmonton dates)
- ✅ DST transition tests (spring forward & fall back)
- ✅ Year boundary tests (Dec 31/Jan 1)
- ✅ Timezone consistency across all tools
- ✅ UTC timestamp format validation

See `src/__tests__/integration/tools.test.ts` for timezone test suite.

### Common Pitfalls to Avoid

❌ **DON'T:**
- Parse DATS dates/times as UTC (they're already Edmonton time)
- Convert user input from device timezone to Edmonton (assume Edmonton)
- Use `Date.UTC()` for DATS data (use local Date constructor)
- Infer trip status from time comparisons (trust DATS API status)

✅ **DO:**
- Use `getCurrentDateInfo('America/Edmonton')` for current date
- Include `dateContext` in time-sensitive tool responses
- Let DATS API validate booking/cancellation times
- Display times exactly as DATS returns them

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

## ✅ Code Quality Refactoring - Phase 3 Complete!

**Status:** Phase 3 of 4 Complete - Phase 4 Ready to Start
**Last Updated:** 2026-01-15
**Review Score:** A- (Excellent structure after refactoring)

### Major Achievement: index.ts Reduced by 93%!

Phases 0-3 of the comprehensive code quality refactoring are **complete**! The codebase has been significantly improved through systematic refactoring.

**📋 See `REFACTORING_PLAN.md` for complete details and Phase 4 planning.**

### Completed Work

**Phase 0: Testing Infrastructure** ✅
- 170 comprehensive tests implemented (including 11 timezone tests)
- 70%+ code coverage achieved
- All MCP tools covered by integration tests
- Comprehensive timezone testing (DST, midnight boundaries, year transitions)

**Phase 1: Quick Wins** ✅
- ✅ constants.ts created for all magic numbers
- ✅ Date helpers extracted to utils/date-helpers.ts
- ✅ Encryption logic shared across session stores
- ✅ Dead code archived

**Phase 2: Foundation** ✅
- ✅ Test coverage maintained throughout refactoring
- ✅ Code organization improved
- ✅ Build pipeline stable

**Phase 3: Tool Handler Organization** ✅
- ✅ All 11 MCP tools extracted to separate files in `src/tools/`
- ✅ Tool factory pattern with dependency injection
- ✅ Session helpers extracted to `src/helpers/session-helpers.ts`
- ✅ **index.ts reduced from 1,432 to 100 lines (93% reduction!)**
- ✅ All 159 tests passing

### Remaining Work

**Phase 4: God Object Splitting (22 hours)** ← **READY TO START**
- Split `src/api/dats-api.ts` (1,451 LOC) into 6 service classes
- Remove remaining `any` types
- Extract shared XML parsers
- Final strict typing and cleanup

### Current Architecture

**Before refactoring:**
- `src/index.ts`: 1,432 lines (10 tool handlers + helpers)
- Duplicated validation logic in 8 places
- Magic numbers scattered throughout

**After Phase 3:**
- `src/index.ts`: 100 lines (clean entry point)
- `src/tools/`: 11 modular tool files with factory pattern
- `src/helpers/`: Session validation extracted
- Dependency injection throughout

### Documentation Files

- **Refactoring Plan:** `REFACTORING_PLAN.md` (project root)
- **Detailed Review:** `.claude/plans/hazy-honking-peacock.md`
- **Security Audit:** `.claude/plans/fancy-splashing-volcano.md`

---

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
              │   dats-mcp-app          │
              │   [VNet Integrated]     │
              └───────────┬─────────────┘
                          │ Private Network (10.0.0.0/16)
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Auth Routes │  │ DATS SOAP   │  │ Cosmos DB   │
│ (same host) │  │ API         │  │ (Private    │
│             │  │ (external)  │  │  Endpoint)  │
└─────────────┘  └─────────────┘  └─────────────┘
```

**Remote Mode URL:** `https://dats-mcp-app.whitewater-072cffec.canadacentral.azurecontainerapps.io/mcp`

## MCP Tools

| Tool | Description |
|------|-------------|
| `connect_account` | Opens secure browser page for DATS login (credentials never touch Claude). In remote mode, starts background polling automatically. |
| `complete_connection` | Complete authentication (remote mode only). Rarely needed - background polling handles this automatically. |
| `disconnect_account` | Log out and clear session from this computer |
| `book_trip` | Create a new DATS booking with full options |
| `get_trips` | Retrieve trips with status filtering (active trips by default) |
| `track_trip` | Real-time tracking: vehicle location, ETA, driver info (within 60 min of pickup) |
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

**Note:** All status information comes directly from the DATS API. The MCP server passes through status values without modification or inference.

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
| Tue, Jan 13, 2026 | 2:30 PM-3:00 PM | McNally High School | 9713 160 St NW | Scheduled | 18789349 |
```
- Use the `date` field exactly as provided (includes day of week)
- Use title case for addresses (not ALL CAPS)
- Show the full address from pickupAddress/destinationAddress fields
- Use the `statusLabel` field for status display

### Real-Time Trip Tracking

The `track_trip` tool provides live tracking for imminent trips:

| Field | Description |
|-------|-------------|
| `pickup.eta` | Estimated pickup time |
| `dropoff.eta` | Estimated dropoff time |
| `vehicle.location` | Live GPS coordinates of the vehicle |
| `vehicle.driverName` | Driver's name |
| `vehicle.make/model` | Vehicle description (e.g., "Toyota Caravan") |
| `provider` | Service provider (e.g., "PRESTIGE") |
| `pickup.status` | `scheduled`, `arrived`, or `departed` |

**Availability:** Only works within 60 minutes of the scheduled pickup time.

**Use cases:**
- "Where is my ride?"
- "When will my ride arrive?"
- "Who is my driver?"

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
- Use the `date` field exactly as provided (already includes day of week)
- Use title case for addresses (not ALL CAPS from API)
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
3. Enter URL: `https://dats-mcp-app.whitewater-072cffec.canadacentral.azurecontainerapps.io/mcp`
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
