#!/bin/bash

###############################################################################
# Padel Booking - Full Deployment Script
# Description: Deploys all Salesforce metadata for the public booking site
# Usage: ./deploy.sh [org-alias]
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Get org alias from argument or use default
ORG_ALIAS="${1:-myorg}"

print_header "Padel Booking - Deployment Script"

# Step 1: Verify Salesforce CLI is installed
print_info "Checking Salesforce CLI installation..."
if ! command -v sf &> /dev/null; then
    print_error "Salesforce CLI (sf) is not installed"
    print_info "Install from: https://developer.salesforce.com/tools/salesforcecli"
    exit 1
fi
print_success "Salesforce CLI is installed"

# Step 2: Verify org connection
print_info "Verifying connection to org: $ORG_ALIAS"
if ! sf org display --target-org "$ORG_ALIAS" &> /dev/null; then
    print_error "Cannot connect to org: $ORG_ALIAS"
    print_info "Run: sf org login web --alias $ORG_ALIAS"
    exit 1
fi
print_success "Connected to org: $ORG_ALIAS"

# Step 3: Display org information
print_info "Org Information:"
sf org display --target-org "$ORG_ALIAS" | grep -E "(Username|Org ID|Instance URL)"

# Step 4: Pre-deployment validation
print_header "Pre-Deployment Validation"

print_info "Checking for required metadata files..."
REQUIRED_FILES=(
    "force-app/main/default/classes/PadelGameController.cls"
    "force-app/main/default/classes/PadelGameControllerTest.cls"
    "force-app/main/default/aura/PadelBookingGuestApp/PadelBookingGuestApp.app"
    "force-app/main/default/pages/PadelBooking.page"
    "force-app/main/default/lwc/padelBookingApp/padelBookingApp.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        print_error "Missing required file: $file"
        exit 1
    fi
done
print_success "All required files present"

# Step 5: Deploy metadata
print_header "Deploying Metadata"

print_info "Deploying custom objects..."
if sf project deploy start \
    --source-dir force-app/main/default/objects \
    --target-org "$ORG_ALIAS" \
    --wait 10 \
    --verbose; then
    print_success "Custom objects deployed"
else
    print_warning "Custom objects may already exist or deployment skipped"
fi

print_info "Deploying Apex classes..."
if sf project deploy start \
    --source-dir force-app/main/default/classes \
    --target-org "$ORG_ALIAS" \
    --wait 10 \
    --test-level NoTestRun \
    --verbose; then
    print_success "Apex classes deployed"
else
    print_error "Apex deployment failed"
    exit 1
fi

print_info "Deploying Lightning Web Components..."
if sf project deploy start \
    --source-dir force-app/main/default/lwc \
    --target-org "$ORG_ALIAS" \
    --wait 10 \
    --verbose; then
    print_success "LWC components deployed"
else
    print_error "LWC deployment failed"
    exit 1
fi

print_info "Deploying Aura components..."
if sf project deploy start \
    --source-dir force-app/main/default/aura \
    --target-org "$ORG_ALIAS" \
    --wait 10 \
    --verbose; then
    print_success "Aura components deployed"
else
    print_error "Aura deployment failed"
    exit 1
fi

print_info "Deploying Visualforce pages..."
if sf project deploy start \
    --source-dir force-app/main/default/pages \
    --target-org "$ORG_ALIAS" \
    --wait 10 \
    --verbose; then
    print_success "Visualforce pages deployed"
else
    print_error "Visualforce deployment failed"
    exit 1
fi

# Step 6: Run Apex tests
print_header "Running Apex Tests"

print_info "Running PadelGameControllerTest..."
if sf apex run test \
    --class-names PadelGameControllerTest \
    --result-format human \
    --code-coverage \
    --target-org "$ORG_ALIAS" \
    --wait 10; then
    print_success "All tests passed"
else
    print_error "Some tests failed - review output above"
    exit 1
fi

# Step 7: Post-deployment summary
print_header "Deployment Summary"

print_success "Deployment completed successfully!"
echo ""
print_info "Next steps (MANUAL CONFIGURATION REQUIRED):"
echo ""
echo "1. Enable Force.com Sites:"
echo "   Setup → Sites → Settings → Enable Sites"
echo ""
echo "2. Create new Site:"
echo "   Setup → Sites → New"
echo "   - Site Label: Padel Booking"
echo "   - Site Name: padelbooking"
echo "   - Active Site Home Page: PadelBooking"
echo ""
echo "3. Configure Public Access Settings:"
echo "   Setup → Sites → [Padel Booking] → Public Access Settings"
echo "   - Enable Apex Class: PadelGameController"
echo "   - Enable Visualforce Page: PadelBooking"
echo "   - Object Permissions: Padel_Game__c, Padel_Player__c (Read/Create/Edit/Delete)"
echo "   - Field-Level Security: All fields (Read + Edit)"
echo ""
echo "4. Enable Lightning Features for Guest User:"
echo "   Setup → Sites → [Padel Booking] → Site Details"
echo "   - Check: Enable Lightning Features for Guest User"
echo ""
echo "5. Set Organization-Wide Defaults:"
echo "   Setup → Sharing Settings"
echo "   - Padel_Game__c: Public Read/Write"
echo "   - Padel_Player__c: Controlled by Parent"
echo ""
echo "6. Activate Site:"
echo "   Setup → Sites → [Padel Booking] → Activate"
echo ""
print_info "For detailed instructions, see: FORCE_COM_SITES_SETUP.md"
echo ""
print_success "Deployment script completed!"
