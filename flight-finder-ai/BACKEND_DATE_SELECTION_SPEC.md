# Backend Specification: Date Selection Feature

## 📋 Przegląd
Implementacja walidacji dat oraz logiki elastycznych dat (±3 dni) w backendzie.

**API Endpoint**: `POST /api/flights/search`
**Wymagania**: `departureDate` i `returnDate` są **OBOWIĄZKOWE**
**Flexible Dates**: Jeśli `flexibleDates: true`, szukaj w zakresie ±3 dni

---

## 🔧 Krok 1: Aktualizacja Typów

**Plik**: `backend/src/types/flight.ts`

### 1.1. Zmienić `departureDate` i `returnDate` na required

```typescript
/**
 * User preferences for flight search
 */
export interface UserPreferences {
  budget: number;
  origin: string;
  travelStyle: 'adventure' | 'relaxation' | 'culture' | 'party' | 'nature';
  preferredDestinations?: string[];
  departureDate: string;      // ✨ ZMIANA: Required (było optional)
  returnDate: string;          // ✨ ZMIANA: Required (było optional)
  flexibleDates?: boolean;     // ✨ NOWE: Flag for ±3 days search
}
```

**⚠️ Breaking Change**: Wszystkie requesty bez `departureDate`/`returnDate` zwrócą błąd 400.

---

## ✅ Krok 2: Walidacja Dat

**Plik**: `backend/src/controllers/flightController.ts`

### 2.1. Funkcja `validateDates()`

**Dodać PRZED funkcją `validateUserPreferences`**:

```typescript
/**
 * Validate date parameters
 *
 * @param departureDate - Departure date string (YYYY-MM-DD)
 * @param returnDate - Return date string (YYYY-MM-DD)
 * @returns Validation result with error message if invalid
 */
function validateDates(
  departureDate: any,
  returnDate: any
): { valid: boolean; error?: string } {
  // 1. Check if dates are provided (REQUIRED)
  if (!departureDate || typeof departureDate !== 'string') {
    return { valid: false, error: 'Departure date is required (format: YYYY-MM-DD)' };
  }

  if (!returnDate || typeof returnDate !== 'string') {
    return { valid: false, error: 'Return date is required (format: YYYY-MM-DD)' };
  }

  // 2. Validate format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(departureDate)) {
    return { valid: false, error: 'Invalid departure date format. Use YYYY-MM-DD' };
  }

  if (!dateRegex.test(returnDate)) {
    return { valid: false, error: 'Invalid return date format. Use YYYY-MM-DD' };
  }

  // 3. Parse dates
  const departure = new Date(departureDate);
  const returnD = new Date(returnDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if dates are valid
  if (isNaN(departure.getTime())) {
    return { valid: false, error: 'Invalid departure date' };
  }

  if (isNaN(returnD.getTime())) {
    return { valid: false, error: 'Invalid return date' };
  }

  // 4. Check if departure is in the future (at least tomorrow)
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (departure < tomorrow) {
    return { valid: false, error: 'Departure date must be at least tomorrow' };
  }

  // 5. Check if departure is within 330 days (Amadeus API limit)
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 330);

  if (departure > maxDate) {
    return { valid: false, error: 'Departure date cannot be more than 330 days in the future' };
  }

  // 6. Check if return is after departure
  if (returnD <= departure) {
    return { valid: false, error: 'Return date must be after departure date' };
  }

  // 7. Check trip length (minimum 2 days, maximum 30 days)
  const tripDays = Math.ceil(
    (returnD.getTime() - departure.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (tripDays < 2) {
    return { valid: false, error: 'Trip must be at least 2 days long' };
  }

  if (tripDays > 30) {
    return { valid: false, error: 'Trip cannot be longer than 30 days' };
  }

  return { valid: true };
}
```

### 2.2. Aktualizować `validateUserPreferences`

**Rozszerzyć istniejącą funkcję**:

