# EquityCloud Infrastructure

This directory contains **Azure Bicep** templates for provisioning the EquityCloud platform infrastructure.

## 📁 Directory Structure

```
infra/
├── main.bicep                    # Main orchestration file
├── modules/
│   └── staticwebapp.bicep        # Static Web App module
└── README.md                     # This documentation
```

## 🚀 Deployment

### Prerequisites
- Azure CLI already installed
- Azure subscription

### Deploy via Azure CLI

```bash
# Set variables
RESOURCE_GROUP="rg-equity-cloud-dev"
LOCATION="westeurope"

# Deploy
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file main.bicep \
  --parameters environment=dev
```

---

**Week 1 Status**: ✅ Foundation Complete
**Next**: GitHub Actions workflow for automated deployment
