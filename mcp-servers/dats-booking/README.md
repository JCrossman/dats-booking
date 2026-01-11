# DATS Booking MCP Server

An MCP (Model Context Protocol) server that enables AI assistants to book, view, and manage Edmonton DATS (Disabled Adult Transit Service) trips through natural language.

## Features

- **Book trips** with natural language date/time/location descriptions
- **View upcoming trips** with accessible formatting
- **Cancel trips** with confirmation prompts
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

# Copy and configure environment
cp .env.example .env
# Edit .env and add your encryption key
```

### Generate Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add the output to your `.env` file as `DATS_ENCRYPTION_KEY`.

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
| `DATS_ENCRYPTION_KEY` | Yes | 64-character hex key for AES-256 credential encryption |
| `LOG_LEVEL` | No | Logging level: debug, info, warn, error (default: info) |
| `DATS_RATE_LIMIT_MS` | No | Minimum delay between DATS requests in ms (default: 3000) |

## MCP Tools

### setup_credentials

Store your DATS login credentials securely. Call this first before using other tools.

**Parameters:**
- `client_id` (string): Your DATS client ID number
- `passcode` (string): Your DATS passcode/password

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

**Trip data includes:**
- Date, pickup window, pickup/destination addresses
- Mobility device type (wheelchair, scooter, ambulatory)
- Additional passengers (escort, PCA, guest) with count
- Pickup/dropoff phone numbers and comments
- Fare amount

**Accessibility Note:** Results should be displayed with:
- Day of week (e.g., "Sunday, January 12")
- Time window first (e.g., "7:50-8:20 AM")
- "to" instead of arrows between locations
- Include mobility device and passengers if present
- Confirmation number at end in brackets
- Example: "7:50-8:20 AM: Home to Hospital, with scooter, 1 escort [#18789348]"

### cancel_trip

Cancel an existing DATS booking. Requires 2-hour minimum notice.

**Parameters:**
- `confirmation_number` (string): The trip's booking ID (numeric like 18789348) or confirmation number (alphanumeric like T011EBCA7)

**Important:** Always confirm with the user before calling this tool. The system accepts either format and will look up the correct booking ID if needed.

### get_announcements

Get DATS system announcements and important notices.

No parameters required.

### get_profile

Get your DATS client profile including personal info, contacts, and saved locations.

No parameters required.

### get_info

Get DATS general information.

**Parameters:**
- `topic` (optional): general, fares, privacy, service, or all (default: all)

## Usage Examples

### Setting Up Credentials

> "Set up my DATS credentials. My client ID is 12345 and passcode is mypassword."

### Booking a Trip

> "Book a DATS trip for tomorrow at 9am from 10011 102 Street to Royal Alex Hospital."

> "I need a ride to my doctor on January 15th at 2:30pm. Pickup is 123 Main Street and destination is 456 Medical Drive. I use a wheelchair and will have a PCA with me."

### Viewing Trips

> "What trips do I have booked this week?"

> "Show me all my trips including cancelled ones."

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

# Format code
npm run format
```

## Architecture

The server uses direct SOAP API calls to the Trapeze PASS system rather than browser automation, providing:

- **Fast response times** (~2 seconds vs ~30 seconds with browser)
- **Reliable connections** (no session management needed)
- **Simple deployment** (no browser dependencies)

### Key Files

```
src/
├── index.ts              # MCP server with 7 tools
├── types.ts              # TypeScript interfaces
├── api/
│   ├── auth-client.ts    # Direct login API
│   └── dats-api.ts       # SOAP API client
├── auth/
│   └── credential-manager.ts  # AES-256 credential encryption
└── utils/
    ├── errors.ts         # Error handling
    └── logger.ts         # Logging utilities
```

### Booking Flow

1. **PassCreateTrip** - Create draft trip with addresses
2. **PassScheduleTrip** - Get available time slots
3. **PassSaveSolution** - Confirm booking

Address geocoding uses the OpenStreetMap Nominatim API.

## Security

- Credentials encrypted at rest with AES-256-GCM
- No PII logged
- Session cookies are ephemeral
- All API calls use TLS 1.2+

## DATS Booking Rules

- **Advance booking**: Up to 3 days ahead, until noon day before
- **Same-day booking**: 2-hour minimum notice, not guaranteed
- **Pickup window**: 30 minutes (vehicle waits 5 minutes max)
- **Cancellation**: 2-hour minimum notice required
- **Companions**: Must request at booking time
- **Mobility devices**: Must specify type at booking

## Known Limitations

- **Additional passengers with new addresses**: Booking trips with escorts/PCAs/guests may fail when using new (geocoded) addresses. This is a DATS system limitation. Workaround: Book the trip without additional passengers first, then contact DATS to add a companion.

## Accessibility

This server is designed for users with disabilities. Output formatting follows WCAG 2.2 AA guidelines:

- Screen reader compatible trip formatting
- Clear date/time presentation with day of week
- Plain language responses (Grade 6 reading level target)
- No arrows or special characters that may not be announced

## License

MIT

## Contributing

Contributions welcome. Please ensure:

1. All tests pass (`npm test`)
2. Code is linted (`npm run lint`)
3. Accessibility guidelines are followed
4. No PII in commits or logs
