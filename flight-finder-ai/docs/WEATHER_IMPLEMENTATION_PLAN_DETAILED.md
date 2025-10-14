# Weather Integration - Szczegółowy Plan Implementacji dla Agenta

**Status:** Ready for Implementation
**Estimated Time:** 4.5 hours
**Last Updated:** 2025-10-15
**Assigned To:** Implementation Agent

---

## 📋 Status Początkowy

### ✅ COMPLETED
**Task 1.1** - AirportLocation schema został już zaktualizowany w `/backend/src/types/weather.ts`
- ✅ `cityName` (było `city`)
- ✅ `countryCode` (było `country`)
- ✅ `timeZoneOffset` (było `timezone`)
- ✅ Dodano `AmadeusLocationResponse` interface

### 🔴 TODO (8 zadań)
- [ ] Task 1.2: Create AmadeusGeocodingService.ts (1h)
- [ ] Task 2.1: Create OpenMeteoProvider.ts (1.5h)
- [ ] Task 2.2: Create WeatherService.ts (30min)
- [ ] Task 3.1: Update types/index.ts (15min)
- [ ] Task 3.2: Integrate into agent.ts (45min)
- [ ] Task 3.3: Add weather controllers (20min)
- [ ] Task 3.4: Add weather routes (10min)
- [ ] Task 3.5: Test implementation (30min)

---

## 🎯 Konfiguracja Projektu

### Decyzje Architektoniczne
1. ✅ **Typy:** Zgodnie z Guide (Amadeus API format)
2. ✅ **Format pogody:** `WeatherForecast` (rozbudowany)
3. ✅ **Fallback:** Real API → Mock → Brak pogody (graceful degradation)
4. ✅ **Cache:** **POMIJAMY** w pierwszej wersji (uproszczenie!)
5. ✅ **Amadeus Geocoding:** Endpoint działa (test podczas implementacji)
6. ✅ **Scope:** Tylko backend (bez Phase 4 Frontend)

### Uproszczona Architektura (BEZ Cache)

```
User Search
    ↓
Agent (agent.ts)
    ↓
    ├─→ searchFlightInspiration() (Amadeus API)
    │   └─→ [Fallback] Mock data
    ↓
    ├─→ enrichWithWeather() - PARALLEL
    │   ├─→ getCoordinates(iataCode) → Amadeus Geocoding API
    │   ├─→ weatherService.getForecast(coords) → Open-Meteo API
    │   └─→ [Fallback] Mock weather (flightAPI.ts)
    ↓
    ├─→ filterAndRankInspirationResults()
    └─→ generateInspirationReasoning()
```

**Korzyści z pominięcia cache:**
- ❌ Bez WeatherCache.ts
- ❌ Bez GeocodingCache klasy
- ✅ Bezpośrednie wywołania API
- ✅ Szybsza implementacja (4.5h zamiast 6-8h)
- ✅ Prostszy kod do debugowania

---

## 📁 TASK 1.2: Create AmadeusGeocodingService.ts (1h)

### Cel
Utworzyć serwis do konwersji IATA code → współrzędne geograficzne używając Amadeus API.

### Plik do utworzenia
**Path:** `/Users/tomaszfilinski/projects/flight-finder-ai/backend/src/services/AmadeusGeocodingService.ts`

### Instrukcje wykonania
1. Użyj narzędzia **Write** do utworzenia pliku
2. Skopiuj kod poniżej **1:1** (bez żadnych zmian)
3. Upewnij się że plik ma rozszerzenie `.ts`
4. Sprawdź że importy używają `.js` extension (NodeNext requirement)

### Kompletny kod

