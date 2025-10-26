# Frontend Specification: Date Selection Feature

## 📋 Przegląd
Implementacja wyboru dat (departure/return) za pomocą date pickerów z opcją elastycznych dat.

**Biblioteka**: `react-datepicker`
**Umiejscowienie**: FiltersBar (poziomy layout)
**Walidacja**: Lokalna (soft) + Backend (hard)

---

## 🚀 Krok 1: Instalacja Zależności

```bash
cd frontend
npm install react-datepicker
npm install --save-dev @types/react-datepicker
```

**Weryfikacja**:
```bash
# Sprawdź czy dodane do package.json
grep "react-datepicker" package.json
```

---

## 🔧 Krok 2: Aktualizacja Typów

**Plik**: `frontend/src/types/index.ts`

### 2.1. Dodać nowe pole `flexibleDates`

```typescript
/**
 * User preferences for flight search
 */
export interface UserPreferences {
  budget: number;
  origin: string;
  travelStyle: 'adventure' | 'relaxation' | 'culture' | 'party' | 'nature';
  preferredDestinations?: string[];
  departureDate?: string;      // ⚠️ Pozostawić opcjonalne na frontendzie
  returnDate?: string;          // ⚠️ Pozostawić opcjonalne na frontendzie
  flexibleDates?: boolean;      // ✨ NOWE: Flexible dates flag
}
```

**Uwaga**: Na frontendzie daty pozostają opcjonalne (TypeScript nie wymusza), ale UI **wymaga** ich wypełnienia przed wysłaniem.

---

## 🎨 Krok 3: Komponent FiltersBar

**Plik**: `frontend/src/components/FiltersBar.tsx`

### 3.1. Import react-datepicker

```typescript
import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import type { UserPreferences } from '../types';
```

### 3.2. Dodać state dla dat

```typescript
export default function FiltersBar({
  onSearch,
  onReset,
  loading,
}: FiltersBarProps) {
  const [budget, setBudget] = useState(500);
  const [origin, setOrigin] = useState('WAW');
  const [travelStyle, setTravelStyle] = useState<UserPreferences['travelStyle']>('culture');

  // ✨ NOWE: Date states
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [flexibleDates, setFlexibleDates] = useState(false);

  // ✨ NOWE: Validation error state
  const [dateError, setDateError] = useState<string | null>(null);

  // ... rest of component
}
```

### 3.3. Funkcje pomocnicze

```typescript
// Format Date to YYYY-MM-DD
const formatDateToString = (date: Date | null): string | undefined => {
  if (!date) return undefined;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Validate dates locally (soft validation)
const validateDates = (): boolean => {
  setDateError(null);

  // Check if dates are selected
  if (!departureDate || !returnDate) {
    setDateError('Please select both departure and return dates');
    return false;
  }

  // Check if departure is in the future (at least tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  if (departureDate < tomorrow) {
    setDateError('Departure date must be at least tomorrow');
    return false;
  }

  // Check if return is after departure
  if (returnDate <= departureDate) {
    setDateError('Return date must be after departure date');
    return false;
  }

  // Check trip length (1-30 days)
  const tripDays = Math.ceil(
    (returnDate.getTime() - departureDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (tripDays < 1) {
    setDateError('Trip must be at least 1 day long');
    return false;
  }

  if (tripDays > 30) {
    setDateError('Trip cannot be longer than 30 days');
    return false;
  }

  // Check if departure is within 330 days (Amadeus limit)
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 330);

  if (departureDate > maxDate) {
    setDateError('Departure date cannot be more than 330 days in the future');
    return false;
  }

  return true;
};
```

### 3.4. Aktualizować handleSubmit

```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  // ✨ Validate dates
  if (!validateDates()) {
    return; // Don't submit if validation fails
  }

  onSearch({
    budget,
    origin,
    travelStyle,
    departureDate: formatDateToString(departureDate),
    returnDate: formatDateToString(returnDate),
    flexibleDates,
  });
};
```

### 3.5. Aktualizować handleReset

```typescript
const handleReset = () => {
  setBudget(500);
  setOrigin('WAW');
  setTravelStyle('culture');
  setDepartureDate(null);      // ✨ Reset dates
  setReturnDate(null);          // ✨ Reset dates
  setFlexibleDates(false);      // ✨ Reset flexible flag
  setDateError(null);           // ✨ Clear errors
  onReset();
};
```

### 3.6. Dodać Date Pickers do JSX

**Umiejscowienie**: W `<div className="filters-grid">`, po Origin, przed Travel Style

