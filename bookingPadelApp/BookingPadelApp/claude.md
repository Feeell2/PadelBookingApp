# Padel Booking App - Complete Technical Documentation

**Public web application for padel court booking** - No login required

**Stack**: Experience Cloud (LWR) + LWC + Apex (without sharing) | **API Version**: 60.0 | **Prefix**: `padel*`

---

## 📋 Table of Contents

1. [Data Model](#data-model)
2. [Architecture](#architecture)
3. [Code Conventions](#code-conventions)
4. [Adding Features](#adding-features)
5. [Testing](#testing)
6. [Deployment](#deployment)
7. [Security](#security)
8. [Troubleshooting](#troubleshooting)
9. [Performance](#performance)

---

## 🗄️ Data Model

### Entity Relationship Diagram

```
Padel_Court__c (1) ←──────┐
                           │ (Lookup)
                           │
Padel_Player__c (1) ←──────┼────────┐
    │                      │        │
    │ (Lookup)             │        │ (Lookup) Organizer
    │                      │        │
    ↓                      ↓        │
Padel_Game_Registration__c ────→ Padel_Game__c (1)
    (Junction Object)              │
                                   └─ Current_Players__c (Roll-up COUNT)
```

### Objects Summary

| Object | Purpose | Sharing | Key Fields |
|--------|---------|---------|------------|
| **Padel_Game__c** | Game sessions | Public R/W | Game_Date__c, Game_Time__c, Court__c, Organizer__c, Total_Price__c, Status__c |
| **Padel_Player__c** | Player registry | Public R/W | Player_Name__c, Email__c, Phone__c |
| **Padel_Court__c** | Court catalog | Public R/W | Court_Name__c, Location__c |
| **Padel_Game_Registration__c** | Junction: Player↔Game | Public R/W | Game__c, Player__c, Payment_Status__c, Is_Organizer__c |

### Padel_Game__c Fields

| Field | Type | Description | Formula/Default |
|-------|------|-------------|-----------------|
| Game_Date__c | Date | Game date | Required |
| Game_Time__c | Time | Start time (ms from midnight) | Required |
| Court__c | Lookup | → Padel_Court__c | Required |
| Organizer__c | Lookup | → Padel_Player__c | Required |
| Total_Price__c | Currency | Total cost | Required, >0 |
| Price_Per_Person__c | Formula | Auto cost per player | Total_Price__c / Max_Players__c |
| Duration__c | Number(16,2) | Hours (e.g. 1.5) | Required |
| Max_Players__c | Number | Player limit | Default: 4 |
| Current_Players__c | Roll-up | COUNT(registrations) | Auto-calculated |
| Status__c | Picklist | Dostępna/Zarezerwowana/Pełna/Anulowana | Default: Dostępna |
| Day_Of_Week__c | Formula | Pn-Nd | TEXT(Game_Date__c) |
| Share_Link__c | URL | Shareable link | Optional |
| Notes__c | Long Text | Additional info | Optional |

**Validation Rules**: Game_Date_Must_Be_Future, Max_Players_Must_Be_4, Total_Price_Positive

### Padel_Game_Registration__c Fields

| Field | Type | Description |
|-------|------|-------------|
| Game__c | Master-Detail | → Padel_Game__c (Required) |
| Player__c | Lookup | → Padel_Player__c (Required) |
| Payment_Status__c | Picklist | Zapłacone/Niezapłacone |
| Is_Organizer__c | Checkbox | Marks organizer |
| Registration_Date__c | DateTime | Join timestamp |

**Key Pattern**: Junction object enables many-to-many + metadata (payment status, organizer flag)

---

## 🏗️ Architecture

### Core Patterns

| Pattern | Implementation | Why |
|---------|----------------|-----|
| **Public Guest Access** | `without sharing` Apex + Public R/W OWD | Allow unauthenticated CRUD |
| **Junction Object** | Game_Registration__c | Many-to-many with metadata |
| **Wrapper Classes** | GameWrapper, PlayerWrapper | Clean API for LWC |
| **Event-Driven UI** | CustomEvents (playeradded, gamecreated) | Component communication |
| **Organizer Transfer** | Auto-assign next player when organizer leaves | Business continuity |
| **Status Automation** | Update game status based on Current_Players__c | Data consistency |

### Component Architecture

```
padelBookingApp (Container)
├── Tab: Browse Games
│   └── padelBookingList (Display)
│       └── padelGameCard (Card) [for:each]
│           └── padelPlayerItem (Player) [for:each]
└── Tab: Create Game
    └── padelBookingForm (Form)
```

### Data Flow

```
LWC → @AuraEnabled Method → SOQL/DML → Wrapper Class → LWC
                ↓
        without sharing = Guest User access
```

### Apex Controller (PadelGameController.cls)

**Methods** (all `@AuraEnabled`):

| Method | Params | Returns | Description |
|--------|--------|---------|-------------|
| getAvailableGames | - | List\<GameWrapper\> | Fetch all active games |
| getGameById | Id gameId | GameWrapper | Single game details |
| createGame | Id courtId, Id organizerPlayerId, String gameDate, ... | Id | Create new game + register organizer |
| addPlayerToGame | Id gameId, Id playerId | Id | Create registration record |
| removePlayerFromGame | Id registrationId, Boolean autoTransferOrganizer | void | Delete registration, transfer organizer if needed |
| updatePaymentStatus | Id registrationId, String paymentStatus | void | Toggle payment status |
| deleteGame | Id gameId | void | Delete game + cascade registrations |
| getAvailableCourts | - | List\<CourtOption\> | Court picker options |
| getAvailablePlayers | String searchTerm | List\<PlayerOption\> | Player picker with search |
| createPlayer | String playerName, String email, String phone | Id | New player record |

**Key Classes**:
- `GameWrapper`: Full game data with nested List<PlayerWrapper>
- `PlayerWrapper`: Player registration info
- `CourtOption/PlayerOption`: Combobox options

---

## 💻 Code Conventions

### Apex Standards

```apex
// Class: PascalCase + Suffix
PadelGameController.cls
PadelGameControllerTest.cls

// Method: camelCase + Action verb
public static Id createGame(...) {}
public static void updatePaymentStatus(...) {}

// Always wrap @AuraEnabled in try-catch
@AuraEnabled
public static ReturnType methodName(Type param) {
    try {
        // 1. Validate inputs
        if (param == null) throw new AuraHandledException('Param required');

        // 2. Query data
        List<Object> records = [SELECT ... FROM ... WHERE ...];

        // 3. Business logic
        // ...

        // 4. DML operations
        insert newRecords;

        // 5. Return
        return result;
    } catch (AuraHandledException e) {
        throw e; // Re-throw custom
    } catch (Exception e) {
        throw new AuraHandledException('Błąd: ' + e.getMessage());
    }
}
```

### LWC Standards

```javascript
// File naming: camelCase
padelBookingApp.js
padelBookingApp.html
padelBookingApp.js-meta.xml

// Properties
@api game;              // Public (from parent)
@track games = [];      // Reactive (internal)
@wire(getGames)         // Wire adapter (cached)

// Method naming
handleJoinClick()       // Event handlers: handle[Event]
get isFull()            // Computed: get [property]
validateForm()          // Helpers: descriptive

// Event dispatching
this.dispatchEvent(new CustomEvent('playeradded', {
    detail: { gameId: this.game.gameId },
    bubbles: true,
    composed: true
}));

// Async pattern
async handleSubmit() {
    this.isLoading = true;
    try {
        const result = await createGame({ /* params */ });
        this.showToast('Sukces', 'Gra utworzona', 'success');
        this.dispatchEvent(new CustomEvent('gamecreated'));
    } catch (error) {
        this.showToast('Błąd', error.body?.message || 'Błąd', 'error');
    } finally {
        this.isLoading = false;
    }
}
```

### Meta.xml Template

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>60.0</apiVersion>
    <isExposed>true</isExposed>
    <targets>
        <target>lightningCommunity__Page</target>
        <target>lightningCommunity__Default</target>
    </targets>
</LightningComponentBundle>
```

---

## 🚀 Adding Features

### Recipe 1: Add Field to Existing Object

**Example**: Add `Game_Level__c` (Beginner/Intermediate/Advanced) to Padel_Game__c

1. **Create field metadata**: `force-app/main/default/objects/Padel_Game__c/fields/Game_Level__c.field-meta.xml`
```xml
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Game_Level__c</fullName>
    <label>Game Level</label>
    <type>Picklist</type>
    <valueSet>
        <valueSetDefinition>
            <value><fullName>Beginner</fullName><label>Początkujący</label></value>
            <value><fullName>Intermediate</fullName><label>Średniozaawansowany</label></value>
            <value><fullName>Advanced</fullName><label>Zaawansowany</label></value>
        </valueSetDefinition>
    </valueSet>
</CustomField>
```

2. **Update Apex**:
```apex
// Add to GameWrapper
@AuraEnabled public String gameLevel;

// Update queries
SELECT Id, Game_Level__c, ... FROM Padel_Game__c

// Update buildGameWrappers()
gw.gameLevel = game.Game_Level__c;

// Update createGame() signature
public static Id createGame(..., String gameLevel) {
    newGame.Game_Level__c = gameLevel;
}
```

3. **Update LWC**:
```html
<!-- padelBookingForm.html -->
<lightning-combobox label="Poziom" value={gameLevel} options={gameLevelOptions}></lightning-combobox>
```

```javascript
// padelBookingForm.js
gameLevelOptions = [
    { label: 'Początkujący', value: 'Beginner' },
    { label: 'Średniozaawansowany', value: 'Intermediate' },
    { label: 'Zaawansowany', value: 'Advanced' }
];
```

4. **Update tests**: Add test case for new parameter

5. **Deploy**: `sf project deploy start --source-dir force-app/`

### Recipe 2: Add New LWC Component

1. **Create component**:
```bash
sfdx force:lightning:component:create --type lwc --componentname padelGameFilter --outputdir force-app/main/default/lwc
```

2. **Implement logic** (padelGameFilter.js):
```javascript
export default class PadelGameFilter extends LightningElement {
    handleCourtChange(event) {
        this.dispatchEvent(new CustomEvent('filterchange', {
            detail: { court: event.detail.value },
            bubbles: true, composed: true
        }));
    }
}
```

3. **Add to parent**:
```html
<c-padel-game-filter onfilterchange={handleFilterChange}></c-padel-game-filter>
```

4. **Configure meta.xml** with `isExposed="true"` and `lightningCommunity__Page` target

### Recipe 3: Add Server-Side Filtering

**Enhance getAvailableGames() with parameters**:

```apex
@AuraEnabled
public static List<GameWrapper> getAvailableGames(Id courtId, Date startDate, String gameLevel) {
    String query = 'SELECT ... FROM Padel_Game__c WHERE Status__c != \'Anulowana\'';

    if (courtId != null) query += ' AND Court__c = :courtId';
    if (startDate != null) query += ' AND Game_Date__c >= :startDate';
    if (String.isNotBlank(gameLevel)) query += ' AND Game_Level__c = :gameLevel';

    query += ' ORDER BY Game_Date__c ASC LIMIT 100';
    return buildGameWrappers(Database.query(query));
}
```

---

## 🧪 Testing

### Test Coverage: 90%+ (Current: PadelGameControllerTest.cls - 751 lines)

### Test Method Categories

```apex
@TestSetup
static void setupTestData() {
    // Create reusable test data
    insert new Padel_Court__c(Court_Name__c = 'Test Court');
    insert new Padel_Player__c(Player_Name__c = 'Test Player');
}

// 1. Positive Test
@isTest
static void testCreateGame() {
    Test.startTest();
    Id gameId = PadelGameController.createGame(/* valid params */);
    Test.stopTest();

    System.assertNotEquals(null, gameId);
    Padel_Game__c game = [SELECT Status__c FROM Padel_Game__c WHERE Id = :gameId];
    System.assertEquals('Dostępna', game.Status__c);
}

// 2. Negative Test
@isTest
static void testCreateGameMissingFields() {
    try {
        PadelGameController.createGame(null, null, null, null, null, null, null, null);
        System.assert(false, 'Should throw exception');
    } catch (AuraHandledException e) {
        System.assert(e.getMessage().contains('wymagany'));
    }
}

// 3. Boundary Test
@isTest
static void testAddPlayerToFullGame() {
    // Create game with max=2, add 2 players, attempt 3rd
    // Assert: Exception thrown
}

// 4. Integration Test
@isTest
static void testOrganizerTransfer() {
    // Remove organizer with autoTransferOrganizer=true
    // Assert: New organizer assigned
}
```

### Testing Checklist

- [ ] Positive scenario with valid inputs
- [ ] Missing required fields
- [ ] Null/blank inputs
- [ ] Boundary conditions (min/max)
- [ ] Related record updates (cascade)
- [ ] Status transitions
- [ ] Bulk operations (50+ records)

### Run Tests

```bash
# All tests
sf apex run test --test-level RunLocalTests --code-coverage

# Specific class
sf apex run test --class-names PadelGameControllerTest
```

---

## 🚢 Deployment

### Pre-Deployment Checklist

- [ ] All tests pass: `sf apex run test --test-level RunLocalTests`
- [ ] Code coverage ≥ 75%
- [ ] No compilation errors
- [ ] LWC meta.xml includes `isExposed="true"` + `lightningCommunity__Page`
- [ ] Guest User Profile includes permissions for new objects/fields

### Deploy Commands

```bash
# Full deployment
sf project deploy start --source-dir force-app/ --wait 30

# Validate only (no deploy)
sf project deploy start --source-dir force-app/ --check-only --test-level RunLocalTests

# Deploy specific metadata
sf project deploy start --metadata ApexClass
sf project deploy start --source-dir force-app/main/default/lwc/padelGameCard/
```

### Post-Deployment

1. **Verify Guest User Permissions**:
   ```
   Setup → Profiles → [Guest User Profile]
   → Object Settings → Verify CRUD for all objects
   → Apex Class Access → Verify PadelGameController enabled
   ```

2. **Clear Experience Cloud Cache**:
   ```
   Setup → Digital Experiences → [Site] → Clear Cache
   ```

3. **Smoke Test**: Visit public URL in incognito, test CRUD operations

### Rollback

```bash
# Revert to previous commit
git checkout [previous-commit-hash]
sf project deploy start --source-dir force-app/
```

---

## 🔒 Security

### Current Model: PUBLIC ACCESS (No Authentication)

**Security Settings**:
- Apex: `without sharing` (bypasses record-level security)
- OWD: Public Read/Write for all objects
- Guest User Profile: Full CRUD permissions
- No login required = **Anyone can modify any data**

### Recommended Enhancements

| Enhancement | Implementation | Benefit |
|-------------|----------------|---------|
| **reCAPTCHA** | Google reCAPTCHA v3 on forms | Prevent bot spam |
| **Rate Limiting** | Track actions per session, limit 5 games/hour | Prevent abuse |
| **Email Verification** | Send token on game creation, verify before public | Accountability |
| **Content Moderation** | Keyword filter in notes fields | Block inappropriate content |
| **Audit Logging** | Custom object to track all actions + IP | Traceability |

**Example Rate Limiting**:
```apex
private static void checkRateLimit() {
    Integer recentGames = [
        SELECT COUNT() FROM Padel_Game__c
        WHERE CreatedDate = LAST_N_HOURS:1
          AND CreatedById IN (SELECT Id FROM User WHERE Profile.Name LIKE '%Guest%')
    ];
    if (recentGames >= 5) {
        throw new AuraHandledException('Przekroczono limit. Spróbuj za godzinę.');
    }
}
```

### Monitor

```
Setup → System Overview → API Usage
→ Guest User API Requests: Limit 10,000/day
→ Set alert at 8,000/day (80% threshold)
```

---

## 🔧 Troubleshooting

### Issue 1: "Insufficient Privileges"

**Causes**: Missing Guest User permissions

**Fix**:
1. `Setup → Profiles → [Guest User] → Object Settings` - Enable CRUD
2. `Setup → Sharing Settings` - Set OWD to Public R/W
3. Verify `without sharing` in Apex class
4. Check Field-Level Security (all fields Visible)

### Issue 2: Component Not in Experience Builder

**Fix**:
1. Verify `isExposed="true"` in meta.xml
2. Verify `<target>lightningCommunity__Page</target>`
3. Redeploy: `sf project deploy start --source-dir force-app/main/default/lwc/`
4. Clear cache: `Setup → Digital Experiences → Clear Cache`

### Issue 3: Games Not Loading

**Debug**:
```javascript
// Browser console (F12)
console.log('Games:', this.games);

// Developer Console → Execute Anonymous
List<PadelGameController.GameWrapper> games = PadelGameController.getAvailableGames();
System.debug('Count: ' + games.size());
```

**Common causes**:
- Query filters out all games (check `Game_Date__c >= TODAY`)
- JavaScript error in LWC
- Wire adapter not refreshing

### Issue 4: Current_Players__c Wrong

**Cause**: Roll-up calculation delay (~500ms async)

**Fix**: Add delay before refresh
```javascript
await new Promise(resolve => setTimeout(resolve, 500));
await this.loadGames();
```

### Issue 5: Guest User API Limit

**Limit**: 10,000 requests/day (shared across all guest users)

**Fix**:
- Add `@AuraEnabled(cacheable=true)` to read-only methods
- Use Lightning Data Service (LDS) where possible
- Batch operations in Apex

### Issue 6: Time Zone Issues

**Problem**: Time field stores UTC milliseconds, displays in local timezone

**Fix**: Convert in LWC
```javascript
convertMillisecondsToTime(ms) {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
```

---

## ⚡ Performance

### Current Benchmarks

| Operation | Target | Alert Threshold |
|-----------|--------|-----------------|
| Page load (no cache) | <2s | >5s |
| Page load (cached) | <500ms | >1s |
| Create game | <1s | >3s |
| Join game | <500ms | >2s |

### Optimization Strategies

**1. Query Optimization** (Avoid N+1)
```apex
// ❌ BAD: N queries
for (Padel_Game__c game : games) {
    List<Registration__c> regs = [SELECT ... WHERE Game__c = :game.Id];
}

// ✅ GOOD: 1 query
List<Padel_Game__c> games = [
    SELECT Id, (SELECT ... FROM Game_Registrations__r)
    FROM Padel_Game__c
];
```

**2. Selective Fields** (Query only what's needed)
```apex
// Only select fields used in UI
SELECT Id, Name, Game_Date__c, Court__r.Court_Name__c
FROM Padel_Game__c
// Don't select: CreatedDate, LastModifiedDate, etc.
```

**3. Pagination** (Limit results)
```apex
@AuraEnabled
public static GameListWrapper getGamesPaginated(Integer pageSize, Integer offset) {
    Integer total = [SELECT COUNT() FROM Padel_Game__c WHERE ...];
    List<Padel_Game__c> games = [SELECT ... LIMIT :pageSize OFFSET :offset];
    return new GameListWrapper(games, total);
}
```

**4. Caching** (Use @wire for read-only)
```javascript
@wire(getAvailableGames)  // Cached automatically
wiredGames({ data, error }) { ... }
```

**5. Bulkify DML** (No DML in loops)
```apex
// ❌ BAD
for (Id regId : registrationIds) {
    update new Registration__c(Id = regId, ...);
}

// ✅ GOOD
List<Registration__c> regsToUpdate = new List<Registration__c>();
for (Id regId : registrationIds) {
    regsToUpdate.add(new Registration__c(Id = regId, ...));
}
update regsToUpdate;
```

### Monitor Performance

```apex
// Add timing logs
Long start = System.currentTimeMillis();
// ... logic ...
System.debug('Time: ' + (System.currentTimeMillis() - start) + 'ms');
```

```
Setup → Query Plan Tool
→ Check for "Using Index" (good) vs "Table Scan" (bad)
```

---

## 📦 Experience Cloud Setup

### 1. Create Site

```
Setup → Digital Experiences → New
- Template: "Build Your Own (LWR)"
- Name: "Padel Booking"
- URL: yourorg.my.site.com/padelbooking
```

### 2. Configure Guest User Profile

```
Setup → Digital Experiences → [Site] → Administration → Preferences → Guest User Profile
```

**Grant Permissions**:
- Object Settings: All 4 objects (CRUD)
- Apex Class Access: PadelGameController (Enabled)
- Field-Level Security: All fields (Read/Edit)

### 3. Set Sharing (OWD)

```
Setup → Sharing Settings
```
- Padel_Game__c: Public Read/Write
- Padel_Player__c: Public Read/Write
- Padel_Court__c: Public Read/Write
- Padel_Game_Registration__c: Public Read/Write

### 4. Add Component

```
Experience Builder → Edit → Add padelBookingApp to page → Publish
```

### 5. Enable Public Access

```
Setup → Digital Experiences → Settings
☑ Enable public access
☑ Allow guest users
```

**Public URL**: `https://yourorg.my.site.com/padelbooking`

---

## 📁 Project Structure

```
force-app/main/default/
├── objects/
│   ├── Padel_Game__c/
│   │   ├── Padel_Game__c.object-meta.xml
│   │   ├── fields/
│   │   │   ├── Game_Date__c.field-meta.xml
│   │   │   ├── Game_Time__c.field-meta.xml
│   │   │   ├── Court__c.field-meta.xml
│   │   │   └── ...
│   │   └── validationRules/
│   ├── Padel_Player__c/
│   ├── Padel_Court__c/
│   └── Padel_Game_Registration__c/
├── classes/
│   ├── PadelGameController.cls
│   ├── PadelGameController.cls-meta.xml
│   ├── PadelGameControllerTest.cls
│   └── PadelGameControllerTest.cls-meta.xml
└── lwc/
    ├── padelBookingApp/
    ├── padelBookingList/
    ├── padelGameCard/
    ├── padelPlayerItem/
    └── padelBookingForm/
```

---

## 🔄 Business Logic

### Status Automation

**Trigger**: After player add/remove

```apex
private static void updateGameStatus(Id gameId) {
    Padel_Game__c game = [SELECT Current_Players__c, Max_Players__c, Status__c
                          FROM Padel_Game__c WHERE Id = :gameId];

    if (game.Status__c == 'Anulowana') return; // Don't auto-change cancelled

    if (game.Current_Players__c == 0) {
        game.Status__c = 'Dostępna';
    } else if (game.Current_Players__c >= game.Max_Players__c) {
        game.Status__c = 'Pełna';
    } else if (game.Current_Players__c >= game.Max_Players__c - 1) {
        game.Status__c = 'Zarezerwowana';
    } else {
        game.Status__c = 'Dostępna';
    }

    update game;
}
```

### Organizer Transfer

**Trigger**: When organizer leaves game

```apex
if (isOrganizer && autoTransferOrganizer) {
    // Find next oldest registered player
    List<Padel_Game_Registration__c> otherRegs = [
        SELECT Player__c FROM Padel_Game_Registration__c
        WHERE Game__c = :gameId AND Id != :registrationId
        ORDER BY Registration_Date__c ASC LIMIT 1
    ];

    if (!otherRegs.isEmpty()) {
        // Transfer organizer role
        game.Organizer__c = otherRegs[0].Player__c;
        otherRegs[0].Is_Organizer__c = true;
        update new List<SObject>{ game, otherRegs[0] };
    } else {
        // No players left - cancel game
        game.Status__c = 'Anulowana';
        update game;
    }
}
```

---

## 📊 Key Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Apex Classes | 2 | Controller + Test |
| Apex Lines | 1,807 | 1,056 (Controller) + 751 (Test) |
| Test Coverage | 90%+ | Exceeds 75% requirement |
| LWC Components | 5 | All exposed to Experience Cloud |
| Custom Objects | 4 | 1 junction object |
| Validation Rules | 10 | Across all objects |
| Guest User API Limit | 10,000/day | Monitor usage |
| Max Query Results | 100 | LIMIT in queries |

---

## 🎯 Quick Reference

### Common Tasks

| Task | Command/Location |
|------|------------------|
| Deploy all | `sf project deploy start --source-dir force-app/` |
| Run tests | `sf apex run test --test-level RunLocalTests` |
| Check coverage | Add `--code-coverage` to test command |
| Clear cache | Setup → Digital Experiences → Clear Cache |
| View logs | Setup → Debug Logs → New (User = Guest User) |
| Monitor API usage | Setup → System Overview → API Usage |
| Guest User perms | Setup → Profiles → [Guest User] → Object Settings |

### Quick Troubleshooting

| Error | Quick Fix |
|-------|-----------|
| Insufficient Privileges | Check Guest User Profile CRUD + Apex access |
| Component not visible | Verify `isExposed="true"` + redeploy + clear cache |
| Games not loading | Check query filters + browser console |
| Roll-up wrong | Add 500ms delay before refresh |
| API limit | Add `cacheable=true` to read methods |

---

**Version**: 2.0 | **Last Updated**: 2025-10-30 | **Experience Cloud Ready** ✅