```typescript
/**
 * Validate user preferences
 */
function validateUserPreferences(body: any): { valid: boolean; error?: string } {
  // Existing validations...
  if (!body.budget || typeof body.budget !== 'number' || body.budget <= 0) {
    return { valid: false, error: 'Budget must be a positive number' };
  }

  if (!body.origin || typeof body.origin !== 'string') {
    return { valid: false, error: 'Origin airport code is required' };
  }

  const validTravelStyles = ['adventure', 'relaxation', 'culture', 'party', 'nature'];
  if (!body.travelStyle || !validTravelStyles.includes(body.travelStyle)) {
    return { valid: false, error: `Travel style must be one of: ${validTravelStyles.join(', ')}` };
  }

  // ✨ NEW: Validate dates (REQUIRED)
  const dateValidation = validateDates(body.departureDate, body.returnDate);
  if (!dateValidation.valid) {
    return dateValidation;
  }

  // ✨ NEW: Validate flexibleDates (optional, but must be boolean if provided)
  if (body.flexibleDates !== undefined && typeof body.flexibleDates !== 'boolean') {
    return { valid: false, error: 'flexibleDates must be a boolean' };
  }

  return { valid: true };
}
```

### 2.3. Aktualizować `searchFlights` controller

**Dodać `flexibleDates` do UserPreferences object**:

```typescript
export async function searchFlights(req: Request, res: Response): Promise<void> {
  try {
    console.log('\n📥 [Controller] Received flight search request');
    console.log('📋 [Controller] Request body:', JSON.stringify(req.body, null, 2));

    // Validate request (now includes date validation)
    const validation = validateUserPreferences(req.body);
    if (!validation.valid) {
      const response: ApiResponse = {
        success: false,
        error: validation.error,
        details: {
          field: 'preferences',
          message: validation.error,
        },
      };
      res.status(400).json(response);
      return;
    }

    const preferences: UserPreferences = {
      budget: req.body.budget,
      origin: req.body.origin,
      travelStyle: req.body.travelStyle,
      preferredDestinations: req.body.preferredDestinations,
      departureDate: req.body.departureDate,        // ✨ Now required
      returnDate: req.body.returnDate,              // ✨ Now required
      flexibleDates: req.body.flexibleDates || false, // ✨ New field
    };

    // Run AI agent
    console.log('🚀 [Controller] Starting AI agent...');
    const agentResponse = await runFlightAgent(preferences);
    console.log('✅ [Controller] AI agent completed successfully');

    const response: ApiResponse = {
      success: true,
      data: agentResponse,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('❌ [Controller] Error in searchFlights:', error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      details: {
        type: 'agent_error',
        message: 'Failed to process flight search with AI agent',
      },
    };

    res.status(500).json(response);
  }
}
```

---

## 🔀 Krok 3: Logika "Flexible Dates"

**Plik**: `backend/src/services/amadeus/amadeusFlightService.ts`

### 3.1. Nowa funkcja pomocnicza: `generateFlexibleDates`

**Dodać NA POCZĄTKU pliku, po importach**:

```typescript
/**
 * Generate array of dates within ±N days range
 *
 * @param baseDate - Base date string (YYYY-MM-DD)
 * @param flexDays - Number of days flexibility (e.g., 3 for ±3 days)
 * @returns Array of date strings (YYYY-MM-DD) sorted chronologically
 */
function generateFlexibleDates(baseDate: string, flexDays: number = 3): string[] {
  const dates: string[] = [];
  const base = new Date(baseDate);

  // Generate dates from -flexDays to +flexDays
  for (let i = -flexDays; i <= flexDays; i++) {
    const date = new Date(base);
    date.setDate(date.getDate() + i);

    // Format to YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
}
```

### 3.2. Rozszerzyć `FlightInspirationParams` type

**W pliku**: `backend/src/types/amadeus.ts`

```typescript
export interface FlightInspirationParams {
  origin: string;           // IATA code (e.g., 'WAW')
  maxPrice?: number;        // Maximum price in EUR
  departureDate?: string;   // YYYY-MM-DD
  duration?: number;        // Trip length in days (1-15)
  oneWay?: boolean;         // One-way vs round-trip
  viewBy?: 'DATE' | 'DESTINATION' | 'DURATION' | 'WEEK' | 'COUNTRY';
  flexibleDates?: boolean;  // ✨ NEW: Enable ±3 days search
}
```

### 3.3. Aktualizować `searchFlightInspiration` dla flexible dates

**Zastąpić istniejącą funkcję**:

