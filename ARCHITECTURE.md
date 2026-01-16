# Technical Architecture Document: DATS Accessible Booking Assistant

**Version:** 1.0
**Status:** Draft
**Last Updated:** January 2026

> **Note:** This document describes the original architecture design. The actual implementation differs:
> - **Planned:** Playwright browser automation for DATS portal
> - **Implemented:** Direct SOAP API calls to DATS (Trapeze PASS system)
>
> The SOAP API approach provides ~750ms response times vs ~30 seconds for browser automation.
> See `CLAUDE.md` for current implementation details.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Claude     │  │  Microsoft   │  │   Custom     │  │   Teams      │   │
│  │   Desktop    │  │   Copilot    │  │   Web UI     │  │   Bot        │   │
│  │              │  │   Plugin     │  │  (Accessible)│  │              │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                 │                 │                 │            │
│         └─────────────────┴────────┬────────┴─────────────────┘            │
│                                    │                                        │
│                              MCP Protocol                                   │
│                          (stdio / HTTP+SSE)                                 │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                              MCP SERVER LAYER                               │
├────────────────────────────────────┼────────────────────────────────────────┤
│                                    │                                        │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐ │
│  │                         MCP Gateway (Optional)                         │ │
│  │                   Route requests to appropriate server                 │ │
│  └─────────────────────────────────┬─────────────────────────────────────┘ │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐            │
│         │                          │                          │            │
│         ▼                          ▼                          ▼            │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │  DATS Booking   │    │  Calendar Sync  │    │  Accessibility  │        │
│  │  MCP Server     │    │  MCP Server     │    │  MCP Server     │        │
│  │                 │    │                 │    │                 │        │
│  │  Tools:         │    │  Tools:         │    │  Tools:         │        │
│  │  - book_trip    │    │  - create_event │    │  - get_symbols  │        │
│  │  - get_trips    │    │  - check_busy   │    │  - text_to_speech│       │
│  │  - cancel_trip  │    │  - sync_trip    │    │  - simplify_text│        │
│  │  - get_slots    │    │  - get_events   │    │                 │        │
│  └────────┬────────┘    └────────┬────────┘    └─────────────────┘        │
│           │                      │                                         │
└───────────┼──────────────────────┼─────────────────────────────────────────┘
            │                      │
┌───────────┼──────────────────────┼─────────────────────────────────────────┐
│           │    INTEGRATION LAYER │                                         │
├───────────┼──────────────────────┼─────────────────────────────────────────┤
│           │                      │                                         │
│           ▼                      ▼                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │   Playwright    │    │  Microsoft      │    │   ARASAAC       │        │
│  │   Automation    │    │  Graph API      │    │   API           │        │
│  │                 │    │                 │    │                 │        │
│  │  Page Objects:  │    │  Endpoints:     │    │  Endpoints:     │        │
│  │  - LoginPage    │    │  - /calendar    │    │  - /pictogram   │        │
│  │  - BookingPage  │    │  - /events      │    │  - /search      │        │
│  │  - TripsPage    │    │  - /me          │    │                 │        │
│  └────────┬────────┘    └────────┬────────┘    └─────────────────┘        │
│           │                      │                                         │
└───────────┼──────────────────────┼─────────────────────────────────────────┘
            │                      │
            ▼                      ▼
┌─────────────────┐       ┌─────────────────┐
│  DATS Portal    │       │  Microsoft 365  │
│  (Trapeze PASS) │       │  (Outlook)      │
└─────────────────┘       └─────────────────┘
```

---

## Component Details

### 1. DATS Booking MCP Server

**Purpose**: Automate DATS portal interactions via Playwright

**Technology Stack**:
- TypeScript 5.3+
- @modelcontextprotocol/sdk
- Playwright (Chromium)
- crypto (Node.js built-in for AES-256)

**Tools Exposed**:

```typescript
// book_trip: Create a new DATS booking
interface BookTripInput {
  pickup_date: string;      // YYYY-MM-DD
  pickup_time: string;      // HH:MM (24hr)
  pickup_address: string;
  destination_address: string;
  mobility_device?: "wheelchair" | "scooter" | "walker" | "none";
  companion?: boolean;
  return_trip?: boolean;
}

interface BookTripOutput {
  success: boolean;
  confirmation_number?: string;
  pickup_window?: { start: string; end: string };
  error?: string;
}

// get_trips: Retrieve upcoming booked trips
interface GetTripsInput {
  date_from?: string;  // YYYY-MM-DD (default: today)
  date_to?: string;    // YYYY-MM-DD (default: +7 days)
}

