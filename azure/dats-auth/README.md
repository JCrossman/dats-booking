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

Azure Static Web Apps managed functions need an Azure Storage account to persist sessions across serverless instances.

**Option A: Create a new storage account**
```bash
# Create resource group (if not exists)
az group create --name rg-dats-booking --location canadacentral

# Create storage account
az storage account create \
  --name datsbookingstorage \
  --resource-group rg-dats-booking \
  --location canadacentral \
  --sku Standard_LRS

# Get connection string
az storage account show-connection-string \
  --name datsbookingstorage \
  --resource-group rg-dats-booking \
  --query connectionString -o tsv
```

**Option B: Use existing storage account**
Get the connection string from Azure Portal or CLI.

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
   - Name: `AzureWebJobsStorage`
   - Value: (your storage account connection string)

Or via CLI:
```bash
az staticwebapp appsettings set \
  --name <your-static-web-app-name> \
  --resource-group rg-dats-booking \
  --setting-names "AzureWebJobsStorage=<your-connection-string>"
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
