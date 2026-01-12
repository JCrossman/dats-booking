# DATS Accessible Booking Assistant

An MCP (Model Context Protocol) server that enables natural language booking of Edmonton DATS (Disabled Adult Transit Service) trips. Designed for users with disabilities including non-verbal individuals.

## Features

- **Secure Web Authentication**: Credentials entered in browser, never sent to Claude/Anthropic
- **Direct API Integration**: Fast SOAP API calls (~750ms total) instead of slow browser automation
- **Natural Language Booking**: Book trips by describing where and when you need to go
- **Trip Management**: View upcoming trips, cancel bookings
- **Accessibility First**: Designed for AAC devices, switch access, and screen readers

## Quick Start

```bash
# Install dependencies
cd mcp-servers/dats-booking
npm install

# Build
npm run build

# Set encryption key for session storage
export DATS_ENCRYPTION_KEY="your-32-byte-key-here"

# Run the MCP server
node build/index.js
```

## Authentication Flow

Credentials are **never** sent to Claude or Anthropic. Instead:

1. User asks to connect their DATS account
2. Browser opens to a secure Azure-hosted login page
3. User enters credentials directly in the browser
4. Azure authenticates with DATS and returns a session cookie
5. Session cookie is stored locally (encrypted) for API calls

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
| `disconnect_account` | Log out and clear session |
| `get_trips` | Retrieve upcoming booked trips |
| `book_trip` | Create a new DATS booking |
| `cancel_trip` | Cancel an existing booking |
| `check_availability` | Check available booking dates and times |
| `get_announcements` | Get DATS system announcements |
| `get_profile` | Get user profile and saved locations |
| `get_info` | Get DATS general info, fares, privacy policy |

## Architecture

```
mcp-servers/dats-booking/
├── src/
│   ├── index.ts              # MCP server entry point (9 tools)
│   ├── api/
│   │   ├── auth-client.ts    # Direct API authentication
│   │   └── dats-api.ts       # SOAP API client
│   ├── auth/
│   │   ├── web-auth.ts       # Browser auth + Azure polling
│   │   └── session-manager.ts # Encrypted session storage
│   └── utils/                # Logging, validation, errors

azure/dats-auth/
├── src/                      # Static Web App (login UI)
│   ├── index.html            # Accessible login form
│   ├── success.html          # Connection success page
│   └── app.js                # Form handler
└── api/                      # Azure Functions
    ├── auth-login/           # POST /api/auth/login
    ├── auth-status/          # GET /api/auth/status/{sessionId}
    └── shared/
        ├── dats-client.ts    # DATS authentication
        └── session-store.ts  # Azure Blob session storage
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
      "args": ["/path/to/mcp-servers/dats-booking/build/index.js"],
      "env": {
        "DATS_ENCRYPTION_KEY": "your-32-byte-hex-key"
      }
    }
  }
}
```

## License

MIT
