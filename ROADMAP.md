# DATS Accessible Booking Assistant - Roadmap

This document tracks planned features and improvements. Items are derived from [PRD.md](PRD.md).

---

## ✅ Production Release (v1.0.0) - 2026-01-16

### Infrastructure & Deployment
- [x] **CI/CD Pipeline** - GitHub Actions automated deployment
  - Automated testing on push
  - Docker image build (linux/amd64)
  - Push to Azure Container Registry
  - Deploy to Container Apps
  - Health verification
  - ~2-3 minute deployment time
- [x] **Application Insights** - Production monitoring
  - Connected to Log Analytics Workspace
  - 30-day log retention
  - Audit logging verified (no PII)
- [x] **POPA Compliance (Alberta)** - Full implementation
  - Explicit consent flow (remote mode)
  - Privacy policy deployed (WCAG 2.2 AA)
  - Enhanced audit logging (hashed session IDs)
  - Data deletion rights
  - All 6 NFR-2.x requirements met
- [x] **Environment Configuration** - Production-ready
  - `DATS_AUTH_URL` fixed (Static Web App)
  - `LOG_LEVEL=info` for production
  - Application Insights connection string
  - All health probes configured

### Development Workflow
- [x] **Automated Deployments** - Zero-touch production releases
- [x] **Documentation** - Complete operations manual
  - `DEPLOYMENT-COMPLETE.md` - Operations guide
  - `CONTRIBUTING.md` - Development workflow
  - `AZURE-ASSESSMENT.md` - Infrastructure details
  - `POPA-COMPLIANCE.md` - Privacy law compliance
- [x] **GitHub Copilot Migration** - From Claude Code
  - Renamed CLAUDE.md → COPILOT.md
  - Updated AGENTS.md for natural language invocation
  - Created `.github/copilot-instructions.md`

---

## Completed (v1.1.0)

- [x] **Remote MCP Server** (HTTP/SSE transport for Claude Mobile/Web)
  - Azure Container Apps deployment (Canada Central)
  - Cosmos DB session storage (encrypted, 24-hour TTL)
  - Streamable HTTP transport for iOS/Android/Web
  - Add as connector: `https://dats-mcp-app.whitewater-072cffec.canadacentral.azurecontainerapps.io/mcp`
- [x] **Flexible date parsing** - Server-side date calculation
  - Accepts day names ("thursday"), relative dates ("tomorrow"), and YYYY-MM-DD
  - Timezone-aware (defaults to America/Edmonton)
  - Fixes date calculation issues with Claude's UTC assumptions
- [x] **Background auth polling** - Automatic session storage
  - `connect_account` starts polling immediately when returning auth URL
  - Session stored automatically when user completes authentication
  - ~~`complete_connection`~~ **DEPRECATED 2026-01-21** (causes 3min hangs - do not use)
- [x] **Auth URL fix** for Container Apps (explicit DATS_AUTH_URL env var)

## Completed (v1.0.0)

- [x] Direct SOAP API integration (Trapeze PASS)
- [x] MCP server with 10 tools:
  - `connect_account` - Secure web-based authentication (with background polling)
  - ~~`complete_connection`~~ - **DEPRECATED 2026-01-21** (do not use)
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
- [x] 90 passing tests

---

## In Progress

### MCPB Distribution (One-Click Install)

**Status:** Deprioritized - Remote connector is now the recommended installation method.

**Completed:**
- [x] Auto-generate encryption key (no user config needed)
- [x] Create manifest.json for MCPB
- [x] Create icon (512x512 PNG)
- [x] Build working .mcpb bundle (~26MB)
- [x] Update README with user-friendly install instructions

**Known Issues:**
- [ ] Icon not displaying in Claude Desktop install preview
- [ ] "Access to everything" warning concerning for users (standard for all MCPs)
- [ ] Self-signing doesn't work (corrupts bundle)

**Recommendation:** Use the remote connector instead (no installation required):
`https://dats-mcp-app.whitewater-072cffec.canadacentral.azurecontainerapps.io/mcp`

---

## Known Limitations

### Seamless Auth Flow (Not Possible)

**Issue:** Users must say "done" after authenticating before Claude continues with their original request.

**Root cause:** MCP's request-response architecture:
- Tools return ONE response and cannot push updates to Claude
- Blocking until auth completes causes the app to hang (user never sees auth URL)
- Server cannot notify Claude when authentication completes

**Current workaround:** Background polling stores the session automatically. User just needs to say "done" or "connected" after authenticating, and Claude will retry their original request.

**Would require:** Streaming tool responses or server-push notifications (not in MCP spec)

---

## Next Up (P1 Priority)

**Note:** All new features must follow the established CI/CD workflow:
1. Develop locally with tests
2. Update documentation (CHANGELOG.md, STATUS.md)
3. Push to `main` → Automatic deployment
4. Maintain POPA compliance (see CONTRIBUTING.md)

| PRD Ref | Feature | Description |
|---------|---------|-------------|
| FR-3.1-3.4 | Calendar Integration | Sync DATS bookings with Microsoft Outlook via Graph API (OAuth 2.1 + PKCE) |
| FR-3.3 | Conflict Detection | Check calendar before suggesting booking times |
| FR-2.4 | Trip Modification | Support "change to 2pm" style modifications |

**Completed P1 Items (2026-01-16):**
- ~~NFR-2.4~~ ✅ Audit Logging (implemented with hashed session IDs)
- ~~NFR-2.7~~ ✅ Data Deletion (24hr TTL + manual delete)
- ~~NFR-2.6~~ ✅ Consent Collection (explicit consent in remote mode)

---

## Future (P2 Priority)

| PRD Ref | Feature | Description | Notes |
|---------|---------|-------------|-------|
| FR-3.5 | Shared Calendars | Support caregiver access to shared calendars | |
| - | M365 Copilot Integration | Expose DATS booking as M365 Copilot plugin | Requires REST API + OpenAPI spec |
| FR-5.1 | Symbol-based UI | ARASAAC symbol selection for non-verbal users | Custom web UI needed |
| FR-5.2 | Large Button UI | 44px+ touch targets for motor impairments | Custom web UI needed |
| FR-5.3 | Switch Scanning | 1-2 switch navigation with configurable timing | Custom web UI needed |
| FR-5.4 | Text-to-Speech | Audio confirmation of all booking actions | |
| US-2.3 | Caregiver Notifications | Email/SMS alerts when trips booked/cancelled | |
| - | Recurring Bookings | Auto-book regular trips (e.g., weekly dialysis) | May require DATS approval |
| - | Multi-city Support | Extend to other Canadian paratransit systems | Different APIs per city |
| - | Custom Connector Icon | Custom branding for Claude connector | Waiting for MCP protocol support |

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
| Claude iOS | ✅ Working | Via remote connector (HTTP) |
| Claude Android | ✅ Working | Via remote connector (HTTP) |
| Claude Web | ✅ Working | Via remote connector (HTTP) |
| GitHub Copilot Chat (VS Code) | ✅ Working | Experimental MCP support |
| M365 Copilot | Planned | Requires plugin conversion (see Future) |
| Custom Web UI | Possible | HTTP endpoint available for custom clients |

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

*Last updated: January 13, 2026 (v1.1.1)*
