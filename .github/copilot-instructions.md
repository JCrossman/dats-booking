# Copilot Instructions

This file provides guidance to GitHub Copilot when working with code in this repository.

## Project Overview

MCP-based accessible booking assistant for Edmonton's Disabled Adult Transit Service (DATS). Enables natural language booking via Claude/Copilot clients, with accessibility-first design for users with disabilities.

**Architecture:** SOAP/XML API (Trapeze PASS) with direct API calls (~2 seconds vs ~30 seconds for browser automation).

---

## ⚠️ CRITICAL: Passthrough Principle

**THIS IS A PASSTHROUGH MCP SERVER - NO BUSINESS LOGIC OR INFERENCE ALLOWED**

The DATS Booking MCP server is a **simple passthrough** to the DATS SOAP API. Its ONLY job is to:
1. Accept requests from clients
2. Call the DATS API
3. Format the response for display
4. Return the data to clients

### ✅ DO:
- Trust the DATS API completely for all data
- Format data for display (e.g., "20260113" → "Mon, Jan 13, 2026")
- Validate user input before sending to DATS API
- Handle errors and present them clearly

### ❌ DO NOT:
- Infer or calculate trip status based on dates/times
- Add business logic to "improve" or "correct" DATS data
- Perform timezone conversions (DATS returns Edmonton/MST times)
- Second-guess the DATS API

**The DATS API is the source of truth. We're just the messenger.**

---

## Security-First Architecture

**Architectural security is of the utmost importance.**

1. **Private by Default**: All internal Azure services use private networking (VNet, Private Endpoints)
2. **Least Privilege**: Use managed identities with minimal permissions
3. **Defense in Depth**: Layer security controls
4. **Data Residency**: All data must remain in Canada (Canada Central) for POPA compliance
5. **No Security Shortcuts**: Never bypass security controls for convenience

---

## Timezone Handling

**All DATS operations occur in Edmonton timezone (America/Edmonton = MST/MDT).**

- DATS returns all dates/times in Edmonton local time
- Do NOT convert timezones - data is already correct
- Include `dateContext` in tool responses for timezone clarity

---

## Code Standards

- TypeScript strict mode - no `any` types
- Functions under 50 lines
- JSDoc comments on public APIs
- Unit tests for business logic
- Integration tests for MCP tools

---

## Key Documentation

- `COPILOT.md` - Full project guidance (detailed version of this file)
- `AGENTS.md` - Multi-agent review framework with specialized personas
- `ARCHITECTURE.md` - System design and component diagrams
- `PRD.md` - Product requirements
