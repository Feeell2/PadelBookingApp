# Weather Integration Feature - Implementation Guide

## Overview

This document provides detailed, actionable instructions for implementing the weather forecast feature in the Flight Finder AI application. The feature will enrich flight search results with 7-day weather forecasts for destination cities using **real-time geocoding** from Amadeus API.

**Total Estimated Time**: 6-8 hours (without unit tests)
**Architecture Pattern**: Single weather provider with Amadeus geocoding
**Note**: Unit tests omitted for now - focus on implementation first

---

## Architecture Summary

```
User Search → Controller → Agent → Amadeus Flight API
                                 ↓
                    Amadeus City Search API: "BCN" → {lat: 41.29, lon: 2.08}
                                 ↓
                    Open-Meteo Weather API (with cache)
                                 ↓
                    Response: Flights + Weather → Frontend
```

**Key Components**:
1. **Amadeus City Search API**: Real-time geocoding (IATA → coordinates)
2. **Open-Meteo API**: Free weather provider (no API key required)
3. **Two-tier caching**: Coordinates cache (24h TTL) + Weather cache (1h TTL)

**Why This Approach**:
- ✅ No static airport database to maintain
- ✅ Always accurate, up-to-date coordinates
- ✅ Simplified codebase (single weather provider)
- ✅ Leverages existing Amadeus authentication
- ✅ Free weather API (Open-Meteo)

---

## Phase 1: Foundation & Core Infrastructure (2-3 hours)

### Task 1.1: Create Weather Type Definitions

**File**: `backend/src/types/weather.ts` (NEW)

```typescript
// ==========================================
// Weather Types & Interfaces
// ==========================================

/**
 * Geographic coordinates
 */
export interface Coordinates {
  latitude: number;   // -90 to 90
  longitude: number;  // -180 to 180
}

/**
 * Weather forecast for a specific date
 */
export interface WeatherForecast {
  date: string;                    // YYYY-MM-DD
  destination: string;             // City name (e.g., "Barcelona")
  destinationCode: string;         // IATA code (e.g., "BCN")
  coordinates: Coordinates;
  temperature: {
    min: number;                   // Celsius
    max: number;                   // Celsius
    avg: number;                   // Celsius
  };
  apparentTemperature?: {          // "Feels like" temperature
    min: number;                   // Celsius
    max: number;                   // Celsius
  };
  conditions: {
    main: string;                  // "Clear", "Clouds", "Rain", etc.
    description: string;           // "partly cloudy", "light rain"
    icon: string;                  // Weather condition code
  };
  precipitation: {
    probability: number;           // 0-100 percentage
    amount: number;                // mm (total)
    rain?: number;                 // mm (rain only)
    snow?: number;                 // cm (snowfall)
    showers?: number;              // mm (rain showers)
    hours?: number;                // Hours with precipitation
  };
  wind: {
    speed: number;                 // km/h (max)
    gusts?: number;                // km/h (max gusts)
    direction: number;             // degrees (0-360)
  };
  humidity: number;                // 0-100 percentage
  visibility: number;              // km
  uvIndex: number;                 // 0-11+
  sunrise: string;                 // ISO timestamp
  sunset: string;                  // ISO timestamp
  daylightDuration?: number;       // seconds
  sunshineDuration?: number;       // seconds (actual sunshine vs daylight)
}

/**
 * Weather forecast response (multiple days)
 */
export interface WeatherForecastResponse {
  destination: string;
  destinationCode: string;
  forecasts: WeatherForecast[];   // Array of daily forecasts
  provider: string;                // "open-meteo"
  cachedAt: string;                // ISO timestamp
  expiresAt: string;               // ISO timestamp
}

/**
 * Airport/City location from Amadeus
 */
export interface AirportLocation {
  iataCode: string;                // "BCN"
  name: string;                    // "Barcelona"
  cityName: string;                // "BARCELONA"
  countryCode: string;             // "ES"
  coordinates: Coordinates;
  timeZoneOffset?: string;         // "+02:00"
}

/**
 * Amadeus City Search API Response
 */
export interface AmadeusLocationResponse {
  meta: {
    count: number;
    links?: {
      self: string;
    };
  };
  data: Array<{
    type: string;                  // "location"
    subType: string;               // "CITY" or "AIRPORT"
    name: string;                  // "BARCELONA"
    detailedName?: string;         // "Barcelona, ES"
    id: string;                    // "CBCN"
    self?: {
      href: string;
      methods: string[];
    };
    timeZoneOffset?: string;       // "+02:00"
    iataCode: string;              // "BCN"
    geoCode: {
      latitude: number;            // 41.2974
      longitude: number;           // 2.0833
    };
    address: {
      cityName: string;            // "BARCELONA"
      cityCode?: string;           // "BCN"
      countryName?: string;        // "SPAIN"
      countryCode: string;         // "ES"
      regionCode?: string;         // "EUROP"
    };
    analytics?: {
      travelers: {
        score: number;
      };
    };
  }>;
}

/**
 * Weather provider interface
 */
export interface WeatherProvider {
  name: string;

  /**
   * Fetch weather forecast for coordinates and date range
   */
  getForecast(
    coordinates: Coordinates,
    startDate: string,
    endDate: string,
    options?: WeatherFetchOptions
  ): Promise<WeatherForecast[]>;

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get provider configuration
   */
  getConfig(): WeatherProviderConfig;
}

export interface WeatherFetchOptions {
  timezone?: string;
  units?: 'metric' | 'imperial';
  language?: string;
}

export interface WeatherProviderConfig {
  name: string;
  requiresApiKey: boolean;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  features: {
    maxForecastDays: number;
    hourlyForecast: boolean;
    historicalData: boolean;
  };
}

/**
 * Cache entry with TTL
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;   // Unix timestamp (ms)
  expiresAt: number;   // Unix timestamp (ms)
  accessCount: number;
  lastAccessed: number; // Unix timestamp (ms)
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  ttl: number;         // Time to live in milliseconds
  maxSize?: number;    // Max entries (LRU eviction)
  namespace?: string;  // Cache namespace
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}
```