```typescript
export async function searchFlightInspiration(
  params: FlightInspirationParams
): Promise<FlightOffer[]> {
  const { origin, maxPrice, departureDate, duration, oneWay, viewBy, flexibleDates } = params;

  // Input validation
  if (!/^[A-Z]{3}$/.test(origin)) {
    throw new Error(FLIGHT_INSPIRATION_ERRORS.INVALID_IATA);
  }

  if (maxPrice && (maxPrice < 0 || maxPrice > 50000)) {
    throw new Error(FLIGHT_INSPIRATION_ERRORS.INVALID_BUDGET);
  }

  if (duration && (duration < 1 || duration > 15)) {
    throw new Error(FLIGHT_INSPIRATION_ERRORS.INVALID_DURATION);
  }

  // ✨ NEW: Flexible dates logic
  if (flexibleDates && departureDate) {
    console.log(`📅 [Amadeus] Flexible dates enabled: searching ±3 days from ${departureDate}`);
    return await searchFlexibleDates(params);
  }

  // ✨ Original single-date search
  return await searchSingleDate(params);
}
```

### 3.4. Nowa funkcja: `searchSingleDate`

**Dodać (wydzielić logikę z oryginalnej `searchFlightInspiration`)**:

```typescript
/**
 * Search for flights on a single departure date
 * (Original searchFlightInspiration logic)
 */
async function searchSingleDate(
  params: FlightInspirationParams
): Promise<FlightOffer[]> {
  const { origin, maxPrice, departureDate, duration, oneWay, viewBy } = params;

  // Get OAuth token
  const token = await getAmadeusToken();

  // Convert maxPrice from PLN to EUR
  let maxPriceInEUR = maxPrice;
  if (maxPrice) {
    maxPriceInEUR = await convertFromPLN(maxPrice, 'EUR');
    console.log(`💱 [Amadeus] Converted budget: ${maxPrice} PLN → ${maxPriceInEUR} EUR`);
  }

  // Build API URL
  const baseUrl = 'https://test.api.amadeus.com/v1/shopping/flight-destinations';
  const queryParams = new URLSearchParams({
    origin: origin,
    ...(departureDate && { departureDate }),
    ...(oneWay !== undefined && { oneWay: oneWay.toString() }),
    ...(duration && { duration: duration.toString() }),
    ...(maxPriceInEUR && { maxPrice: Math.round(maxPriceInEUR).toString() }),
    ...(viewBy && { viewBy }),
  });
  const url = `${baseUrl}?${queryParams.toString()}`;

  console.log(`✈️  [Amadeus Inspiration] Calling API for origin: ${origin}, maxPrice: ${maxPriceInEUR ? `${maxPriceInEUR} EUR` : 'any'}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Handle 401 - Token expired, retry once
    if (response.status === 401) {
      console.log('🔄 [Amadeus Inspiration] Token expired, retrying with fresh token...');
      const newToken = await getAmadeusToken();
      const retryResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${newToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!retryResponse.ok) {
        throw new Error(`Amadeus API error after retry: ${retryResponse.status}`);
      }

      const retryData: AmadeusDestinationResponse = await retryResponse.json();
      return await transformInspirationToOffers(retryData);
    }

    // Handle 404 - No destinations found
    if (response.status === 404) {
      console.log('❌ [Amadeus Inspiration] No destinations found for the given criteria');
      return [];
    }

    // Handle other errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Amadeus Inspiration] API error: ${response.status}`, errorText);
      throw new Error(`Amadeus API error: ${response.status}`);
    }

    const data: AmadeusDestinationResponse = await response.json();
    console.log(`✅ [Amadeus Inspiration] Found ${data.data?.length || 0} inspiring destinations`);

    return await transformInspirationToOffers(data);

  } catch (error) {
    console.error('❌ [Amadeus Inspiration] Error calling API:', error);
    throw error;
  }
}
```

### 3.5. Nowa funkcja: `searchFlexibleDates`

**Dodać**:

```typescript
/**
 * Search for flights with flexible dates (±3 days)
 * Calls API multiple times for each date in range
 *
 * @param params - Flight search parameters
 * @returns Aggregated and sorted flight offers
 */
