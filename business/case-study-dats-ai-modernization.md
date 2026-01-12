# Modernizing Legacy Government Services with AI: The DATS Accessible Booking Assistant

*A Case Study in Accessibility-First Design and Secure AI Integration*

---

## Executive Summary

The City of Edmonton's Disabled Adult Transit Service (DATS) provides essential transportation for adults with disabilities. While the underlying booking system (Trapeze PASS) serves its purpose, the web interface presents significant barriers for the very population it's designed to serve—people with cognitive disabilities, motor impairments, and those who rely on assistive technology.

We built the **DATS Accessible Booking Assistant**, an MCP (Model Context Protocol) server that enables natural language booking through AI assistants like Claude. Users can now say "Book me a ride to the hospital tomorrow at 2pm" instead of navigating complex web forms.

**Key Results:**
- **26x faster** than browser automation (~750ms vs ~20 seconds)
- **Zero credential exposure** to AI systems
- **~$0.01/month** hosting cost
- **WCAG 2.2 AA compliant** authentication interface
- **Grade 6 reading level** for all system responses

---

## The Problem

### Legacy System Barriers

Edmonton's DATS serves thousands of adults with disabilities, but the booking process requires:
- Navigating multi-step web forms
- Remembering client IDs and passcodes
- Understanding transportation jargon
- Precise motor control for dropdown menus and date pickers

For users with cognitive disabilities, motor impairments, or those using AAC (Augmentative and Alternative Communication) devices, these barriers can make independent booking impossible.

### The Traditional AI Integration Approach (and Why We Rejected It)

The obvious solution—browser automation with tools like Playwright—would let an AI "click through" the existing interface. We prototyped this and found:

| Metric | Browser Automation |
|--------|-------------------|
| Login time | 10-15 seconds |
| Booking time | 15-20 seconds |
| Reliability | Flaky (UI changes break scripts) |
| Security | Must store credentials to replay login |

Storing credentials to enable automation directly contradicts our privacy requirements under Alberta's POPA (Personal Information Protection Act).

---

## Our Solution: Direct API + Secure Web Authentication

### Architecture Overview

```
User → "Book a ride to the hospital tomorrow at 2pm"
         ↓
    Claude Desktop (AI)
         ↓
    MCP Server (local)
         ↓ SOAP/XML
    DATS API (Trapeze PASS)
         ↓
    Booking Confirmed (~750ms total)
```

### Key Innovation #1: Direct SOAP API Integration

Instead of automating the browser, we reverse-engineered the underlying SOAP/XML API (Trapeze PASS) and call it directly.

**Performance Comparison:**

| Operation | Browser Automation | Direct API | Improvement |
|-----------|-------------------|------------|-------------|
| Login | 10-15 seconds | 650ms | 16-23x |
| Get trips | 5-10 seconds | 104ms | 50-100x |
| **Full booking** | **20+ seconds** | **~750ms** | **26x** |

For users experiencing motor fatigue, reducing a 20-second interaction to under 1 second dramatically improves usability.

### Key Innovation #2: Web-Based Authentication

**The Security Problem:** AI assistants shouldn't know user passwords. If credentials appear in a conversation, they're stored in logs, potentially transmitted to AI provider servers, and visible to anyone with access to the conversation history.

**Our Solution:** A dedicated Azure-hosted login page where credentials are entered directly in the browser—never passing through the AI.

```
1. User says "Connect my DATS account" to Claude
2. Browser opens to our Azure-hosted login page
3. User enters credentials in the browser (not in Claude)
4. Azure Function authenticates with DATS, receives session cookie
5. MCP server polls Azure, retrieves session cookie
6. Session cookie stored locally, encrypted with AES-256-GCM
7. Credentials are immediately discarded—never stored
```

**Privacy Guarantees:**
- Credentials never appear in Claude conversation history
- Credentials never touch Anthropic's servers
- Only temporary session cookies are stored (encrypted)
- Sessions expire when DATS invalidates them (typically daily)

---

## Technical Implementation

### MCP Protocol: The Integration Standard

MCP (Model Context Protocol) is Anthropic's open standard for connecting AI assistants to external tools. It provides:
- **Standardized interface**: Works with Claude Desktop, Copilot, custom clients
- **Type safety**: JSON Schema validation for all inputs/outputs
- **Local execution**: Tools run on the user's machine, not in the cloud
- **Minimal footprint**: Simple JSON-RPC over stdio

### The 9 Tools We Built

| Tool | Description |
|------|-------------|
| `connect_account` | Opens secure browser login |
| `disconnect_account` | Clears local session |
| `book_trip` | Creates a new DATS booking |
| `get_trips` | Retrieves upcoming trips |
| `cancel_trip` | Cancels existing booking |
| `check_availability` | Queries available dates/times |
| `get_announcements` | System notices from DATS |
| `get_profile` | User profile and saved locations |
| `get_info` | Fares, service info, privacy policy |

### Booking Flow (3-Step SOAP API)

```
1. PassCreateTrip    → Create draft with addresses, time, passengers
2. PassScheduleTrip  → Get available time slots from DATS
3. PassSaveSolution  → Confirm the booking
```

