# DATS Accessible Booking Assistant - Roadmap

This document tracks planned features and improvements. Items are derived from [PRD.md](PRD.md).

---

## Completed (v1.0.0)

- [x] Direct SOAP API integration (Trapeze PASS)
- [x] MCP server with 9 tools:
  - `connect_account` - Secure web-based authentication
  - `disconnect_account` - Log out and clear session
  - `book_trip` - Create DATS bookings
  - `get_trips` - View upcoming trips
  - `cancel_trip` - Cancel bookings
  - `check_availability` - Query available dates/times
  - `get_announcements` - System notices
  - `get_profile` - User profile and saved locations
  - `get_info` - Fares, privacy policy, service info
- [x] **Secure web-based authentication** (credentials never touch Claude)
  - Azure Static Web App (Canada Central)
  - Browser-based credential entry
  - Session cookie polling
  - Encrypted local session storage (AES-256-GCM)
- [x] Address geocoding via OpenStreetMap Nominatim
- [x] Claude Desktop integration
- [x] No PII in logs (NFR-2.5)
- [x] Booking window validation (3 days ahead, noon cutoff, same-day with 2-hour notice)
- [x] Cancellation validation (2-hour notice)
- [x] Accessible trip formatting (WCAG 2.2 AA)
- [x] Plain language responses (Grade 6 reading level)
- [x] 88 passing tests

---

## In Progress

*No items currently in progress*

---

## Next Up (P1 Priority)

| PRD Ref | Feature | Description |
|---------|---------|-------------|
| FR-3.1-3.4 | Calendar Integration | Sync DATS bookings with Microsoft Outlook via Graph API (OAuth 2.1 + PKCE) |
| FR-3.3 | Conflict Detection | Check calendar before suggesting booking times |
| FR-2.4 | Trip Modification | Support "change to 2pm" style modifications |
| NFR-2.4 | Audit Logging | Log access and modifications (no PII) for POPA compliance |
| NFR-2.7 | Data Deletion | Capability to delete user data within 30 days (POPA) |
| NFR-2.6 | Consent Collection | Explicit consent prompt before storing session |

---

## Future (P2 Priority)

| PRD Ref | Feature | Description | Notes |
|---------|---------|-------------|-------|
| FR-4.6 | HTTP/SSE Transport | Support remote MCP clients over HTTP | Enables web-based clients |
| FR-3.5 | Shared Calendars | Support caregiver access to shared calendars | |
| - | M365 Copilot Integration | Expose DATS booking as M365 Copilot plugin | Requires REST API + OpenAPI spec |
| FR-5.1 | Symbol-based UI | ARASAAC symbol selection for non-verbal users | Custom web UI needed |
| FR-5.2 | Large Button UI | 44px+ touch targets for motor impairments | Custom web UI needed |
| FR-5.3 | Switch Scanning | 1-2 switch navigation with configurable timing | Custom web UI needed |
| FR-5.4 | Text-to-Speech | Audio confirmation of all booking actions | |
| US-2.3 | Caregiver Notifications | Email/SMS alerts when trips booked/cancelled | |
| - | Recurring Bookings | Auto-book regular trips (e.g., weekly dialysis) | May require DATS approval |
| - | Multi-city Support | Extend to other Canadian paratransit systems | Different APIs per city |

---

## Under Consideration

| Idea | Status | Notes |
|------|--------|-------|
| Mobile Native App | Deferred | Web-responsive approach preferred for v1 |
| Real-time Vehicle Tracking | Blocked | Requires DATS API access we don't have |
| Payment Processing | Out of scope | DATS handles billing separately |
| Health Records Integration | Out of scope | Privacy/compliance complexity |

---

## AI Client Compatibility

| Client | Status | Notes |
|--------|--------|-------|
| Claude Desktop | ✅ Working | Native MCP support (stdio) |
| GitHub Copilot Chat (VS Code) | ✅ Working | Experimental MCP support |
| M365 Copilot | Planned | Requires plugin conversion (see Future) |
| Custom Web UI | Planned | For symbol-based/switch access interface (requires HTTP/SSE) |

---

## NFR Status

| Requirement | Status | Notes |
|-------------|--------|-------|
| NFR-1.1 Booking < 30s | ✅ Achieved | ~2s with direct API |
| NFR-1.2 Trip list < 10s | ✅ Achieved | ~750ms with direct API |
| NFR-2.1 AES-256 encryption | ✅ Done | Session cookies encrypted |
| NFR-2.2 TLS 1.2+ | ✅ Done | DATS API uses HTTPS |
| NFR-2.3 Canadian residency | ✅ Done | Azure Canada Central + local storage |
| NFR-2.4 Audit logging | Planned | |
| NFR-2.5 No PII in logs | ✅ Done | |
| NFR-2.6 Consent collection | Planned | |
| NFR-2.7 Data deletion | Planned | |
| NFR-4.1-4.5 WCAG 2.2 AA | Partial | Auth page compliant; MCP output accessible |

---

*Last updated: January 11, 2026 (v1.0.0)*