```typescript
// ==========================================
// Amadeus Geocoding Service (NO CACHE)
// Converts IATA codes to coordinates using Amadeus City Search API
// ==========================================

import type { AirportLocation, Coordinates, AmadeusLocationResponse } from '../types/weather.js';
import { getAmadeusToken } from './amadeusAPI.js';

const AMADEUS_BASE_URL = 'https://test.api.amadeus.com';

/**
 * Get airport/city location by IATA code using Amadeus City Search API
 * @param iataCode - 3-letter IATA code (e.g., "BCN")
 * @returns Airport location with coordinates
 * @throws Error if location not found or API fails
 */
export async function getAirportLocation(iataCode: string): Promise<AirportLocation> {
  const normalizedCode = iataCode.toUpperCase().trim();

  // Validate IATA code format
  if (!/^[A-Z]{3}$/.test(normalizedCode)) {
    throw new Error(`Invalid IATA code format: ${iataCode} (must be 3 letters)`);
  }

  console.log(`🌍 [Amadeus Geocoding] Fetching coordinates for ${normalizedCode}...`);

  try {
    // Get Amadeus token
    const token = await getAmadeusToken();

    // Build API URL
    const searchUrl = new URL(`${AMADEUS_BASE_URL}/v1/reference-data/locations`);
    searchUrl.searchParams.set('subType', 'CITY,AIRPORT');
    searchUrl.searchParams.set('keyword', normalizedCode);
    searchUrl.searchParams.set('page[limit]', '1');

    console.log(`🌐 [Amadeus Geocoding] API Call: ${searchUrl.toString()}`);

    const response = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Amadeus geocoding failed: ${response.status} - ${errorText}`);
    }

    const data: AmadeusLocationResponse = await response.json();

    // Check if we got results
    if (!data.data || data.data.length === 0) {
      throw new Error(`No location found for IATA code: ${normalizedCode}`);
    }

    // Get first result (most relevant)
    const location = data.data[0];

    // Validate geoCode exists
    if (!location.geoCode || !location.geoCode.latitude || !location.geoCode.longitude) {
      throw new Error(`No coordinates found for IATA code: ${normalizedCode}`);
    }

    // Convert to our AirportLocation format
    const airportLocation: AirportLocation = {
      iataCode: location.iataCode,
      name: location.name,
      cityName: location.address.cityName,
      countryCode: location.address.countryCode,
      coordinates: {
        latitude: location.geoCode.latitude,
        longitude: location.geoCode.longitude,
      },
      timeZoneOffset: location.timeZoneOffset,
    };

    console.log(`✅ [Amadeus Geocoding] Found: ${airportLocation.name} at (${airportLocation.coordinates.latitude}, ${airportLocation.coordinates.longitude})`);

    return airportLocation;

  } catch (error) {
    console.error(`❌ [Amadeus Geocoding] Error for ${normalizedCode}:`, error);
    throw error;
  }
}

/**
 * Get coordinates for an airport by IATA code
 * @throws Error if airport not found
 */
export async function getCoordinates(iataCode: string): Promise<Coordinates> {
  const airport = await getAirportLocation(iataCode);
  return airport.coordinates;
}

/**
 * Validate coordinates
 */
export function validateCoordinates(lat: number, lon: number): boolean {
  return (
    !isNaN(lat) && !isNaN(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180
  );
}
```

### Weryfikacja
Po utworzeniu pliku, sprawdź:
- [ ] Plik istnieje w `/backend/src/services/AmadeusGeocodingService.ts`
- [ ] Importy używają `.js` extension
- [ ] Eksportowane są 3 funkcje: `getAirportLocation`, `getCoordinates`, `validateCoordinates`

---

## 🌤️ TASK 2.1: Create OpenMeteoProvider.ts (1.5h)

### Cel
Utworzyć providera pogody używającego darmowego API Open-Meteo.

### Struktura katalogów do utworzenia
```
backend/src/services/weather/
backend/src/services/weather/providers/
```

### Krok 1: Utwórz katalogi

```bash
mkdir -p /Users/tomaszfilinski/projects/flight-finder-ai/backend/src/services/weather/providers
```

**Użyj narzędzia Bash** do wykonania powyższego polecenia.

### Krok 2: Utwórz plik

**Path:** `/Users/tomaszfilinski/projects/flight-finder-ai/backend/src/services/weather/providers/OpenMeteoProvider.ts`

### Kompletny kod

```typescript
// ==========================================
// Open-Meteo Weather Provider (Free API)
// https://open-meteo.com/
// ==========================================

import type {
  WeatherProvider,
  WeatherProviderConfig,
  WeatherForecast,
  Coordinates,
  WeatherFetchOptions,
} from '../../../types/weather.js';

/**
 * Open-Meteo API Response Interface
 * Based on: https://open-meteo.com/en/docs
 */
interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  elevation?: number;
  daily: {
    time: string[];
    // Temperature
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    temperature_2m_mean: number[];
    apparent_temperature_max: number[];
    apparent_temperature_min: number[];
    // Precipitation
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    precipitation_hours: number[];
    rain_sum: number[];
    snowfall_sum: number[];
    showers_sum: number[];
    // Wind
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
    wind_direction_10m_dominant: number[];
    // Weather conditions
    weather_code: number[];
    // Solar
    sunrise: string[];
    sunset: string[];
    daylight_duration: number[];
    sunshine_duration: number[];
    uv_index_max: number[];
  };
  daily_units?: {
    temperature_2m_max: string;
    precipitation_sum: string;
    wind_speed_10m_max: string;
  };
}

/**
 * WMO Weather Code to Condition mapping
 * https://open-meteo.com/en/docs
 */
