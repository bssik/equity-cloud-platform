// Module: Azure Static Web App
// Provisions a Static Web App for hosting the frontend application.

@description('The name of the Static Web App resource')
param name string

@description('The Azure region for deployment')
param location string

@description('The SKU tier for the Static Web App')
@allowed([
  'Free'
  'Standard'
])
param sku string = 'Free'

@description('Resource tags for cost tracking')
param tags object = {}

// Resource

resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
    tier: sku
  }
  properties: {
    buildProperties: {
      skipGithubActionWorkflowGeneration: false
    }
    enterpriseGradeCdnStatus: sku == 'Standard' ? 'Enabled' : 'Disabled'
  }
}

// Outputs

@description('The default hostname of the deployed Static Web App')
output defaultHostname string = staticWebApp.properties.defaultHostname

@description('The deployment token for CI/CD integration')
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey

@description('The fully qualified resource ID')
output resourceId string = staticWebApp.id

@description('The Static Web App name')
output name string = staticWebApp.name
