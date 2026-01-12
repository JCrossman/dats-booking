# DATS Booking MCP Server

An MCP (Model Context Protocol) server that enables AI assistants to book, view, and manage Edmonton DATS (Disabled Adult Transit Service) trips through natural language.

## Features

- **Secure web authentication** - Credentials entered in browser, never sent to Claude
- **Book trips** with natural language date/time/location descriptions
- **View upcoming trips** with accessible formatting
- **Cancel trips** with confirmation prompts
- **Check availability** for booking dates and times
- **View profile** including contact info and saved locations
- **Get announcements** for DATS system notices
- **Get info** about fares, privacy policy, and service description

## Installation

### Prerequisites

- Node.js 20+
- A valid DATS client account

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd mcp-servers/dats-booking

# Install dependencies
npm install

# Build the server
npm run build
```

### Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Configuration

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "dats-booking": {
      "command": "node",
      "args": ["/path/to/dats-booking/build/index.js"],
      "env": {
        "DATS_ENCRYPTION_KEY": "your-64-char-hex-key"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATS_ENCRYPTION_KEY` | Yes | 64-character hex key for AES-256 session encryption |
| `DATS_AUTH_URL` | No | Azure auth endpoint URL (has default) |
| `LOG_LEVEL` | No | Logging level: debug, info, warn, error (default: info) |

## MCP Tools

### connect_account

Opens a secure browser page for DATS login. Credentials are entered in the browser and never sent to Claude.

**How it works:**
1. Browser opens to Azure-hosted login page
2. You enter your DATS client ID and passcode
3. Azure authenticates with DATS directly
4. Only the session cookie is stored locally (encrypted)

### disconnect_account

Log out and clear your session from this computer.

### book_trip

Create a new DATS trip booking.

**Important:** The assistant will summarize booking details and ask for confirmation before submitting.

**Parameters:**
- `pickup_date` (string): Date in YYYY-MM-DD format
- `pickup_time` (string): Time in HH:MM 24-hour format
- `pickup_address` (string): Full pickup address in Edmonton
- `destination_address` (string): Full destination address
- `mobility_device` (optional): wheelchair, scooter, walker, or none
- `companion` (optional boolean): Whether a companion will travel
- `return_trip` (optional boolean): Book a return trip
- `pickup_phone` (optional string): Callback phone for pickup
- `dropoff_phone` (optional string): Callback phone for dropoff
- `pickup_comments` (optional string): Special instructions for pickup
- `dropoff_comments` (optional string): Special instructions for dropoff
- `additional_passenger_type` (optional): escort, pca, or guest
- `additional_passenger_count` (optional number): Number of passengers (1-3)

### get_trips

Retrieve upcoming booked DATS trips.

**Parameters:**
- `date_from` (optional string): Start date filter (YYYY-MM-DD)
- `date_to` (optional string): End date filter (YYYY-MM-DD)
- `include_cancelled` (optional boolean): Include cancelled trips (default: false)

### check_availability

Check available dates and times for DATS bookings.

**Parameters:**
- `date` (optional string): Specific date to check times for (YYYY-MM-DD)

### cancel_trip

Cancel an existing DATS booking. Requires 2-hour minimum notice.

**Parameters:**
- `confirmation_number` (string): The trip's booking ID or confirmation number

### get_announcements

Get DATS system announcements and important notices.

### get_profile

Get your DATS client profile including personal info, contacts, and saved locations.

### get_info

Get DATS general information.

**Parameters:**
- `topic` (optional): general, fares, privacy, service, or all (default: all)

## Usage Examples

### Connecting Your Account

> "Connect my DATS account"

A browser window will open for you to enter your credentials securely.

### Booking a Trip

> "Book a DATS trip for tomorrow at 9am from 10011 102 Street to Royal Alex Hospital."

> "I need a ride to my doctor on January 15th at 2:30pm. I use a wheelchair."

### Viewing Trips

> "What trips do I have booked this week?"

### Cancelling a Trip

> "Cancel my trip to the hospital tomorrow."

The assistant will show trip details and ask for confirmation before cancelling.

## Development

```bash
# Run in watch mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint
```

## Architecture

```
src/
├── index.ts              # MCP server with 9 tools
├── types.ts              # TypeScript interfaces
├── api/
│   ├── auth-client.ts    # Direct login API
│   └── dats-api.ts       # SOAP API client
├── auth/
│   ├── session-manager.ts   # Encrypted session storage
│   └── web-auth.ts          # Browser auth + Azure polling
└── utils/
    ├── errors.ts         # Error handling
    └── logger.ts         # Logging utilities
```

### Authentication Flow

```
User → Claude Desktop → MCP (opens browser)
                              ↓
                        Azure Auth Page
                              ↓
                        User enters credentials
                              ↓
                        Azure → DATS API
                              ↓
                        MCP polls for result
                              ↓
                        Session stored locally (encrypted)
```

### Booking Flow

1. **PassCreateTrip** - Create draft trip with addresses
2. **PassScheduleTrip** - Get available time slots
3. **PassSaveSolution** - Confirm booking

## Security

- **Credentials never touch Claude** - entered in browser, sent directly to Azure/DATS
- **Session cookies encrypted** at rest with AES-256-GCM
- **No PII logged**
- **Canadian data residency** - Azure hosted in Canada Central

## DATS Booking Rules

- **Advance booking**: Up to 3 days ahead, until noon day before
- **Same-day booking**: 2-hour minimum notice, not guaranteed
- **Pickup window**: 30 minutes (vehicle waits 5 minutes max)
- **Cancellation**: 2-hour minimum notice required

## Accessibility

Output formatting follows WCAG 2.2 AA guidelines:

- Screen reader compatible trip formatting
- Clear date/time with day of week
- Plain language (Grade 6 reading level)
- No arrows or special characters

## License

MIT
