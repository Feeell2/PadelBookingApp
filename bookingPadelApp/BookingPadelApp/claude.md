# Padel Booking - Publiczna Aplikacja Webowa

System rezerwacji kortów do padla **bez wymagania logowania** - publiczna strona dostępna dla wszystkich.

**Stack**: Experience Cloud + LWC + Apex (without sharing) | **Prefix**: `padel*`

---

## 📦 Custom Objects

### Padel_Game__c
- `Game_Date__c` (Date) | `Game_Time__c` (Time) | `Court_Name__c` (Picklist)
- `Total_Price__c` (Currency) | `Price_Per_Person__c` (Formula)
- `Max_Players__c` (Number, default: 4) | `Current_Players__c` (Number)
- `Status__c` (Picklist: Dostępna/Zarezerwowana/Pełna/Anulowana)
- `Share_Link__c` (URL) | `Day_Of_Week__c` (Formula: Pn-Nd)

### Padel_Player__c
- `Game__c` (Master-Detail) | `Player_Name__c` (Text)
- `Payment_Status__c` (Picklist: Zapłacone/Niezapłacone)
- `Email__c` | `Phone__c` | `Registration_Date__c`

---

## ⚡ Apex Controller

**PadelGameController.cls** - **`without sharing`** (publiczny dostęp):
```apex
public without sharing class PadelGameController {
    @AuraEnabled(cacheable=true)
    public static List<Padel_Game__c> getAvailableGames() {}
    
    @AuraEnabled
    public static Id createGame(String gameData) {}
    
    @AuraEnabled
    public static Id addPlayerToGame(String gameId, String playerName) {}
    
    @AuraEnabled
    public static void updatePlayerPaymentStatus(String playerId, String status) {}
    
    @AuraEnabled
    public static void removePlayerFromGame(String playerId) {}
    
    @AuraEnabled
    public static void deleteGame(String gameId) {}
}
```

⚠️ **WAŻNE**: `without sharing` = pełny dostęp dla Guest User (niezalogowanych użytkowników)

---

## 🎨 Lightning Web Components

**Wszystkie komponenty wymagają `isExposed=true` oraz target `lightningCommunity__Page`**

| Komponent | Rola | Kluczowe funkcje |
|-----------|------|------------------|
| **padelBookingApp** | Główny kontener | Zakładki: "Zapisz się" ↔ "Stwórz wyjście" |
| **padelBookingList** | Lista gier | @wire(getAvailableGames), wyświetla karty |
| **padelGameCard** | Karta gry | Data, kort, cena, gracze, status 3/4 |
| **padelPlayerItem** | Element gracza | Ikona płatności ✓/✗, przycisk usuń |
| **padelBookingForm** | Formularz | lightning-record-edit-form, tworzenie gry |
| **padelCreatedGameItem** | Zarządzanie grą | Checkboxy płatności, link, edycja/usuń |

**Przykład meta.xml dla Experience Cloud:**
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

## 🚀 Deployment

```bash
# 1. Login
sf org login web --alias my-org

# 2. Deploy
sf project deploy start --source-dir force-app/

# 3. Testy
sf apex run test --test-level RunLocalTests --code-coverage
```

**Struktura:**
```
force-app/main/default/
├── objects/ (Padel_Game__c, Padel_Player__c)
├── classes/ (PadelGameController without sharing)
├── lwc/ (6 komponentów z prefiksem padel*)
└── profiles/ (Guest User Profile with permissions)
```

---

## ⚙️ Konfiguracja Experience Cloud (KRYTYCZNE!)

### 1. Utwórz Experience Cloud Site
```
Setup → Digital Experiences → New
- Template: "Build Your Own (LWR)"
- Name: "Padel Booking"
- URL: yourorg.my.site.com/padelbooking
```

### 2. Konfiguracja Guest User Profile
```
Setup → Digital Experiences → Workspaces → Administration → Preferences
→ Guest User Profile
```

