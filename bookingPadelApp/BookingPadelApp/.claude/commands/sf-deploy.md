# Salesforce Deployment Command

Zadanie: Zdeployuj zmiany na Salesforce w odpowiedniej kolejności

## KROK 1 - Analiza zmian
Sprawdź które pliki zostały zmienione używając: git diff --name-only HEAD

## KROK 2 - Pogrupuj pliki według typu i priorytetu

### PRIORYTET 1 (deployuj NAJPIERW):
- objects/**/*.object-meta.xml (Custom Objects)
- objects/**/fields/*.field-meta.xml (Custom Fields)
- objects/**/recordTypes/*.recordType-meta.xml (Record Types)
- customMetadata/**/*.md-meta.xml (Custom Metadata)
- settings/**/*.settings-meta.xml (Custom Settings)

### PRIORYTET 2 (deployuj POTEM):
- objects/**/validationRules/*.validationRule-meta.xml
- workflows/**/*.workflow-meta.xml
- flows/**/*.flow-meta.xml
- classes/**/*[Util,Helper,Service,Handler].cls
- permissionsets/**/*.permissionset-meta.xml

### PRIORYTET 3 (deployuj NASTĘPNIE):
- classes/**/*.cls (pozostałe klasy)
- triggers/**/*.trigger
- lwc/**/*
- aura/**/*
- pages/**/*.page

### PRIORYTET 4 (deployuj NA KOŃCU):
- layouts/**/*.layout-meta.xml
- flexipages/**/*.flexipage-meta.xml
- applications/**/*.app-meta.xml
- tabs/**/*.tab-meta.xml

### BEZ ZNACZENIA:
- staticresources/**/*
- documents/**/*
- labels/**/*.labels-meta.xml
- reports/**/*
- dashboards/**/*

## KROK 3 - Deployment
Dla każdej grupy wykonaj:
sf project deploy start --source-dir [ścieżki] --target-org [alias]

## KROK 4 - Obsługa błędów
Zapisz błędy i zasugeruj rozwiązania

## KROK 5 - Podsumowanie
Wypisz co zostało zdeployowane

