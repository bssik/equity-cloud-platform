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

// =====================================================
// Naming Variables
// =====================================================

var regionAbbreviation = 'weu'
var staticWebAppName = 'stapp-${projectName}-${environment}-${regionAbbreviation}'

// =====================================================
// Resources
// =====================================================

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

// =====================================================
// Outputs
// =====================================================

@description('The default hostname of the Static Web App')
output staticWebAppUrl string = staticWebApp.outputs.defaultHostname

@description('The resource ID of the Static Web App')
output staticWebAppId string = staticWebApp.outputs.resourceId