async function searchFlexibleDates(
  params: FlightInspirationParams
): Promise<FlightOffer[]> {
  const { departureDate, duration } = params;

  if (!departureDate) {
    throw new Error('Departure date is required for flexible date search');
  }

  // Generate ±3 days range
  const departureDates = generateFlexibleDates(departureDate, 3);
  console.log(`📅 [Amadeus] Flexible dates: ${departureDates.join(', ')}`);

  // If duration is specified, generate flexible return dates too
  let returnDates: string[] | undefined;
  if (duration && params.oneWay === false) {
    const baseReturnDate = new Date(departureDate);
    baseReturnDate.setDate(baseReturnDate.getDate() + duration);
    const baseReturnStr = baseReturnDate.toISOString().split('T')[0];
    returnDates = generateFlexibleDates(baseReturnStr, 3);
    console.log(`📅 [Amadeus] Flexible return dates: ${returnDates.join(', ')}`);
  }

  // Search all date combinations
  const allOffers: FlightOffer[] = [];
  const searchPromises: Promise<FlightOffer[]>[] = [];

  for (const depDate of departureDates) {
    // Create search params for this date
    const searchParams: FlightInspirationParams = {
      ...params,
      departureDate: depDate,
      flexibleDates: false, // Disable recursion
    };

    // Call searchSingleDate for each departure date
    searchPromises.push(
      searchSingleDate(searchParams).catch(err => {
        console.warn(`⚠️  [Amadeus] Failed to search date ${depDate}:`, err.message);
        return []; // Return empty array on error
      })
    );
  }

  // Wait for all searches to complete
  const results = await Promise.all(searchPromises);

  // Flatten results
  results.forEach(offers => {
    allOffers.push(...offers);
  });

  console.log(`✅ [Amadeus] Flexible search found ${allOffers.length} total offers across all dates`);

  // Remove duplicates (same destination, similar price)
  const uniqueOffers = deduplicateOffers(allOffers);

  // Sort by price (cheapest first)
  const sorted = uniqueOffers.sort((a, b) => a.price - b.price);

  // Return top 15 offers
  const topOffers = sorted.slice(0, 15);
  console.log(`✅ [Amadeus] Returning top ${topOffers.length} offers from flexible search`);

  return topOffers;
}
```

### 3.6. Funkcja pomocnicza: `deduplicateOffers`

```typescript
/**
 * Remove duplicate offers (same destination + similar dates)
 * Keeps the cheapest offer for each destination-date combination
 */
