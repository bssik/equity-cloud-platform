// Function App for the EquityCloud API
// Linux-based Python runtime, consumption plan by default

@description('The name of the Function App')
param name string

@description('Azure region for deployment')
param location string = resourceGroup().location

@description('App Service Plan SKU')
@allowed([
  'Y1'  // Consumption
  'EP1' // Elastic Premium
  'EP2'
  'EP3'
])
param sku string = 'Y1'

@description('Resource tags')
param tags object = {}

@description('Storage account name for Function App state')
param storageAccountName string

@description('Application Insights connection string')
param appInsightsConnectionString string = ''

@description('Key Vault Name to reference secrets')
param keyVaultName string

// Storage account needed for function app state and logs

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
  }
}

// App Service Plan - using Linux for Python support

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${name}-plan'
  location: location
  tags: tags
  sku: {
    name: sku
  }
  kind: 'linux'
  properties: {
    reserved: true // this property must be true for linux plans
  }
}

// =====================================================
// Function App
resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Python|3.11'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(name)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'python'
        }
        {
          name: 'ALPHA_VANTAGE_API_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=ALPHA-VANTAGE-API-KEY)'
        }
        {
          name: 'FINNHUB_API_KEY'
          value: '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=FINNHUB-API-KEY)'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
      ]
      cors: {
        allowedOrigins: [
          'https://black-stone-0e8040d03.6.azurestaticapps.net'
          'http://localhost:3000'
          'http://localhost:4280'
        ]
        supportCredentials: false
      }
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
    }
  }
}

// =====================================================
// Outputs
// Outputs for other modules or CI/CD pipelines
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output principalId string = functionApp.identity.principalId
output functionAppName string = functionApp.name
