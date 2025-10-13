# Git Flow Strategy - Flight Finder AI

## Overview

Ten projekt używa **uproszczonego Git Flow** z 2 głównymi branchami:
- **`main`** - stabilna wersja produkcyjna (zawsze działająca)
- **`develop`** - branch deweloperski do integracji zmian

## Branch Structure

```
main (production)
  ↑
  │ merge after testing
  │
develop (development)
  ↑
  │ merge via Pull Request
  │
  ├── feature/booking-system
  ├── feature/user-authentication
  └── fix/filter-reset-bug
```

---

## Workflow

### 1. Rozpoczęcie pracy nad nowym feature'em

```bash
# Upewnij się, że develop jest aktualny
git checkout develop
git pull origin develop

# Utwórz nowy feature branch
git checkout -b feature/add-booking-system

# Pracuj nad kodem i commituj
git add .
git commit -m "feat(backend): add booking controller and routes"
git commit -m "feat(frontend): create BookingForm component"

# Push do remote
git push -u origin feature/add-booking-system
```

**Następnie:**
1. Otwórz Pull Request na GitHub: `feature/add-booking-system` → `develop`
2. Poczekaj na code review
3. Po aprobacie: merge do `develop`
4. Usuń branch lokalnie i na remote

---

### 2. Deploy do produkcji

```bash
# Po przetestowaniu zmian na develop, merge do main
git checkout main
git pull origin main
git merge develop

# Dodaj tag wersji (Semantic Versioning)
git tag -a v1.1.0 -m "Release: Add booking system and improved filters"

# Push do produkcji
git push origin main --tags
```

**Po push do `main` następuje automatyczny deployment do produkcji.**

---

### 3. Hotfix (pilna naprawa produkcji)

Jeśli pojawi się krytyczny bug w produkcji, który wymaga natychmiastowej naprawy:

```bash
# Utwórz hotfix branch z main
git checkout main
git pull origin main
git checkout -b hotfix/fix-amadeus-token-expiry

# Napraw bug
git add backend/src/services/amadeusAPI.ts
git commit -m "fix(backend): resolve token refresh race condition"

# Merge do main
git checkout main
git merge hotfix/fix-amadeus-token-expiry
git tag -a v1.0.1 -m "Hotfix: Amadeus token refresh issue"
git push origin main --tags

# WAŻNE: Merge również do develop, żeby fix był w przyszłych wersjach
git checkout develop
git merge hotfix/fix-amadeus-token-expiry
git push origin develop

# Usuń branch hotfix
git branch -d hotfix/fix-amadeus-token-expiry
git push origin --delete hotfix/fix-amadeus-token-expiry
```

---

## Branch Naming Conventions

| Typ | Nazwa | Przykład | Kiedy używać |
|-----|-------|----------|--------------|
| **Feature** | `feature/opis-funkcjonalnosci` | `feature/add-user-auth` | Nowe funkcjonalności |
| **Fix** | `fix/opis-buga` | `fix/filter-reset-bug` | Naprawy bugów w develop |
| **Hotfix** | `hotfix/opis-pilnego-fixa` | `hotfix/critical-security-fix` | Pilne naprawy produkcji (z main) |
| **Chore** | `chore/opis-zadania` | `chore/update-dependencies` | Maintenance, refactoring |

**Zasady:**
- Używaj kebab-case (małe litery, myślniki)
- Nazwy opisowe, ale zwięzłe
- Po angielsku (dla konsystencji)

---

## Commit Message Conventions

Format: `type(scope): subject`

### Types:
- **feat**: Nowa funkcjonalność
- **fix**: Naprawa buga
- **docs**: Aktualizacja dokumentacji
- **style**: Formatowanie kodu (bez zmian logiki)
- **refactor**: Refactoring (bez zmian funkcjonalności)
- **test**: Dodanie lub aktualizacja testów
- **chore**: Maintenance (dependencies, config)

### Scope (opcjonalnie):
- `backend`, `frontend`, `api`, `ui`, `agent`, `docs`

### Examples:
```bash
git commit -m "feat(backend): add JWT authentication middleware"
git commit -m "fix(frontend): resolve race condition in flight search"
git commit -m "docs: update Git Flow strategy in CLAUDE.md"
git commit -m "style(frontend): format FiltersBar component"
git commit -m "refactor(backend): extract Amadeus API logic to service"
git commit -m "test(backend): add unit tests for agent orchestrator"
git commit -m "chore(deps): upgrade Express to v5.1.0"
```

**Zasady:**
- Subject max 72 znaki
- Imperative mood ("add" nie "added")
- Bez kropki na końcu
- Pierwsza litera mała (po dwukropku)

---

## Version Tagging

Używamy **Semantic Versioning**: `vMAJOR.MINOR.PATCH`

- **MAJOR** (v2.0.0): Breaking changes, przepisanie API
- **MINOR** (v1.1.0): Nowe funkcjonalności (backward compatible)
- **PATCH** (v1.0.1): Bug fixes, małe poprawki

### Kiedy tworzyć tag:
- Po każdym merge `develop` → `main` (release)
- Po każdym hotfix merge do `main`

```bash
# Tworzenie tagu
git tag -a v1.2.0 -m "Release: User authentication and booking system"
git push origin v1.2.0

# Lista wszystkich tagów
git tag -l

# Przejście do konkretnej wersji
git checkout v1.0.0
```

---

## Pull Request Process

### Dla feature/fix branches:

1. **Otwórz PR** na GitHub: `feature/my-feature` → `develop`
2. **Wypełnij template** (automatyczny z `.github/pull_request_template.md`)
3. **Poczekaj na review** (opcjonalnie dla małego zespołu)
4. **Sprawdź CI checks** (jeśli skonfigurowane):
   - Backend build passes
   - Frontend build passes
   - Linting passes
