# Padel Booking - Complete Deployment Guide

## Overview

This guide walks you through deploying the **Padel Booking public site** on Salesforce Force.com Sites with Guest User access. No authentication required!

**Stack:** Force.com Sites + Visualforce + Lightning Out + Aura + LWC + Apex (without sharing)

---

## Prerequisites

### 1. Salesforce Org Requirements
- **Developer Edition** (free) or **Enterprise Edition+**
- Force.com Sites enabled (included in Developer Edition)
- No Experience Cloud license required

### 2. Developer Tools
- **Salesforce CLI** installed ([Download](https://developer.salesforce.com/tools/salesforcecli))
- **Git** (for version control)
- **VS Code** with Salesforce Extensions (recommended)
- **Node.js 18+** (for LWC local development)

### 3. Salesforce CLI Authentication
```bash
# Login to your org
sf org login web --alias myorg --set-default

# Verify connection
sf org display --target-org myorg
```

---

## Deployment Steps

### Phase 1: Deploy Metadata (Automated)

Run the deployment script:

```bash
# Make script executable (first time only)
chmod +x deploy.sh

# Deploy to your org
./deploy.sh myorg
```

**What this deploys:**
- ✅ Custom Objects: `Padel_Game__c`, `Padel_Player__c`
- ✅ Apex Classes: `PadelGameController`, `PadelGameControllerTest`
- ✅ Lightning Web Components: 6 components (padelBookingApp, etc.)
- ✅ Aura Application: `PadelBookingGuestApp` with `ltng:allowGuestAccess`
- ✅ Visualforce Page: `PadelBooking` with Lightning Out
- ✅ Runs all Apex tests (must pass with 75%+ coverage)

**Expected output:**
```
========================================
Deployment Summary
========================================

✓ Deployment completed successfully!
```

---

### Phase 2: Manual Configuration (Setup UI)

#### Step 1: Enable Force.com Sites

1. Navigate to **Setup → Sites → Settings**
2. Click **Enable Sites**
3. Accept the terms and conditions
4. Set your domain (e.g., `yourorg.force.com`)

![Enable Sites](https://user-images.githubusercontent.com/placeholder/enable-sites.png)

---

#### Step 2: Create New Site

1. **Setup → Sites → New**
2. Fill in the form:
   - **Site Label:** `Padel Booking`
   - **Site Name:** `padelbooking` (URL path)
   - **Active Site Home Page:** `PadelBooking` (select from dropdown)
   - **Inactive Site Home Page:** `PadelBooking` (same)
   - **Site Template:** (leave blank)
3. Click **Save**

**Result:** Site created but **not activated yet**

---

#### Step 3: Configure Public Access Settings (CRITICAL!)

This is the most important step - it grants Guest User permissions.

1. **Setup → Sites → [Padel Booking] → Public Access Settings**

2. **Enable Apex Classes:**
   - Click **Enabled Apex Class Access**
   - Search for `PadelGameController`
   - Click **Add**
   - Save

3. **Enable Visualforce Pages:**
   - Click **Enabled Visualforce Page Access**
   - Search for `PadelBooking`
   - Click **Add**
   - Save

4. **Object Permissions:**
   - Scroll to **Custom Object Permissions**
   - Find `Padel_Game__c`:
     - ☑ Read
     - ☑ Create
     - ☑ Edit
     - ☑ Delete
   - Find `Padel_Player__c`:
     - ☑ Read
     - ☑ Create
     - ☑ Edit
     - ☑ Delete
   - Click **Save**

5. **Field-Level Security:**
   - Click **View** next to `Padel_Game__c`
   - For **each field**, set:
     - ☑ Read Access
     - ☑ Edit Access
   - Click **Save**
   - Repeat for `Padel_Player__c`

**⚠️ IMPORTANT:** All fields must have **both Read and Edit** enabled for Guest User!

---

#### Step 4: Enable Lightning Features for Guest User

1. **Setup → Sites → [Padel Booking] → Site Details**
2. Find **Lightning Features for Guest User**
3. ☑ **Enable Lightning Features for Guest User**
4. Click **Save**

**Why this matters:** Without this, Lightning Out will fail to load for Guest Users.

---

#### Step 5: Set Organization-Wide Defaults (Sharing Settings)

1. **Setup → Sharing Settings**

2. Find **Padel_Game__c** in the table:
   - **Default Internal Access:** `Public Read/Write`
   - **Default External Access:** `Public Read/Write`
   - ☑ **Grant Access Using Hierarchies**
   - Click **Edit** → Change settings → Save

3. Find **Padel_Player__c**:
   - **Default Internal Access:** `Controlled by Parent`
   - **Default External Access:** `Controlled by Parent`
   - (No action needed - this is default for Master-Detail)

**Why this matters:** Public Read/Write allows Guest User to perform CRUD operations.

---

#### Step 6: Activate Site

1. **Setup → Sites → [Padel Booking]**
2. Click **Activate** button
3. Confirm activation

**Result:** Site is now live!

**Your public URL:**
```
https://yourorg.force.com/padelbooking
```

*(Replace `yourorg` with your actual domain)*

---

## Verification & Testing

### Test 1: Access Public URL

1. Open incognito/private browser window
2. Navigate to `https://yourorg.force.com/padelbooking`
3. **Expected:** Page loads with "Rezerwacja Kortów Padel" header and 3 tabs

### Test 2: Browse Games

1. Click **"Zapisz się"** tab
2. **Expected:**
   - If no games: "Brak dostępnych gier"
   - If games exist: Grid of game cards

### Test 3: Create Game

1. Click **"Stwórz wyjście"** tab
2. Fill in the form:
   - **Data gry:** Tomorrow's date
   - **Godzina:** 18:00
   - **Kort:** Kort 1
   - **Cena całkowita:** 200
   - **Maksymalna liczba graczy:** 4
3. Click **"Utwórz grę"**
4. **Expected:**
   - Success toast: "Gra została utworzona!"
   - Auto-switch to "Moje gry" tab
   - Game appears in list

### Test 4: Join Game

1. Go to **"Zapisz się"** tab
2. Click **"Dołącz"** on any available game
3. Fill player form:
   - **Imię:** Jan Kowalski
   - **Email:** jan@test.com
   - **Telefon:** +48123456789 (optional)
4. Click **"Zapisz się"**
5. **Expected:**
   - Success toast
   - Player added to game card
   - Player count updates (e.g., 2/4)

### Test 5: Guest User Permissions

Run this in **Developer Console → Execute Anonymous Apex:**

```apex
// Check Guest User permissions
User guestUser = [SELECT Id, Name, Profile.Name FROM User WHERE IsGuestUser = true LIMIT 1];
System.debug('Guest User: ' + guestUser.Name);
System.debug('Profile: ' + guestUser.Profile.Name);

// Check object permissions (run as system admin)
List<ObjectPermissions> objPerms = [
    SELECT SObjectType, PermissionsRead, PermissionsCreate, PermissionsEdit, PermissionsDelete
    FROM ObjectPermissions
    WHERE ParentId IN (SELECT PermissionSetId FROM PermissionSetAssignment WHERE AssigneeId = :guestUser.Id)
    AND SObjectType IN ('Padel_Game__c', 'Padel_Player__c')
];

for (ObjectPermissions perm : objPerms) {
    System.debug(perm.SObjectType + ': R=' + perm.PermissionsRead + ', C=' + perm.PermissionsCreate +
                 ', E=' + perm.PermissionsEdit + ', D=' + perm.PermissionsDelete);
}
```

**Expected output:**
```
Guest User: [Site Name] Site Guest User
Profile: [Site Name] Profile
Padel_Game__c: R=true, C=true, E=true, D=true
Padel_Player__c: R=true, C=true, E=true, D=true
```

---

## Troubleshooting

### Issue 1: "Insufficient Privileges" Error

**Symptoms:** Guest User cannot create/edit games

**Solution:**
1. Verify **Public Access Settings** → Object permissions (all CRUD enabled)
2. Verify **Field-Level Security** (all fields Read + Edit)
3. Verify **Sharing Settings** → OWD = Public Read/Write
4. Check Apex class uses `without sharing`

**Verification:**
```apex
// In PadelGameController.cls
public without sharing class PadelGameController {
    // NOT: public with sharing
```

---

### Issue 2: Lightning Out Fails to Load

**Symptoms:** White screen or "Błąd ładowania aplikacji"

**Solution:**
1. Verify **Site Details** → Lightning Features for Guest User is **enabled**
2. Check **Public Access Settings** → Enabled Apex Classes includes `PadelGameController`
3. Check **Public Access Settings** → Enabled Visualforce Pages includes `PadelBooking`
4. Open browser console (F12) for JavaScript errors

**Check Site URL:**
- Must access via `https://yourorg.force.com/padelbooking`
- NOT via `https://yourorg.my.salesforce.com`

---

### Issue 3: Components Not Visible in Visualforce Page

**Symptoms:** "Component not found: c:padelBookingApp"

**Solution:**
1. Verify all LWC components deployed successfully
2. Check Aura app dependencies in `PadelBookingGuestApp.app`
3. Clear cache: **Setup → Sites → [Site] → Clear Cache**
4. Refresh browser (Ctrl+F5 / Cmd+Shift+R)

**Verify deployment:**
```bash
sf project deploy report --target-org myorg
```

---

### Issue 4: Tests Failing

**Symptoms:** Deployment script shows test failures

**Common causes:**
1. **Data isolation:** Tests must create own test data (don't rely on existing records)
2. **Field references:** Check all field API names match custom objects
3. **Validation rules:** May prevent test data insertion

**Run tests manually:**
```bash
sf apex run test --class-names PadelGameControllerTest --detailed-coverage --target-org myorg
```

---

### Issue 5: Guest User Limit Exceeded

**Symptoms:** "Daily API limit exceeded" error

**Solution:**
- Force.com Sites Guest User: **500,000 page views/month**
- Check usage: **Setup → System Overview → API Usage**
- Use `@AuraEnabled(cacheable=true)` for read operations (already implemented)
- Implement client-side caching in LWC (5-minute TTL recommended)

---

## Post-Deployment Configuration

### Optional: Custom Domain (Force.com Sites)

1. **Setup → Sites → Domains**
2. Register custom domain (requires DNS configuration)
3. Update `Share_Link__c` formula field to use new domain

### Optional: reCAPTCHA (Spam Prevention)

Add Google reCAPTCHA to forms:

```html
<!-- In padelBookingForm.html -->
<div class="g-recaptcha" data-sitekey="YOUR_SITE_KEY"></div>
```

**Apex validation:**
```apex
// In PadelGameController.createGame()
if (!verifyRecaptcha(recaptchaToken)) {
    throw new AuraHandledException('reCAPTCHA validation failed');
}
```

### Optional: Email Notifications

Add email alert when player joins:

```apex
// After player insert
Messaging.SingleEmailMessage mail = new Messaging.SingleEmailMessage();
mail.setToAddresses(new String[]{game.Creator_Email__c});
mail.setSubject('Nowy gracz dołączył do Twojej gry!');
mail.setPlainTextBody('Gracz ' + newPlayer.Player_Name__c + ' dołączył do gry.');
Messaging.sendEmail(new Messaging.SingleEmailMessage[]{mail});
```

---

## Monitoring & Maintenance

### Daily Monitoring

**Check Guest User API Usage:**
- **Setup → System Overview → API Usage**
- Monitor "Guest User Requests" chart
- Alert if approaching 500k/month limit

**Check Error Logs:**
```bash
sf apex log tail --target-org myorg
```

### Weekly Tasks

1. **Review Created Games:**
   - Delete test/spam games
   - Archive past games

2. **Check Data Storage:**
   - **Setup → System Overview → Data Storage**
   - Plan cleanup if approaching limits

3. **Review Security:**
   - Check for suspicious patterns (mass game creation)
   - Review Guest User Profile changes

### Monthly Tasks

1. **Backup Data:**
```bash
sf data export --query "SELECT Id, Name, Game_Date__c, Total_Price__c FROM Padel_Game__c" --target-org myorg
```

2. **Review Performance:**
   - Page load times (target: <3 seconds)
   - Apex execution time (target: <1 second)

3. **Update Dependencies:**
   - Check for Salesforce platform updates
   - Test site after Salesforce releases

---

## Rollback Plan

If deployment fails or issues arise:

### Deactivate Site
```
Setup → Sites → [Padel Booking] → Deactivate
```

### Remove Metadata
```bash
# Delete specific components
sf project delete source --metadata ApexClass:PadelGameController --target-org myorg
sf project delete source --metadata LightningComponentBundle:padelBookingApp --target-org myorg

# Or destructive changes
sf project deploy start --manifest destructive/destructiveChanges.xml --target-org myorg
```

### Restore Previous Version
```bash
# If using version control
git checkout <previous-commit>
./deploy.sh myorg
```

---

## Support & Resources

### Documentation
- **Salesforce Force.com Sites:** [Docs](https://developer.salesforce.com/docs/atlas.en-us.sitedev.meta/sitedev/)
- **Lightning Out:** [Docs](https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.use_lightning_out)
- **Guest User Permissions:** [Docs](https://help.salesforce.com/s/articleView?id=sf.networks_guest_user.htm)

### Community
- **Salesforce Trailblazer Community:** [community.salesforce.com](https://community.salesforce.com)
- **Salesforce Stack Exchange:** [salesforce.stackexchange.com](https://salesforce.stackexchange.com)

### Contact
For issues with this specific implementation, create an issue in the project repository.

---

**Deployment Guide Version:** 1.0
**Last Updated:** 2025-10-22
**Compatibility:** Salesforce API 60.0+
