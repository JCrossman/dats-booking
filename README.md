# DATS Accessible Booking Assistant

An MCP (Model Context Protocol) server that enables natural language booking of Edmonton DATS (Disabled Adult Transit Service) trips. Designed for users with disabilities including non-verbal individuals.

## Features

- **Secure Web Authentication**: Credentials entered in browser, never sent to Claude/Anthropic
- **Direct API Integration**: Fast SOAP API calls (~750ms total) instead of slow browser automation
- **Natural Language Booking**: Book trips by describing where and when you need to go
- **Real-Time Trip Tracking**: Live vehicle location, driver info, ETA for imminent trips
- **Flexible Date Parsing**: Say "Thursday" or "tomorrow" - server handles timezone-aware date calculation
- **Trip Management**: View upcoming trips, cancel bookings, intelligent status display
- **Accessibility First**: Designed for AAC devices, switch access, and screen readers

## Deployment

**Production Environment:** Deployed on Azure Container Apps in Canada Central region

- **Container App:** `dats-mcp-app` (https://dats-mcp-app.whitewater-072cffec.canadacentral.azurecontainerapps.io)
- **Auth Page:** Azure Static Web App (https://green-sky-0e461ed10.1.azurestaticapps.net)
- **CI/CD:** Automated via GitHub Actions on push to `main` branch
- **Monitoring:** Azure Application Insights (`dats-mcp-prod-insights`)
- **Data Storage:** Azure Cosmos DB (encrypted, Canada Central, 24hr TTL)

**Deployment Workflow:**
1. Push to `main` branch
2. GitHub Actions runs tests
3. Builds Docker image
4. Pushes to Azure Container Registry
5. Updates Container App
6. Verifies health endpoint

See `CONTRIBUTING.md` for development workflow and `.github/workflows/deploy-to-azure.yml` for CI/CD configuration.

## Quick Start

### Claude Mobile/Web (Recommended)

1. Go to [claude.ai](https://claude.ai) → Settings → Connectors
2. Add custom connector: `https://dats-mcp-app.whitewater-072cffec.canadacentral.azurecontainerapps.io/mcp`
3. Works on iOS, Android, and web - no installation needed!

**First use:** Ask "Show my DATS trips" → Open the auth link → Enter credentials → Say "done" → Claude continues automatically.

### Claude Desktop (Local Installation)

```bash
# Install dependencies
cd mcp-servers/dats-booking
npm install

# Build
npm run build

# Run the MCP server
node build/index.js
```

Note: Encryption keys are auto-generated and stored locally. No environment variables required.

## Authentication Flow

Credentials are **never** sent to Claude or Anthropic. Instead:

1. User asks to connect their DATS account
2. **Remote mode (Claude Mobile/Web):** User is shown a privacy notice and must consent before proceeding (POPA compliance)
3. Browser opens to a secure Azure-hosted login page
4. User enters credentials directly in the browser
5. Azure authenticates with DATS and returns a session cookie
6. Session cookie is stored (locally for Desktop, encrypted in Azure Canada for Mobile/Web)
7. **Data retention:** 24-hour automatic deletion, or immediate deletion via `disconnect_account`

### Privacy & Compliance

**POPA Compliance (Alberta):**
- ✅ Explicit consent required before storing sessions (remote mode)
- ✅ Data stored in Azure Canada Central (Canadian residency)
- ✅ AES-256-GCM encryption at rest
- ✅ 24-hour automatic deletion (TTL)
- ✅ User right to delete data anytime (`disconnect_account`)
- ✅ Audit logging (no PII)
- ✅ Privacy policy: [View Policy](https://dats-mcp-app.whitewater-072cffec.canadacentral.azurecontainerapps.io/privacy)

**What We Store (Remote Mode Only):**
- Encrypted DATS session cookie (enables booking)
- DATS client ID (technical identifier)
- Session timestamp

**What We DON'T Store:**
- Your DATS username/password (entered in browser, never transmitted)
- Trip details (fetched in real-time from DATS)
- Personal health information
- Names, addresses, phone numbers

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude Desktop │     │  Azure Static   │     │    DATS API     │
│   (MCP Server)  │     │    Web App      │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  1. Open browser      │                       │
         │──────────────────────>│                       │
         │                       │                       │
         │                       │  2. User enters       │
         │                       │     credentials       │
         │                       │                       │
         │                       │  3. Authenticate      │
         │                       │──────────────────────>│
         │                       │                       │
         │                       │  4. Session cookie    │
         │                       │<──────────────────────│
         │                       │                       │
         │  5. Poll for result   │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │  6. Store session     │                       │
         │     (encrypted)       │                       │
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `connect_account` | Open secure login page to connect DATS account |
| `check_connection` | Verify session is ready after authentication (v1.0.2+) |
| `disconnect_account` | Log out and clear session |
| `get_trips` | Retrieve booked trips with status (Scheduled/Performed/Cancelled) and provider info |
| `track_trip` | Real-time tracking: vehicle location, ETA, driver info (within 60 min of pickup) |
| `book_trip` | Create a new DATS booking |
| `cancel_trip` | Cancel an existing booking |
| `check_availability` | Check available booking dates and times |
| `get_announcements` | Get DATS system announcements |
| `get_profile` | Get user profile and saved locations |
| `get_info` | Get DATS general info, fares, privacy policy |

### Trip Display

Trips are displayed with: Date, Time, From, To, Status, Provider, Confirmation
- **Status**: Shows actual trip status (Scheduled, Performed, Cancelled, No Show, etc.)
- **Provider**: Shows transport provider (DATS, PRESTIGE, etc.)

## Architecture

The server supports two modes: **local** (stdio for Claude Desktop) and **remote** (HTTP for Claude Mobile/Web).

```
mcp-servers/dats-booking/
├── src/
│   ├── index.ts              # MCP server entry point (10 tools)
│   ├── api/
│   │   ├── auth-client.ts    # Direct API authentication
│   │   └── dats-api.ts       # SOAP API client
│   ├── auth/
│   │   ├── web-auth.ts           # Browser auth + Azure polling
│   │   ├── session-manager.ts    # Local encrypted session storage
│   │   └── cosmos-session-store.ts # Remote session storage (Cosmos DB)
│   ├── server/
│   │   ├── http-server.ts        # Express HTTP server (remote mode)
│   │   └── auth-routes.ts        # Auth API endpoints
│   └── utils/                # Logging, validation, errors
├── static/                   # Auth pages for remote mode
└── Dockerfile                # Container image for Azure

azure/dats-mcp/               # Remote mode infrastructure
├── main.bicep                # Container Apps, Cosmos DB, Managed Identity

azure/dats-auth/              # Local mode auth (Azure Static Web App)
├── src/                      # Static Web App (login UI)
│   ├── index.html            # Accessible login form
│   ├── success.html          # Connection success page
│   └── app.js                # Form handler
└── api/                      # Azure Functions
    ├── auth-login/           # POST /api/auth/login
    └── auth-status/          # GET /api/auth/status/{sessionId}
```

## Performance

| Operation | Browser Automation | Direct API |
|-----------|-------------------|------------|
| Login | ~10-15 seconds | ~650ms |
| Get trips | ~5-10 seconds | ~104ms |
| **Total** | ~20+ seconds | **~750ms** |

## Security

- **Credentials never touch Claude**: Entered directly in browser, sent to Azure, immediately used with DATS
- **Session cookies encrypted**: AES-256-GCM at `~/.dats-booking/session.enc`
- **One-time session tokens**: Azure session IDs expire after 5 minutes
- **No PII in logs**: Client IDs and addresses never logged
- **Canadian data residency**: Azure Canada Central (POPA compliant)

## Claude Desktop Configuration

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

## For Developers

**✅ Production Deployment: Fully Automated CI/CD**

This project uses GitHub Actions for automated testing and deployment. All code changes pushed to `main` are automatically deployed to Azure.

**Development Workflow:**
1. Make changes in `mcp-servers/dats-booking/`
2. Run tests locally: `npm test`
3. Push to `main` → **Automatic deployment** (~2-3 minutes)
4. Monitor: `gh run list --workflow="deploy-to-azure.yml"`

**Key Documentation:**
- `CONTRIBUTING.md` - **START HERE** - Development workflow & standards
- `COPILOT.md` - Development guidance & architecture
- `DEPLOYMENT-COMPLETE.md` - Operations manual & monitoring
- `POPA-COMPLIANCE.md` - Privacy law requirements

**Infrastructure:**
- **CI/CD:** GitHub Actions (`.github/workflows/deploy-to-azure.yml`)
- **Hosting:** Azure Container Apps (Canada Central)
- **Monitoring:** Application Insights (`dats-mcp-prod-insights`)
- **Status:** ✅ Production Ready (deployed 2026-01-16)

**Quick Commands:**
```bash
# Run tests
cd mcp-servers/dats-booking && npm test

# Deploy (automatic on push)
git push origin main

# View logs
az containerapp logs show --name dats-mcp-app --resource-group dats-mcp-rg --tail 100
```

## License

MIT