const WMO_WEATHER_CODES: Record<number, { main: string; description: string; icon: string }> = {
  0: { main: 'Clear', description: 'clear sky', icon: '01d' },
  1: { main: 'Clouds', description: 'mainly clear', icon: '02d' },
  2: { main: 'Clouds', description: 'partly cloudy', icon: '03d' },
  3: { main: 'Clouds', description: 'overcast', icon: '04d' },
  45: { main: 'Fog', description: 'foggy', icon: '50d' },
  48: { main: 'Fog', description: 'depositing rime fog', icon: '50d' },
  51: { main: 'Drizzle', description: 'light drizzle', icon: '09d' },
  53: { main: 'Drizzle', description: 'moderate drizzle', icon: '09d' },
  55: { main: 'Drizzle', description: 'dense drizzle', icon: '09d' },
  61: { main: 'Rain', description: 'slight rain', icon: '10d' },
  63: { main: 'Rain', description: 'moderate rain', icon: '10d' },
  65: { main: 'Rain', description: 'heavy rain', icon: '10d' },
  71: { main: 'Snow', description: 'slight snow', icon: '13d' },
  73: { main: 'Snow', description: 'moderate snow', icon: '13d' },
  75: { main: 'Snow', description: 'heavy snow', icon: '13d' },
  77: { main: 'Snow', description: 'snow grains', icon: '13d' },
  80: { main: 'Rain', description: 'slight rain showers', icon: '09d' },
  81: { main: 'Rain', description: 'moderate rain showers', icon: '09d' },
  82: { main: 'Rain', description: 'violent rain showers', icon: '09d' },
  85: { main: 'Snow', description: 'slight snow showers', icon: '13d' },
  86: { main: 'Snow', description: 'heavy snow showers', icon: '13d' },
  95: { main: 'Thunderstorm', description: 'thunderstorm', icon: '11d' },
  96: { main: 'Thunderstorm', description: 'thunderstorm with slight hail', icon: '11d' },
  99: { main: 'Thunderstorm', description: 'thunderstorm with heavy hail', icon: '11d' },
};

export class OpenMeteoProvider implements WeatherProvider {
  readonly name = 'open-meteo';
  private readonly baseUrl = 'https://api.open-meteo.com/v1/forecast';
  private readonly timeout = 5000; // 5 second timeout

  /**
   * Fetch weather forecast from Open-Meteo API
   */
  async getForecast(
    coordinates: Coordinates,
    startDate: string,
    endDate: string,
    options?: WeatherFetchOptions
  ): Promise<WeatherForecast[]> {
    console.log(`☀️  [Open-Meteo] Fetching forecast for (${coordinates.latitude}, ${coordinates.longitude})`);

    try {
      const url = this.buildApiUrl(coordinates, startDate, endDate, options);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
      }

      const data: OpenMeteoResponse = await response.json();
      const forecasts = this.parseResponse(data, coordinates);

      console.log(`✅ [Open-Meteo] Retrieved ${forecasts.length} days of forecast`);
      return forecasts;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Open-Meteo API request timed out');
      }
      throw error;
    }
  }

  /**
   * Check if Open-Meteo API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const testUrl = `${this.baseUrl}?latitude=52.52&longitude=13.41&daily=temperature_2m_max`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(testUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get provider configuration
   */
  getConfig(): WeatherProviderConfig {
    return {
      name: 'open-meteo',
      requiresApiKey: false,
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerDay: 10000,
      },
      features: {
        maxForecastDays: 16,
        hourlyForecast: true,
        historicalData: true,
      },
    };
  }

  /**
   * Build API URL with parameters
   */
  private buildApiUrl(
    coordinates: Coordinates,
    startDate: string,
    endDate: string,
    options?: WeatherFetchOptions
  ): string {
    const url = new URL(this.baseUrl);

    url.searchParams.set('latitude', coordinates.latitude.toString());
    url.searchParams.set('longitude', coordinates.longitude.toString());
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);

    // Daily parameters - comprehensive weather data
    url.searchParams.set('daily', [
      'temperature_2m_max',
      'temperature_2m_min',
      'temperature_2m_mean',
      'apparent_temperature_max',
      'apparent_temperature_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'precipitation_hours',
      'rain_sum',
      'snowfall_sum',
      'showers_sum',
      'wind_speed_10m_max',
      'wind_gusts_10m_max',
      'wind_direction_10m_dominant',
      'weather_code',
      'sunrise',
      'sunset',
      'daylight_duration',
      'sunshine_duration',
      'uv_index_max',
    ].join(','));

    // Timezone
    if (options?.timezone) {
      url.searchParams.set('timezone', options.timezone);
    } else {
      url.searchParams.set('timezone', 'auto');
    }

    return url.toString();
  }

  /**
   * Parse Open-Meteo response to WeatherForecast array
   */
  private parseResponse(data: OpenMeteoResponse, coordinates: Coordinates): WeatherForecast[] {
    const forecasts: WeatherForecast[] = [];

    for (let i = 0; i < data.daily.time.length; i++) {
      const weatherCode = data.daily.weather_code[i];
      const conditions = WMO_WEATHER_CODES[weatherCode] || {
        main: 'Unknown',
        description: 'unknown',
        icon: '01d',
      };

      forecasts.push({
        date: data.daily.time[i],
        destination: '', // Will be filled by service layer
        destinationCode: '', // Will be filled by service layer
        coordinates,
        temperature: {
          min: Math.round(data.daily.temperature_2m_min[i]),
          max: Math.round(data.daily.temperature_2m_max[i]),
          avg: Math.round(data.daily.temperature_2m_mean[i]),
        },
        apparentTemperature: {
          min: Math.round(data.daily.apparent_temperature_min[i]),
          max: Math.round(data.daily.apparent_temperature_max[i]),
        },
        conditions: {
          main: conditions.main,
          description: conditions.description,
          icon: conditions.icon,
        },
        precipitation: {
          probability: data.daily.precipitation_probability_max[i] || 0,
          amount: data.daily.precipitation_sum[i] || 0,
          rain: data.daily.rain_sum[i] || 0,
          snow: data.daily.snowfall_sum[i] || 0,
          showers: data.daily.showers_sum[i] || 0,
          hours: data.daily.precipitation_hours[i] || 0,
        },
        wind: {
          speed: Math.round(data.daily.wind_speed_10m_max[i]),
          gusts: Math.round(data.daily.wind_gusts_10m_max[i]),
          direction: data.daily.wind_direction_10m_dominant[i],
        },
        humidity: 0, // Not provided by Open-Meteo daily API
        visibility: 10, // Default value
        uvIndex: Math.round(data.daily.uv_index_max[i] || 0),
        sunrise: data.daily.sunrise[i],
        sunset: data.daily.sunset[i],
        daylightDuration: data.daily.daylight_duration[i],
        sunshineDuration: data.daily.sunshine_duration[i],
      });
    }

    return forecasts;
  }
}
```

### Weryfikacja
- [ ] Katalog `/backend/src/services/weather/providers/` istnieje
- [ ] Plik `OpenMeteoProvider.ts` został utworzony
- [ ] Klasa `OpenMeteoProvider` implementuje `WeatherProvider` interface
- [ ] `WMO_WEATHER_CODES` zawiera mapowanie dla 95 kodów pogody

---

## ⚙️ TASK 2.2: Create WeatherService.ts (30min)

### Plik do utworzenia
**Path:** `/Users/tomaszfilinski/projects/flight-finder-ai/backend/src/services/weather/WeatherService.ts`

### Kompletny kod

```typescript
// ==========================================
// Weather Service (NO CACHE)
// ==========================================

