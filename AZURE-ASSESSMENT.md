# Azure Infrastructure Assessment

**Date:** 2026-01-16  
**Subscription:** ME-MngEnvMCAP516709-jcrossman-1  
**Primary Region:** Canada Central

---

## 🔍 Current Deployment Status

### ✅ What's Deployed and Working

#### Resource Group: `dats-mcp-rg` (Primary Infrastructure)
| Resource | Type | Status | Purpose |
|----------|------|--------|---------|
| **dats-mcp-app** | Container App | ✅ Running | MCP Server (HTTP endpoint) |
| **dats-mcp-dev-cosmos** | Cosmos DB | ✅ Running | Session storage (encrypted) |
| **datsmcpregistry** | Container Registry | ✅ Running | Docker images |
| **dats-mcp-dev-identity** | Managed Identity | ✅ Running | Cosmos DB authentication |
| **dats-mcp-dev-env-vnet** | Container Apps Environment | ✅ Running | Container host |
| **dats-mcp-vnet** | Virtual Network | ✅ Running | Network isolation |
| **dats-cosmos-pe** | Private Endpoint | ✅ Running | Secure Cosmos access |
| **privatelink.documents.azure.com** | Private DNS Zone | ✅ Running | Private endpoint DNS |
| **dats-mcp-dev-logs** | Log Analytics | ✅ Running | Monitoring & audit logs |

#### Resource Group: `rg-dats-booking-prod` (Auth Portal)
| Resource | Type | Status | Purpose |
|----------|------|--------|---------|
| **dats-auth** | Static Web App | ✅ Running | OAuth callback handler |
| **datsauthstorage** | Storage Account | ✅ Running | Static site storage |

#### Current Container App Configuration
```
FQDN: dats-mcp-app.whitewater-072cffec.canadacentral.azurecontainerapps.io
Image: datsmcpregistry.azurecr.io/dats-mcp:latest
Scaling: Min 1 → Max 10 replicas
Status: ✅ Health endpoint responding (HTTP 200)
```

#### Environment Variables (Configured)
- ✅ `MCP_TRANSPORT=http` (Remote mode)
- ✅ `COSMOS_ENDPOINT` (Private endpoint URL)
- ✅ `COSMOS_ENCRYPTION_KEY` (Stored as secret)
- ✅ `AZURE_CLIENT_ID` (Managed identity)
- ⚠️ `LOG_LEVEL=debug` (Should be 'info' in production)
- ⚠️ `DATS_AUTH_URL` points to container app (should be static web app)

---

## ⚠️ Issues Identified

### Critical Issues

#### 1. **DATS_AUTH_URL Configuration Error**
- **Current:** `https://dats-mcp-app.whitewater-072cffec.canadacentral.azurecontainerapps.io`
- **Should be:** `https://green-sky-0e461ed10.1.azurestaticapps.net`
- **Impact:** OAuth callback redirects to wrong endpoint
- **Fix:** Update environment variable

#### 2. **Missing Privacy Policy Page**
- **Issue:** `privacy.html` not deployed to Static Web App
- **Impact:** POPA compliance violation (no accessible privacy policy)
- **Fix:** Deploy `azure/dats-auth/src/privacy.html` to static site

#### 3. **No CI/CD Pipeline**
- **Issue:** Manual deployments only, no automation
- **Impact:** Error-prone, no testing, no rollback capability
- **Fix:** Set up GitHub Actions workflow

#### 4. **Production Logging Too Verbose**
- **Current:** `LOG_LEVEL=debug`
- **Should be:** `LOG_LEVEL=info`
- **Impact:** Performance overhead, potential PII leakage
- **Fix:** Update environment variable

### Moderate Issues

#### 5. **Outdated Container Image**
- **Issue:** Latest POPA compliance code not deployed
- **Missing:** Consent management, enhanced audit logging
- **Impact:** Non-compliant with POPA requirements
- **Fix:** Build and deploy new image

#### 6. **No Application Insights Configured**
- **Issue:** Log Analytics exists but not connected to app
- **Impact:** Limited observability, no alerts
- **Fix:** Add Application Insights integration

#### 7. **Container Registry in Different Region**
- **Location:** ACR is in Central US, app is in Canada Central
- **Impact:** Slower image pulls, data residency concern
- **Fix:** Use Canadian registry (already exists: `datsmcpregistry`)

#### 8. **No Health Probe Configuration**
- **Issue:** No liveness/readiness probes defined
- **Impact:** Can't detect unhealthy containers
- **Fix:** Configure probes in Bicep template

### Minor Issues

#### 9. **Three Resource Groups for One Project**
- `rg-dats-booking-prod`
- `dats-mcp-rg`
- `rg-alberta-mcp-pilot` (appears to be a different project)
- **Impact:** Organizational complexity
- **Recommendation:** Consolidate or use clear naming

