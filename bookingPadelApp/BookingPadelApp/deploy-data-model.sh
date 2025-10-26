#!/bin/bash

# Padel Booking Data Model Deployment Script
# Usage: ./deploy-data-model.sh [org-alias]

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
ORG_ALIAS="${1:-padel-org}"
SOURCE_PATH="force-app/main/default/objects/"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Padel Booking - Data Model Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if Salesforce CLI is installed
if ! command -v sf &> /dev/null; then
    echo -e "${RED}❌ Salesforce CLI (sf) not found${NC}"
    echo "Please install: npm install -g @salesforce/cli"
    exit 1
fi

echo -e "${GREEN}✓ Salesforce CLI found${NC}"

# Check if source directory exists
if [ ! -d "$SOURCE_PATH" ]; then
    echo -e "${RED}❌ Source directory not found: $SOURCE_PATH${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Source directory found${NC}"

# Count files to deploy
TOTAL_FILES=$(find $SOURCE_PATH -type f | wc -l | xargs)
echo -e "${BLUE}📦 Files to deploy: $TOTAL_FILES${NC}"

# Check org connection
echo ""
echo -e "${YELLOW}Checking connection to org: $ORG_ALIAS${NC}"
if ! sf org display --target-org "$ORG_ALIAS" &> /dev/null; then
    echo -e "${RED}❌ Cannot connect to org: $ORG_ALIAS${NC}"
    echo "Available orgs:"
    sf org list
    echo ""
    echo "Login with: sf org login web --alias $ORG_ALIAS"
    exit 1
fi

echo -e "${GREEN}✓ Connected to org: $ORG_ALIAS${NC}"

# Display org info
ORG_INFO=$(sf org display --target-org "$ORG_ALIAS" --json | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
echo -e "${BLUE}📧 Username: $ORG_INFO${NC}"

# Confirm deployment
echo ""
echo -e "${YELLOW}Ready to deploy:${NC}"
echo "  - 2 Custom Objects (Padel_Game__c, Padel_Player__c)"
echo "  - 20 Custom Fields"
echo "  - 5 Validation Rules"
echo ""
read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

# Deploy to org
echo ""
echo -e "${BLUE}🚀 Deploying data model...${NC}"
if sf project deploy start --source-dir "$SOURCE_PATH" --target-org "$ORG_ALIAS"; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Deployment successful!${NC}"
    echo -e "${GREEN}========================================${NC}"

    # Verify deployment
    echo ""
    echo -e "${BLUE}Verifying objects...${NC}"

    # Check Padel_Game__c
    if sf data query --query "SELECT COUNT() FROM Padel_Game__c" --target-org "$ORG_ALIAS" &> /dev/null; then
        echo -e "${GREEN}✓ Padel_Game__c accessible${NC}"
    else
        echo -e "${RED}❌ Padel_Game__c not accessible${NC}"
    fi

    # Check Padel_Player__c
    if sf data query --query "SELECT COUNT() FROM Padel_Player__c" --target-org "$ORG_ALIAS" &> /dev/null; then
        echo -e "${GREEN}✓ Padel_Player__c accessible${NC}"
    else
        echo -e "${RED}❌ Padel_Player__c not accessible${NC}"
    fi

    echo ""
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. Configure Organization-Wide Defaults (Setup → Sharing Settings)"
    echo "   - Set Padel_Game__c to: Public Read/Write"
    echo ""
    echo "2. Configure Guest User Profile permissions"
    echo "   - Navigate: Setup → Digital Experiences → Guest User Profile"
    echo "   - Grant CRUD on both objects"
    echo ""
    echo "3. Create test data:"
    echo "   sf data create record --sobject Padel_Game__c \\"
    echo "     --values \"Game_Date__c=2025-10-25 Game_Time__c=18:00:00.000Z \\"
    echo "              Court_Name__c='Kort 1' Total_Price__c=200 Max_Players__c=4\" \\"
    echo "     --target-org $ORG_ALIAS"
    echo ""
    echo -e "${GREEN}✓ Data model deployment complete!${NC}"
else
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}❌ Deployment failed${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo "Check deployment report with:"
    echo "  sf project deploy report --target-org $ORG_ALIAS"
    exit 1
fi
