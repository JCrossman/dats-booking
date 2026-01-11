# DATS Accessible Booking Assistant

An MCP (Model Context Protocol) server that enables natural language booking of Edmonton DATS (Disabled Adult Transit Service) trips. Designed for users with disabilities including non-verbal individuals.

## Features

- **Direct API Integration**: Fast SOAP API calls (~750ms total) instead of slow browser automation
- **Natural Language Booking**: Book trips by describing where and when you need to go
- **Trip Management**: View upcoming trips, cancel bookings
- **Secure Credential Storage**: AES-256-GCM encrypted credentials
- **Accessibility First**: Designed for AAC devices, switch access, and screen readers

## Quick Start

```bash
# Install dependencies
cd mcp-servers/dats-booking
npm install

# Build
npm run build

# Set encryption key for credential storage
export DATS_ENCRYPTION_KEY="your-32-byte-key-here"

# Run the MCP server
node build/index.js
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `setup_credentials` | Store encrypted DATS login credentials |
| `get_trips` | Retrieve upcoming booked trips |
| `book_trip` | Create a new DATS booking |
| `cancel_trip` | Cancel an existing booking |

## Architecture

```
mcp-servers/dats-booking/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── api/
│   │   ├── auth-client.ts    # Direct API authentication
│   │   ├── dats-api.ts       # SOAP API client
│   │   └── soap-client.ts    # Low-level SOAP calls
│   ├── automation/           # Playwright fallback (if needed)
│   ├── auth/                 # Credential encryption
│   └── utils/                # Logging, validation, errors
└── tests/
```

## Performance

| Operation | Browser Automation | Direct API |
|-----------|-------------------|------------|
| Login | ~10-15 seconds | ~650ms |
| Get trips | ~5-10 seconds | ~104ms |
| **Total** | ~20+ seconds | **~750ms** |

## Security

- Credentials encrypted at rest with AES-256-GCM
- No PII in logs
- Session cookies stored only in memory
- Canadian data residency (Alberta POPA compliant)

## License

MIT