```tsx
{/* Filters Grid */}
<div className="filters-grid">

  {/* Budget Filter */}
  <div className="filter-group">
    {/* ... existing budget code ... */}
  </div>

  {/* Origin Filter */}
  <div className="filter-group">
    {/* ... existing origin code ... */}
  </div>

  {/* ✨ NEW: Departure Date Filter */}
  <div className="filter-group">
    <label className="filter-label">
      Departure Date
    </label>
    <DatePicker
      selected={departureDate}
      onChange={(date: Date | null) => {
        setDepartureDate(date);
        setDateError(null); // Clear error on change
      }}
      selectsStart
      startDate={departureDate}
      endDate={returnDate}
      minDate={new Date(new Date().setDate(new Date().getDate() + 1))} // Tomorrow
      maxDate={new Date(new Date().setDate(new Date().getDate() + 330))} // +330 days
      placeholderText="Select departure"
      dateFormat="yyyy-MM-dd"
      disabled={loading}
      className="date-picker-input"
      wrapperClassName="date-picker-wrapper"
      required
    />
  </div>

  {/* ✨ NEW: Return Date Filter */}
  <div className="filter-group">
    <label className="filter-label">
      Return Date
    </label>
    <DatePicker
      selected={returnDate}
      onChange={(date: Date | null) => {
        setReturnDate(date);
        setDateError(null); // Clear error on change
      }}
      selectsEnd
      startDate={departureDate}
      endDate={returnDate}
      minDate={departureDate ? new Date(departureDate.getTime() + 24 * 60 * 60 * 1000) : new Date()} // Day after departure
      maxDate={departureDate ? new Date(departureDate.getTime() + 30 * 24 * 60 * 60 * 1000) : undefined} // Max 30 days trip
      placeholderText="Select return"
      dateFormat="yyyy-MM-dd"
      disabled={loading || !departureDate}
      className="date-picker-input"
      wrapperClassName="date-picker-wrapper"
      required
    />
  </div>

  {/* Travel Style Filter */}
  <div className="filter-group">
    {/* ... existing travel style code ... */}
  </div>

</div>

{/* ✨ NEW: Flexible Dates Checkbox (below filters grid) */}
<div className="flexible-dates-section">
  <label className="flexible-dates-label">
    <input
      type="checkbox"
      checked={flexibleDates}
      onChange={(e) => setFlexibleDates(e.target.checked)}
      disabled={loading || !departureDate || !returnDate}
      className="flexible-dates-checkbox"
    />
    <span className="flexible-dates-text">
      My dates are flexible (±3 days)
    </span>
    <span className="flexible-dates-hint">
      Find cheaper options by searching nearby dates
    </span>
  </label>
</div>

{/* ✨ NEW: Date Error Message */}
{dateError && (
  <div className="date-error-message">
    <span className="date-error-icon">⚠️</span>
    <span>{dateError}</span>
  </div>
)}

{/* Action Buttons */}
<div className="action-buttons">
  {/* ... existing buttons ... */}
</div>
```

---

## 🎨 Krok 4: Styling CSS

**Plik**: `frontend/src/index.css`

### 4.1. Dodać style dla Date Picker (dopasowane do dark theme)

```css
/* ==========================================
   Date Picker Styles (Dark Theme)
   ========================================== */

/* Date Picker Wrapper */
.date-picker-wrapper {
  width: 100%;
}

/* Date Picker Input */
.date-picker-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: rgba(30, 30, 46, 0.5);
  border: 1px solid rgba(147, 116, 255, 0.2);
  border-radius: 12px;
  color: #e0e0e0;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.3s ease;
  cursor: pointer;
}

.date-picker-input:hover {
  border-color: rgba(147, 116, 255, 0.5);
  background: rgba(30, 30, 46, 0.7);
}

.date-picker-input:focus {
  outline: none;
  border-color: #9374ff;
  box-shadow: 0 0 0 3px rgba(147, 116, 255, 0.1);
}

.date-picker-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.date-picker-input::placeholder {
  color: rgba(224, 224, 224, 0.4);
}

/* React DatePicker Calendar Customization */
.react-datepicker {
  background: #1e1e2e;
  border: 1px solid rgba(147, 116, 255, 0.3);
  border-radius: 16px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
}

.react-datepicker__header {
  background: linear-gradient(135deg, #2d2d44 0%, #1e1e2e 100%);
  border-bottom: 1px solid rgba(147, 116, 255, 0.2);
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  padding-top: 1rem;
}

.react-datepicker__current-month {
  color: #e0e0e0;
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.react-datepicker__day-name {
  color: #9374ff;
  font-weight: 600;
  font-size: 0.85rem;
}

.react-datepicker__day {
  color: #e0e0e0;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.react-datepicker__day:hover {
  background: rgba(147, 116, 255, 0.2);
  color: #fff;
}

.react-datepicker__day--selected,
.react-datepicker__day--keyboard-selected {
  background: #9374ff !important;
  color: #fff !important;
  font-weight: 600;
}

.react-datepicker__day--in-range {
  background: rgba(147, 116, 255, 0.15);
  color: #e0e0e0;
}

.react-datepicker__day--disabled {
  color: rgba(224, 224, 224, 0.2);
  cursor: not-allowed;
}

.react-datepicker__day--outside-month {
  color: rgba(224, 224, 224, 0.3);
}

.react-datepicker__navigation {
  top: 1rem;
}

.react-datepicker__navigation-icon::before {
  border-color: #9374ff;
}

.react-datepicker__navigation:hover *::before {
  border-color: #fff;
}

/* Flexible Dates Section */
.flexible-dates-section {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(147, 116, 255, 0.05);
  border: 1px solid rgba(147, 116, 255, 0.1);
  border-radius: 12px;
}

.flexible-dates-label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.flexible-dates-checkbox {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
  accent-color: #9374ff;
}

.flexible-dates-text {
  color: #e0e0e0;
  font-size: 1rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.flexible-dates-hint {
  color: rgba(224, 224, 224, 0.6);
  font-size: 0.85rem;
  margin-left: 2rem;
}

/* Date Error Message */
.date-error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  margin-top: 1rem;
  background: rgba(255, 76, 96, 0.1);
  border: 1px solid rgba(255, 76, 96, 0.3);
  border-radius: 12px;
  color: #ff6b7a;
  font-size: 0.9rem;
  font-weight: 500;
}

.date-error-icon {
  font-size: 1.2rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .filters-grid {
    grid-template-columns: 1fr;
  }

  .flexible-dates-hint {
    margin-left: 0;
  }
}
```

