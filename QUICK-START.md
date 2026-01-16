# Quick Start - Testing & Deployment

## Option 1: Automated Deployment (Recommended)

```bash
cd "/Users/jeremycrossman/Desktop/DATS Booking"

# Deploy to production
./deploy.sh prod

# Or deploy to dev environment
./deploy.sh dev
```

The script will:
- ✅ Run tests
- ✅ Build TypeScript
- ✅ Create Azure resources
- ✅ Build & push Docker image
- ✅ Deploy infrastructure
- ✅ Output URLs for testing

---

## Option 2: Manual Deployment

See `TESTING-DEPLOYMENT.md` for detailed step-by-step instructions.

---

## Quick Testing After Deployment

### 1. Test MCP Endpoint

```bash
# Get Container App URL from deployment output
CONTAINER_APP_URL="<your-url-from-deployment>"

# Test health
curl https://${CONTAINER_APP_URL}/health
```

### 2. Test in Claude Mobile

1. Open Claude app
2. Settings → Connectors → Add Custom Connector
3. Enter URL: `https://<your-url>/mcp`
4. Test consent flow:
   - Say: "Show my DATS trips"
   - Expected: Privacy notice
   - Say: "I consent"
   - Complete auth
   - Say: "done"

### 3. Check Audit Logs

```bash
az containerapp logs show \
  --name dats-mcp-prod-app \
  --resource-group dats-mcp-rg \
  --tail 100 | grep AUDIT
```

Expected logs:
- `consent_prompt_shown`
- `consent_recorded`
- `session_stored`
- `session_deleted`

---

## Troubleshooting

### Build fails
```bash
cd mcp-servers/dats-booking
npm install
npm run build
```

### Docker push fails
```bash
az acr login --name youracrname
docker push youracrname.azurecr.io/dats-mcp:latest
```

### Container app won't start
```bash
az containerapp logs show \
  --name dats-mcp-prod-app \
  --resource-group dats-mcp-rg \
  --tail 100
```

---

## Full Documentation

- **Detailed Testing:** `TESTING-DEPLOYMENT.md`
- **POPA Compliance:** `POPA-COMPLIANCE.md`
- **Architecture:** `COPILOT.md`

---

## Post-Deployment Checklist

- [ ] Consent flow tested ✅
- [ ] Privacy policy accessible ✅
- [ ] Audit logs verified ✅
- [ ] No PII in logs ✅
- [ ] Data deletion tested ✅
- [ ] Application Insights configured ✅

**Status:** Ready for production! 🚀
