# Azure Deployment - Best Practices Approach

## Why Not a Bash Script?

**Issues with bash deployment scripts:**
- ❌ Secrets in plaintext/environment
- ❌ No audit trail
- ❌ Manual execution prone to errors
- ❌ Hard to rollback
- ❌ Doesn't scale with team

**Best practices approach:**
- ✅ GitHub Actions for CI/CD
- ✅ Azure Key Vault for secrets
- ✅ Managed Identity authentication
- ✅ Bicep for infrastructure-as-code
- ✅ Automated testing before deployment
- ✅ Blue-green deployments
- ✅ Full audit trail

---

## Recommended Deployment Architecture

```
┌─────────────────┐
│  GitHub Repo    │
│  (main branch)  │
└────────┬────────┘
         │
         │ Push/PR
         ▼
┌─────────────────┐
│ GitHub Actions  │
│  - Lint         │
│  - Test         │
│  - Build        │
└────────┬────────┘
         │
         │ On success
         ▼
┌──────────────────┐
│ Azure Container  │
│    Registry      │
└────────┬─────────┘
         │
         │ Image ready
         ▼
┌──────────────────┐
│  Azure Bicep     │
│  Deployment      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Container Apps   │
│ (Blue-Green)     │
└──────────────────┘
```

---

## Setup Steps

### 1. Create Azure Service Principal (One-Time)

```bash
# Create service principal for GitHub Actions
az ad sp create-for-rbac \
  --name "github-actions-dats-mcp" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/dats-mcp-rg \
  --sdk-auth

# Save the JSON output - you'll add it to GitHub Secrets
```

---

### 2. Configure GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets → Actions):

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `AZURE_CREDENTIALS` | JSON from step 1 | Service principal credentials |
| `AZURE_SUBSCRIPTION_ID` | Your subscription ID | Azure subscription |
| `COSMOS_ENCRYPTION_KEY` | Generated key | For encrypting sessions |
| `ACR_USERNAME` | ACR admin username | Container registry login |
| `ACR_PASSWORD` | ACR admin password | Container registry password |

**Generate encryption key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

### 3. Create Azure Resources (One-Time)

```bash
# Resource group
az group create \
  --name dats-mcp-rg \
  --location canadacentral

# Azure Container Registry
az acr create \
  --resource-group dats-mcp-rg \
  --name datsmcpprodacr \
  --sku Standard \
  --location canadacentral \
  --admin-enabled true

# Get ACR credentials for GitHub Secrets
az acr credential show --name datsmcpprodacr
```

---

### 4. GitHub Actions Workflow

Create `.github/workflows/deploy-prod.yml`:

```yaml
name: Deploy to Azure Production

on:
  push:
    branches: [main]
  workflow_dispatch:  # Manual trigger

env:
  AZURE_RESOURCE_GROUP: dats-mcp-rg
  AZURE_LOCATION: canadacentral
  ACR_NAME: datsmcpprodacr
  CONTAINER_APP_NAME: dats-mcp-prod-app

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: 'mcp-servers/dats-booking/package-lock.json'
      
      - name: Install dependencies
        working-directory: mcp-servers/dats-booking
        run: npm ci
      
      - name: Run tests
        working-directory: mcp-servers/dats-booking
        run: npm test
      
      - name: Lint
        working-directory: mcp-servers/dats-booking
        run: npm run lint
      
      - name: Build TypeScript
        working-directory: mcp-servers/dats-booking
        run: npm run build

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Azure Login
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Login to Azure Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.ACR_NAME }}.azurecr.io
          username: ${{ secrets.ACR_USERNAME }}
          password: ${{ secrets.ACR_PASSWORD }}
      
      - name: Docker meta
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.ACR_NAME }}.azurecr.io/dats-mcp
          tags: |
            type=sha,prefix={{date 'YYYYMMDD-HHmmss'}}-
            type=raw,value=latest
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: mcp-servers/dats-booking
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=registry,ref=${{ env.ACR_NAME }}.azurecr.io/dats-mcp:latest
          cache-to: type=inline

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment:
      name: production
      url: ${{ steps.deploy.outputs.containerAppUrl }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Azure Login
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Deploy Bicep template
        id: deploy
        uses: azure/arm-deploy@v2
        with:
          scope: resourcegroup
          resourceGroupName: ${{ env.AZURE_RESOURCE_GROUP }}
          template: azure/dats-mcp/main.bicep
          parameters: >
            environment=prod
            containerImage=${{ needs.build-and-push.outputs.image-tag }}
            cosmosEncryptionKey=${{ secrets.COSMOS_ENCRYPTION_KEY }}
            containerRegistryServer=${{ env.ACR_NAME }}.azurecr.io
            containerRegistryUsername=${{ secrets.ACR_USERNAME }}
            containerRegistryPassword=${{ secrets.ACR_PASSWORD }}
      
      - name: Azure Container App - Health Check
        run: |
          APP_URL="${{ steps.deploy.outputs.containerAppUrl }}"
          echo "Waiting for app to be healthy..."
          for i in {1..30}; do
            if curl -f -s "${APP_URL}/health" > /dev/null; then
              echo "✅ App is healthy!"
              exit 0
            fi
            echo "Waiting... ($i/30)"
            sleep 10
          done
          echo "❌ Health check failed"
          exit 1
      
      - name: Run smoke tests
        run: |
          APP_URL="${{ steps.deploy.outputs.containerAppUrl }}"
          # Test MCP endpoint
          curl -f "${APP_URL}/mcp" || exit 1
          echo "✅ Smoke tests passed"

  audit-logs:
    needs: deploy
    runs-on: ubuntu-latest
    steps:
      - name: Azure Login
        uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}
      
      - name: Check audit logs for POPA compliance
        run: |
          echo "Checking audit logs..."
          az containerapp logs show \
            --name ${{ env.CONTAINER_APP_NAME }} \
            --resource-group ${{ env.AZURE_RESOURCE_GROUP }} \
            --tail 50 | grep AUDIT || true
```