Addresses are geocoded via OpenStreetMap Nominatim API before being sent to DATS.

### Security Implementation

**Encryption:** AES-256-GCM (NIST-approved, authenticated encryption)
**Key Management:** Auto-generated, stored locally at `~/.dats-booking/.key`
**Session Storage:** Encrypted at `~/.dats-booking/session.enc`
**Data Residency:** Azure Canada Central (POPA compliant)

---

## Accessibility Design

### Plain Language (Grade 6 Reading Level)

All system responses target Grade 6 reading level:

**Before:** "Your PassCreateTrip request has been successfully processed and queued for scheduling."

**After:** "Got it! Let me find available times for your trip."

### Screen Reader Optimization

Trip formatting optimized for accessibility:

```
Sunday, January 12

7:50-8:20 AM: Home to McNally High School [#18789348]
2:30-3:00 PM: McNally High School to Home [#18789352]
```

- Groups trips by date with day of week
- Uses "to" instead of arrows
- Confirmation number at end in brackets
- Logical reading order

### WCAG 2.2 AA Compliance

The Azure-hosted login page meets WCAG 2.2 AA:
- Proper heading hierarchy
- Form labels associated with inputs
- Sufficient color contrast
- Focus indicators visible
- Error messages announced to screen readers

---

## Cost Analysis

| Component | Tier | Monthly Cost |
|-----------|------|--------------|
| Azure Static Web Apps | Free | $0.00 |
| Azure Blob Storage | Standard | ~$0.01 |
| Azure Functions | Included with SWA | $0.00 |
| **Total** | | **~$0.01/month** |

The entire cloud infrastructure costs about one cent per month—less than a single printed form.

---

## Replicability: A Pattern for Government AI Modernization

### The Pattern

This project demonstrates a replicable pattern for modernizing legacy government services:

1. **Find the API**: Most legacy systems have SOAP/REST APIs behind their web interfaces
2. **Build an MCP server**: Expose the API as AI-friendly tools
3. **Implement secure auth**: Web-based authentication keeps credentials out of AI systems
4. **Design for accessibility**: Plain language, screen reader optimization, cognitive load reduction
5. **Deploy to regional cloud**: Meet data residency requirements (POPA, FOIPPA, etc.)

### Applicable Services

This pattern could modernize:

| Service | Legacy Interface | AI-Enabled Alternative |
|---------|-----------------|----------------------|
| Paratransit booking | Complex web forms | "Book me a ride to dialysis on Tuesday" |
| Permit applications | Multi-page PDFs | "Apply for a building permit for my deck" |
| Benefits enrollment | Dense eligibility questionnaires | "Am I eligible for AISH?" |
| Library services | Catalog search + hold systems | "Find me books about gardening" |
| Recreation registration | Session-based enrollment | "Sign my kids up for swimming lessons" |

### Why MCP?

MCP is becoming the standard for AI tool integration:
- **Open protocol**: Not locked to any AI provider
- **Local-first**: Tools run on user's machine, respecting privacy
- **Multi-client**: Works with Claude Desktop, Copilot, custom UIs
- **Extensible**: HTTP/SSE transport available for web deployments

---

## Lessons Learned

### 1. Direct API beats browser automation

For every legacy system we've examined, there's an API behind the UI. Finding and using it directly provides 10-100x performance improvements and eliminates UI fragility.

### 2. Web-based auth solves the credential problem

Credentials don't belong in AI conversations. A dedicated auth page (even a simple one) keeps secrets out of logs and conversation history.

### 3. Accessibility drives better architecture

Designing for screen readers and cognitive accessibility forced us to simplify response formatting—which improved the experience for all users.

### 4. Azure Static Web Apps are underrated

Free tier, built-in HTTPS, serverless functions, regional deployment, GitHub Actions integration—all for ~$0.01/month in storage costs.

### 5. Enterprise Azure policies require exemptions

Azure security baselines may disable shared key access on storage accounts. SWA managed functions don't support managed identity, so policy exemptions may be needed.

---

## Future Roadmap

### In Progress
- **Calendar integration**: Sync with Microsoft Outlook to check conflicts before booking
- **Trip modification**: "Change my 2pm ride to 3pm"

### Planned
- **Symbol-based interface**: ARASAAC pictograms for non-verbal users
- **Switch access**: 1-2 switch navigation for motor impairments
- **Caregiver notifications**: Email/SMS alerts for completed bookings
- **Multi-city support**: Expand to other Canadian paratransit systems

---

## Strategic Opportunity for Microsoft

This project represents a significant opportunity for Microsoft across multiple dimensions: cloud revenue, accessibility leadership, government modernization, and AI ecosystem expansion.

### Azure as the Foundation

The entire solution runs on Azure infrastructure:
- **Azure Static Web Apps** (free tier) - Hosts the accessible login interface
- **Azure Functions** (managed) - Handles authentication flow
- **Azure Blob Storage** - Session persistence
- **Azure Canada Central** - POPA-compliant data residency

This demonstrates that Azure can power sophisticated AI-enabled accessibility solutions at near-zero cost (~$0.01/month), making it attractive for budget-conscious government agencies.

