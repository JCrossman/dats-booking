# DATS Portal: Available Features Reference

**Date:** 2026-01-19  
**Purpose:** Clarify what features ARE and ARE NOT available through the DATS booking portal

---

## ✅ Available Features (Implemented)

### Trip Management
- **Book trips** - Create new DATS bookings with pickup/dropoff locations, dates, times
- **View trips** - Get booked trips with status (Scheduled, Performed, Cancelled, No Show)
- **Cancel trips** - Cancel bookings with 2-hour minimum notice before pickup
- **Track trips** - Real-time vehicle location, driver info, ETA for imminent trips (within 90 min)
- **Frequent trips** - Quick rebooking of most common routes

### User Profile & Contact Information
- **Client info** - Name, phone, address, mobility aids, space type
- **Contact info** - Emergency contacts, multiple phone numbers (home/work/cell), email
- **Mobility aids** - Available wheelchair, scooter, walker options
- **Saved locations** - Both registered addresses and frequently used locations

### Booking Management
- **Booking window** - Available dates (3-day advance booking limit, DATS policy)
- **Time slots** - Available pickup/dropoff times for specific routes
- **Default settings** - Booking defaults and available options

### General Information
- **Announcements** - System announcements (supports multiple languages)
- **Service info** - General DATS information, fares, privacy policy

---

## ❌ NOT Available (Out of Scope)

### Billing & Financial
- **Account statements** - DATS handles billing separately, not through portal
- **Transaction history** - No API access to payment records
- **Account balance** - Billing managed by DATS directly
- **Payment processing** - Payments handled outside the booking system

### Terminology
- **"Appointments"** - DATS uses "trips" not "appointments"
  - User asks: "Show me my appointments" → Mean: "Show me my trips"
  - Use `get_trips` tool, not a non-existent `get_appointments`

### Preferences
- **Communication preferences** - Not available through portal API
  - Notification settings are MCP tool configuration, not DATS portal data
  - Email/SMS preferences may be in profile but not configurable via API

---

## API Architecture

The DATS Booking MCP Server uses:
- **Direct SOAP API calls** to PassInfoServer
- **NOT web scraping** or page object patterns
- All interactions are API-driven

### Key SOAP Operations
- `PassCreateTrip` - Create draft booking
- `PassScheduleTrip` - Get available time slots
- `PassSaveSolution` - Confirm booking
- `PassCancelTrip` - Cancel trip
- `PassGetClientTrips` - Retrieve trips
- `PassGetClientInfo` - Get profile
- `PassGetClientContactInfo` - Get contact details
- `PassGetClientLocationsMerged` - Get saved locations
- `PassGetMostFrequentClientTrips` - Get frequent routes
- `PassGetTNCProviders` - TNC provider options
- `GetActivePassRemarks` - System announcements

---

## Tool Descriptions Updated

To prevent Claude from hallucinating non-existent tools, the following tool descriptions now explicitly document what IS and ISN'T available:

### `get_info`
**Added:**
- Lists available information topics
- Explicitly states "NOT AVAILABLE" section:
  - Account statements or transaction history
  - Payment processing
  - Communication preferences
- Notes that DATS uses "trips" not "appointments"

### `get_trips`
**Added:**
- Clarification: "DATS uses 'trips' not 'appointments'. This tool shows scheduled rides, not medical appointments."

### `get_profile`
**Added:**
- Lists what profile data includes
- "NOT AVAILABLE" section:
  - Communication preferences (use MCP settings)
  - Account statements or billing history

---

## Implementation Notes

### Why No Statements?
Per `ROADMAP.md`:
> Payment Processing | Out of scope | DATS handles billing separately

DATS billing is managed separately from the online booking system. Users receive monthly invoices by mail/email directly from DATS finance department, not through the booking portal.

### Why No "Appointments"?
DATS terminology is **trips** (scheduled rides) not **appointments** (medical visits). The system books transportation, not medical appointments.

### Why No Communication Preferences?
The DATS portal does not expose API endpoints for managing notification preferences. These settings exist in the DATS system but are not accessible via the PassInfoServer SOAP API.

---

## For AI Assistants (Claude, etc.)

When a user asks for:
- **"Statements"** → Inform: "Account statements aren't available. DATS handles billing separately."
- **"Appointments"** → Clarify: "Do you mean trips (scheduled rides)? Use `get_trips`."
- **"Communication preferences"** → Explain: "Not available through the API. Contact DATS directly."
- **"Transaction history"** → Inform: "Payment records aren't accessible. DATS bills separately."

**Available tools:**
- `connect_account` - Login
- `complete_connection` - Finalize remote auth
- `disconnect_account` - Logout
- `book_trip` - Schedule new trip
- `get_trips` - View trips (past/future)
- `track_trip` - Real-time tracking
- `cancel_trip` - Cancel booking
- `check_availability` - Check time slots
- `get_announcements` - System messages
- `get_profile` - User info
- `get_info` - General DATS info
- `get_saved_locations` - Saved addresses
- `get_frequent_trips` - Common routes
- `get_booking_options` - Booking defaults

**Non-existent tools** (do not hallucinate):
- ~~`get_statements`~~
- ~~`get_appointments`~~ (use `get_trips`)
- ~~`get_communication_preferences`~~
- ~~`get_account_balance`~~
- ~~`process_payment`~~

---

## References

- **ROADMAP.md** - Feature scope and priorities
- **PRD.md** - Product requirements
- **mcp-servers/dats-booking/src/api/** - DATS API client implementations
- **mcp-servers/dats-booking/src/tools/** - MCP tool implementations