5. **Merge** do develop (preferowany: Squash and merge)
6. **Usuń branch** po merge'u

### Merge strategies:

| Strategia | Kiedy używać |
|-----------|--------------|
| **Squash and merge** | Feature branches z wieloma małymi commitami |
| **Merge commit** | Zachowanie pełnej historii commitów |
| **Rebase and merge** | Linearna historia (advanced) |

**Rekomendacja dla tego projektu: Squash and merge**

---

## Branch Protection Rules (GitHub)

### `main` branch:
- ✅ **Require pull request** (opcjonalnie dla solo dev)
- ✅ **Require status checks to pass** (CI/CD)
- ❌ **NIGDY nie używaj `git push --force`**
- ✅ Deploy tylko z tego brancha

### `develop` branch:
- ✅ **Require pull request** dla feature branches
- ✅ **Require status checks to pass** (CI/CD)
- ✅ Można merge'ować przez GUI lub CLI

**Jak ustawić na GitHub:**
1. Settings → Branches → Add rule
2. Branch name pattern: `main` lub `develop`
3. Zaznaczyć odpowiednie opcje

---

## Daily Workflow Tips

### Synchronizacja z develop (codziennie!)

```bash
# Jesteś na feature branch
git fetch origin develop
git merge origin/develop

# Rozwiąż konflikty jeśli są
# Commituj i push
```

### Sprawdzanie stanu

```bash
# Aktualny branch i status
git status

# Lista lokalnych branches
git branch

# Lista remote branches
git branch -r

# Różnice między develop a twoim feature
git diff develop...feature/my-feature

# Log commitów
git log --oneline --graph --decorate
```

### Czyszczenie starych branches

```bash
# Usuń lokalnie zmergowane branche
git branch --merged | grep -v "\*\|main\|develop" | xargs -n 1 git branch -d

# Usuń remote branches (które już nie istnieją)
git fetch --prune
```

---

## Rollback Strategy

### Jeśli deployment do main poszedł źle:

**Opcja 1: Revert ostatniego merge'a (bezpieczne)**
```bash
git checkout main
git revert -m 1 HEAD
git push origin main
```

**Opcja 2: Rollback do poprzedniego tagu**
```bash
git checkout v1.0.0
git checkout -b hotfix/rollback-to-stable
# Testuj
# Otwórz PR do main
```

**Opcja 3: Hot patch (najprostsze dla małych fixów)**
```bash
git checkout main
git checkout -b hotfix/urgent-fix
# Fix bug
git commit -m "fix: critical production issue"
git checkout main
git merge hotfix/urgent-fix
git tag v1.1.1
git push origin main --tags
```

---

## Quick Reference

### Frequent Commands

```bash
# Start nowego feature
git checkout develop && git pull && git checkout -b feature/my-feature

# Update feature z develop
git fetch origin develop && git merge origin/develop

# Commit z konwencją
git commit -m "feat(scope): description"

# Push nowego brancha
git push -u origin feature/my-feature

# Merge develop do main (release)
git checkout main && git merge develop && git tag v1.x.0 && git push origin main --tags

# Zobacz wszystkie branche z ostatnim commitem
git branch -vv

# Usuń branch lokalnie
git branch -d feature/my-feature

# Usuń branch na remote
git push origin --delete feature/my-feature
```

---

## Troubleshooting

### Merge conflicts

```bash
# Po git merge origin/develop
# Rozwiąż konflikty w edytorze
git add .
git commit -m "chore: resolve merge conflicts"
```

### Przypadkowy commit do złego brancha

```bash
# Jesteś na develop, ale commit powinien być na feature branch
git log  # Znajdź hash commita
git checkout feature/my-feature
git cherry-pick <commit-hash>
git checkout develop
git reset --hard HEAD~1  # Usuń commit z develop
```

### Force push (TYLKO na feature branches!)

```bash
# NIGDY na main/develop
# Tylko jeśli musisz przepisać historię swojego feature brancha
git push --force-with-lease origin feature/my-feature
```

---

## Team Guidelines

### Code Review Checklist
- [ ] Backend: `npm run build` passes
- [ ] Frontend: `npm run build` passes
- [ ] Frontend: `npm run lint` passes
- [ ] Import paths use `.js` extension (backend)
- [ ] No `console.log` in production code
- [ ] Semantic CSS classes (not Tailwind utilities)
- [ ] `.env` files not committed
- [ ] API endpoints have error handling
- [ ] Commit messages follow convention

### When to Create PR
- **Zawsze** dla feature/fix branches → develop
- **Opcjonalnie** dla develop → main (można przez CLI)
- **Zalecane** dla hotfixes → main (review mimo pilności)

### Branch Lifetime
- **Feature branches**: max 1-2 tygodnie (rozbij na mniejsze)
- **Hotfix branches**: delete natychmiast po merge
- **main/develop**: permanentne

---

## Summary

**Prosty workflow w 3 krokach:**

1. **Develop feature**: `develop` → `feature/xyz` → commit → push → PR → merge do `develop`
2. **Test on develop**: Manualne testy, CI/CD checks
3. **Deploy to production**: `develop` → `main` → tag → push → auto-deploy

**Kluczowe zasady:**
- ✅ `main` zawsze stabilny
- ✅ `develop` dla integracji
- ✅ Feature branches z PR
- ✅ Semantic versioning tags
- ✅ Hotfixy z `main`, merge do obu branches
- ✅ Regularnie sync z develop
- ❌ NIGDY force push na main/develop

---

**Questions?** Sprawdź `.github/pull_request_template.md` lub `CLAUDE.md` dla więcej szczegółów.
