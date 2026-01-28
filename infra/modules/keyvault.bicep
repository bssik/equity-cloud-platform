// =====================================================
// EquityCloud - Key Vault Module
// =====================================================
// Secure secrets storage for API keys and connections.
// Uses Microsoft Well-Architected Framework best practices.
// =====================================================

param name string
param location string
param tags object = {}

@description('The principal ID of the Function App to grant access')
param functionAppPrincipalId string

@secure()
param alphaVantageApiKey string

@secure()
param finnhubApiKey string

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: false // Using access policies for simplicity in this baseline, though RBAC is often preferred
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: functionAppPrincipalId
        permissions: {
          secrets: [
            'get'
            'list'
          ]
        }
      }
    ]
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    enableSoftDelete: true
  }
}

resource alphaVantageSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ALPHA-VANTAGE-API-KEY'
  properties: {
    value: alphaVantageApiKey
  }
}

resource finnhubSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'FINNHUB-API-KEY'
  properties: {
    value: finnhubApiKey
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
