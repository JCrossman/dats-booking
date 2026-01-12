# DATS Auth Service

Azure Static Web App that handles DATS authentication securely. Credentials are entered in a browser (not in Claude chat) and never stored.

## Architecture

```
User → Browser (accessible auth page) → Azure Functions → DATS API
                                              ↓
                                        Session Cookie
                                              ↓
                                        MCP Server (polls)
```

## Deployment

### Prerequisites

1. Azure CLI installed and logged in
2. An Azure Storage Account (for session persistence)

### Step 1: Configure Azure Storage

Azure Static Web Apps managed functions need an Azure Storage account to persist sessions across serverless instances. The session store uses SAS tokens for authentication.

**Create a storage account:**
```bash
# Create resource group (if not exists)
az group create --name rg-dats-booking --location canadacentral

# Create storage account (shared key access must be enabled for SAS tokens)
az storage account create \
  --name datsauthstorage \
  --resource-group rg-dats-booking \
  --location canadacentral \
  --sku Standard_LRS \
  --allow-shared-key-access true

# Create the auth-sessions container
az storage container create \
  --name auth-sessions \
  --account-name datsauthstorage

# Generate a SAS URL for the container (valid for 1 year)
az storage container generate-sas \
  --name auth-sessions \
  --account-name datsauthstorage \
  --permissions rwdl \
  --expiry $(date -u -v+1y +"%Y-%m-%dT%H:%MZ") \
  --https-only \
  --output tsv
```

The SAS URL will be: `https://datsauthstorage.blob.core.windows.net/auth-sessions?<SAS-token>`

**Important:** Azure Static Web Apps managed functions do NOT support managed identity. You must use SAS tokens, which require shared key access to be enabled on the storage account.

### Step 2: Deploy Static Web App

**Option A: Azure CLI**
```bash
cd azure/dats-auth

# Deploy using SWA CLI
npm install -g @azure/static-web-apps-cli
swa deploy ./src --api-location ./api
```

**Option B: GitHub Actions**
Push to a connected repository - deployment happens automatically.

**Option C: Azure Portal**
1. Create a Static Web App in Azure Portal
2. Point it to this directory structure
3. Configure build settings:
   - App location: `azure/dats-auth/src`
   - API location: `azure/dats-auth/api`
   - Output location: (leave blank)

### Step 3: Configure Application Settings

In Azure Portal:
1. Go to your Static Web App
2. Settings → Configuration
3. Add application setting:
   - Name: `STORAGE_CONTAINER_URL`
   - Value: (your SAS URL from Step 1)

Or via CLI:
```bash
az staticwebapp appsettings set \
  --name <your-static-web-app-name> \
  --resource-group rg-dats-booking-prod \
  --setting-names "STORAGE_CONTAINER_URL=https://datsauthstorage.blob.core.windows.net/auth-sessions?<SAS-token>"
```

### Step 4: Update MCP Server

Update the MCP server's `DATS_AUTH_URL` environment variable to point to your deployed Static Web App URL.

## Local Development

```bash
cd azure/dats-auth

# Install API dependencies
cd api && npm install && cd ..

# Build API
cd api && npm run build && cd ..

# Run with SWA CLI
swa start ./src --api-location ./api

# Or use Azure Functions Core Tools
cd api && func start
```

Note: For local development, you'll need to set `AzureWebJobsStorage` in `api/local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true"
  }
}
```

You can use [Azurite](https://github.com/Azure/Azurite) for local storage emulation.

## Security

- Credentials are NEVER stored - only used immediately to authenticate
- Session data is stored in Azure Blob Storage with 5-minute expiration
- Sessions are one-time use (deleted after retrieval)
- All communications over HTTPS

## Azure Policy Considerations

If your Azure subscription has security policies that disable shared key access on storage accounts (e.g., Azure Security Baseline, MCAPSGov), you'll need to create a policy exemption.

**Why this is needed:** Azure Static Web Apps managed functions do not support managed identity. The only way to authenticate to blob storage is via SAS tokens, which require shared key access.

**Symptoms of this issue:**
- Login returns "Something went wrong. Please try again."
- API returns 500 errors
- Error in logs: `KeyBasedAuthenticationNotPermitted`

**Create a policy exemption:**
```bash
# Find the policy assignment blocking shared key access
az policy assignment list \
  --scope "/providers/Microsoft.Management/managementGroups/<your-management-group>" \
  --query "[?contains(displayName, 'Deploy') || contains(displayName, 'Modify')].{name:name, displayName:displayName}" \
  --output table

# Create exemption for your storage account
az policy exemption create \
  --name "dats-auth-swa-storage" \
  --policy-assignment "/providers/Microsoft.Management/managementGroups/<your-mg>/providers/Microsoft.Authorization/policyAssignments/<policy-name>" \
  --scope "/subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.Storage/storageAccounts/<storage-account>" \
  --exemption-category "Waiver" \
  --description "Azure Static Web Apps managed functions do not support managed identity. Shared key access required for SAS token authentication."

# Then enable shared key access
az storage account update \
  --name <storage-account> \
  --resource-group <rg> \
  --allow-shared-key-access true
```

**Note:** Policy exemptions are a legitimate Azure feature for cases where blanket policies don't fit specific use cases. The exemption is scoped to just this one storage account.

## Files

```
azure/dats-auth/
├── api/                    # Azure Functions (TypeScript)
│   ├── auth-login/         # POST /api/auth/login
│   ├── auth-status/        # GET /api/auth/status/{sessionId}
│   ├── shared/             # Shared code
│   │   ├── dats-client.ts  # DATS API authentication
│   │   └── session-store.ts # Azure Blob Storage session store
│   ├── dist/               # Compiled JavaScript
│   └── package.json
├── src/                    # Static Web App (HTML/CSS/JS)
│   ├── index.html          # Accessible login page
│   ├── success.html        # Success confirmation
│   ├── error.html          # Error page
│   ├── styles.css          # WCAG 2.2 AA compliant styles
│   └── app.js              # Form submission logic
├── staticwebapp.config.json # SWA configuration
└── README.md               # This file
```

## Cost

| Component | Tier | Monthly Cost |
|-----------|------|--------------|
| Azure Static Web Apps | Free | $0 |
| Azure Storage (Blob) | Standard | ~$0.01 |
| **Total** | | **~$0.01/month** |
