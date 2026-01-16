# Testing & Deployment Guide - POPA Compliance

**Date:** 2026-01-16  
**Purpose:** Test and deploy POPA compliance features to Azure

---

## Pre-Deployment Testing

### 1. Build & Unit Tests

```bash
cd /Users/jeremycrossman/Desktop/DATS\ Booking/mcp-servers/dats-booking

# Install dependencies (if needed)
npm install

# Build TypeScript
npm run build

# Run unit tests
npm test

# Optional: Run with coverage
npm run test:coverage
```

**Expected:** All tests pass, no build errors

---

### 2. Type Checking

```bash
# Check for TypeScript errors
npx tsc --noEmit

# Check for any 'any' types (should be minimal)
grep -r "any" src/ --include="*.ts" | grep -v "node_modules" | grep -v "test"
```

**Expected:** No TypeScript errors

---

### 3. Lint Check

```bash
# Run linter
npm run lint
```

**Expected:** No linting errors

---

## Local Testing (Optional)

### Test Local Mode (Claude Desktop)

```bash
# Start MCP server locally
npm run start

# In another terminal, test with MCP Inspector
npx @modelcontextprotocol/inspector build/index.js
```

**Manual Tests:**
1. Call `connect_account` - should show simple info message (no consent)
2. Authenticate in browser
3. Call `get_trips` - should work
4. Call `disconnect_account` - should clear session
5. Check logs for audit entries

---

## Azure Deployment

### Prerequisites

```bash
# Login to Azure
az login

# Set subscription (if multiple)
az account set --subscription "Your Subscription Name"

# Verify you're in correct subscription
az account show --query "{Name:name, ID:id, TenantID:tenantId}"
```

---

### Step 1: Create Resource Group (if needed)

```bash
# Check if resource group exists
az group show --name dats-mcp-rg

# If not, create it
az group create \
  --name dats-mcp-rg \
  --location canadacentral \
  --tags project=dats-booking environment=prod
```

---

### Step 2: Generate Encryption Key (if needed)

```bash
# Generate a secure encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Save this key securely - you'll need it for deployment
```

---

### Step 3: Build & Push Docker Image

```bash
cd /Users/jeremycrossman/Desktop/DATS\ Booking/mcp-servers/dats-booking

# Build Docker image
docker build -t dats-mcp:latest .

# Tag for Azure Container Registry (replace with your ACR name)
ACR_NAME="youracrname"
docker tag dats-mcp:latest ${ACR_NAME}.azurecr.io/dats-mcp:latest

# Login to ACR
az acr login --name ${ACR_NAME}

# Push image
docker push ${ACR_NAME}.azurecr.io/dats-mcp:latest
```

**Note:** If you don't have an ACR, create one:

```bash
az acr create \
  --resource-group dats-mcp-rg \
  --name youracrname \
  --sku Basic \
  --location canadacentral \
  --admin-enabled true
```

---

### Step 4: Deploy Infrastructure with Bicep

```bash
cd /Users/jeremycrossman/Desktop/DATS\ Booking/azure/dats-mcp

# Set variables
ACR_NAME="youracrname"
ENCRYPTION_KEY="<your-generated-key>"
CONTAINER_IMAGE="${ACR_NAME}.azurecr.io/dats-mcp:latest"

# Get ACR credentials
ACR_USERNAME=$(az acr credential show --name ${ACR_NAME} --query username -o tsv)
ACR_PASSWORD=$(az acr credential show --name ${ACR_NAME} --query passwords[0].value -o tsv)

# Deploy with Bicep
az deployment group create \
  --resource-group dats-mcp-rg \
  --template-file main.bicep \
  --parameters \
    environment=prod \
    containerImage=${CONTAINER_IMAGE} \
    cosmosEncryptionKey=${ENCRYPTION_KEY} \
    containerRegistryUsername=${ACR_USERNAME} \
    containerRegistryPassword=${ACR_PASSWORD}
```

**Expected:** Deployment succeeds, outputs Container App URL

---

### Step 5: Deploy Privacy Policy Page