function deduplicateOffers(offers: FlightOffer[]): FlightOffer[] {
  const uniqueMap = new Map<string, FlightOffer>();

  for (const offer of offers) {
    // Create unique key: destination + departure week
    const departureWeek = Math.floor(
      new Date(offer.departureDate).getTime() / (7 * 24 * 60 * 60 * 1000)
    );
    const key = `${offer.destinationCode}-week${departureWeek}`;

    // Keep only the cheapest offer for this key
    const existing = uniqueMap.get(key);
    if (!existing || offer.price < existing.price) {
      uniqueMap.set(key, offer);
    }
  }

  return Array.from(uniqueMap.values());
}
```

---

## 🧪 Krok 4: Testy Jednostkowe

**Plik**: `backend/src/controllers/__tests__/flightController.test.ts`

### 4.1. Test Cases dla walidacji dat

```typescript
describe('Date Validation', () => {

  test('should reject request without departure date', async () => {
    const response = await request(app)
      .post('/api/flights/search')
      .send({
        budget: 500,
        origin: 'WAW',
        travelStyle: 'culture',
        returnDate: '2025-12-01',
        // departureDate missing
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Departure date is required');
  });

  test('should reject request without return date', async () => {
    const response = await request(app)
      .post('/api/flights/search')
      .send({
        budget: 500,
        origin: 'WAW',
        travelStyle: 'culture',
        departureDate: '2025-11-01',
        // returnDate missing
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('Return date is required');
  });

  test('should reject invalid date format', async () => {
    const response = await request(app)
      .post('/api/flights/search')
      .send({
        budget: 500,
        origin: 'WAW',
        travelStyle: 'culture',
        departureDate: '2025/11/01', // Wrong format
        returnDate: '2025-12-01',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid departure date format');
  });

  test('should reject past departure date', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const response = await request(app)
      .post('/api/flights/search')
      .send({
        budget: 500,
        origin: 'WAW',
        travelStyle: 'culture',
        departureDate: yesterdayStr,
        returnDate: '2025-12-01',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('must be at least tomorrow');
  });

  test('should reject return date before departure', async () => {
    const response = await request(app)
      .post('/api/flights/search')
      .send({
        budget: 500,
        origin: 'WAW',
        travelStyle: 'culture',
        departureDate: '2025-12-01',
        returnDate: '2025-11-25', // Before departure
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Return date must be after departure');
  });

  test('should reject trip shorter than 2 days', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const response = await request(app)
      .post('/api/flights/search')
      .send({
        budget: 500,
        origin: 'WAW',
        travelStyle: 'culture',
        departureDate: tomorrow.toISOString().split('T')[0],
        returnDate: dayAfter.toISOString().split('T')[0], // Only 1 day trip
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('must be at least 2 days long');
  });

  test('should reject trip longer than 30 days', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const wayTooLate = new Date(tomorrow);
    wayTooLate.setDate(wayTooLate.getDate() + 31);

    const response = await request(app)
      .post('/api/flights/search')
      .send({
        budget: 500,
        origin: 'WAW',
        travelStyle: 'culture',
        departureDate: tomorrow.toISOString().split('T')[0],
        returnDate: wayTooLate.toISOString().split('T')[0],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('cannot be longer than 30 days');
  });

  test('should reject departure > 330 days in future', async () => {
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 331);
    const evenFurther = new Date(farFuture);
    evenFurther.setDate(evenFurther.getDate() + 7);

    const response = await request(app)
      .post('/api/flights/search')
      .send({
        budget: 500,
        origin: 'WAW',
        travelStyle: 'culture',
        departureDate: farFuture.toISOString().split('T')[0],
        returnDate: evenFurther.toISOString().split('T')[0],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('cannot be more than 330 days');
  });

  test('should accept valid dates', async () => {
    const departure = new Date();
    departure.setDate(departure.getDate() + 14);
    const returnDate = new Date(departure);
    returnDate.setDate(returnDate.getDate() + 7);

    const response = await request(app)
      .post('/api/flights/search')
      .send({
        budget: 500,
        origin: 'WAW',
        travelStyle: 'culture',
        departureDate: departure.toISOString().split('T')[0],
        returnDate: returnDate.toISOString().split('T')[0],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('should accept flexibleDates flag', async () => {
    const departure = new Date();
    departure.setDate(departure.getDate() + 14);
    const returnDate = new Date(departure);
    returnDate.setDate(returnDate.getDate() + 7);

    const response = await request(app)
      .post('/api/flights/search')
      .send({
        budget: 500,
        origin: 'WAW',
        travelStyle: 'culture',
        departureDate: departure.toISOString().split('T')[0],
        returnDate: returnDate.toISOString().split('T')[0],
        flexibleDates: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

});
```

---

## ✅ Krok 5: Checklist Backend

- [ ] Typy zaktualizowane (`departureDate`/`returnDate` required, `flexibleDates` added)
- [ ] Funkcja `validateDates()` zaimplementowana
- [ ] `validateUserPreferences()` wywołuje `validateDates()`
- [ ] Controller przekazuje `flexibleDates` do UserPreferences
- [ ] `generateFlexibleDates()` helper dodany
- [ ] `searchFlexibleDates()` zaimplementowana
- [ ] `searchSingleDate()` wydzielona
- [ ] `deduplicateOffers()` helper dodany
- [ ] Testy jednostkowe napisane (wszystkie scenariusze)
- [ ] Testy przechodzą (`npm test`)
- [ ] Logi debug dodane (console.log)

---

## 🧪 Manual Testing

### Test 1: Exact Dates (flexibleDates: false)

**Request**:
```bash
curl -X POST http://localhost:3001/api/flights/search \
  -H "Content-Type: application/json" \
  -d '{
    "budget": 500,
    "origin": "WAW",
    "travelStyle": "culture",
    "departureDate": "2025-11-15",
    "returnDate": "2025-11-22",
    "flexibleDates": false
  }'
```

**Expected**:
- ✅ 200 OK
- ✅ Recommendations dla dokładnie tych dat
- ✅ `searchSingleDate()` wywołana 1x

### Test 2: Flexible Dates (flexibleDates: true)

**Request**:
```bash
curl -X POST http://localhost:3001/api/flights/search \
  -H "Content-Type: application/json" \
  -d '{
    "budget": 500,
    "origin": "WAW",
    "travelStyle": "culture",
    "departureDate": "2025-11-15",
    "returnDate": "2025-11-22",
    "flexibleDates": true
  }'
```

**Expected**:
- ✅ 200 OK
- ✅ Recommendations dla dat ±3 dni
- ✅ `searchSingleDate()` wywołana 7x (dla każdego dnia w zakresie)
- ✅ Wyniki posortowane po cenie (najtańsze najpierw)
- ✅ Top 15 ofert zwróconych

### Test 3: Invalid Dates

**Request**:
```bash
curl -X POST http://localhost:3001/api/flights/search \
  -H "Content-Type: application/json" \
  -d '{
    "budget": 500,
    "origin": "WAW",
    "travelStyle": "culture",
    "departureDate": "2025-12-01",
    "returnDate": "2025-11-25"
  }'
```

**Expected**:
- ❌ 400 Bad Request
- ❌ Error: "Return date must be after departure date"

---

## 🐛 Edge Cases

### Edge Case 1: No results for flexible dates
**Scenario**: Wszystkie 7 dni zwracają 404
**Solution**: Zwróć pustą tablicę + log warning

```typescript
if (allOffers.length === 0) {
  console.warn('⚠️  [Amadeus] No offers found for any flexible dates');
  return [];
}
```

### Edge Case 2: Amadeus API timeout
**Scenario**: Jeden z requestów timeout
**Solution**: `.catch()` w Promise.all + zwróć [] dla tego dnia

### Edge Case 3: Duplicate destinations
**Scenario**: Ta sama destynacja w różnych dniach
**Solution**: `deduplicateOffers()` zachowuje najtańszą

### Edge Case 4: flexibleDates bez departureDate
**Scenario**: `flexibleDates: true` ale brak `departureDate`
**Solution**: Walidacja odrzuci request (dates are required)

---

## 📊 Performance Considerations

### Optymalizacja 1: Parallel API Calls
```typescript
// ✅ GOOD: Promise.all (parallel)
const results = await Promise.all(searchPromises);

// ❌ BAD: Sequential (slow)
for (const date of dates) {
  await searchSingleDate(...);
}
```

### Optymalizacja 2: Limit Results
```typescript
// Return only top 15 offers (don't overload frontend)
return sorted.slice(0, 15);
```

### Optymalizacja 3: Cache API Responses
**Future improvement**: Cache Amadeus responses for 5 minutes

---

## 📝 Dokumentacja API

### POST /api/flights/search

**Request Body**:
```typescript
{
  budget: number;              // Required, > 0
  origin: string;              // Required, IATA code (e.g., "WAW")
  travelStyle: string;         // Required, one of: adventure|relaxation|culture|party|nature
  departureDate: string;       // ✨ Required, YYYY-MM-DD
  returnDate: string;          // ✨ Required, YYYY-MM-DD
  flexibleDates?: boolean;     // ✨ Optional, default: false
  preferredDestinations?: string[]; // Optional
}
```

**Response (200 OK)**:
```typescript
{
  success: true,
  data: {
    recommendations: FlightOffer[],
    reasoning: string,
    alternatives: FlightOffer[],
    executionTime: number,
    toolsUsed: string[]
  }
}
```

**Response (400 Bad Request)**:
```typescript
{
  success: false,
  error: string,
  details: {
    field: string,
    message: string
  }
}
```

---

## 🎯 Oczekiwany Rezultat

Po implementacji:
- ✅ Daty są **obowiązkowe** (400 bez dat)
- ✅ Walidacja backendu działa (format, zakres, długość)
- ✅ Flexible dates zwraca top 15 ofert z ±3 dni
- ✅ Exact dates zwraca oferty dla konkretnych dat
- ✅ Error messages są czytelne
- ✅ Logi debug pomagają w debugowaniu
- ✅ Testy jednostkowe pokrywają wszystkie scenariusze

**Przykładowy log output (flexible dates)**:
```
📅 [Amadeus] Flexible dates enabled: searching ±3 days from 2025-11-15
📅 [Amadeus] Flexible dates: 2025-11-12,2025-11-13,2025-11-14,2025-11-15,2025-11-16,2025-11-17,2025-11-18
✈️  [Amadeus Inspiration] Calling API for origin: WAW, maxPrice: 460 EUR
✅ [Amadeus Inspiration] Found 12 inspiring destinations
... (repeat for each date)
✅ [Amadeus] Flexible search found 84 total offers across all dates
✅ [Amadeus] Returning top 15 offers from flexible search
```