---

### Task 1.2: Implement Amadeus Geocoding Service

**File**: `backend/src/services/AmadeusGeocodingService.ts` (NEW)

```typescript
// ==========================================
// Amadeus Geocoding Service
// Converts IATA codes to coordinates using Amadeus City Search API
// ==========================================

import type { AirportLocation, Coordinates, AmadeusLocationResponse } from '../types/weather.js';
import { getAmadeusToken } from './amadeusAPI.js';

const AMADEUS_BASE_URL = 'https://test.api.amadeus.com';

/**
 * Cache for airport coordinates (24 hour TTL)
 */
class GeocodingCache {
  private cache: Map<string, { location: AirportLocation; expiresAt: number }>;
  private readonly ttl = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.cache = new Map();
  }

  get(iataCode: string): AirportLocation | null {
    const entry = this.cache.get(iataCode.toUpperCase());

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(iataCode);
      console.log(`🗑️  [Geocoding Cache] Expired: ${iataCode}`);
      return null;
    }

    console.log(`💾 [Geocoding Cache] HIT: ${iataCode}`);
    return entry.location;
  }

  set(iataCode: string, location: AirportLocation): void {
    this.cache.set(iataCode.toUpperCase(), {
      location,
      expiresAt: Date.now() + this.ttl,
    });
    console.log(`💾 [Geocoding Cache] SET: ${iataCode} (expires in 24h)`);
  }

  clear(): void {
    this.cache.clear();
  }
}

const geocodingCache = new GeocodingCache();

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

  // Check cache first
  const cached = geocodingCache.get(normalizedCode);
  if (cached) {
    return cached;
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

    // Cache the result
    geocodingCache.set(normalizedCode, airportLocation);

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

/**
 * Clear geocoding cache (useful for testing)
 */
export function clearGeocodingCache(): void {
  geocodingCache.clear();
  console.log('🗑️  [Geocoding Cache] Cleared all entries');
}
```

---

### Task 1.3: Implement Weather Cache Infrastructure

**File**: `backend/src/utils/cache/WeatherCache.ts` (NEW)

