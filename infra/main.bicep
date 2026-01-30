// =====================================================
// EquityCloud - Main Infrastructure
// =====================================================
// Deploys the core infrastructure for the EquityCloud platform.
// Follows Microsoft Well-Architected Framework.
// =====================================================

targetScope = 'resourceGroup'

@description('The deployment environment (dev, staging, prod)')
@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string = 'dev'

@description('Primary Azure region for deployment')
param location string = resourceGroup().location

@description('Name prefix for all resources following CAF standards')
param projectName string = 'equitycloud'

@description('Alpha Vantage API Key')
@secure()
param alphaVantageApiKey string

@description('Finnhub API Key')
@secure()
param finnhubApiKey string

@description('Override for Key Vault Name (optional)')
param keyVaultNameOverride string = ''

@description('Override for Key Vault Location (optional)')
param keyVaultLocationOverride string = ''

@description('Override for Static Web App Name (optional)')
param staticWebAppNameOverride string = ''

@description('Override for Static Web App Location (optional)')
param staticWebAppLocationOverride string = ''

@description('Override for Function App Location (optional)')
param functionAppLocationOverride string = ''

// =====================================================
// Naming Variables
// =====================================================

var regionAbbreviation = 'weu'
var staticWebAppName = !empty(staticWebAppNameOverride) ? staticWebAppNameOverride : 'stapp-${projectName}-${environment}-${regionAbbreviation}'
var staticWebAppLocation = !empty(staticWebAppLocationOverride) ? staticWebAppLocationOverride : location
var functionAppName = 'func-${projectName}-${environment}-${regionAbbreviation}'
var functionAppLocation = !empty(functionAppLocationOverride) ? functionAppLocationOverride : location
var storageAccountName = 'st${projectName}${environment}${regionAbbreviation}'
var keyVaultName = !empty(keyVaultNameOverride) ? keyVaultNameOverride : 'kv-${projectName}-${environment}-${regionAbbreviation}'
var keyVaultLocation = !empty(keyVaultLocationOverride) ? keyVaultLocationOverride : location

// =====================================================
// Resources
// =====================================================

module observability './modules/loganalytics.bicep' = {
  name: 'deploy-observability'
  params: {
    name: projectName
    location: location
    tags: {
      Environment: environment
      Project: 'EquityCloud'
      ManagedBy: 'Bicep'
    }
  }
}

module staticWebApp './modules/staticwebapp.bicep' = {
  name: 'deploy-static-web-app'
  params: {
    name: staticWebAppName
    location: staticWebAppLocation
    sku: 'Free'
    tags: {
      Environment: environment
      Project: 'EquityCloud'
      ManagedBy: 'Bicep'
    }
  }
}

module functionApp './modules/functionapp.bicep' = {
  name: 'deploy-function-app'
  params: {
    name: functionAppName
    location: functionAppLocation
    sku: 'Y1'
    storageAccountName: storageAccountName
    keyVaultName: keyVaultName
    appInsightsConnectionString: observability.outputs.connectionString
    allowedOrigins: [
      'https://${staticWebApp.outputs.defaultHostname}'
      'https://black-stone-0e8040d03-dev.westeurope.6.azurestaticapps.net'
    ]
    tags: {
      Environment: environment
      Project: 'EquityCloud'
      ManagedBy: 'Bicep'
    }
  }
}

module keyVault './modules/keyvault.bicep' = {
  name: 'deploy-key-vault'
  params: {
    name: keyVaultName
    location: keyVaultLocation
    alphaVantageApiKey: alphaVantageApiKey
    finnhubApiKey: finnhubApiKey
    tags: {
      Environment: environment
      Project: 'EquityCloud'
      ManagedBy: 'Bicep'
    }
  }
}

// =====================================================
// Outputs
// =====================================================

@description('The default hostname of the Static Web App')
output staticWebAppUrl string = staticWebApp.outputs.defaultHostname

@description('The resource ID of the Static Web App')
output staticWebAppId string = staticWebApp.outputs.resourceId

@description('The Function App URL')
output functionAppUrl string = functionApp.outputs.functionAppUrl

@description('The Function App name')
output functionAppName string = functionApp.outputs.functionAppName