import type {
  WeatherForecast,
  WeatherForecastResponse,
  Coordinates,
} from '../../types/weather.js';
import { OpenMeteoProvider } from './providers/OpenMeteoProvider.js';
import { getAirportLocation } from '../AmadeusGeocodingService.js';

export class WeatherService {
  private provider: OpenMeteoProvider;

  constructor() {
    this.provider = new OpenMeteoProvider();
  }

  /**
   * Get weather forecast for coordinates (NO CACHE)
   */
  async getForecast(
    coordinates: Coordinates,
    startDate: string,
    endDate?: string
  ): Promise<WeatherForecast[]> {
    const end = endDate || startDate;

    console.log(`🌍 [WeatherService] Fetching forecast from ${this.provider.name}`);
    const forecasts = await this.provider.getForecast(coordinates, startDate, end);

    if (forecasts.length > 0) {
      console.log(`✅ [WeatherService] Retrieved ${forecasts.length} days of forecast`);
      return forecasts;
    }

    throw new Error('No forecast data returned');
  }

  /**
   * Get weather forecast by IATA code (NO CACHE)
   */
  async getForecastByIATA(
    iataCode: string,
    date: string,
    days: number = 7
  ): Promise<WeatherForecastResponse> {
    console.log(`🌤️  [WeatherService] Fetching weather for ${iataCode}...`);

    // Get coordinates from Amadeus
    const airport = await getAirportLocation(iataCode);
    const startDate = date;
    const endDate = this.calculateEndDate(date, days);

    // Fetch weather
    let forecasts = await this.getForecast(airport.coordinates, startDate, endDate);

    // Fill in destination info
    forecasts = forecasts.map(f => ({
      ...f,
      destination: airport.cityName,
      destinationCode: iataCode,
    }));

    return {
      destination: airport.cityName,
      destinationCode: iataCode,
      forecasts,
      provider: this.provider.name,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(), // No expiration (no cache)
    };
  }

  /**
   * Check provider health
   */
  async checkProviderHealth(): Promise<{ name: string; available: boolean }> {
    const available = await this.provider.isAvailable();
    return {
      name: this.provider.name,
      available,
    };
  }

  /**
   * Calculate end date from start date and number of days
   */
  private calculateEndDate(startDate: string, days: number): string {
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + days - 1);
    return end.toISOString().split('T')[0];
  }
}

// Export singleton instance
export const weatherService = new WeatherService();
```

### Weryfikacja
- [ ] Plik utworzony w `/backend/src/services/weather/WeatherService.ts`
- [ ] Eksportowane są: `WeatherService` klasa i `weatherService` singleton
- [ ] Brak zależności od cache

---

## 📝 TASK 3.1: Update types/index.ts (15min)

### Plik do edycji
**Path:** `/Users/tomaszfilinski/projects/flight-finder-ai/backend/src/types/index.ts`

### Krok 1: Odczytaj koniec pliku
Użyj **Read** tool aby zobaczyć ostatnie linie pliku (offset od końca)

### Krok 2: Dodaj na końcu pliku

```typescript
// ==========================================
// Weather Types Export
// ==========================================

