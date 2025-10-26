# Padel Booking - Quick Start Guide

## 🚀 Deploy in 10 Minutes

### Step 1: Login to Salesforce
```bash
sf org login web --alias myorg
```

### Step 2: Deploy
```bash
./deploy.sh myorg
```

### Step 3: Manual Setup (5 minutes)

1. **Setup → Sites → Settings** → Enable Sites
2. **Setup → Sites → New**
   - Label: `Padel Booking`
   - Name: `padelbooking`
   - Home Page: `PadelBooking`
3. **Setup → Sites → [Padel Booking] → Public Access Settings**
   - Enable Apex: `PadelGameController`
   - Enable VF Page: `PadelBooking`
   - Object Permissions: Both objects → Read/Create/Edit/Delete
   - Field Security: All fields → Read + Edit
4. **Setup → Sites → [Padel Booking] → Site Details**
   - ☑ Enable Lightning Features for Guest User
5. **Setup → Sharing Settings**
   - Padel_Game__c → Public Read/Write
6. **Setup → Sites → [Padel Booking]** → Click **Activate**

### Step 4: Test

Open in browser:
```
https://yourorg.force.com/padelbooking
```

✅ **Done!** You now have a public padel booking site.

---

## 📋 Checklist

- [ ] Salesforce CLI installed
- [ ] Logged into org
- [ ] Deployment script executed successfully
- [ ] All tests passed (75%+ coverage)
- [ ] Sites enabled
- [ ] Site created
- [ ] Public Access Settings configured
- [ ] Lightning Features enabled for Guest User
- [ ] Sharing Settings = Public Read/Write
- [ ] Site activated
- [ ] Public URL accessible

---

## 🆘 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| "Insufficient Privileges" | Check Public Access Settings → Object Permissions |
| White screen | Enable Lightning Features for Guest User |
| Component not found | Clear cache: Setup → Sites → Clear Cache |
| Tests fail | Run: `sf apex run test --class-names PadelGameControllerTest` |

---

## 📚 Full Documentation

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed instructions.