```typescript
// ==========================================
// Weather Cache with TTL and LRU Eviction
// ==========================================

import type { CacheEntry, CacheOptions, CacheStats } from '../../types/weather.js';
import type { WeatherForecast } from '../../types/weather.js';

export class WeatherCache {
  private cache: Map<string, CacheEntry<WeatherForecast[]>>;
  private readonly ttl: number;
  private readonly maxSize: number;
  private stats: { hits: number; misses: number };

  constructor(options: CacheOptions = { ttl: 60 * 60 * 1000, maxSize: 1000 }) {
    this.cache = new Map();
    this.ttl = options.ttl;
    this.maxSize = options.maxSize || 1000;
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Generate cache key from IATA code and date
   */
  generateKey(iataCode: string, date: string, provider: string = 'open-meteo'): string {
    return `weather:${iataCode.toUpperCase()}:${date}:${provider}`;
  }

  /**
   * Get cached value
   * Returns null if not found or expired
   */
  get(key: string): WeatherForecast[] | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      console.log(`🗑️  [Weather Cache] Expired entry removed: ${key}`);
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    const validFor = Math.floor((entry.expiresAt - Date.now()) / 1000);
    console.log(`💾 [Weather Cache] HIT: ${key} (valid for ${validFor}s, accessed ${entry.accessCount} times)`);

    return entry.value;
  }

  /**
   * Set cache value with TTL
   */
  set(key: string, value: WeatherForecast[]): void {
    // Evict LRU entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<WeatherForecast[]> = {
      key,
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry);
    console.log(`💾 [Weather Cache] SET: ${key} (expires in ${this.ttl / 1000}s)`);
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`🗑️  [Weather Cache] Deleted: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🗑️  [Weather Cache] Cleared ${size} entries`);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  /**
   * Get cache size
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    // Find least recently used entry
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      console.log(`🗑️  [Weather Cache] LRU eviction: ${lruKey}`);
    }
  }

  /**
   * Remove expired entries (cleanup)
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🗑️  [Weather Cache] Cleanup: removed ${removed} expired entries`);
    }

    return removed;
  }
}

// Export singleton instance
export const weatherCache = new WeatherCache({
  ttl: 60 * 60 * 1000, // 1 hour
  maxSize: 1000,
});
```

---

### Phase 1 Completion Checklist

✅ **Weather types defined** (`backend/src/types/weather.ts`)
✅ **Amadeus geocoding service implemented** (`backend/src/services/AmadeusGeocodingService.ts`)
✅ **Cache infrastructure ready** (`backend/src/utils/cache/WeatherCache.ts`)

---

## Phase 2: Open-Meteo Weather Provider (2 hours)

### Task 2.1: Implement Open-Meteo Provider

**File**: `backend/src/services/weather/providers/OpenMeteoProvider.ts` (NEW)

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

---

### Task 2.2: Create Simplified WeatherService

**File**: `backend/src/services/weather/WeatherService.ts` (NEW)

```typescript
// ==========================================
// Weather Service (Single Provider)
// ==========================================

import type {
  WeatherForecast,
  WeatherForecastResponse,
  Coordinates,
} from '../../types/weather.js';
import { OpenMeteoProvider } from './providers/OpenMeteoProvider.js';
import { weatherCache } from '../../utils/cache/WeatherCache.js';
import { getAirportLocation } from '../AmadeusGeocodingService.js';

export class WeatherService {
  private provider: OpenMeteoProvider;
  private readonly useCache: boolean;

  constructor(useCache: boolean = true) {
    this.provider = new OpenMeteoProvider();
    this.useCache = useCache;
  }

  /**
   * Get weather forecast for coordinates
   */
  async getForecast(
    coordinates: Coordinates,
    startDate: string,
    endDate?: string
  ): Promise<WeatherForecast[]> {
    const end = endDate || startDate;

    try {
      console.log(`🌍 [WeatherService] Fetching forecast from ${this.provider.name}`);
      const forecasts = await this.provider.getForecast(coordinates, startDate, end);

      if (forecasts.length > 0) {
        console.log(`✅ [WeatherService] Retrieved ${forecasts.length} days of forecast`);
        return forecasts;
      }

      throw new Error('No forecast data returned');
    } catch (error) {
      console.error(`❌ [WeatherService] Error:`, error);
      throw error;
    }
  }