// Export all weather types
export * from './weather.js';
```

### Instrukcje
- **NIE usuwaj** żadnych istniejących typów
- Dodaj powyższy kod **NA SAMYM KOŃCU** pliku
- Użyj narzędzia **Edit** do dodania kodu

### Weryfikacja
- [ ] Export `export * from './weather.js'` dodany na końcu pliku
- [ ] Wszystkie istniejące typy zachowane
- [ ] Plik kompiluje się bez błędów

---

## 🔌 TASK 3.2: Integrate into agent.ts (45min)

### Plik do edycji
**Path:** `/Users/tomaszfilinski/projects/flight-finder-ai/backend/src/services/agent.ts`

### Krok 1: Dodaj importy

**Znajdź linię z importami** (około linii 5-7) i dodaj:

```typescript
import { weatherService } from './weather/WeatherService.js';
import type { WeatherData } from '../types/index.js';
```

### Krok 2: Zastąp funkcję `enrichWithWeather()`

**ZNAJDŹ** funkcję (około linii 231-273):
```typescript
async function enrichWithWeather(flights: FlightOffer[]): Promise<FlightOffer[]> {
  // ... stary kod z mockiem
}
```

**ZASTĄP CAŁĄ FUNKCJĘ NA:**

```typescript
/**
 * Enrich flight offers with REAL weather data (Open-Meteo + Amadeus Geocoding)
 * Fallback: Real API → Mock → No weather (graceful degradation)
 */
async function enrichWithWeather(flights: FlightOffer[]): Promise<FlightOffer[]> {
  console.log(`\n🌤️  [Agent] Enriching ${flights.length} flights with REAL weather (Open-Meteo)...`);

  const enrichmentPromises = flights.map(async (flight) => {
    try {
      // TRY 1: Real API (Open-Meteo + Amadeus Geocoding)
      const weatherResponse = await weatherService.getForecastByIATA(
        flight.destinationCode,
        flight.departureDate,
        7
      );

      // Convert WeatherForecast[] to simple WeatherData for backward compatibility
      const firstForecast = weatherResponse.forecasts[0];
      if (!firstForecast) {
        throw new Error('No forecast data');
      }

      const weatherData: WeatherData = {
        destination: flight.destination,
        destinationCode: flight.destinationCode,
        temperature: firstForecast.temperature.avg,
        condition: firstForecast.conditions.main,
        description: firstForecast.conditions.description,
        humidity: firstForecast.humidity,
        windSpeed: firstForecast.wind.speed,
        fetchedAt: new Date().toISOString(),
      };

      console.log(`✅ [Agent] Real weather for ${flight.destinationCode}: ${weatherData.temperature}°C, ${weatherData.condition}`);
      return { ...flight, weatherData };

    } catch (error: any) {
      console.warn(`⚠️  [Agent] Real API failed for ${flight.destinationCode}: ${error.message}`);

      // TRY 2: Mock fallback
      try {
        const mockWeather = getWeather({ destinationCode: flight.destinationCode });

        if (!mockWeather) {
          throw new Error('No mock weather available');
        }

        const weatherData: WeatherData = {
          destination: flight.destination,
          destinationCode: flight.destinationCode,
          temperature: mockWeather.temperature,
          condition: mockWeather.condition,
          description: mockWeather.forecast,
          humidity: mockWeather.humidity,
          fetchedAt: new Date().toISOString(),
        };

        console.log(`🔄 [Agent] Using mock weather for ${flight.destinationCode}`);
        return { ...flight, weatherData };

      } catch (mockError) {
        console.warn(`⚠️  [Agent] Mock fallback also failed for ${flight.destinationCode}`);
        // TRY 3: Return flight without weather (graceful degradation)
        return flight;
      }
    }
  });

  const results = await Promise.allSettled(enrichmentPromises);

  const enrichedFlights = results
    .filter((result): result is PromiseFulfilledResult<FlightOffer> => result.status === 'fulfilled')
    .map(result => result.value);

  const successRate = (enrichedFlights.filter(f => f.weatherData).length / flights.length) * 100;
  console.log(`✅ [Agent] Weather enrichment: ${successRate.toFixed(0)}% success rate (Real API + Mock fallback)`);

  return enrichedFlights;
}
```

### Weryfikacja
- [ ] Importy dodane na początku pliku
- [ ] Funkcja `enrichWithWeather()` zastąpiona nową wersją
- [ ] Zachowana struktura 3-poziomowego fallbacku (Real → Mock → None)
- [ ] Logi zawierają emoji dla łatwego debugowania

---

## 🎮 TASK 3.3: Add Weather Controllers (20min)

### Plik do edycji
**Path:** `/Users/tomaszfilinski/projects/flight-finder-ai/backend/src/controllers/flightController.ts`

### Krok 1: Dodaj import na początku

```typescript
import { weatherService } from '../services/weather/WeatherService.js';
```

### Krok 2: Dodaj funkcje NA KOŃCU pliku

```typescript
/**
 * GET /api/weather/forecast/:destinationCode
 * Get weather forecast for destination
 */
