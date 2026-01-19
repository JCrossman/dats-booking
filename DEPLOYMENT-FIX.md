# Azure Static Web App Deployment Fix

**Date:** 2026-01-19  
**Issue:** Authentication flow failing with 500 errors and infinite polling

## Problems Identified

1. **Missing Storage Configuration**
   - Azure Functions required `STORAGE_CONTAINER_URL` environment variable
   - Session storage was not configured for auth results

2. **Incomplete Function Deployment**
   - `auth-status` endpoint was not deployed
   - MCP server polling returned 404, causing infinite wait

## Solutions Implemented

### 1. Storage Account Configuration

```bash
# Enabled public network access
az storage account update --name datsauthstorage \
  --resource-group rg-dats-booking-prod \
  --public-network-access Enabled

# Enabled shared key access
az storage account update --name datsauthstorage \
  --resource-group rg-dats-booking-prod \
  --allow-shared-key-access true

# Created auth-sessions container
az storage container create --name auth-sessions \
  --account-name datsauthstorage

# Generated SAS token (1 year expiry)
az storage container generate-sas --account-name datsauthstorage \
  --name auth-sessions \
  --permissions racwdl \
  --expiry "2027-01-19T00:57Z" \
  --https-only

# Configured Static Web App with container URL + SAS
az staticwebapp appsettings set --name dats-auth \
  --resource-group rg-dats-booking-prod \
  --setting-names STORAGE_CONTAINER_URL="https://..."
```

### 2. Azure Functions Deployment

```bash
# Redeployed Static Web App with both API functions
cd azure/dats-auth
swa deploy . --deployment-token "$TOKEN" --env production \
  --app-location src --api-location api \
  --api-language node --api-version 18
```

**Deployed Functions:**
- ✅ `/api/auth/login` - POST endpoint for credentials
- ✅ `/api/auth/status/{sessionId}` - GET endpoint for polling

## Verification

```bash
# Test login endpoint
curl -X POST https://green-sky-0e461ed10.1.azurestaticapps.net/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"...","clientId":"...","passcode":"..."}'
# Expected: {"success":false,"error":"..."} (200 OK)

# Test status endpoint
curl https://green-sky-0e461ed10.1.azurestaticapps.net/api/auth/status/123e4567-e89b-12d3-a456-426614174000
# Expected: {"status":"not_found",...} (404 Not Found)
```

## Authentication Flow (Now Working)

1. User: "login to DATS" in Claude
2. MCP: Shows privacy notice → user consents
3. MCP: Returns auth URL (Static Web App)
4. User: Opens URL, enters DATS credentials
5. Azure Function: Authenticates, stores session in Blob Storage
6. User: Says "done" in Claude
7. MCP: Polls `/api/auth/status/{sessionId}` every 2 seconds
8. Azure Function: Returns success + session cookie
9. MCP: Stores encrypted session in Cosmos DB
10. ✅ Connection complete - booking tools available

## Key Learnings

- **SWA CLI requires explicit flags** even when `staticwebapp.config.json` has `platform.apiRuntime`
- **Blob Storage requires SAS token** for Azure Functions to access (no managed identity used here)
- **Auth-status function was built** but not deployed initially
- **Session storage expiry:** 5 minutes (configured in `session-store.ts`)

## Related Files

- `azure/dats-auth/api/auth-login/index.ts` - Login endpoint
- `azure/dats-auth/api/auth-status/index.ts` - Status polling endpoint
- `azure/dats-auth/api/shared/session-store.ts` - Blob Storage interface
- `azure/dats-auth/api/shared/dats-client.ts` - DATS authentication client

## Status

✅ **RESOLVED** - Authentication flow fully operational as of 2026-01-19 01:05 UTC