#### 10. **No Tags for Resource Management**
- **Issue:** Resources lack metadata tags
- **Impact:** Hard to track costs, ownership, environment
- **Fix:** Add tags (Environment, Project, Owner, CostCenter)

---

## ✅ What's Good

### Security Best Practices
- ✅ Managed Identity (no connection strings)
- ✅ Private Endpoint for Cosmos DB
- ✅ Secrets stored in Container App secrets
- ✅ Virtual Network isolation
- ✅ Canada residency (POPA compliant)
- ✅ Encryption at rest (Cosmos DB)

### Infrastructure Design
- ✅ Container Apps (good choice for MCP server)
- ✅ Cosmos DB with 24-hour TTL
- ✅ Separate auth portal (Static Web App)
- ✅ Log Analytics workspace
- ✅ Auto-scaling configured

---

## 📋 Recommended Improvements

### Priority 1: Fix Critical Issues (Do Immediately)
1. ✅ **Update DATS_AUTH_URL** environment variable
2. ✅ **Deploy privacy.html** to Static Web App
3. ✅ **Set LOG_LEVEL to 'info'** for production
4. ✅ **Build and deploy** latest code with POPA compliance

### Priority 2: Set Up CI/CD (This Week)
5. ✅ **Create GitHub Actions workflow** for automated deployments
6. ✅ **Set up GitHub Secrets** for Azure credentials
7. ✅ **Add automated testing** to pipeline
8. ✅ **Configure blue-green deployments**

### Priority 3: Enhance Monitoring (This Week)
9. ✅ **Add Application Insights** integration
10. ✅ **Configure health probes** (liveness + readiness)
11. ✅ **Set up alerts** for errors and POPA violations
12. ✅ **Create monitoring dashboard**

### Priority 4: Infrastructure Optimization (This Month)
13. ⏳ **Consolidate resource groups** (optional)
14. ⏳ **Add resource tags** for cost tracking
15. ⏳ **Migrate encryption key to Key Vault** (more secure)
16. ⏳ **Set up staging environment** for testing

---

## 🚀 Deployment Plan

### Phase 1: Immediate Fixes (30 minutes)
- Update environment variables
- Deploy privacy.html
- Redeploy container with LOG_LEVEL fix

### Phase 2: Deploy Latest Code (1 hour)
- Build new Docker image with POPA compliance
- Push to Azure Container Registry
- Deploy to Container App
- Test consent flow

### Phase 3: Set Up CI/CD (2 hours)
- Create GitHub Actions workflow
- Configure GitHub Secrets
- Set up automated deployments
- Test full pipeline

### Phase 4: Monitoring Setup (1 hour)
- Add Application Insights
- Configure health probes
- Create alert rules
- Test monitoring

**Total Time:** ~4-5 hours

---

## 📊 Cost Analysis

### Current Monthly Costs (Estimated)
| Resource | Tier | Est. Cost/Month |
|----------|------|----------------|
| Container Apps | Basic (1-10 replicas) | $30-150 |
| Cosmos DB | Serverless | $25-100 |
| Container Registry | Standard | $15 |
| Static Web App | Free | $0 |
| Log Analytics | Pay-as-you-go | $5-20 |
| Virtual Network | Standard | $5 |
| **Total** | | **$80-290/month** |

### Cost Optimization Opportunities
- Switch Cosmos DB to 400 RU/s provisioned if usage is consistent
- Use Container App consumption plan instead of dedicated
- Delete unused resources in other resource groups

---

## 🔒 POPA Compliance Status

### Current Status
- ❌ **Non-compliant** - Missing consent management
- ❌ **Non-compliant** - Privacy policy not accessible
- ⚠️ **Partial** - Audit logging exists but incomplete
- ✅ **Compliant** - Data residency (Canada)
- ✅ **Compliant** - Encryption at rest
- ✅ **Compliant** - 24-hour data retention

### After Proposed Fixes
- ✅ All 6 POPA requirements met
- ✅ Privacy policy accessible
- ✅ Consent tracking implemented
- ✅ Audit logging complete (no PII)

---

## 🎯 Success Criteria

After implementing recommendations:
- [ ] Container App running latest code with POPA compliance
- [ ] Privacy policy accessible at `/privacy.html`
- [ ] Consent flow works in Claude Mobile
- [ ] Audit logs contain no PII
- [ ] CI/CD pipeline deploys automatically on push
- [ ] Health probes detect unhealthy containers
- [ ] Application Insights shows metrics
- [ ] All tests pass in pipeline

---

## 📞 Next Steps

**I'm ready to implement all fixes for you!**

Choose your approach:
1. **Full Automation (Recommended):** Set up GitHub Actions + deploy everything
2. **Manual Deployment:** I'll run the commands for you step-by-step
3. **Hybrid:** Fix critical issues manually, then set up CI/CD

**Which would you like me to do?**