export async function getWeatherForecast(req: any, res: any): Promise<void> {
  try {
    const { destinationCode } = req.params;
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const days = parseInt((req.query.days as string) || '7');

    if (!destinationCode || destinationCode.length !== 3) {
      res.status(400).json({
        success: false,
        error: 'Invalid IATA code (must be 3 letters)',
      });
      return;
    }

    if (days < 1 || days > 14) {
      res.status(400).json({
        success: false,
        error: 'Days must be between 1 and 14',
      });
      return;
    }

    const forecast = await weatherService.getForecastByIATA(
      destinationCode.toUpperCase(),
      date,
      days
    );

    res.status(200).json({
      success: true,
      data: forecast,
    });

  } catch (error) {
    console.error('❌ [Controller] Weather error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch weather',
    });
  }
}

/**
 * GET /api/weather/status
 * Check weather service status
 */
export async function getWeatherStatus(req: any, res: any): Promise<void> {
  try {
    const health = await weatherService.checkProviderHealth();

    res.status(200).json({
      success: true,
      data: {
        provider: {
          name: health.name,
          status: health.available ? 'available' : 'unavailable',
        },
      },
    });

  } catch (error) {
    console.error('❌ [Controller] Status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    });
  }
}
```

### Weryfikacja
- [ ] Import `weatherService` dodany
- [ ] 2 nowe funkcje: `getWeatherForecast` i `getWeatherStatus`
- [ ] Walidacja parametrów (IATA code, days)
- [ ] Error handling z logami

---

## 🛣️ TASK 3.4: Add Weather Routes (10min)

### Plik do edycji
**Path:** `/Users/tomaszfilinski/projects/flight-finder-ai/backend/src/routes/flightRoutes.ts`

### Krok 1: Aktualizuj import kontrolerów

**ZNAJDŹ** linię z importem (około linii 1-5):
```typescript
import {
  searchFlights,
  listDestinations,
  // ... inne
} from '../controllers/flightController.js';
```

**DODAJ** do importu:
```typescript
import {
  searchFlights,
  listDestinations,
  // ... inne istniejące
  getWeatherForecast,     // DODAJ
  getWeatherStatus,       // DODAJ
} from '../controllers/flightController.js';
```

### Krok 2: Dodaj routes

**ZNAJDŹ** koniec definicji routes (PRZED `export default router;`)

**DODAJ:**
```typescript
// Weather routes
router.get('/weather/forecast/:destinationCode', getWeatherForecast);
router.get('/weather/status', getWeatherStatus);
```

### Weryfikacja
- [ ] Import zawiera `getWeatherForecast` i `getWeatherStatus`
- [ ] 2 nowe routes dodane
- [ ] Routes używają GET method
- [ ] Parametr `:destinationCode` jest w pierwszym route

---

## 🧪 TASK 3.5: Test Implementation (30min)

### Test 1: Kompilacja TypeScript

```bash
cd /Users/tomaszfilinski/projects/flight-finder-ai/backend
npm run build
```

**Oczekiwany wynik:**
```
✔ Compilation successful
0 errors
```

**Jeśli błędy:**
- Sprawdź czy wszystkie importy używają `.js` extension
- Sprawdź czy wszystkie foldery istnieją
- Sprawdź czy typy są poprawnie eksportowane

---

### Test 2: Uruchom backend

```bash
cd /Users/tomaszfilinski/projects/flight-finder-ai/backend
npm run dev
```

**Sprawdź logi:**
```
Server running on port 3001
✓ No startup errors
```

**Jeśli błędy:**
- Sprawdź czy Amadeus credentials są w `.env`
- Sprawdź czy port 3001 jest wolny

---

### Test 3: Weather Status Endpoint

```bash
curl "http://localhost:3001/api/weather/status"
```

**Oczekiwany response:**
```json
{
  "success": true,
  "data": {
    "provider": {
      "name": "open-meteo",
      "status": "available"
    }
  }
}
```

**Weryfikacja:**
- [ ] `success: true`
- [ ] `provider.name` = "open-meteo"
- [ ] `provider.status` = "available"

---

### Test 4: Weather Forecast Endpoint

```bash
curl "http://localhost:3001/api/weather/forecast/BCN?date=2025-10-20&days=7"
```

**Oczekiwany response:**
```json
{
  "success": true,
  "data": {
    "destination": "BARCELONA",
    "destinationCode": "BCN",
    "forecasts": [
      {
        "date": "2025-10-20",
        "destination": "BARCELONA",
        "destinationCode": "BCN",
        "coordinates": {
          "latitude": 41.2974,
          "longitude": 2.0833
        },
        "temperature": {
          "min": 15,
          "max": 22,
          "avg": 18
        },
        "conditions": {
          "main": "Clear",
          "description": "clear sky",
          "icon": "01d"
        },
        "precipitation": { /* ... */ },
        "wind": { /* ... */ }
      }
      // ... 6 more days
    ],
    "provider": "open-meteo",
    "cachedAt": "2025-10-15T...",
    "expiresAt": "2025-10-15T..."
  }
}
```

**Weryfikacja:**
- [ ] `success: true`
- [ ] `data.forecasts` zawiera 7 elementów
- [ ] `data.provider` = "open-meteo"
- [ ] Każdy forecast ma wszystkie pola (temperature, conditions, precipitation, wind)

**Backend logs powinny zawierać:**
```
🌍 [Amadeus Geocoding] Fetching coordinates for BCN...
🌐 [Amadeus Geocoding] API Call: https://test.api.amadeus.com/v1/reference-data/locations...
✅ [Amadeus Geocoding] Found: BARCELONA at (41.2974, 2.0833)
🌍 [WeatherService] Fetching forecast from open-meteo
☀️  [Open-Meteo] Fetching forecast for (41.2974, 2.0833)
✅ [Open-Meteo] Retrieved 7 days of forecast
✅ [WeatherService] Retrieved 7 days of forecast
```

---

### Test 5: Flight Search z Pogodą (Integration Test)

```bash
curl -X POST http://localhost:3001/api/flights/search \
  -H "Content-Type: application/json" \
  -d '{
    "budget": 500,
    "origin": "WAW",
    "travelStyle": "culture",
    "weatherPreference": "mild",
    "preferredDestinations": ["BCN"]
  }'