**Nadaj uprawnienia Guest User:**
- **Object Settings**: Padel_Game__c (Read, Create, Edit, Delete)
- **Object Settings**: Padel_Player__c (Read, Create, Edit, Delete)
- **Apex Class Access**: PadelGameController (Enabled)
- **Field-Level Security**: ALL fields dla obu obiektów (Read/Edit)

### 3. Sharing Settings (OWD - Organization-Wide Defaults)
```
Setup → Sharing Settings
```

**Padel_Game__c:**
- Default Internal Access: Public Read/Write
- Default External Access: Public Read/Write
- ☑ Grant Access Using Hierarchies

**Padel_Player__c:**
- Default Internal Access: Controlled by Parent
- Default External Access: Controlled by Parent

### 4. Guest User Sharing Rules (opcjonalnie)
```
Setup → Sharing Settings → Sharing Rules
- Utwórz "Guest User Access" rule
- Criteria: Wszystkie rekordy
- Share with: Guest User
- Access Level: Read/Write
```

### 5. Dodaj komponent do strony
- Experience Builder → Edit Site → Page
- Przeciągnij `padelBookingApp` na stronę
- **Publish** site

### 6. Aktywuj publiczny dostęp
```
Setup → Digital Experiences → Settings
☑ Enable public access
☑ Allow guest users
```

**URL publiczny:** `https://yourorg.my.site.com/padelbooking`

---

## 🔧 Troubleshooting

### "Insufficient Privileges" dla Guest User?
1. Sprawdź Guest User Profile → Object Permissions (CRUD)
2. Sprawdź Field-Level Security (wszystkie pola Visible)
3. Sprawdź Apex Class Access (PadelGameController enabled)
4. Potwierdź OWD = Public Read/Write
5. Upewnij się, że `without sharing` w Apex

### Komponenty nie widoczne w Experience Builder?
- Sprawdź `isExposed="true"` w meta.xml
- Sprawdź `<target>lightningCommunity__Page</target>`
- Zrefreshuj cache: Setup → Digital Experiences → Clear Cache

### Guest User nie może zapisywać danych?
```apex
// Upewnij się, że jest without sharing:
public without sharing class PadelGameController {
    // nie: public with sharing
}
```

### Limity Guest User przekroczone?
- Guest User ma limit **10,000 requests/day**
- Rozważ cacheable queries: `@AuraEnabled(cacheable=true)`
- Monitoruj: Setup → System Overview → API Usage

---

## 🔒 Bezpieczeństwo

⚠️ **UWAGA**: Aplikacja jest całkowicie publiczna! Każdy może:
- Tworzyć gry
- Dodawać/usuwać graczy
- Zmieniać statusy płatności

**Zalecane dodatkowe zabezpieczenia:**
- reCAPTCHA na formularzu
- Rate limiting w Apex
- Validation rules na obiektach
- Email verification dla twórców gier

---

## 📝 Notatki

### Wymagania techniczne:
- **Experience Cloud License** wymagana w Salesforce org
- Apex Controller musi być **`without sharing`** dla Guest User
- Wszystkie LWC z `target: lightningCommunity__Page`
- Guest User Profile z pełnym dostępem do obiektów i Apex

### Dostęp publiczny:
- ✅ Każdy może przeglądać gry bez logowania
- ✅ Każdy może tworzyć nowe wyjścia
- ✅ Każdy może dołączać jako gracz
- ⚠️ Brak autentykacji = potencjalne spam/abuse

### Automatyzacje:
- Formula field `Price_Per_Person__c` dzieli cenę automatycznie
- Status gry aktualizuje się przy dodawaniu/usuwaniu graczy
- `Current_Players__c` inkrementuje się automatycznie
- Link do udostępnienia generowany przy tworzeniu

### Koszty Salesforce:
- Experience Cloud wymaga **dodatkowej licencji** (nie działa na Developer Edition bez dodatkowego setupu)
- Guest User ma limit **zapytań API** (sprawdź limity w swoim org)

---

**Wersja:** 1.0 | **Publiczna strona bez logowania** 🌐 | **Experience Cloud ready** ✅