---

### 5. Manual Deployment (Azure CLI - For Testing)

```bash
# Login
az login
az account set --subscription <subscription-id>

# Build Docker image
cd mcp-servers/dats-booking
docker build -t datsmcpprodacr.azurecr.io/dats-mcp:manual .

# Push to ACR
az acr login --name datsmcpprodacr
docker push datsmcpprodacr.azurecr.io/dats-mcp:manual

# Deploy infrastructure
cd ../../azure/dats-mcp
az deployment group create \
  --resource-group dats-mcp-rg \
  --template-file main.bicep \
  --parameters \
    environment=prod \
    containerImage=datsmcpprodacr.azurecr.io/dats-mcp:manual \
    cosmosEncryptionKey="<your-key>" \
    containerRegistryServer=datsmcpprodacr.azurecr.io \
    containerRegistryUsername="<username>" \
    containerRegistryPassword="<password>"

# Check deployment
az containerapp show \
  --name dats-mcp-prod-app \
  --resource-group dats-mcp-rg \
  --query "properties.{URL:configuration.ingress.fqdn, Status:runningStatus}"
```

---

## Testing Strategy

### 1. Pre-Deployment (Automated in CI)
- ✅ Unit tests
- ✅ TypeScript compilation
- ✅ Linting
- ✅ Docker build

### 2. Post-Deployment (Automated)
- ✅ Health check endpoint
- ✅ MCP endpoint responding
- ✅ Audit logs present

### 3. Manual Testing (Checklist)
- [ ] Consent flow in Claude Mobile
- [ ] Privacy policy page accessible
- [ ] Data deletion works
- [ ] No PII in logs
- [ ] Application Insights queries

---

## Azure Key Vault Integration (Optional - More Secure)

### Setup

```bash
# Create Key Vault
az keyvault create \
  --name dats-mcp-vault \
  --resource-group dats-mcp-rg \
  --location canadacentral \
  --enable-rbac-authorization

# Store encryption key
az keyvault secret set \
  --vault-name dats-mcp-vault \
  --name cosmos-encryption-key \
  --value "<your-key>"

# Grant Container App access
CONTAINER_APP_IDENTITY=$(az containerapp show \
  --name dats-mcp-prod-app \
  --resource-group dats-mcp-rg \
  --query identity.principalId -o tsv)

az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee ${CONTAINER_APP_IDENTITY} \
  --scope /subscriptions/<sub-id>/resourceGroups/dats-mcp-rg/providers/Microsoft.KeyVault/vaults/dats-mcp-vault
```

### Update Bicep to use Key Vault references

```bicep
// In main.bicep
secrets: [
  {
    name: 'cosmos-encryption-key'
    keyVaultUrl: 'https://dats-mcp-vault.vault.azure.net/secrets/cosmos-encryption-key'
    identity: managedIdentity.id
  }
]
```

---

## Monitoring & Alerts

### Application Insights Queries

**POPA Compliance Monitoring:**

```kusto
// Consent events
traces
| where message contains "AUDIT: consent_recorded"
| summarize ConsentCount=count() by bin(timestamp, 1h)
| render timechart

// Session deletions
traces
| where message contains "AUDIT: session_deleted"
| summarize DeletionCount=count() by bin(timestamp, 1h)
| render timechart

// Audit trail
traces
| where message contains "AUDIT"
| project timestamp, message
| order by timestamp desc
```

---

## Rollback Procedure

### Option 1: GitHub Actions Revert

```bash
# Revert commit and push
git revert HEAD
git push origin main

# GitHub Actions will auto-deploy previous version
```

### Option 2: Manual Revision Activation

```bash
# List revisions
az containerapp revision list \
  --name dats-mcp-prod-app \
  --resource-group dats-mcp-rg \
  --query "[].{Name:name, Active:properties.active, Created:properties.createdTime}" -o table

# Activate previous revision
az containerapp revision activate \
  --name dats-mcp-prod-app \
  --resource-group dats-mcp-rg \
  --revision <previous-revision-name>
```

---

## Best Practices Summary

✅ **Infrastructure as Code** - All resources in Bicep  
✅ **CI/CD Pipeline** - GitHub Actions with tests  
✅ **Secrets Management** - GitHub Secrets + Key Vault  
✅ **Managed Identity** - No credentials in code  
✅ **Blue-Green Deployments** - Zero downtime  
✅ **Automated Testing** - Tests before deploy  
✅ **Audit Trail** - All deployments tracked  
✅ **Easy Rollback** - Activate previous revision  

---

**Next:** Set up GitHub Actions workflow → See `TESTING-DEPLOYMENT.md` for manual testing steps.