interface GetTripsOutput {
  trips: Array<{
    confirmation_number: string;
    date: string;
    pickup_window: { start: string; end: string };
    pickup_address: string;
    destination_address: string;
    status: "confirmed" | "pending" | "cancelled";
  }>;
}

// cancel_trip: Cancel an existing booking
interface CancelTripInput {
  confirmation_number: string;
}

interface CancelTripOutput {
  success: boolean;
  message: string;
}
```

**Page Object Pattern**:

```typescript
// automation/pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}
  
  async login(clientId: string, passcode: string): Promise<void> {
    await this.page.goto('https://datsonlinebooking.edmonton.ca/');
    await this.page.getByLabel('Client Number').fill(clientId);
    await this.page.getByLabel('Passcode').fill(passcode);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
    await this.page.waitForURL('**/home**');
  }
}

// automation/pages/BookingPage.ts
export class BookingPage {
  constructor(private page: Page) {}
  
  async createBooking(details: BookingDetails): Promise<string> {
    // Navigate to booking form
    // Fill fields with rate-limited interactions
    // Submit and extract confirmation
  }
}
```

**Credential Storage**:

```typescript
// auth/CredentialManager.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export class CredentialManager {
  private readonly algorithm = 'aes-256-gcm';
  
  async store(userId: string, credentials: DATSCredentials): Promise<void> {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    // Encrypt and store with userId association
    // Never log credentials or PII
  }
  
  async retrieve(userId: string): Promise<DATSCredentials> {
    // Retrieve and decrypt
    // Audit log: { timestamp, userId, action: 'credential_access' }
  }
}
```

---

### 2. Calendar Sync MCP Server

**Purpose**: Integrate with Microsoft Outlook via Graph API

**Technology Stack**:
- TypeScript 5.3+
- @modelcontextprotocol/sdk
- @azure/msal-node (OAuth 2.1 + PKCE)
- @microsoft/microsoft-graph-client

**Tools Exposed**:

```typescript
// create_event: Add DATS trip to calendar
interface CreateEventInput {
  trip_confirmation: string;
  pickup_date: string;
  pickup_window: { start: string; end: string };
  destination: string;
  notes?: string;
}

// check_busy: Check if time slot conflicts with calendar
interface CheckBusyInput {
  date: string;
  time_start: string;
  time_end: string;
}

interface CheckBusyOutput {
  is_busy: boolean;
  conflicting_events?: Array<{ subject: string; start: string; end: string }>;
}

// get_events: Retrieve calendar events for date range
interface GetEventsInput {
  date_from: string;
  date_to: string;
}
```

**OAuth Flow**:

```typescript
// oauth/GraphAuth.ts
import { ConfidentialClientApplication } from '@azure/msal-node';

export class GraphAuth {
  private cca: ConfidentialClientApplication;
  
  constructor() {
    this.cca = new ConfidentialClientApplication({
      auth: {
        clientId: process.env.AZURE_CLIENT_ID!,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
        clientSecret: process.env.AZURE_CLIENT_SECRET!,
      },
    });
  }
  
  async getTokenForUser(userId: string): Promise<string> {
    // Retrieve cached token or refresh
    // Scopes: ['Calendars.ReadWrite', 'User.Read']
  }
}
```

---

### 3. Accessibility MCP Server

**Purpose**: Provide accessibility features (symbols, TTS, text simplification)

**Tools Exposed**:

```typescript
// get_symbols: Retrieve ARASAAC symbols for concepts
interface GetSymbolsInput {
  concepts: string[];  // e.g., ["hospital", "home", "tomorrow"]
  language?: string;   // default: "en"
}

interface GetSymbolsOutput {
  symbols: Array<{
    concept: string;
    image_url: string;
    alt_text: string;
  }>;
}

// text_to_speech: Convert text to audio
interface TextToSpeechInput {
  text: string;
  voice?: "male" | "female";
  speed?: number;  // 0.5 to 2.0
}

