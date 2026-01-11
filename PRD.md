# Product Requirements Document: DATS Accessible Booking Assistant

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** January 2026

---

## Executive Summary

The DATS Accessible Booking Assistant is an AI-powered tool that enables people with disabilities to book Edmonton DATS (Disabled Adult Transit Service) trips through natural language and multi-modal interfaces. The system addresses critical accessibility gaps in the current DATS online booking portal, which presents significant usability barriers for users with motor, cognitive, and communication disabilities.

---

## Problem Statement

### Current State
Edmonton DATS serves adults with disabilities who cannot use conventional public transit. The existing booking system (Trapeze PASS web portal) has several limitations:

1. **Complex UI/UX**: Multi-step booking process requires precise input timing and navigation
2. **Limited booking window**: Only 2-3 days advance booking, requiring frequent re-booking
3. **Session timeouts**: Frequent re-authentication disrupts users with motor impairments
4. **No API access**: Prevents integration with assistive technologies and AI agents
5. **Poor accessibility**: Not optimized for AAC devices, switch access, or cognitive disabilities

### User Impact
- Caregivers must repeatedly book trips on behalf of family members
- Non-verbal users cannot use voice-based alternatives
- Users with motor impairments struggle with precise clicking and timing
- Cognitive load of the interface creates barriers for users with intellectual disabilities

### Target Users
1. **Primary**: Adults with disabilities who use DATS
2. **Secondary**: Caregivers, family members, and support workers who book trips for others
3. **Tertiary**: Healthcare providers coordinating patient transportation

---

## Solution Overview

An MCP-based assistant that:
1. Accepts booking requests via natural language, symbols, or structured forms
2. Automates DATS portal interactions via Playwright
3. Syncs bookings with Microsoft Outlook calendars
4. Integrates with multiple AI clients (Claude, Copilot, custom interfaces)
5. Meets WCAG 2.2 AA accessibility standards

---

## User Stories

### Epic 1: Trip Booking

**US-1.1**: As a DATS user, I want to book a trip by describing where and when I need to go, so I don't have to navigate the complex portal interface.

**Acceptance Criteria:**
- User can specify pickup location, destination, date, and time in natural language
- System confirms booking details before submission
- System returns confirmation number and pickup window
- Booking appears in DATS system within 2 minutes

**US-1.2**: As a non-verbal user, I want to select trip options using symbols and large buttons, so I can book independently without text input.

**Acceptance Criteria:**
- Symbol-based interface for common destinations (home, hospital, therapy, grocery)
- Large touch targets (minimum 44x44px)
- Switch scanning support with adjustable timing
- Audio confirmation of selections

**US-1.3**: As a user with cognitive disabilities, I want a simplified booking flow with fewer steps, so I don't get overwhelmed or confused.

**Acceptance Criteria:**
- Maximum 3 steps to complete booking
- Clear progress indication
- Undo/back options at every step
- Plain language throughout (Grade 6 reading level)

### Epic 2: Trip Management

**US-2.1**: As a DATS user, I want to view my upcoming trips, so I can confirm my schedule.

**Acceptance Criteria:**
- List all booked trips for next 7 days
- Show pickup window, destination, confirmation number
- Accessible to screen readers with proper headings

**US-2.2**: As a DATS user, I want to cancel a trip by saying or selecting "cancel my trip tomorrow", so I don't have to navigate the portal.

**Acceptance Criteria:**
- Confirm cancellation before processing
- Verify cancellation meets 2-hour notice requirement
- Return cancellation confirmation

**US-2.3**: As a caregiver, I want to receive notifications when trips are booked or cancelled, so I can coordinate care.

**Acceptance Criteria:**
- Optional email/SMS notifications
- Configurable notification preferences
- Include trip details in notification

### Epic 3: Calendar Integration

**US-3.1**: As a user, I want my DATS trips to automatically appear in my Outlook calendar, so I don't double-book myself.

**Acceptance Criteria:**
- Calendar event created within 5 minutes of DATS booking
- Event includes pickup window, destination, confirmation number
- Event marked as "Busy" by default

**US-3.2**: As a user, I want the assistant to check my calendar before suggesting booking times, so it doesn't suggest times when I'm busy.

**Acceptance Criteria:**
- Read user's Outlook calendar (with permission)
- Warn if proposed trip conflicts with existing event
- Suggest alternative times if conflict detected

### Epic 4: Accessibility Features

**US-4.1**: As a switch user, I want to navigate the entire interface using 1-2 switches, so I can book trips independently.

**Acceptance Criteria:**
- Full keyboard navigation
- Logical focus order
- Visible focus indicators (minimum 2px, 3:1 contrast)
- Configurable switch scanning speed

**US-4.2**: As a screen reader user, I want all booking actions announced, so I know what's happening.

**Acceptance Criteria:**
- ARIA live regions for dynamic content
- Proper heading hierarchy (h1 → h2 → h3)
- Form labels associated with inputs
- Error messages announced immediately

**US-4.3**: As a user with low vision, I want to customize text size and contrast, so I can read the interface.

**Acceptance Criteria:**
- Text scalable to 200% without loss of functionality
- High contrast mode option
- No information conveyed by color alone

---

## Functional Requirements

### FR-1: DATS Portal Automation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | Authenticate to DATS portal using stored credentials | P0 |
| FR-1.2 | Create new trip booking with all required fields | P0 |
| FR-1.3 | Retrieve upcoming booked trips | P0 |
| FR-1.4 | Cancel existing trip with confirmation | P0 |
| FR-1.5 | Handle session expiration gracefully | P1 |
| FR-1.6 | Detect and report booking conflicts/errors | P1 |
| FR-1.7 | Support same-day booking (2-hour minimum notice) | P2 |