```bash
cd /Users/jeremycrossman/Desktop/DATS\ Booking/azure/dats-auth

# Install Azure Static Web Apps CLI (if needed)
npm install -g @azure/static-web-apps-cli

# Build/deploy the auth site (includes privacy.html)
# Method 1: Using Azure CLI
az staticwebapp create \
  --name dats-mcp-auth \
  --resource-group dats-mcp-rg \
  --location canadacentral \
  --source https://github.com/your-org/dats-booking \
  --branch main \
  --app-location "azure/dats-auth/src" \
  --api-location "azure/dats-auth/api"

# Method 2: Manual upload to existing Static Web App
# Copy privacy.html to src/ directory (already done)
# Push to GitHub, Static Web App will auto-deploy
```

**Verify:** Visit `https://dats-mcp-auth.livelymeadow-eb849b65.canadacentral.azurecontainerapps.io/privacy.html`

---

### Step 6: Configure Environment Variables

```bash
# Get Container App name
CONTAINER_APP_NAME="dats-mcp-prod-app"

# Get DATS Auth URL
DATS_AUTH_URL="https://dats-mcp-auth.livelymeadow-eb849b65.canadacentral.azurecontainerapps.io"

# Update Container App environment variables
az containerapp update \
  --name ${CONTAINER_APP_NAME} \
  --resource-group dats-mcp-rg \
  --set-env-vars \
    DATS_AUTH_URL=${DATS_AUTH_URL} \
    LOG_LEVEL=info \
    NODE_ENV=production

# Restart to apply changes
az containerapp revision restart \
  --name ${CONTAINER_APP_NAME} \
  --resource-group dats-mcp-rg
```

---

## Post-Deployment Verification

### 1. Check Container App Health

```bash
# Get Container App status
az containerapp show \
  --name dats-mcp-prod-app \
  --resource-group dats-mcp-rg \
  --query "properties.{Status:runningStatus, URL:configuration.ingress.fqdn}"

# Check recent logs
az containerapp logs show \
  --name dats-mcp-prod-app \
  --resource-group dats-mcp-rg \
  --tail 50
```

**Expected:** Status = "Running", logs show no errors

---

### 2. Test Privacy Policy Page

```bash
# Test privacy page is accessible
curl -I https://dats-mcp-auth.livelymeadow-eb849b65.canadacentral.azurecontainerapps.io/privacy.html
```

**Expected:** HTTP 200 OK

---

### 3. Test MCP Endpoint

```bash
# Get Container App URL
CONTAINER_APP_URL=$(az containerapp show \
  --name dats-mcp-prod-app \
  --resource-group dats-mcp-rg \
  --query "properties.configuration.ingress.fqdn" -o tsv)

# Test health endpoint
curl https://${CONTAINER_APP_URL}/mcp
```

**Expected:** Returns MCP server info

---

## Manual Testing - POPA Compliance

### Test 1: Consent Flow (Claude Mobile/Web)

1. **Open Claude Mobile App**
2. **Add Connector:**
   ```
   Settings → Connectors → Add Custom Connector
   URL: https://dats-mcp-prod-app.<your-url>.canadacentral.azurecontainerapps.io/mcp
   ```

3. **Test Consent Flow:**
   - Say: "Show my DATS trips"
   - Expected: Privacy notice displayed
   - Expected: Prompt to consent
   - Say: "I consent"
   - Expected: Auth URL returned
   - Open URL in browser
   - Enter DATS credentials
   - Say: "done"
   - Expected: Original request processed

4. **Verify Audit Logs:**
   ```bash
   az containerapp logs show \
     --name dats-mcp-prod-app \
     --resource-group dats-mcp-rg \
     --tail 100 | grep AUDIT
   ```
   - Expected: See entries for:
     - `consent_prompt_shown`
     - `consent_recorded`
     - `session_stored`

---

### Test 2: Data Deletion

1. **In Claude Mobile:**
   - Say: "Disconnect my DATS account"
   - Expected: Confirmation that session was permanently deleted

2. **Verify Audit Logs:**
   ```bash
   az containerapp logs show \
     --name dats-mcp-prod-app \
     --resource-group dats-mcp-rg \
     --tail 50 | grep "session_deleted"
   ```
   - Expected: See `AUDIT: session_deleted - success [session: <hash>]`

3. **Verify Cosmos DB:**
   ```bash
   # Check session was deleted from Cosmos DB
   az cosmosdb sql container query \
     --account-name dats-mcp-prod-cosmos \
     --database-name dats-sessions \
     --name sessions \
     --query "SELECT * FROM c"
   ```
   - Expected: No matching session ID