### 4.2. Aktualizować filters-grid (jeśli potrzeba)

```css
/* Filters Grid - Updated for date pickers */
.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}
```

---

## ✅ Krok 5: Weryfikacja i Testy

### 5.1. Checklist Frontend

- [ ] `react-datepicker` zainstalowany
- [ ] Typy TypeScript zaktualizowane (`flexibleDates`)
- [ ] FiltersBar ma date pickers (departure + return)
- [ ] Walidacja lokalna działa (tomorrow, future dates, trip length)
- [ ] Checkbox "flexible dates" działa
- [ ] Error messages wyświetlają się
- [ ] Reset button resetuje daty
- [ ] Styling dark theme dopasowany
- [ ] Responsive layout działa na mobile
- [ ] Disabled states działają (loading, no departure selected)

### 5.2. Manual Testing Scenarios

**Test 1: Happy Path**
1. Wybierz departure: jutro
2. Wybierz return: za 7 dni
3. Kliknij Search
4. ✅ Request wysłany z `departureDate`, `returnDate`, `flexibleDates: false`

**Test 2: Flexible Dates**
1. Wybierz departure: za 2 tygodnie
2. Wybierz return: za 3 tygodnie
3. Zaznacz checkbox "flexible dates"
4. Kliknij Search
5. ✅ Request wysłany z `flexibleDates: true`

**Test 3: Validation Errors**
1. Nie wybieraj dat → kliknij Search → ❌ Error: "Please select both dates"
2. Wybierz return < departure → ❌ Error: "Return must be after departure"
3. Wybierz trip > 30 dni → ❌ Error: "Trip cannot be longer than 30 days"
4. Wybierz departure > 330 dni → ❌ Error: "Cannot be more than 330 days"

**Test 4: UI/UX**
1. Date picker otwiera się po kliknieciu
2. Calendar jest czytelny (dark theme)
3. Disabled dates są szare
4. Selected range jest podświetlony
5. Mobile layout działa

---

## 🐛 Edge Cases i Rozwiązania

### Edge Case 1: User wybiera return przed departure
**Rozwiązanie**: Validation error + return date picker ma `minDate={departure + 1 day}`

### Edge Case 2: Loading spinner podczas wyboru dat
**Rozwiązanie**: Date pickers mają `disabled={loading}`

### Edge Case 3: Timezone issues
**Rozwiązanie**: Format daty YYYY-MM-DD (bez czasu) + backend waliduje

### Edge Case 4: Return date picker enabled before departure selected
**Rozwiązanie**: `disabled={!departureDate}` na return picker

---

## 📚 Dokumentacja

### Props DatePicker

```typescript
<DatePicker
  selected={date}              // Currently selected date
  onChange={handleChange}      // Callback when date changes
  selectsStart                 // Marks as start of range (departure)
  selectsEnd                   // Marks as end of range (return)
  startDate={departureDate}    // Start of range
  endDate={returnDate}         // End of range
  minDate={minDate}            // Minimum selectable date
  maxDate={maxDate}            // Maximum selectable date
  placeholderText="..."        // Placeholder text
  dateFormat="yyyy-MM-dd"      // Display format
  disabled={boolean}           // Disabled state
  className="..."              // Input class
  wrapperClassName="..."       // Wrapper class
  required                     // HTML required attribute
/>
```

### References

- [react-datepicker Docs](https://reactdatepicker.com/)
- [Date Range Example](https://reactdatepicker.com/#example-date-range)
- [Custom Styling](https://reactdatepicker.com/#example-custom-header)

---

## 🎯 Oczekiwany Rezultat

Po implementacji:
- ✅ Użytkownik widzi 2 date pickery w FiltersBar
- ✅ Walidacja frontendowa działa przed wysłaniem
- ✅ Checkbox "flexible dates" funkcjonalny
- ✅ Dark theme dopasowany
- ✅ Mobile responsive
- ✅ Error messages user-friendly

**Request payload do backendu**:
```json
{
  "budget": 500,
  "origin": "WAW",
  "travelStyle": "culture",
  "departureDate": "2025-11-01",
  "returnDate": "2025-11-08",
  "flexibleDates": true
}
```
