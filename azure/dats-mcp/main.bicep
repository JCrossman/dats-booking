/**
 * DATS Booking MCP Server - Azure Infrastructure
 *
 * Deploys:
 * - Azure Container Apps Environment
 * - Azure Container App (MCP Server)
 * - Azure Cosmos DB (Serverless, for sessions)
 * - User-Assigned Managed Identity
 *
 * Region: Canada Central (POPA compliance)
 *
 * Deploy:
 *   az deployment group create \
 *     --resource-group dats-mcp-rg \
 *     --template-file main.bicep \
 *     --parameters environment=prod cosmosEncryptionKey=<key>
 */

// ============= PARAMETERS =============

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'prod'

@description('Location for all resources - Canada Central for POPA compliance')
param location string = 'canadacentral'

@description('Container image to deploy')
param containerImage string = 'ghcr.io/your-org/dats-mcp:latest'

@secure()
@description('Encryption key for Cosmos DB session data')
param cosmosEncryptionKey string

@description('Existing DATS Auth URL')
param datsAuthUrl string = 'https://green-sky-0e461ed10.1.azurestaticapps.net'

// ============= VARIABLES =============

var resourcePrefix = 'dats-mcp-${environment}'
var tags = {
  project: 'dats-booking'
  environment: environment
  managedBy: 'bicep'
}

// Cosmos DB built-in role: Cosmos DB Built-in Data Contributor
var cosmosDataContributorRoleId = '00000000-0000-0000-0000-000000000002'

// ============= USER-ASSIGNED MANAGED IDENTITY =============

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${resourcePrefix}-identity'
  location: location
  tags: tags
}

// ============= LOG ANALYTICS WORKSPACE =============

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${resourcePrefix}-logs'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// ============= CONTAINER APPS ENVIRONMENT =============

resource containerAppEnvironment 'Microsoft.App/managedEnvironments@2023-11-02-preview' = {
  name: '${resourcePrefix}-env'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    zoneRedundant: false
  }
}

// ============= COSMOS DB ACCOUNT (SERVERLESS) =============

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: '${resourcePrefix}-cosmos'
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [
      { name: 'EnableServerless' }
    ]
    locations: [
      {
        locationName: location
        failoverPriority: 0
      }
    ]
    // Disable public network access for production
    publicNetworkAccess: environment == 'prod' ? 'Disabled' : 'Enabled'
    // Enable encryption at rest (default)
    // Enable automatic failover
    enableAutomaticFailover: false
  }
}

// ============= COSMOS DB DATABASE =============

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: 'dats-sessions'
  properties: {
    resource: {
      id: 'dats-sessions'
    }
  }
}

// ============= COSMOS DB CONTAINER =============

resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: cosmosDatabase
  name: 'sessions'
  properties: {
    resource: {
      id: 'sessions'
      partitionKey: {
        paths: ['/id']
        kind: 'Hash'
      }
      // TTL: 24 hours (86400 seconds) - sessions auto-expire
      defaultTtl: 86400
      indexingPolicy: {
        automatic: true
        indexingMode: 'consistent'
        includedPaths: [
          { path: '/*' }
        ]
        excludedPaths: [
          { path: '/encryptedCookie/?' }
          { path: '/iv/?' }
          { path: '/authTag/?' }
        ]
      }
    }
  }
}

// ============= COSMOS DB ROLE ASSIGNMENT =============

resource cosmosRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-05-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, managedIdentity.id, cosmosDataContributorRoleId)
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/sqlRoleDefinitions/${cosmosDataContributorRoleId}'
    principalId: managedIdentity.properties.principalId
    scope: cosmosAccount.id
  }
}

// ============= CONTAINER APP =============

resource containerApp 'Microsoft.App/containerApps@2023-11-02-preview' = {
  name: '${resourcePrefix}-app'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppEnvironment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
          exposeHeaders: ['mcp-session-id']
          maxAge: 3600
        }
      }
      secrets: [
        {
          name: 'cosmos-encryption-key'
          value: cosmosEncryptionKey
        }
      ]
      registries: []
    }
    template: {
      containers: [
        {
          name: 'dats-mcp'
          image: containerImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'MCP_TRANSPORT', value: 'http' }
            { name: 'PORT', value: '3000' }
            { name: 'HOST', value: '0.0.0.0' }
            { name: 'COSMOS_ENDPOINT', value: cosmosAccount.properties.documentEndpoint }
            { name: 'COSMOS_DATABASE', value: cosmosDatabase.name }
            { name: 'COSMOS_CONTAINER', value: cosmosContainer.name }
            { name: 'COSMOS_ENCRYPTION_KEY', secretRef: 'cosmos-encryption-key' }
            { name: 'AZURE_CLIENT_ID', value: managedIdentity.properties.clientId }
            // Auth is now handled by Container App itself (same IP = valid sessions)
            // DATS_AUTH_URL removed - server auto-detects its own URL
            { name: 'LOG_LEVEL', value: environment == 'prod' ? 'info' : 'debug' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 3000
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 3000
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: environment == 'prod' ? 1 : 0
        maxReplicas: 10
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// ============= OUTPUTS =============

@description('Container App URL')
output containerAppUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'

@description('MCP Endpoint URL')
output mcpEndpoint string = 'https://${containerApp.properties.configuration.ingress.fqdn}/mcp'

@description('Health Check URL')
output healthEndpoint string = 'https://${containerApp.properties.configuration.ingress.fqdn}/health'

@description('Cosmos DB Endpoint')
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint

@description('Managed Identity Client ID')
output managedIdentityClientId string = managedIdentity.properties.clientId

@description('Log Analytics Workspace ID')
output logAnalyticsWorkspaceId string = logAnalytics.id
