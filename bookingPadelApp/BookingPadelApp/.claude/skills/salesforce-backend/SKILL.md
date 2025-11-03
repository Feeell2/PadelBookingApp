name: sf-backend
description: Salesforce Backend - Apex Classes + Tests
---

# Salesforce Backend

## Rules
1. Bulkify (handle 200+ records)
2. SOQL outside loops
3. WITH SECURITY_ENFORCED
4. Test >75% coverage

## Templates
Use `/templates/ApexClass.apex` and `/templates/TestClass.apex`

## Structure
```
force-app/main/default/classes/
├── AccountService.cls
├── AccountServiceTest.cls
├── LeadHelper.cls
└── LeadHelperTest.cls
```