---

### Test 3: Privacy Policy

1. **Visit:** `https://dats-mcp-auth.livelymeadow-eb849b65.canadacentral.azurecontainerapps.io/privacy.html`
2. **Verify:**
   - Page loads correctly
   - All sections present
   - Links work
   - Mobile responsive
   - WCAG contrast (use browser DevTools)

---

### Test 4: No PII in Logs

```bash
# Search logs for potential PII
az containerapp logs show \
  --name dats-mcp-prod-app \
  --resource-group dats-mcp-rg \
  --tail 500 | grep -E "(session_id|clientId|address|phone)"
```

**Expected:** 
- Session IDs only appear as hashes
- No client IDs, addresses, or phone numbers in logs
- All audit logs use hashed identifiers

---

## Monitoring Setup

### 1. Configure Alerts

```bash
# Create alert for failed authentications
az monitor metrics alert create \
  --name "DATS-Auth-Failures" \
  --resource-group dats-mcp-rg \
  --scopes /subscriptions/<sub-id>/resourceGroups/dats-mcp-rg/providers/Microsoft.App/containerApps/dats-mcp-prod-app \
  --condition "count ConsoleLogCount > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --description "Alert when authentication failures exceed threshold"
```

---

### 2. Set Up Application Insights Queries

**Consent Events:**
```kusto
traces
| where message contains "AUDIT: consent_recorded"
| project timestamp, message
| order by timestamp desc
```

**Session Deletions:**
```kusto
traces
| where message contains "AUDIT: session_deleted"
| project timestamp, message
| order by timestamp desc
```

**Failed Operations:**
```kusto
traces
| where message contains "AUDIT" and message contains "failure"
| project timestamp, message
| order by timestamp desc
```

---

## Rollback Procedure (If Issues Found)

```bash
# Get previous revision
az containerapp revision list \
  --name dats-mcp-prod-app \
  --resource-group dats-mcp-rg \
  --query "[].{Name:name, Active:properties.active, Created:properties.createdTime}" -o table

# Activate previous revision
az containerapp revision activate \
  --name dats-mcp-prod-app \
  --resource-group dats-mcp-rg \
  --revision <previous-revision-name>

# Deactivate current revision
az containerapp revision deactivate \
  --name dats-mcp-prod-app \
  --resource-group dats-mcp-rg \
  --revision <current-revision-name>
```

---

## Troubleshooting

### Issue: Container App won't start

```bash
# Check recent logs
az containerapp logs show \
  --name dats-mcp-prod-app \
  --resource-group dats-mcp-rg \
  --tail 100

# Check revision status
az containerapp revision show \
  --name dats-mcp-prod-app \
  --resource-group dats-mcp-rg \
  --revision <revision-name>
```

---

### Issue: Consent flow not working

1. Check `DATS_AUTH_URL` environment variable is set
2. Verify privacy.html is accessible
3. Check audit logs for error messages
4. Verify Cosmos DB connection

---

### Issue: Audit logs missing

1. Check Log Analytics workspace connection
2. Verify `LOG_LEVEL=info` is set
3. Check for logger initialization errors

---

## Post-Deployment Checklist

- [ ] Container App running and healthy
- [ ] Privacy policy page accessible
- [ ] MCP endpoint responding
- [ ] Consent flow tested (Claude Mobile)
- [ ] Data deletion tested
- [ ] Audit logs verified (no PII)
- [ ] Application Insights queries configured
- [ ] Alerts configured
- [ ] Documentation updated with production URLs
- [ ] Legal team notified for review (optional)

---

## Production URLs

**MCP Endpoint:**  
`https://dats-mcp-prod-app.<your-url>.canadacentral.azurecontainerapps.io/mcp`

**Privacy Policy:**  
`https://dats-mcp-auth.livelymeadow-eb849b65.canadacentral.azurecontainerapps.io/privacy.html`

**Auth Portal:**  
`https://dats-mcp-auth.livelymeadow-eb849b65.canadacentral.azurecontainerapps.io`

---

**Deployment Complete!** ✅

Next: Monitor audit logs for 24-48 hours to ensure POPA compliance is working correctly.