### M365 Copilot Integration Path

The MCP protocol we built on is compatible with Microsoft Copilot. This creates a direct path to:

1. **Copilot Plugin/Agent**: Expose DATS booking as a Microsoft 365 Copilot skill
   - "Hey Copilot, book me a DATS ride to my doctor appointment on Tuesday"
   - Copilot checks Outlook calendar, finds the appointment, books the ride

2. **Teams Integration**: Caregiver notifications and booking confirmations via Teams
   - "Your client John's ride to the hospital has been confirmed for 2:30 PM"

3. **Outlook Calendar Sync**: Already on our roadmap
   - Automatic conflict detection before booking
   - Trip reminders synced to user's calendar
   - OAuth 2.1 + PKCE authentication with Microsoft Graph

### Government Cloud Opportunity

The pattern we've developed is directly applicable to government agencies using:
- **Azure Government** (US FedRAMP compliance)
- **Azure Canada** (POPA, FOIPPA compliance)
- **Azure for Government** programs worldwide

**Addressable market**: Every municipal paratransit system, benefits enrollment portal, permit application system, and citizen service interface could be modernized using this pattern—all running on Azure.

### Accessibility Leadership Alignment

Microsoft has made significant investments in accessibility:
- **Microsoft Accessibility** initiative
- **Inclusive Design** principles
- **AI for Accessibility** grants
- **Seeing AI**, **Immersive Reader**, and other accessibility products

This project directly aligns with Microsoft's stated mission to empower every person. It demonstrates that AI can reduce barriers for people with disabilities rather than creating new ones.

### Partner Ecosystem Opportunity

This solution could become:

1. **Solution Accelerator**: A reference architecture for government AI modernization
   - Template code for MCP + Azure + secure auth
   - Deployment scripts for Azure Government regions
   - Accessibility testing frameworks

2. **ISV Partner Solution**: Licensed to municipalities and transit agencies
   - Microsoft could support through ISV programs
   - Azure consumption revenue from deployments

3. **Consulting Practice Catalyst**: For Microsoft partners (Avanade, Accenture, etc.)
   - Replicable engagement model for legacy modernization
   - Accessibility expertise development

### Power Platform Extension

The solution could be exposed through Power Platform:

- **Power Automate Connector**: Enable citizen developers to build accessible workflows
- **Power Apps Integration**: Embed booking in custom accessibility portals
- **Dataverse Storage**: Audit trails and analytics for compliance

### Competitive Differentiation

While other cloud providers offer AI services, this project demonstrates Azure's unique advantages:

| Capability | Azure Advantage |
|-----------|----------------|
| Regional data residency | Canada Central, Government regions |
| Free tier static hosting | Static Web Apps (competitors charge) |
| Managed serverless | Functions included with SWA |
| Enterprise security | Built-in DDoS, HTTPS, WAF |
| Accessibility tools | Immersive Reader integration potential |
| Government compliance | FedRAMP, POPA, FOIPPA ready |

### Revenue Opportunity

**Direct Azure revenue** (per deployment):
- Storage: ~$0.01/month baseline
- As usage scales: $5-50/month per agency
- Enterprise features (Key Vault, managed identity): $50-200/month

**Indirect revenue**:
- M365 licenses for government workers using Copilot integration
- Azure Government subscriptions for compliant deployments
- Partner services for implementation and support

**Market size**: Thousands of government agencies across Canada and the US operate legacy citizen service systems that could benefit from AI modernization. Even at $50/month average, 1,000 deployments = $600K ARR in Azure consumption.

### Recommended Microsoft Actions

1. **Feature this as an Azure accessibility case study** - Demonstrates AI for Good + Azure + Government
2. **Include in M365 Copilot extensibility examples** - Shows practical Copilot + MCP integration
3. **Add to Azure Government reference architectures** - Template for compliant AI modernization
4. **Explore AI for Accessibility grant** - Fund expansion to other paratransit systems
5. **Connect with Canadian government cloud team** - This is a Canadian-built solution on Azure Canada

---

## Conclusion

The DATS Accessible Booking Assistant demonstrates that AI can make government services more accessible, not less. By combining direct API integration with secure web authentication and accessibility-first design, we achieved:

- **26x faster** performance than browser automation
- **Zero credential exposure** to AI systems
- **Grade 6 reading level** plain language responses
- **~$0.01/month** hosting costs
- **Full POPA compliance** for Alberta data residency

This isn't just a proof of concept—it's a production system serving real users with real disabilities. The patterns we developed are replicable across government services, offering a path to AI modernization that respects privacy, prioritizes accessibility, and costs almost nothing to operate.

---

## Contact & Resources

**Repository:** [Available on request]
**Technology Stack:** TypeScript, Node.js, Azure Static Web Apps, MCP Protocol
**AI Compatibility:** Claude Desktop, GitHub Copilot, custom MCP clients
**Compliance:** WCAG 2.2 AA, POPA (Alberta), Canadian data residency

---

*This case study was prepared for sharing with government agencies, Microsoft partners, and accessibility advocates interested in AI modernization of legacy services.*