### FR-2: Natural Language Understanding

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | Parse booking requests with date/time/location | P0 |
| FR-2.2 | Handle relative dates ("tomorrow", "next Tuesday") | P0 |
| FR-2.3 | Resolve ambiguous locations with clarification | P1 |
| FR-2.4 | Support booking modifications ("change to 2pm") | P1 |
| FR-2.5 | Handle multi-turn conversations for complex requests | P1 |

### FR-3: Calendar Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Authenticate via Microsoft OAuth 2.1 + PKCE | P0 |
| FR-3.2 | Create calendar events for confirmed bookings | P0 |
| FR-3.3 | Read calendar to check for conflicts | P1 |
| FR-3.4 | Update/delete events when trips modified | P1 |
| FR-3.5 | Support shared calendars for caregivers | P2 |

### FR-4: MCP Server

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | Expose `book_trip` tool | P0 |
| FR-4.2 | Expose `get_trips` tool | P0 |
| FR-4.3 | Expose `cancel_trip` tool | P0 |
| FR-4.4 | Expose `check_availability` tool | P1 |
| FR-4.5 | Expose `sync_calendar` tool | P1 |
| FR-4.6 | Support HTTP/SSE transport for remote clients | P2 |

### FR-5: Accessibility Interface

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | Symbol-based destination selection (ARASAAC) | P1 |
| FR-5.2 | Large button booking interface (44px+ targets) | P1 |
| FR-5.3 | Switch scanning with configurable timing | P1 |
| FR-5.4 | Text-to-speech for all confirmations | P1 |
| FR-5.5 | Screen reader optimized (ARIA, semantic HTML) | P0 |

---

## Non-Functional Requirements

### NFR-1: Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1.1 | Booking confirmation time | < 30 seconds |
| NFR-1.2 | Trip list retrieval | < 10 seconds |
| NFR-1.3 | Calendar sync latency | < 5 minutes |
| NFR-1.4 | Interface responsiveness | < 100ms for user actions |

### NFR-2: Security & Privacy (POPA Compliance)

| ID | Requirement |
|----|-------------|
| NFR-2.1 | Credentials encrypted at rest (AES-256) |
| NFR-2.2 | All network traffic TLS 1.2+ |
| NFR-2.3 | Canadian data residency |
| NFR-2.4 | Audit logging (access, modifications) |
| NFR-2.5 | No PII in application logs |
| NFR-2.6 | Consent collection before credential storage |
| NFR-2.7 | Data deletion capability within 30 days |

### NFR-3: Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-3.1 | System availability | 99% uptime |
| NFR-3.2 | Graceful degradation on DATS outage | Inform user, queue request |
| NFR-3.3 | Retry failed bookings | 3 attempts with backoff |

### NFR-4: Accessibility (WCAG 2.2 AA)

| ID | Requirement |
|----|-------------|
| NFR-4.1 | All WCAG 2.2 Level A criteria |
| NFR-4.2 | All WCAG 2.2 Level AA criteria |
| NFR-4.3 | No CAPTCHA or cognitive function tests |
| NFR-4.4 | Text resize to 200% without horizontal scroll |
| NFR-4.5 | Keyboard operable (no mouse required) |

---

## Technical Constraints

1. **No DATS API**: Must use Playwright automation against web portal
2. **Rate limiting**: Minimum 3-second delay between DATS requests to avoid detection
3. **Booking window**: DATS allows 3-day advance booking maximum
4. **Cancellation policy**: 2-hour minimum notice required
5. **Authentication**: DATS uses proprietary credentials (not MyAlberta Digital ID)

---

## Out of Scope (v1.0)

- Mobile native app (web-based responsive only)
- Real-time vehicle tracking
- Payment processing
- Multi-city support (Edmonton only)
- Automated recurring bookings
- Integration with health records systems

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Booking completion rate | > 90% | Successful bookings / attempts |
| Time to book | < 2 minutes | From request to confirmation |
| Accessibility compliance | 100% | WCAG 2.2 AA automated + manual |
| User satisfaction | > 4/5 | Post-booking survey |
| Error rate | < 5% | Failed bookings / attempts |

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| DATS changes portal structure | High | Medium | Page object pattern; monitoring; rapid response plan |
| DATS blocks automation | High | Low | Rate limiting; user-agent rotation; legal defensibility under ACA |
| Credential theft | Critical | Low | Encryption; minimal retention; audit logging |
| User enters wrong destination | Medium | Medium | Confirmation step; address validation |
| Microsoft deprecates Graph API | Medium | Low | Abstraction layer; monitoring deprecation notices |

---

## Appendix A: DATS Booking Rules

- **Advance booking**: Up to 3 days, until noon day before
- **Same-day**: 2-hour minimum notice, not guaranteed
- **Pickup window**: 30 minutes (vehicle waits 5 minutes max)
- **Cancellation**: 2-hour minimum notice
- **Companions**: Must request at booking time
- **Mobility devices**: Must specify type at booking

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| AAC | Augmentative and Alternative Communication |
| DATS | Disabled Adult Transit Service (Edmonton) |
| MCP | Model Context Protocol (Anthropic) |
| POPA | Protection of Privacy Act (Alberta) |
| Switch access | Input method using 1-2 buttons for scanning navigation |
| Trapeze PASS | Paratransit scheduling software used by DATS |