// simplify_text: Reduce reading level
interface SimplifyTextInput {
  text: string;
  target_grade_level?: number;  // default: 6
}
```

---

## Data Flow: Booking a Trip

```
┌──────────┐     ┌──────────────┐     ┌────────────────┐     ┌────────────┐
│  User    │     │  AI Client   │     │  DATS MCP      │     │  DATS      │
│          │     │  (Claude)    │     │  Server        │     │  Portal    │
└────┬─────┘     └──────┬───────┘     └───────┬────────┘     └─────┬──────┘
     │                  │                     │                    │
     │ "Book trip to    │                     │                    │
     │  hospital 2pm"   │                     │                    │
     │─────────────────>│                     │                    │
     │                  │                     │                    │
     │                  │ Parse intent        │                    │
     │                  │ Extract entities    │                    │
     │                  │                     │                    │
     │                  │ book_trip({         │                    │
     │                  │   date: "2026-01-15"│                    │
     │                  │   time: "14:00"     │                    │
     │                  │   dest: "U of A     │                    │
     │                  │         Hospital"   │                    │
     │                  │ })                  │                    │
     │                  │────────────────────>│                    │
     │                  │                     │                    │
     │                  │                     │ Login (encrypted   │
     │                  │                     │ credentials)       │
     │                  │                     │───────────────────>│
     │                  │                     │                    │
     │                  │                     │ Navigate to booking│
     │                  │                     │ Fill form          │
     │                  │                     │ Submit             │
     │                  │                     │───────────────────>│
     │                  │                     │                    │
     │                  │                     │<───────────────────│
     │                  │                     │ Confirmation:      │
     │                  │                     │ DATS-12345         │
     │                  │                     │ Pickup: 1:30-2:00  │
     │                  │                     │                    │
     │                  │<────────────────────│                    │
     │                  │ { success: true,    │                    │
     │                  │   confirmation:     │                    │
     │                  │   "DATS-12345",     │                    │
     │                  │   pickup_window:    │                    │
     │                  │   "13:30-14:00" }   │                    │
     │                  │                     │                    │
     │<─────────────────│                     │                    │
     │ "Booked! Conf    │                     │                    │
     │  #DATS-12345.    │                     │                    │
     │  Pickup between  │                     │                    │
     │  1:30-2:00 PM"   │                     │                    │
     │                  │                     │                    │
```

---

## Security Architecture

### Threat Model

| Threat | Impact | Mitigation |
|--------|--------|------------|
| Credential theft at rest | Critical | AES-256-GCM encryption; key from env var |
| Credential theft in transit | Critical | TLS 1.2+ only; certificate pinning |
| Session hijacking | High | Short-lived Playwright sessions; no persistent browser state |
| Unauthorized access | High | Per-user credential isolation; audit logging |
| Prompt injection | Medium | Input validation; structured tool parameters |
| Denial of service | Medium | Rate limiting; request queuing |

### Encryption at Rest

```typescript
// Credential encryption flow
User Credentials → AES-256-GCM → Encrypted Blob → Secure Storage
                       ↑
                  DATS_ENCRYPTION_KEY (env var)
                       ↑
                  Key derivation from user-specific salt
```

### Audit Logging

```typescript
interface AuditLog {
  timestamp: string;      // ISO 8601
  user_id: string;        // Hashed identifier
  action: AuditAction;    // 'credential_access' | 'booking_created' | 'booking_cancelled'
  resource?: string;      // Non-PII identifier (e.g., confirmation number)
  ip_address?: string;    // For web interface only
  result: 'success' | 'failure';
  error_code?: string;    // If failure
}

// NO PII in logs:
// ❌ { user_name: "John Smith", address: "123 Main St" }
// ✅ { user_id: "hash_abc123", action: "booking_created" }
```

---

## Accessibility Architecture

### WCAG 2.2 AA Implementation

| Criterion | Implementation |
|-----------|----------------|
| 1.1.1 Non-text Content | All images have alt text; symbols have text equivalents |
| 1.3.1 Info and Relationships | Semantic HTML; proper heading hierarchy |
| 1.4.3 Contrast | Minimum 4.5:1 text; 3:1 UI components |
| 2.1.1 Keyboard | All functions keyboard accessible |
| 2.4.7 Focus Visible | Custom focus styles (2px, 3:1 contrast) |
| 2.5.5 Target Size | Minimum 44x44px for interactive elements |
| 3.3.2 Labels | All inputs have visible, associated labels |
| 4.1.2 Name, Role, Value | Proper ARIA where semantic HTML insufficient |

### Switch Scanning Support

```typescript
// hooks/useSwitchScanning.ts
export function useSwitchScanning(elements: HTMLElement[]) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scanSpeed = useUserPreference('scanSpeed', 1500); // ms
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((i) => (i + 1) % elements.length);
    }, scanSpeed);
    
    const handleSwitch = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        elements[activeIndex].click();
      }
    };
    
    window.addEventListener('keydown', handleSwitch);
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleSwitch);
    };
  }, [elements, scanSpeed]);
  
  return activeIndex;
}
```

### Symbol-Based Interface

```typescript
// components/SymbolPicker.tsx
interface SymbolPickerProps {
  category: 'destinations' | 'times' | 'actions';
  onSelect: (value: string) => void;
}