```

**Sprawdź backend logs:**
```
🤖 ========================================
🤖 Starting AI Flight Agent
🤖 ========================================
🔧 [Agent] Executing: search_flight_inspiration
✅ [Agent] Successfully retrieved 8 destinations from Amadeus Inspiration API

🌤️  [Agent] Enriching 8 flights with REAL weather (Open-Meteo)...
🌍 [Amadeus Geocoding] Fetching coordinates for BCN...
✅ [Amadeus Geocoding] Found: BARCELONA at (41.2974, 2.0833)
🌍 [WeatherService] Fetching forecast from open-meteo
☀️  [Open-Meteo] Fetching forecast for (41.2974, 2.0833)
✅ [Open-Meteo] Retrieved 7 days of forecast
✅ [WeatherService] Retrieved 7 days of forecast
✅ [Agent] Real weather for BCN: 18°C, Clear
...
✅ [Agent] Weather enrichment: 100% success rate (Real API + Mock fallback)
🎯 [Agent] Ranking 8 flights by preferences...
✅ [Agent] Completed successfully
⏱️  [Agent] Execution time: 1234ms
```

**Sprawdź response:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "id": "...",
        "destination": "Barcelona",
        "destinationCode": "BCN",
        "weatherData": {
          "destination": "Barcelona",
          "destinationCode": "BCN",
          "temperature": 18,
          "condition": "Clear",
          "description": "clear sky",
          "humidity": 0,
          "windSpeed": 12,
          "fetchedAt": "2025-10-15T..."
        },
        // ... flight details
      }
    ],
    "reasoning": "...",
    "executionTime": 1234,
    "toolsUsed": ["search_flight_inspiration", "enrich_weather", "filter_and_rank"]
  }
}
```

**Weryfikacja:**
- [ ] `recommendations[0].weatherData` istnieje
- [ ] `weatherData.temperature` jest liczbą
- [ ] `weatherData.condition` to string (np. "Clear", "Rain")
- [ ] Backend logi pokazują "REAL weather" (nie mock)

---

## ✅ Checklist Końcowy

Po zakończeniu wszystkich tasków, sprawdź:

### Struktura Plików
- [ ] `/backend/src/services/AmadeusGeocodingService.ts` istnieje
- [ ] `/backend/src/services/weather/WeatherService.ts` istnieje
- [ ] `/backend/src/services/weather/providers/OpenMeteoProvider.ts` istnieje
- [ ] `/backend/src/types/weather.ts` zaktualizowany (AirportLocation)
- [ ] `/backend/src/types/index.ts` zawiera `export * from './weather.js'`

### Kompilacja
- [ ] `npm run build` - 0 errors
- [ ] TypeScript kompiluje się bez ostrzeżeń

### Backend Runtime
- [ ] `npm run dev` - serwer startuje bez błędów
- [ ] Brak error logów podczas startu

### API Endpoints
- [ ] `GET /api/weather/status` - zwraca `status: "available"`
- [ ] `GET /api/weather/forecast/BCN` - zwraca 7-dniową prognozę
- [ ] `GET /api/weather/forecast/BCN?date=2025-10-20&days=3` - zwraca 3-dniową prognozę
- [ ] `GET /api/weather/forecast/INVALID` - zwraca error 400

### Flight Search Integration
- [ ] `POST /api/flights/search` - zwraca loty z `weatherData`
- [ ] Backend logi pokazują "REAL weather" dla destynacji
- [ ] Fallback do mock weather działa jeśli Real API fail
- [ ] Graceful degradation - loty bez pogody nadal się wyświetlają

