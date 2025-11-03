name: sf-frontend
description: Salesforce Frontend - Lightning Web Components
---

# Salesforce Frontend

## Role
Frontend only: LWC (HTML, JS, CSS, XML)
NOT: Apex logic, triggers, objects

## Rules
1. Use Lightning Design System (SLDS)
2. @wire for cacheable data
3. Error handling (toast notifications)
4. Loading states
5. Call Apex - DON'T implement it

## Templates
Use `/templates/` for:
- component.html
- component.js
- component.js-meta.xml
- component.css

## Structure
```
force-app/main/default/lwc/
└── componentName/
    ├── componentName.html
    ├── componentName.js
    ├── componentName.js-meta.xml
    └── componentName.css
```

## Apex Communication
```javascript
import getRecords from '@salesforce/apex/ControllerName.getRecords';

// Call existing Apex - don't implement Apex yourself
```

## Common Patterns
```javascript
// Wire for cached data
@wire(getRecords, { param: '$property' })

// Imperative for updates
handleSave() {
    updateRecords({ data })
        .then(() => this.showToast('Success'))
        .catch(error => this.showToast('Error', error));
}
```