const DESTINATION_SYMBOLS = [
  { id: 'home', arasaac_id: 7748, label: 'Home' },
  { id: 'hospital', arasaac_id: 6677, label: 'Hospital' },
  { id: 'therapy', arasaac_id: 33821, label: 'Therapy' },
  { id: 'grocery', arasaac_id: 2744, label: 'Grocery Store' },
];

export function SymbolPicker({ category, onSelect }: SymbolPickerProps) {
  return (
    <div role="listbox" aria-label={`Select ${category}`}>
      {symbols.map((symbol) => (
        <button
          key={symbol.id}
          role="option"
          className="symbol-button" // min 44x44px
          onClick={() => onSelect(symbol.id)}
          aria-label={symbol.label}
        >
          <img 
            src={`/symbols/${symbol.arasaac_id}.png`} 
            alt="" // Decorative, label is on button
          />
          <span>{symbol.label}</span>
        </button>
      ))}
    </div>
  );
}
```

---

## Deployment Architecture

### Local Development (Claude Code)

```
┌─────────────────────────────────────────────┐
│  Developer Machine                          │
│  ┌─────────────────────────────────────┐   │
│  │  Claude Code                         │   │
│  │  ┌─────────────┐ ┌─────────────┐    │   │
│  │  │ DATS MCP    │ │ Calendar    │    │   │
│  │  │ (stdio)     │ │ MCP (stdio) │    │   │
│  │  └──────┬──────┘ └──────┬──────┘    │   │
│  │         │               │            │   │
│  └─────────┼───────────────┼────────────┘   │
│            │               │                │
│            ▼               ▼                │
│     DATS Portal      Graph API              │
└─────────────────────────────────────────────┘
```

### Production (Azure Canada)

```
┌─────────────────────────────────────────────────────────────────┐
│  Azure Canada Central                                           │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │  App Service    │    │  Key Vault      │                    │
│  │  (Web UI)       │    │  (Secrets)      │                    │
│  └────────┬────────┘    └────────┬────────┘                    │
│           │                      │                              │
│           ▼                      │                              │
│  ┌─────────────────────────────────────────┐                   │
│  │  Azure Container Apps                    │                   │
│  │  ┌─────────────┐  ┌─────────────┐       │                   │
│  │  │ DATS MCP    │  │ Calendar    │       │                   │
│  │  │ Server      │  │ MCP Server  │       │                   │
│  │  └─────────────┘  └─────────────┘       │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │  Azure Cosmos   │    │  Application    │                    │
│  │  (Encrypted     │    │  Insights       │                    │
│  │   Credentials)  │    │  (Audit Logs)   │                    │
│  └─────────────────┘    └─────────────────┘                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Error Handling

### Error Categories

```typescript
enum ErrorCategory {
  AUTH_FAILURE = 'auth_failure',           // DATS login failed
  SESSION_EXPIRED = 'session_expired',     // DATS session timeout
  BOOKING_CONFLICT = 'booking_conflict',   // Time slot unavailable
  VALIDATION_ERROR = 'validation_error',   // Invalid input
  NETWORK_ERROR = 'network_error',         // Connectivity issues
  RATE_LIMITED = 'rate_limited',           // Too many requests
  SYSTEM_ERROR = 'system_error',           // Unexpected failure
}

interface ToolError {
  category: ErrorCategory;
  message: string;           // User-friendly message
  recoverable: boolean;      // Can user retry?
  retry_after_ms?: number;   // If rate limited
}
```

### Retry Strategy

```typescript
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryableErrors: [
    ErrorCategory.NETWORK_ERROR,
    ErrorCategory.SESSION_EXPIRED,
  ],
};

async function withRetry<T>(
  operation: () => Promise<T>,
  config = RETRY_CONFIG
): Promise<T> {
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryable(error) || attempt === config.maxAttempts) {
        throw error;
      }
      await delay(exponentialBackoff(attempt, config));
    }
  }
}
```

---

## Testing Strategy

| Layer | Tool | Coverage Target |
|-------|------|-----------------|
| Unit | Vitest | 80% |
| Integration | Vitest + MSW | 70% |
| E2E | Playwright | Critical paths |
| Accessibility | axe-core + manual | 100% WCAG 2.2 AA |
| Security | OWASP ZAP | No high/critical |

### Accessibility Testing Checklist

- [ ] Automated axe-core scan (0 violations)
- [ ] Keyboard-only navigation test
- [ ] Screen reader test (NVDA + VoiceOver)
- [ ] 200% zoom test
- [ ] High contrast mode test
- [ ] Switch scanning test (if applicable)
- [ ] Color contrast verification