### Performance
- [ ] Weather enrichment success rate ≥ 80%
- [ ] P95 response time < 5 seconds (dla flight search)
- [ ] Brak błędów 500 w API responses

---

## 🔧 Troubleshooting Guide

### Problem: "Cannot find module './weather/WeatherService.js'"

**Przyczyna:** Katalogi nie zostały utworzone lub plik w złej lokalizacji

**Rozwiązanie:**
```bash
# Sprawdź strukturę
ls -la /Users/tomaszfilinski/projects/flight-finder-ai/backend/src/services/weather/

# Powinno być:
# WeatherService.ts
# providers/
#   OpenMeteoProvider.ts
```

---

### Problem: "No location found for IATA code: BCN"

**Przyczyna:** Amadeus Geocoding API nie działa lub błędne credentials

**Rozwiązanie:**
1. Sprawdź `.env`:
   ```bash
   cat /Users/tomaszfilinski/projects/flight-finder-ai/backend/.env | grep AMADEUS
   ```
2. Sprawdź czy credentials są poprawne (bez whitespace)
3. Spróbuj z innym IATA code (PRG, LIS, WAW)
4. Sprawdź logi Amadeus API w konsoli

---

### Problem: "Open-Meteo API request timed out"

**Przyczyna:** Brak połączenia z internetem lub Open-Meteo down

**Rozwiązanie:**
1. Sprawdź połączenie:
   ```bash
   curl "https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&daily=temperature_2m_max"
   ```
2. Zwiększ timeout w `OpenMeteoProvider.ts` (np. do 10000ms)
3. Sprawdź status Open-Meteo: https://open-meteo.com/

---

### Problem: Weather enrichment < 50%

**Przyczyna:** Problemy z Amadeus Geocoding lub Open-Meteo

**Rozwiązanie:**
1. Sprawdź logi - który API failuje?
2. Jeśli Geocoding failuje - sprawdź credentials
3. Jeśli Open-Meteo failuje - sprawdź timeout
4. Fallback do mock weather powinien działać (sprawdź czy mock data istnieje w `flightAPI.ts`)

---

### Problem: TypeScript compilation errors

**Najczęstsze błędy:**

**Błąd:** `Cannot find module './weather.js'`
**Rozwiązanie:** Sprawdź czy w `types/index.ts` jest `export * from './weather.js'` (z `.js` extension!)

**Błąd:** `Type 'WeatherData' is not assignable...`
**Rozwiązanie:** Sprawdź czy `WeatherData` interface istnieje w `types/index.ts`

**Błąd:** `Property 'cityName' does not exist on type 'AirportLocation'`
**Rozwiązanie:** Sprawdź czy `AirportLocation` został zaktualizowany w `types/weather.ts` (Task 1.1)

---

## 📊 Success Metrics

Po zakończeniu implementacji, aplikacja powinna spełniać:

✅ **Functionality:**
- Weather data displayed for 80%+ of flights (Real API + Mock fallback)
- API endpoints `/weather/forecast` i `/weather/status` działają
- Flight search zwraca `weatherData` field

✅ **Performance:**
- P95 response time < 5 seconds (bez cache akceptowalne)
- Weather enrichment success rate ≥ 80%
- Graceful degradation - 0 crashes z powodu weather API

✅ **Code Quality:**
- TypeScript kompiluje bez błędów
- Wszystkie importy używają `.js` extension
- Emoji logging dla łatwego debugowania

✅ **Backward Compatibility:**
- Stary format `WeatherData` zachowany
- Mock weather nadal działa jako fallback
- Istniejące API endpoints nie są broken

---

## 📝 Post-Implementation Notes

Po zakończeniu implementacji:

1. **Commit changes** z opisem:
   ```bash
   git add .
   git commit -m "feat(backend): implement weather integration with Open-Meteo and Amadeus Geocoding

   - Add AmadeusGeocodingService for IATA → coordinates conversion
   - Add OpenMeteoProvider for weather forecasting
   - Integrate weather service into flight agent
   - Add weather API endpoints (/weather/forecast, /weather/status)
   - 3-tier fallback: Real API → Mock → Graceful degradation
   - No cache (simplified first version)

   Closes #XX"
   ```

2. **Update dokumentacji** (opcjonalne):
   - Dodaj weather endpoints do `docs/CLAUDE.md`
   - Zaktualizuj `README.md` z nowymi features

3. **Next steps** (przyszłe iteracje):
   - [ ] Dodaj cache (WeatherCache, GeocodingCache) - Phase 4
   - [ ] Frontend integration - Phase 5
   - [ ] Unit tests - Phase 6
   - [ ] Performance monitoring - Phase 7

---

## 🎓 Learning Resources

- **Open-Meteo API Docs:** https://open-meteo.com/en/docs
- **Amadeus City Search API:** https://developers.amadeus.com/self-service/category/destination-experiences/api-doc/city-search
- **WMO Weather Codes:** https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM

---

**Total Estimated Time:** 4.5 hours
**Difficulty:** Medium
**Dependencies:** Amadeus API credentials

**Good luck! 🚀**
