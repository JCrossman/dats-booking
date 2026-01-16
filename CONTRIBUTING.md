# Contributing to DATS Booking Assistant

This document explains how to contribute to the DATS Booking Assistant project. All development follows automated CI/CD processes established on 2026-01-16.

---

## 🚀 Development Workflow

### 1. Making Changes

```bash
# 1. Create a feature branch (optional but recommended)
git checkout -b feature/your-feature-name

# 2. Make your changes in mcp-servers/dats-booking/

# 3. Run tests locally
cd mcp-servers/dats-booking
npm test
npm run build

# 4. Commit with descriptive message
git add .
git commit -m "feat: description of changes"

# 5. Push to GitHub
git push origin main  # or your branch
```

### 2. Automatic Deployment

**Pushing to `main` triggers GitHub Actions workflow:**
1. ✅ Runs tests (`npm test`)
2. ✅ Builds project (`npm run build`)
3. ✅ Builds Docker image (linux/amd64 platform)
4. ✅ Pushes to Azure Container Registry
5. ✅ Deploys to Azure Container Apps
6. ✅ Verifies health endpoint
7. ✅ Checks audit logs

**Total time:** ~2-3 minutes

### 3. Monitoring Deployment

```bash
# Watch deployment in real-time
gh run watch

# View recent deployments
gh run list --workflow="deploy-to-azure.yml"

# Check logs if deployment fails
gh run view <run-id> --log-failed
```

---

## 📁 Project Structure

```
mcp-servers/dats-booking/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── tools/                   # MCP tool implementations
│   │   ├── book-trip.ts
│   │   ├── cancel-trip.ts
│   │   ├── connect-account.ts   # ← Includes POPA consent flow
│   │   ├── disconnect-account.ts
│   │   └── ...
│   ├── api/
│   │   ├── dats-api.ts          # DATS portal API client
│   │   └── soap-client.ts       # SOAP XML generation
│   ├── auth/
│   │   ├── consent-manager.ts   # POPA consent management
│   │   └── cosmos-session-store.ts
│   ├── utils/
│   │   ├── logger.ts            # ← Enhanced audit logging (no PII)
│   │   └── ...
│   └── types.ts                 # TypeScript interfaces
├── tests/                       # 170+ comprehensive tests
└── package.json

azure/
├── dats-mcp/
│   └── main.bicep               # Infrastructure as Code
└── dats-auth/
    └── src/
        └── privacy.html         # WCAG 2.2 AA privacy policy

.github/
└── workflows/
    └── deploy-to-azure.yml      # CI/CD pipeline
```

---

## 🧪 Testing

### Run Tests Locally

```bash
cd mcp-servers/dats-booking

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode (during development)
npm run test:watch

# Type check
npm run build
```

### Test Standards
- **Unit tests** for business logic
- **Integration tests** for MCP tools
- **170+ tests** currently passing
- All tests must pass before merge

---

## 🔒 POPA Compliance Requirements

**All changes must maintain POPA (Protection of Privacy Act - Alberta) compliance.**

### Critical Rules:
1. **No PII in logs** - Session IDs must be hashed
2. **Consent required** - Remote mode needs explicit user consent
3. **Audit logging** - Log all session operations (create, access, delete)
4. **Data deletion** - Users must be able to delete their data
5. **Canadian residency** - All data stays in Azure Canada Central

### Before Modifying These Files:
- `src/auth/consent-manager.ts` - Read POPA-COMPLIANCE.md
- `src/tools/connect-account.ts` - Consent flow is mandatory
- `src/utils/logger.ts` - Never log PII (names, addresses, trip details)
- `azure/dats-auth/src/privacy.html` - Legal review required

**See:** `POPA-COMPLIANCE.md` for full details

---

## 🏗️ Infrastructure Changes

### Modifying Azure Infrastructure

**File:** `azure/dats-mcp/main.bicep`

```bash
# Test Bicep template locally
az bicep build --file azure/dats-mcp/main.bicep

# Deploy manually (if needed)
cd azure/dats-mcp
az deployment group create \
  --resource-group dats-mcp-rg \
  --template-file main.bicep \
  --parameters environment=prod

# Note: Infrastructure changes should be rare
# Most updates handled by container image deployments
```

### Environment Variables

**Set via Azure Portal or CLI:**
```bash
az containerapp update \
  --name dats-mcp-app \
  --resource-group dats-mcp-rg \
  --set-env-vars "KEY=value"
```

**Current environment variables:**
- `MCP_TRANSPORT=http`
- `COSMOS_ENDPOINT` - Cosmos DB URL
- `COSMOS_ENCRYPTION_KEY` - (secret)
- `AZURE_CLIENT_ID` - Managed identity
- `DATS_AUTH_URL=https://green-sky-0e461ed10.1.azurestaticapps.net`
- `LOG_LEVEL=info`
- `APPLICATIONINSIGHTS_CONNECTION_STRING` - (auto-set)

---

## 📊 Monitoring & Debugging

### View Application Logs

```bash
# Real-time logs
az containerapp logs show \
  --name dats-mcp-app \
  --resource-group dats-mcp-rg \
  --follow

# Last 100 lines
az containerapp logs show \
  --name dats-mcp-app \
  --resource-group dats-mcp-rg \
  --tail 100

# Filter for audit events
az containerapp logs show \
  --name dats-mcp-app \
  --resource-group dats-mcp-rg \
  --tail 500 | grep AUDIT
```