  /**
   * Get weather forecast with caching (by IATA code)
   */
  async getForecastCached(
    iataCode: string,
    date: string,
    days: number = 7
  ): Promise<WeatherForecastResponse> {
    // Generate cache key
    const cacheKey = weatherCache.generateKey(iataCode, date);

    // Check cache first
    if (this.useCache) {
      const cached = weatherCache.get(cacheKey);
      if (cached) {
        const airport = await getAirportLocation(iataCode);
        return {
          destination: airport.cityName,
          destinationCode: iataCode,
          forecasts: cached,
          provider: 'cache',
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        };
      }
    }

    // Cache miss - fetch from provider
    console.log(`🌤️  [WeatherService] Cache miss for ${iataCode}, fetching from API...`);

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

    // Cache the result
    if (this.useCache) {
      weatherCache.set(cacheKey, forecasts);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

    return {
      destination: airport.cityName,
      destinationCode: iataCode,
      forecasts,
      provider: this.provider.name,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
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

---

### Phase 2 Completion Checklist

✅ **Open-Meteo provider implemented**
✅ **Simplified WeatherService created** (single provider, no fallback)
✅ **Service uses Amadeus geocoding** for coordinate lookup

---

## Phase 3: Backend Integration (2-3 hours)

### Task 3.1: Update Type Definitions

**File**: `backend/src/types/index.ts` (UPDATE)

Add to existing types:

```typescript
// Import weather types
export * from './weather.js';

/**
 * Enhanced flight offer with weather data
 */
export interface FlightOfferWithWeather extends FlightOffer {
  weather?: WeatherForecastResponse;
}

/**
 * Enhanced AI Agent response with weather
 */
export interface AgentResponse {
  recommendations: FlightOfferWithWeather[];
  reasoning: string;
  alternatives?: FlightOfferWithWeather[];
  weatherInfo?: WeatherInfo[]; // Deprecated - kept for backward compatibility
  weatherForecasts?: WeatherForecastResponse[];
  executionTime: number;
  toolsUsed: string[];
  metadata?: {
    weatherProvider?: string;
    weatherCacheHits?: number;
    weatherCacheMisses?: number;
    geocodingCacheHits?: number;
  };
}
```

---

### Task 3.2: Integrate Weather into Agent

**File**: `backend/src/services/agent.ts` (UPDATE)

Add weather enrichment:

```typescript
import type { UserPreferences, AgentResponse, FlightOfferWithWeather } from '../types/index.js';
import { searchFlights, getWeather, getDestinations } from './flightAPI.js';
import { searchAmadeusFlights } from './amadeusAPI.js';
import { weatherService } from './weather/WeatherService.js';
import { weatherCache } from '../utils/cache/WeatherCache.js';

export async function runFlightAgent(preferences: UserPreferences): Promise<AgentResponse> {
  const startTime = Date.now();
  const toolsUsed: string[] = [];

  // Get cache stats before
  const statsBefore = weatherCache.getStats();

  console.log('\n🤖 ========================================');
  console.log('🤖 Starting AI Flight Agent');
  console.log('🤖 ========================================');

  // Tool 1: Search flights (existing logic)
  let flights: FlightOfferWithWeather[] = [];

  const departureDate = preferences.departureDate || (() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  })();

  const possibleDestinations = preferences.preferredDestinations && preferences.preferredDestinations.length > 0
    ? preferences.preferredDestinations.map(d => d.toUpperCase())
    : ['BCN', 'PRG', 'LIS', 'BUD', 'CPH'];

  const targetDestination = possibleDestinations[0];

  console.log(`\n🔧 [Agent] Executing: search_real_flights`);
  toolsUsed.push('search_real_flights');

  try {
    const realFlights = await searchAmadeusFlights(
      preferences.origin,
      targetDestination,
      departureDate,
      1,
      5
    );

    if (realFlights.length > 0) {
      flights = realFlights;
      console.log(`✅ [Agent] Retrieved ${flights.length} real flights`);
    } else {
      throw new Error('No flights found');
    }
  } catch (error: any) {
    console.log(`❌ [Agent] Amadeus error: ${error.message}`);
    console.log(`🔄 [Agent] Falling back to mock data...`);
    toolsUsed.push('search_flights_mock');
    flights = searchFlights({
      budget: preferences.budget,
      origin: preferences.origin,
      preferences: {
        travelStyle: preferences.travelStyle,
        weatherPreference: preferences.weatherPreference,
        preferredDestinations: preferences.preferredDestinations,
      },
    });
  }

  // Tool 2: Enrich with weather
  console.log('\n🔧 [Agent] Executing: get_weather_forecast');
  toolsUsed.push('get_weather_forecast');

  const enrichedFlights = await enrichFlightsWithWeather(flights, departureDate);

  // Get cache stats after
  const statsAfter = weatherCache.getStats();

  // Generate reasoning
  const reasoning = generateReasoning(preferences, enrichedFlights);

  const executionTime = Date.now() - startTime;

  console.log('\n✅ [Agent] Completed successfully');
  console.log(`⏱️  [Agent] Execution time: ${executionTime}ms`);
  console.log(`💾 [Agent] Weather cache: ${statsAfter.hits - statsBefore.hits} hits, ${statsAfter.misses - statsBefore.misses} misses`);
  console.log('🤖 ========================================\n');

  return {
    recommendations: enrichedFlights,
    reasoning,
    weatherForecasts: enrichedFlights.map(f => f.weather).filter(Boolean) as any[],
    executionTime,
    toolsUsed,
    metadata: {
      weatherProvider: 'open-meteo',
      weatherCacheHits: statsAfter.hits - statsBefore.hits,
      weatherCacheMisses: statsAfter.misses - statsBefore.misses,
    },
  };
}

/**
 * Enrich flights with weather forecast data
 */
async function enrichFlightsWithWeather(
  flights: FlightOfferWithWeather[],
  departureDate: string
): Promise<FlightOfferWithWeather[]> {
  console.log(`🌤️  [Agent] Enriching ${flights.length} flights with weather...`);

  const enrichedFlights = await Promise.allSettled(
    flights.map(async (flight) => {
      try {
        const weather = await weatherService.getForecastCached(
          flight.destinationCode,
          departureDate,
          7
        );

        return {
          ...flight,
          weather,
        };
      } catch (error) {
        console.warn(`⚠️  [Agent] Weather fetch failed for ${flight.destinationCode}:`,
          error instanceof Error ? error.message : error);
        return flight;
      }
    })
  );

  const results = enrichedFlights.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return flights[index];
    }
  });

  const successCount = results.filter(f => f.weather).length;
  console.log(`✅ [Agent] Enriched ${successCount}/${flights.length} flights`);

  return results;
}

function generateReasoning(preferences: UserPreferences, flights: FlightOfferWithWeather[]): string {
  return `Based on your preferences for ${preferences.travelStyle} travel with ${preferences.weatherPreference} weather, I found ${flights.length} flights from ${preferences.origin}. Weather data included for better planning.`;
}
```

---

### Task 3.3: Add Weather Controller Endpoints

**File**: `backend/src/controllers/flightController.ts` (UPDATE)

```typescript
import { weatherService } from '../services/weather/WeatherService.js';
import { weatherCache } from '../utils/cache/WeatherCache.js';

/**
 * GET /api/weather/forecast/:destinationCode
 */
export async function getWeatherForecast(req: Request, res: Response): Promise<void> {
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

    const forecast = await weatherService.getForecastCached(
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
 */
export async function getWeatherStatus(req: Request, res: Response): Promise<void> {
  try {
    const health = await weatherService.checkProviderHealth();
    const cacheStats = weatherCache.getStats();

    res.status(200).json({
      success: true,
      data: {
        provider: {
          name: health.name,
          status: health.available ? 'available' : 'unavailable',
        },
        cache: cacheStats,
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

---

### Task 3.4: Add Routes

**File**: `backend/src/routes/flightRoutes.ts` (UPDATE)

```typescript
import {
  searchFlights,
  listDestinations,
  getDestinationWeather,
  getWeatherForecast,
  getWeatherStatus,
} from '../controllers/flightController.js';

// Existing routes
router.post('/search', searchFlights);
router.get('/destinations', listDestinations);

// Weather routes
router.get('/weather/forecast/:destinationCode', getWeatherForecast);
router.get('/weather/status', getWeatherStatus);
```

---

### Phase 3 Completion Checklist

✅ **Types updated**
✅ **Agent integrated with weather**
✅ **Weather endpoints added**
✅ **Routes configured**

**Test Commands**:
```bash
# Test weather forecast
curl "http://localhost:3001/api/weather/forecast/BCN?date=2025-10-20&days=7"

# Test weather status
curl "http://localhost:3001/api/weather/status"

# Test flight search with weather
curl -X POST http://localhost:3001/api/flights/search \
  -H "Content-Type: application/json" \
  -d '{"budget":500,"origin":"WAW","travelStyle":"culture","weatherPreference":"mild","preferredDestinations":["BCN"]}'
```

---

## Phase 4: Frontend Integration (Optional - 2 hours)

### Task 4.1: Update Frontend Types

**File**: `frontend/src/types/index.ts` (UPDATE)

```typescript
export interface WeatherForecast {
  date: string;
  destination: string;
  destinationCode: string;
  coordinates: { latitude: number; longitude: number };
  temperature: { min: number; max: number; avg: number };
  apparentTemperature?: { min: number; max: number };
  conditions: { main: string; description: string; icon: string };
  precipitation: {
    probability: number;
    amount: number;
    rain?: number;
    snow?: number;
    hours?: number;
  };
  wind: { speed: number; gusts?: number; direction: number };
  humidity: number;
  visibility: number;
  uvIndex: number;
  sunrise: string;
  sunset: string;
  daylightDuration?: number;
  sunshineDuration?: number;
}

export interface WeatherForecastResponse {
  destination: string;
  destinationCode: string;
  forecasts: WeatherForecast[];
  provider: string;
  cachedAt: string;
  expiresAt: string;
}

export interface FlightOffer {
  id: string;
  destination: string;
  destinationCode: string;
  origin: string;
  price: number;
  currency: string;
  departureDate: string;
  returnDate: string;
  airline: string;
  duration: string;
  stops: number;
  weather?: WeatherForecastResponse;
}
```

### Task 4.2: Enhance WeatherBadge Component

See original documentation Task 4.2 for complete React component code.

### Task 4.3: Update FlightCard Component

See original documentation Task 4.3 for complete integration code.

---

## Success Criteria

✅ Weather data displayed for 95%+ of flights
✅ P95 response time < 2 seconds
✅ Weather cache hit rate > 60%
✅ Geocoding cache hit rate > 80%
✅ Zero weather failures breaking flight search
✅ Graceful degradation on API errors

---

## Environment Variables

**File**: `backend/.env.example`

```bash
# Amadeus API (Required)
AMADEUS_API_KEY=your_api_key
AMADEUS_API_SECRET=your_api_secret

# Weather Cache (Optional)
WEATHER_CACHE_TTL_MINUTES=60
WEATHER_CACHE_MAX_SIZE=1000

# Server
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

---

## API Documentation

### Amadeus City Search API

**Endpoint**: `GET /v1/reference-data/locations`

**Parameters**:
- `subType`: `CITY,AIRPORT` (search both)
- `keyword`: IATA code (e.g., "BCN")
- `page[limit]`: `1` (get first result)

**Response**:
```json
{
  "data": [{
    "type": "location",
    "subType": "CITY",
    "name": "BARCELONA",
    "iataCode": "BCN",
    "geoCode": {
      "latitude": 41.2974,
      "longitude": 2.0833
    },
    "address": {
      "cityName": "BARCELONA",
      "countryCode": "ES"
    }
  }]
}
```

### Open-Meteo API

**Endpoint**: `GET https://api.open-meteo.com/v1/forecast`

**Parameters**:
- `latitude`: Decimal degrees
- `longitude`: Decimal degrees
- `start_date`: YYYY-MM-DD
- `end_date`: YYYY-MM-DD
- `daily`: Comma-separated parameters
- `timezone`: auto

**Docs**: https://open-meteo.com/en/docs

---

## Troubleshooting

### "No location found for IATA code"
- Verify IATA code is valid 3-letter code
- Check Amadeus API credentials
- Try with different destination

### "Open-Meteo API timeout"
- Check network connectivity
- Increase timeout in OpenMeteoProvider
- Verify Open-Meteo service status

### High cache miss rate
- Increase cache TTL
- Check if dates are varying too much
- Monitor cache statistics endpoint

---

## Benefits of This Approach

### vs. Static Airport Database
- ✅ Always up-to-date coordinates
- ✅ No maintenance overhead
- ✅ Supports all Amadeus airports
- ✅ Includes timezone information

### vs. Multiple Weather Providers
- ✅ Simplified codebase
- ✅ No API key management
- ✅ Consistent data format
- ✅ Easier testing and debugging

### Performance
- ✅ Two-tier caching (geocoding + weather)
- ✅ Parallel processing for multiple flights
- ✅ Graceful degradation on errors
- ✅ < 2 second total response time

---

## Next Steps

After implementing this feature:

1. **Add unit tests** for geocoding and weather services
2. **Monitor cache hit rates** and adjust TTL if needed
3. **Add fallback provider** (optional) if Open-Meteo reliability becomes an issue
4. **Implement weather alerts** for extreme conditions
5. **Add historical weather data** for better recommendations

---

**Implementation Time**: 6-8 hours total
**Complexity**: Medium
**Dependencies**: Amadeus API credentials

Good luck! 🚀
