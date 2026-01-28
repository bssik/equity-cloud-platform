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

// =====================================================
// Naming Variables
// =====================================================

var regionAbbreviation = 'weu'
var staticWebAppName = 'stapp-${projectName}-${environment}-${regionAbbreviation}'
var functionAppName = 'func-${projectName}-${environment}-${regionAbbreviation}'
var storageAccountName = 'st${projectName}${environment}${regionAbbreviation}'
var keyVaultName = 'kv-${projectName}-${environment}-${regionAbbreviation}'

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
    location: location
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
    location: location
    sku: 'Y1'
    storageAccountName: storageAccountName
    keyVaultName: keyVaultName
    appInsightsConnectionString: observability.outputs.connectionString
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
    location: location
    functionAppPrincipalId: functionApp.outputs.principalId
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