### Application Insights

```bash
# Query traces (last hour)
az monitor app-insights query \
  --app dats-mcp-prod-insights \
  --resource-group dats-mcp-rg \
  --analytics-query "traces | where timestamp > ago(1h)"

# Query exceptions
az monitor app-insights query \
  --app dats-mcp-prod-insights \
  --resource-group dats-mcp-rg \
  --analytics-query "exceptions | where timestamp > ago(1h)"
```

### Health Check

```bash
# Quick health check
curl https://dats-mcp-app.whitewater-072cffec.canadacentral.azurecontainerapps.io/health

# Expected response:
# {"status":"healthy","timestamp":"...","activeSessions":0}
```

---

## 🐛 Debugging Deployment Failures

### GitHub Actions Fails

```bash
# View failure logs
gh run list --workflow="deploy-to-azure.yml"
gh run view <run-id> --log-failed

# Common issues:
# - Tests failing → Fix tests locally first
# - Docker build failing → Check Dockerfile and dependencies
# - Azure login failing → Check AZURE_CREDENTIALS secret
# - Health check failing → Check container logs
```

### Container App Not Starting

```bash
# View container logs
az containerapp logs show \
  --name dats-mcp-app \
  --resource-group dats-mcp-rg \
  --tail 100

# Check revision status
az containerapp revision list \
  --name dats-mcp-app \
  --resource-group dats-mcp-rg \
  --output table

# Rollback to previous revision (if needed)
az containerapp revision activate \
  --name dats-mcp-app \
  --resource-group dats-mcp-rg \
  --revision <previous-revision-name>
```

---

## 📝 Code Standards

### TypeScript
- **Strict mode enabled** - No `any` types
- **Functions under 50 lines**
- **JSDoc comments** on public APIs
- **Single responsibility** per function

### Naming Conventions
- `camelCase` for functions and variables
- `PascalCase` for types and interfaces
- `UPPER_SNAKE_CASE` for constants

### Error Handling
```typescript
// Always use typed errors
try {
  await operation();
} catch (error) {
  if (error instanceof DATSAuthError) {
    // Handle auth errors
    return { success: false, error: { category: 'auth_failure', ... } };
  }
  throw error; // Re-throw unknown errors
}
```

### Passthrough Principle
**The MCP server is a passthrough - no business logic!**
- Trust DATS API for all data
- Only format for display
- Never infer, calculate, or modify data
- See `COPILOT.md` for full explanation

---

## 🔐 Security

### Secrets Management
- **Never commit secrets** to git
- Use GitHub Secrets for CI/CD
- Use Azure Key Vault for production secrets (future enhancement)
- Container App secrets for current encryption key

### Credential Handling
- All credentials encrypted with AES-256-GCM
- Encryption key stored as secret
- Managed Identity for Azure resources (no connection strings)
- Private Endpoint for Cosmos DB

---

## 📖 Documentation Standards

### When to Update Documentation

**Code changes require:**
- Update `CHANGELOG.md` with changes
- Update `STATUS.md` if major milestone
- Update `README.md` if user-facing changes

**Infrastructure changes require:**
- Update `azure/dats-mcp/main.bicep` comments
- Update `AZURE-DEPLOYMENT-BEST-PRACTICES.md` if process changes

**Security/Compliance changes require:**
- Update `POPA-COMPLIANCE.md` if privacy impact
- Legal review if `privacy.html` changes

---

## ✅ Pre-Merge Checklist

Before pushing to `main`:
- [ ] Tests pass locally (`npm test`)
- [ ] TypeScript compiles (`npm run build`)
- [ ] No PII in log statements
- [ ] POPA compliance maintained (if touching auth/consent code)
- [ ] Documentation updated (CHANGELOG.md at minimum)
- [ ] Commit message follows convention (`feat:`, `fix:`, `docs:`, etc.)

---

## 🆘 Getting Help

### Documentation
- **Operations:** `DEPLOYMENT-COMPLETE.md`
- **Development:** `COPILOT.md`
- **Compliance:** `POPA-COMPLIANCE.md`
- **Infrastructure:** `AZURE-ASSESSMENT.md`

### Resources
- [Azure Container Apps docs](https://learn.microsoft.com/en-us/azure/container-apps/)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Alberta POPA](https://www.alberta.ca/protection-privacy-act)

---

## 🎯 Quick Reference Commands

```bash
# Deploy to production
git push origin main

# Watch deployment
gh run watch

# Check health
curl https://dats-mcp-app.whitewater-072cffec.canadacentral.azurecontainerapps.io/health

# View logs
az containerapp logs show --name dats-mcp-app --resource-group dats-mcp-rg --tail 100

# Run tests
cd mcp-servers/dats-booking && npm test

# Manual deployment (emergency only)
cd mcp-servers/dats-booking
docker build --platform linux/amd64 -t datsmcpregistry.azurecr.io/dats-mcp:manual .
az acr login --name datsmcpregistry
docker push datsmcpregistry.azurecr.io/dats-mcp:manual
az containerapp update --name dats-mcp-app --resource-group dats-mcp-rg --image datsmcpregistry.azurecr.io/dats-mcp:manual
```

---

**Last Updated:** 2026-01-16  
**CI/CD Status:** ✅ Fully Operational
