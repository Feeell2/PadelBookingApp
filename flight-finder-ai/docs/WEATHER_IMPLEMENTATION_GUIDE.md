# Weather Integration Feature - Implementation Guide for node-express-implementer

## Overview

This document provides detailed, actionable instructions for implementing the weather forecast feature in the Flight Finder AI application. The feature will enrich flight search results with 7-day weather forecasts for destination cities.

**Total Estimated Time**: 20-25 hours (without unit tests)
**Architecture Pattern**: Provider-agnostic with fallback strategy
**Note**: Unit tests omitted for now - focus on implementation first

---

## Architecture Summary

```
User Search → Controller → Agent → Amadeus API (flights)
                                 ↓
                    Geocoding: "BCN" → {lat: 41.29, lon: 2.08}
                                 ↓
                    Weather Service (with cache) → Provider
                                 ↓
                    Response: Flights + Weather → Frontend
```

**Provider Strategy**:
1. **Primary**: Open-Meteo (free, no API key, 7-day forecast)
2. **Backup**: WeatherAPI.com (commercial, requires API key)
3. **Fallback**: Mock provider (development/errors)

---

## Phase 1: Foundation & Core Infrastructure (3-4 hours)

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
  provider: string;                // "open-meteo", "weatherapi", "mock"
  cachedAt: string;                // ISO timestamp
  expiresAt: string;               // ISO timestamp
}

/**
 * Airport geographic data
 */
export interface AirportLocation {
  iataCode: string;                // "BCN"
  name: string;                    // "Barcelona-El Prat Airport"
  city: string;                    // "Barcelona"
  country: string;                 // "Spain"
  coordinates: Coordinates;
  timezone: string;                // "Europe/Madrid"
}

/**
 * Weather provider interface (Strategy Pattern)
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

### Task 1.2: Implement Geocoding Service

**File**: `backend/src/utils/geocoding.ts` (NEW)

```typescript
// ==========================================
// Airport Geocoding Service
// Maps IATA codes to geographic coordinates
// ==========================================

import type { AirportLocation, Coordinates } from '../types/weather.js';

/**
 * Airport database with coordinates
 * Data source: OpenFlights.org
 */
const AIRPORT_DATABASE: Record<string, AirportLocation> = {
  // Major European Airports
  BCN: {
    iataCode: 'BCN',
    name: 'Barcelona-El Prat Airport',
    city: 'Barcelona',
    country: 'Spain',
    coordinates: { latitude: 41.2974, longitude: 2.0833 },
    timezone: 'Europe/Madrid',
  },
  PRG: {
    iataCode: 'PRG',
    name: 'Václav Havel Airport Prague',
    city: 'Prague',
    country: 'Czech Republic',
    coordinates: { latitude: 50.1008, longitude: 14.26 },
    timezone: 'Europe/Prague',
  },
  LIS: {
    iataCode: 'LIS',
    name: 'Lisbon Portela Airport',
    city: 'Lisbon',
    country: 'Portugal',
    coordinates: { latitude: 38.7813, longitude: -9.1361 },
    timezone: 'Europe/Lisbon',
  },
  BUD: {
    iataCode: 'BUD',
    name: 'Budapest Ferenc Liszt International Airport',
    city: 'Budapest',
    country: 'Hungary',
    coordinates: { latitude: 47.4367, longitude: 19.2556 },
    timezone: 'Europe/Budapest',
  },
  CPH: {
    iataCode: 'CPH',
    name: 'Copenhagen Airport',
    city: 'Copenhagen',
    country: 'Denmark',
    coordinates: { latitude: 55.6181, longitude: 12.6561 },
    timezone: 'Europe/Copenhagen',
  },
  WAW: {
    iataCode: 'WAW',
    name: 'Warsaw Chopin Airport',
    city: 'Warsaw',
    country: 'Poland',
    coordinates: { latitude: 52.1657, longitude: 20.9671 },
    timezone: 'Europe/Warsaw',
  },
  KRK: {
    iataCode: 'KRK',
    name: 'John Paul II International Airport Kraków-Balice',
    city: 'Kraków',
    country: 'Poland',
    coordinates: { latitude: 50.0777, longitude: 19.7848 },
    timezone: 'Europe/Warsaw',
  },
  BER: {
    iataCode: 'BER',
    name: 'Berlin Brandenburg Airport',
    city: 'Berlin',
    country: 'Germany',
    coordinates: { latitude: 52.3667, longitude: 13.5033 },
    timezone: 'Europe/Berlin',
  },
  CDG: {
    iataCode: 'CDG',
    name: 'Charles de Gaulle Airport',
    city: 'Paris',
    country: 'France',
    coordinates: { latitude: 49.0097, longitude: 2.5479 },
    timezone: 'Europe/Paris',
  },
  LHR: {
    iataCode: 'LHR',
    name: 'London Heathrow Airport',
    city: 'London',
    country: 'United Kingdom',
    coordinates: { latitude: 51.4700, longitude: -0.4543 },
    timezone: 'Europe/London',
  },
  FCO: {
    iataCode: 'FCO',
    name: 'Leonardo da Vinci–Fiumicino Airport',
    city: 'Rome',
    country: 'Italy',
    coordinates: { latitude: 41.8003, longitude: 12.2389 },
    timezone: 'Europe/Rome',
  },
  MAD: {
    iataCode: 'MAD',
    name: 'Adolfo Suárez Madrid–Barajas Airport',
    city: 'Madrid',
    country: 'Spain',
    coordinates: { latitude: 40.4719, longitude: -3.5626 },
    timezone: 'Europe/Madrid',
  },
  AMS: {
    iataCode: 'AMS',
    name: 'Amsterdam Airport Schiphol',
    city: 'Amsterdam',
    country: 'Netherlands',
    coordinates: { latitude: 52.3086, longitude: 4.7639 },
    timezone: 'Europe/Amsterdam',
  },
  VIE: {
    iataCode: 'VIE',
    name: 'Vienna International Airport',
    city: 'Vienna',
    country: 'Austria',
    coordinates: { latitude: 48.1103, longitude: 16.5697 },
    timezone: 'Europe/Vienna',
  },
  ZRH: {
    iataCode: 'ZRH',
    name: 'Zurich Airport',
    city: 'Zurich',
    country: 'Switzerland',
    coordinates: { latitude: 47.4647, longitude: 8.5492 },
    timezone: 'Europe/Zurich',
  },
  MUC: {
    iataCode: 'MUC',
    name: 'Munich Airport',
    city: 'Munich',
    country: 'Germany',
    coordinates: { latitude: 48.3538, longitude: 11.7861 },
    timezone: 'Europe/Berlin',
  },
  // Add more airports as needed...
};

/**
 * Get airport location by IATA code
 * @throws Error if airport not found
 */
export function getAirportLocation(iataCode: string): AirportLocation {
  const normalizedCode = sanitizeIATACode(iataCode);
  const airport = AIRPORT_DATABASE[normalizedCode];

  if (!airport) {
    throw new Error(`Unknown airport IATA code: ${iataCode}`);
  }

  return airport;
}

/**
 * Get coordinates for an airport by IATA code
 * @throws Error if airport not found
 */
export function getCoordinates(iataCode: string): Coordinates {
  const airport = getAirportLocation(iataCode);
  return airport.coordinates;
}

/**
 * Get timezone for an airport by IATA code
 * @throws Error if airport not found
 */
export function getTimezone(iataCode: string): string {
  const airport = getAirportLocation(iataCode);
  return airport.timezone;
}

/**
 * Check if airport exists in database
 */
export function hasAirport(iataCode: string): boolean {
  const normalizedCode = sanitizeIATACode(iataCode);
  return normalizedCode in AIRPORT_DATABASE;
}

/**
 * Get all supported airport codes
 */
export function getSupportedAirports(): string[] {
  return Object.keys(AIRPORT_DATABASE);
}

/**
 * Sanitize and validate IATA code
 * - Convert to uppercase
 * - Remove non-alphabetic characters
 * - Ensure exactly 3 characters
 */
export function sanitizeIATACode(code: string): string {
  const sanitized = code.toUpperCase().replace(/[^A-Z]/g, '');

  if (sanitized.length !== 3) {
    throw new Error(`Invalid IATA code format: ${code} (must be 3 letters)`);
  }

  return sanitized;
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

---

### Task 1.3: Implement Cache Infrastructure

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
  generateKey(iataCode: string, date: string, provider: string = 'default'): string {
    return `weather:${iataCode}:${date}:${provider}`;
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
      console.log(`🗑️  [Cache] Expired entry removed: ${key}`);
      return null;
    }

    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;

    const validFor = Math.floor((entry.expiresAt - Date.now()) / 1000);
    console.log(`💾 [Cache] HIT: ${key} (valid for ${validFor}s, accessed ${entry.accessCount} times)`);

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
    console.log(`💾 [Cache] SET: ${key} (expires in ${this.ttl / 1000}s)`);
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
      console.log(`🗑️  [Cache] Deleted: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🗑️  [Cache] Cleared ${size} entries`);
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
      console.log(`🗑️  [Cache] LRU eviction: ${lruKey}`);
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
      console.log(`🗑️  [Cache] Cleanup: removed ${removed} expired entries`);
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
✅ **Geocoding service implemented** (`backend/src/utils/geocoding.ts`)
✅ **Cache infrastructure ready** (`backend/src/utils/cache/WeatherCache.ts`)

---

## Phase 2: Weather Provider Implementations (5-6 hours)

> **Note**: This implementation uses the **enhanced Open-Meteo API** with comprehensive weather parameters including apparent temperature, wind gusts, sunshine duration, and detailed precipitation breakdown (rain/snow/showers). This provides travelers with rich weather insights for better trip planning.

### Task 2.1: Create Mock Weather Provider

**File**: `backend/src/services/weather/providers/MockWeatherProvider.ts` (NEW)

```typescript
// ==========================================
// Mock Weather Provider (Development/Fallback)
// ==========================================

import type {
  WeatherProvider,
  WeatherProviderConfig,
  WeatherForecast,
  Coordinates,
  WeatherFetchOptions,
} from '../../../types/weather.js';
import { getCityName } from '../../../utils/geocoding-helpers.js';

export class MockWeatherProvider implements WeatherProvider {
  readonly name = 'mock';

  /**
   * Get mock forecast data (always succeeds)
   */
  async getForecast(
    coordinates: Coordinates,
    startDate: string,
    endDate: string,
    options?: WeatherFetchOptions
  ): Promise<WeatherForecast[]> {
    console.log(`🧪 [Mock Weather] Generating mock forecast for ${startDate} to ${endDate}`);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const forecasts: WeatherForecast[] = [];

    // Generate forecast for each day
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      forecasts.push(this.generateMockForecast(coordinates, dateStr));
    }

    return forecasts;
  }

  /**
   * Mock provider is always available
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Get provider configuration
   */
  getConfig(): WeatherProviderConfig {
    return {
      name: 'mock',
      requiresApiKey: false,
      features: {
        maxForecastDays: 365,
        hourlyForecast: false,
        historicalData: true,
      },
    };
  }

  /**
   * Generate realistic mock forecast data
   */
  private generateMockForecast(coordinates: Coordinates, date: string): WeatherForecast {
    // Generate semi-realistic data based on latitude (temperature varies by location)
    const baseTemp = 15 + (45 - Math.abs(coordinates.latitude)) / 2;
    const tempVariation = Math.random() * 10 - 5;
    const avgTemp = Math.round(baseTemp + tempVariation);

    const conditions = ['Clear', 'Clouds', 'Rain', 'Partly Cloudy'];
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];

    return {
      date,
      destination: 'Mock City',
      destinationCode: 'MCK',
      coordinates,
      temperature: {
        min: avgTemp - 3,
        max: avgTemp + 5,
        avg: avgTemp,
      },
      conditions: {
        main: randomCondition,
        description: randomCondition.toLowerCase(),
        icon: '01d',
      },
      precipitation: {
        probability: randomCondition === 'Rain' ? 80 : 20,
        amount: randomCondition === 'Rain' ? 5 : 0,
      },
      wind: {
        speed: Math.round(Math.random() * 20) + 5,
        direction: Math.round(Math.random() * 360),
      },
      humidity: Math.round(Math.random() * 40) + 40,
      visibility: 10,
      uvIndex: Math.round(Math.random() * 8) + 1,
      sunrise: `${date}T06:00:00Z`,
      sunset: `${date}T18:00:00Z`,
    };
  }
}
```

**Create helper**: `backend/src/utils/geocoding-helpers.ts` (NEW)

```typescript
// Helper function to get city name from coordinates (approximation)
export function getCityName(coords: { latitude: number; longitude: number }): string {
  // This is a simplified version - in production, you'd use reverse geocoding
  return 'Unknown City';
}
```

---

### Task 2.2: Implement Open-Meteo Provider

**File**: `backend/src/services/weather/providers/OpenMeteoProvider.ts` (NEW)

```typescript
// ==========================================
// Open-Meteo Weather Provider (Primary)
// Free API, no authentication required
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
    // ... other units
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
   * Enhanced with all useful travel-related weather data
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

    // Daily parameters - comprehensive weather data for travelers
    url.searchParams.set('daily', [
      // Temperature (actual + feels-like)
      'temperature_2m_max',
      'temperature_2m_min',
      'temperature_2m_mean',
      'apparent_temperature_max',
      'apparent_temperature_min',
      // Precipitation (detailed breakdown)
      'precipitation_sum',
      'precipitation_probability_max',
      'precipitation_hours',
      'rain_sum',
      'snowfall_sum',
      'showers_sum',
      // Wind (speed + gusts for safety)
      'wind_speed_10m_max',
      'wind_gusts_10m_max',
      'wind_direction_10m_dominant',
      // Weather condition code
      'weather_code',
      // Solar information
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
   * Enhanced with all available weather parameters
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

### Task 2.3: Implement WeatherAPI.com Provider (Backup)

**File**: `backend/src/services/weather/providers/WeatherAPIProvider.ts` (NEW)

```typescript
// ==========================================
// WeatherAPI.com Provider (Backup)
// Commercial API, requires API key
// https://www.weatherapi.com/
// ==========================================

import dotenv from 'dotenv';
import type {
  WeatherProvider,
  WeatherProviderConfig,
  WeatherForecast,
  Coordinates,
  WeatherFetchOptions,
} from '../../../types/weather.js';

dotenv.config();

/**
 * WeatherAPI.com Response Interface
 */
interface WeatherAPIResponse {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    tz_id: string;
  };
  forecast: {
    forecastday: Array<{
      date: string;
      day: {
        maxtemp_c: number;
        mintemp_c: number;
        avgtemp_c: number;
        totalprecip_mm: number;
        daily_chance_of_rain: number;
        maxwind_kph: number;
        avghumidity: number;
        daily_will_it_rain: number;
        uv: number;
        condition: {
          text: string;
          icon: string;
          code: number;
        };
      };
      astro: {
        sunrise: string;
        sunset: string;
      };
    }>;
  };
}

export class WeatherAPIProvider implements WeatherProvider {
  readonly name = 'weatherapi';
  private readonly baseUrl = 'http://api.weatherapi.com/v1';
  private readonly apiKey: string | undefined;
  private readonly timeout = 5000;

  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY?.trim();
  }

  /**
   * Fetch weather forecast from WeatherAPI.com
   */
  async getForecast(
    coordinates: Coordinates,
    startDate: string,
    endDate: string,
    options?: WeatherFetchOptions
  ): Promise<WeatherForecast[]> {
    if (!this.apiKey) {
      throw new Error('WEATHER_API_KEY not configured');
    }

    console.log(`🌤️  [WeatherAPI] Fetching forecast for (${coordinates.latitude}, ${coordinates.longitude})`);

    try {
      // WeatherAPI.com forecast endpoint (max 14 days)
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (days > 14) {
        throw new Error('WeatherAPI.com supports maximum 14 days forecast');
      }

      const url = this.buildApiUrl(coordinates, days);

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
        const errorText = await response.text();
        throw new Error(`WeatherAPI error: ${response.status} - ${errorText}`);
      }

      const data: WeatherAPIResponse = await response.json();
      const forecasts = this.parseResponse(data, coordinates);

      console.log(`✅ [WeatherAPI] Retrieved ${forecasts.length} days of forecast`);
      return forecasts;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('WeatherAPI request timed out');
      }
      throw error;
    }
  }

  /**
   * Check if WeatherAPI is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const testUrl = `${this.baseUrl}/current.json?key=${this.apiKey}&q=London`;
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
      name: 'weatherapi',
      requiresApiKey: true,
      rateLimit: {
        requestsPerMinute: 3,
        requestsPerDay: 1000, // Free tier limit
      },
      features: {
        maxForecastDays: 14,
        hourlyForecast: true,
        historicalData: true,
      },
    };
  }

  /**
   * Build API URL
   */
  private buildApiUrl(coordinates: Coordinates, days: number): string {
    const url = new URL(`${this.baseUrl}/forecast.json`);

    url.searchParams.set('key', this.apiKey!);
    url.searchParams.set('q', `${coordinates.latitude},${coordinates.longitude}`);
    url.searchParams.set('days', days.toString());
    url.searchParams.set('aqi', 'no');
    url.searchParams.set('alerts', 'no');

    return url.toString();
  }

  /**
   * Parse WeatherAPI response
   */
  private parseResponse(data: WeatherAPIResponse, coordinates: Coordinates): WeatherForecast[] {
    return data.forecast.forecastday.map(day => {
      // Parse sunrise/sunset to ISO format
      const sunriseTime = this.parseTime(day.date, day.astro.sunrise);
      const sunsetTime = this.parseTime(day.date, day.astro.sunset);

      return {
        date: day.date,
        destination: data.location.name,
        destinationCode: '', // Will be filled by service layer
        coordinates,
        temperature: {
          min: Math.round(day.day.mintemp_c),
          max: Math.round(day.day.maxtemp_c),
          avg: Math.round(day.day.avgtemp_c),
        },
        conditions: {
          main: this.mapConditionCode(day.day.condition.code),
          description: day.day.condition.text.toLowerCase(),
          icon: day.day.condition.icon,
        },
        precipitation: {
          probability: day.day.daily_chance_of_rain,
          amount: day.day.totalprecip_mm,
        },
        wind: {
          speed: Math.round(day.day.maxwind_kph),
          direction: 0, // Not provided in daily forecast
        },
        humidity: day.day.avghumidity,
        visibility: 10, // Not provided in daily forecast
        uvIndex: Math.round(day.day.uv),
        sunrise: sunriseTime,
        sunset: sunsetTime,
      };
    });
  }

  /**
   * Map WeatherAPI condition code to standard condition
   */
  private mapConditionCode(code: number): string {
    if (code === 1000) return 'Clear';
    if (code >= 1003 && code <= 1009) return 'Clouds';
    if (code >= 1063 && code <= 1072) return 'Drizzle';
    if (code >= 1180 && code <= 1201) return 'Rain';
    if (code >= 1210 && code <= 1237) return 'Snow';
    if (code >= 1273 && code <= 1282) return 'Thunderstorm';
    return 'Unknown';
  }

  /**
   * Parse time string (e.g., "07:45 AM") to ISO timestamp
   */
  private parseTime(date: string, time: string): string {
    const [timePart, period] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return `${date}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00Z`;
  }
}
```

---

### Task 2.4: Create WeatherService Facade

**File**: `backend/src/services/weather/WeatherService.ts` (NEW)

```typescript
// ==========================================
// Weather Service Facade
// Manages multiple providers with fallback
// ==========================================

import type {
  WeatherProvider,
  WeatherForecast,
  WeatherForecastResponse,
  Coordinates,
} from '../../types/weather.js';
import { OpenMeteoProvider } from './providers/OpenMeteoProvider.js';
import { WeatherAPIProvider } from './providers/WeatherAPIProvider.js';
import { MockWeatherProvider } from './providers/MockWeatherProvider.js';
import { weatherCache } from '../../utils/cache/WeatherCache.js';
import { getAirportLocation } from '../../utils/geocoding.js';

export class WeatherService {
  private providers: WeatherProvider[];
  private readonly useCache: boolean;

  constructor(useCache: boolean = true) {
    // Provider priority: Open-Meteo → WeatherAPI → Mock
    this.providers = [
      new OpenMeteoProvider(),
      new WeatherAPIProvider(),
      new MockWeatherProvider(),
    ];
    this.useCache = useCache;
  }

  /**
   * Get weather forecast with automatic provider fallback
   */
  async getForecast(
    coordinates: Coordinates,
    startDate: string,
    endDate?: string
  ): Promise<WeatherForecast[]> {
    const end = endDate || startDate;

    // Try each provider in order
    for (const provider of this.providers) {
      try {
        console.log(`🌍 [WeatherService] Trying provider: ${provider.name}`);
        const forecasts = await provider.getForecast(coordinates, startDate, end);

        if (forecasts.length > 0) {
          console.log(`✅ [WeatherService] Success with provider: ${provider.name}`);
          return forecasts;
        }
      } catch (error) {
        console.warn(`⚠️  [WeatherService] Provider ${provider.name} failed:`,
          error instanceof Error ? error.message : error);
        // Continue to next provider
      }
    }

    throw new Error('All weather providers failed');
  }

  /**
   * Get weather forecast with caching
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
        const airport = getAirportLocation(iataCode);
        return {
          destination: airport.city,
          destinationCode: iataCode,
          forecasts: cached,
          provider: 'cache',
          cachedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        };
      }
    }

    // Cache miss - fetch from provider
    const airport = getAirportLocation(iataCode);
    const startDate = date;
    const endDate = this.calculateEndDate(date, days);

    let forecasts = await this.getForecast(airport.coordinates, startDate, endDate);

    // Fill in destination info
    forecasts = forecasts.map(f => ({
      ...f,
      destination: airport.city,
      destinationCode: iataCode,
    }));

    // Cache the result
    if (this.useCache) {
      weatherCache.set(cacheKey, forecasts);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

    return {
      destination: airport.city,
      destinationCode: iataCode,
      forecasts,
      provider: this.providers[0].name, // Provider that succeeded
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Check which providers are available
   */
  async checkProviderHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    await Promise.all(
      this.providers.map(async (provider) => {
        health[provider.name] = await provider.isAvailable();
      })
    );

    return health;
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

✅ **Mock provider implemented** (fallback)
✅ **Open-Meteo provider implemented** (primary, free)
✅ **WeatherAPI.com provider implemented** (backup, requires API key)
✅ **WeatherService facade created** (provider management + fallback)

---

## Phase 3: Backend Integration (4-5 hours)

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
  recommendations: FlightOfferWithWeather[];  // Changed from FlightOffer[]
  reasoning: string;
  alternatives?: FlightOfferWithWeather[];
  weatherInfo?: WeatherInfo[];  // Deprecated - kept for backward compatibility
  weatherForecasts?: WeatherForecastResponse[];  // NEW
  executionTime: number;
  toolsUsed: string[];
  metadata?: {
    weatherProvider?: string;
    weatherCacheHits?: number;
    weatherCacheMisses?: number;
  };
}
```

---

### Task 3.2: Integrate Weather into Agent

**File**: `backend/src/services/agent.ts` (UPDATE)

Add weather enrichment to the agent:

```typescript
import type { UserPreferences, AgentResponse, FlightOfferWithWeather } from '../types/index.js';
import { searchFlights, getWeather, getDestinations } from './flightAPI.js';
import { searchAmadeusFlights } from './amadeusAPI.js';
import { weatherService } from './weather/WeatherService.js';  // NEW
import { weatherCache } from '../utils/cache/WeatherCache.js';  // NEW

/**
 * Flight Agent with Amadeus API Integration + Weather Enrichment
 */
export async function runFlightAgent(preferences: UserPreferences): Promise<AgentResponse> {
  const startTime = Date.now();
  const toolsUsed: string[] = [];

  // Get cache stats before
  const statsBefore = weatherCache.getStats();

  console.log('\n🤖 ========================================');
  console.log('🤖 Starting AI Flight Agent');
  console.log('🤖 ========================================');
  console.log('📋 User Preferences:', JSON.stringify(preferences, null, 2));

  // Tool 1: Search real flights via Amadeus API (existing logic)
  let flights: FlightOfferWithWeather[] = [];

  // Calculate departure date (7 days from now or use provided date)
  const departureDate = preferences.departureDate || (() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  })();

  // Try to get preferred destination, otherwise use popular ones
  const possibleDestinations = preferences.preferredDestinations && preferences.preferredDestinations.length > 0
    ? preferences.preferredDestinations.map(d => d.toUpperCase())
    : ['BCN', 'PRG', 'LIS', 'BUD', 'CPH'];

  // Try Amadeus API for first destination
  const targetDestination = possibleDestinations[0];

  console.log(`\n🔧 [Agent] Executing: search_real_flights`);
  console.log(`🎯 [Agent] Target: ${preferences.origin} → ${targetDestination} on ${departureDate}`);
  toolsUsed.push('search_real_flights');

  try {
    const realFlights = await searchAmadeusFlights(
      preferences.origin,
      targetDestination,
      departureDate,
      1, // adults
      5  // max results
    );

    if (realFlights.length > 0) {
      flights = realFlights;
      console.log(`✅ [Agent] Successfully retrieved ${flights.length} real flights from Amadeus API`);
    } else {
      throw new Error('No flights found in Amadeus response');
    }
  } catch (error: any) {
    console.log(`❌ [Agent] Amadeus API error: ${error.message}`);
    console.log(`🔄 [Agent] Falling back to mock data...`);

    // Fallback to mock data
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
    console.log(`✅ [Agent] Using ${flights.length} mock flights`);
  }

  // NEW: Tool 2: Enrich flights with weather data
  console.log('\n🔧 [Agent] Executing: get_weather_forecast');
  toolsUsed.push('get_weather_forecast');

  const enrichedFlights = await enrichFlightsWithWeather(flights, departureDate);

  // Get cache stats after
  const statsAfter = weatherCache.getStats();

  // Tool 3: Get weather for each flight (DEPRECATED - keeping for backward compatibility)
  const weatherInfo = [];
  if (flights.length > 0) {
    console.log('\n🔧 [Mock Agent] Executing: get_weather (deprecated)');

    for (const flight of flights.slice(0, 3)) {
      const weather = getWeather({ destinationCode: flight.destinationCode });
      if (weather) {
        weatherInfo.push(weather);
      }
    }
  }

  // Generate reasoning
  const reasoning = generateMockReasoning(preferences, enrichedFlights, weatherInfo);

  const executionTime = Date.now() - startTime;

  console.log('\n✅ [Agent] Completed successfully');
  console.log(`⏱️  [Agent] Execution time: ${executionTime}ms`);
  console.log(`🔧 [Agent] Tools used: ${toolsUsed.join(', ')}`);
  console.log(`💾 [Agent] Weather cache stats: ${statsAfter.hits - statsBefore.hits} hits, ${statsAfter.misses - statsBefore.misses} misses`);
  console.log('🤖 ========================================\n');

  return {
    recommendations: enrichedFlights,
    reasoning,
    weatherInfo, // Deprecated
    weatherForecasts: enrichedFlights.map(f => f.weather).filter(Boolean) as any[],
    executionTime,
    toolsUsed,
    metadata: {
      weatherProvider: 'open-meteo', // TODO: Get from actual provider used
      weatherCacheHits: statsAfter.hits - statsBefore.hits,
      weatherCacheMisses: statsAfter.misses - statsBefore.misses,
    },
  };
}

/**
 * NEW: Enrich flights with weather forecast data
 */
async function enrichFlightsWithWeather(
  flights: FlightOfferWithWeather[],
  departureDate: string
): Promise<FlightOfferWithWeather[]> {
  console.log(`🌤️  [Agent] Enriching ${flights.length} flights with weather data...`);

  // Process flights in parallel
  const enrichedFlights = await Promise.allSettled(
    flights.map(async (flight) => {
      try {
        const weather = await weatherService.getForecastCached(
          flight.destinationCode,
          departureDate,
          7 // 7-day forecast
        );

        return {
          ...flight,
          weather,
        };
      } catch (error) {
        console.warn(`⚠️  [Agent] Weather fetch failed for ${flight.destinationCode}:`,
          error instanceof Error ? error.message : error);
        // Return flight without weather data
        return flight;
      }
    })
  );

  // Extract results (handle both fulfilled and rejected)
  const results = enrichedFlights.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`❌ [Agent] Failed to enrich flight ${index}:`, result.reason);
      return flights[index]; // Return original flight without weather
    }
  });

  const successCount = results.filter(f => f.weather).length;
  console.log(`✅ [Agent] Enriched ${successCount}/${flights.length} flights with weather data`);

  return results;
}

// Keep existing generateMockReasoning function...
```

---

### Task 3.3: Add Weather Endpoints to Controller

**File**: `backend/src/controllers/flightController.ts` (UPDATE)

Add new weather endpoints:

```typescript
import { weatherService } from '../services/weather/WeatherService.js';
import { weatherCache } from '../utils/cache/WeatherCache.js';

/**
 * NEW: GET /api/weather/forecast/:destinationCode
 * Get weather forecast for a specific destination
 */
export async function getWeatherForecast(req: Request, res: Response): Promise<void> {
  try {
    console.log('\n📥 [Controller] Received weather forecast request');

    const { destinationCode } = req.params;
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const days = parseInt((req.query.days as string) || '7');

    // Validate inputs
    if (!destinationCode || destinationCode.length !== 3) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid destination code (must be 3-letter IATA code)',
      };
      res.status(400).json(response);
      return;
    }

    if (days < 1 || days > 14) {
      const response: ApiResponse = {
        success: false,
        error: 'Days must be between 1 and 14',
      };
      res.status(400).json(response);
      return;
    }

    // Fetch weather forecast
    const forecast = await weatherService.getForecastCached(
      destinationCode.toUpperCase(),
      date,
      days
    );

    const response: ApiResponse = {
      success: true,
      data: forecast,
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ [Controller] Error in getWeatherForecast:', error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch weather forecast',
    };

    res.status(500).json(response);
  }
}

/**
 * NEW: GET /api/weather/status
 * Get weather service status and provider health
 */
export async function getWeatherStatus(req: Request, res: Response): Promise<void> {
  try {
    console.log('\n📥 [Controller] Received weather status request');

    const health = await weatherService.checkProviderHealth();
    const cacheStats = weatherCache.getStats();

    const response: ApiResponse = {
      success: true,
      data: {
        providers: Object.entries(health).map(([name, available]) => ({
          name,
          status: available ? 'available' : 'unavailable',
          isPrimary: name === 'open-meteo',
        })),
        cache: cacheStats,
      },
    };

    res.status(200).json(response);

  } catch (error) {
    console.error('❌ [Controller] Error in getWeatherStatus:', error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get weather status',
    };

    res.status(500).json(response);
  }
}
```

---

### Task 3.4: Add Weather Routes

**File**: `backend/src/routes/flightRoutes.ts` (UPDATE)

```typescript
import { Router } from 'express';
import {
  searchFlights,
  listDestinations,
  getDestinationWeather,
  getWeatherForecast,      // NEW
  getWeatherStatus,        // NEW
} from '../controllers/flightController.js';

const router = Router();

// Existing routes
router.post('/search', searchFlights);
router.get('/destinations', listDestinations);
router.get('/weather/:destinationCode', getDestinationWeather);

// NEW: Weather forecast routes
router.get('/weather/forecast/:destinationCode', getWeatherForecast);
router.get('/weather/status', getWeatherStatus);

export default router;
```

---

### Task 3.5: Update Environment Variables

**Create**: `backend/.env.example`

```bash
# Amadeus API Credentials
AMADEUS_API_KEY=your_amadeus_api_key_here
AMADEUS_API_SECRET=your_amadeus_api_secret_here

# Weather API Configuration (Optional)
# Open-Meteo is free and does not require an API key
# WeatherAPI.com is used as backup provider
WEATHER_API_KEY=your_weatherapi_key_here

# Weather Service Configuration
WEATHER_CACHE_TTL_MINUTES=60
WEATHER_CACHE_MAX_SIZE=1000
WEATHER_PROVIDER_PRIMARY=open-meteo
WEATHER_PROVIDER_BACKUP=weatherapi
WEATHER_PROVIDER_FALLBACK=mock

# Server Configuration
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

---

### Phase 3 Completion Checklist

✅ **Types updated** (FlightOfferWithWeather, AgentResponse)
✅ **Agent integrated** with weather enrichment
✅ **New endpoints added** (/api/weather/forecast/:code, /api/weather/status)
✅ **Routes configured**
✅ **Environment variables documented**

**Verification**:
```bash
# Start backend server
npm run dev

# Test weather forecast endpoint
curl "http://localhost:3001/api/weather/forecast/BCN?date=2025-10-20&days=7"

# Test weather status endpoint
curl "http://localhost:3001/api/weather/status"

# Test flight search with weather
curl -X POST http://localhost:3001/api/flights/search \
  -H "Content-Type: application/json" \
  -d '{"budget":500,"origin":"WAW","travelStyle":"culture","weatherPreference":"mild","preferredDestinations":["BCN"]}'
```

---

## Phase 4: Frontend Integration (3-4 hours)

### Task 4.1: Update Frontend Types

**File**: `frontend/src/types/index.ts` (UPDATE)

```typescript
// Add enhanced weather types matching backend
export interface WeatherForecast {
  date: string;
  destination: string;
  destinationCode: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  temperature: {
    min: number;
    max: number;
    avg: number;
  };
  apparentTemperature?: {
    min: number;
    max: number;
  };
  conditions: {
    main: string;
    description: string;
    icon: string;
  };
  precipitation: {
    probability: number;
    amount: number;
    rain?: number;
    snow?: number;
    showers?: number;
    hours?: number;
  };
  wind: {
    speed: number;
    gusts?: number;
    direction: number;
  };
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

// Update FlightOffer
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
  weather?: WeatherForecastResponse;  // NEW
}
```

---

### Task 4.2: Enhance WeatherBadge Component

**File**: `frontend/src/components/WeatherBadge.tsx` (UPDATE)

```tsx
import React from 'react';
import type { WeatherForecast } from '../types';

interface WeatherBadgeProps {
  weather: WeatherForecast;
  compact?: boolean;
}

export default function WeatherBadge({ weather, compact = false }: WeatherBadgeProps) {
  const getWeatherEmoji = (condition: string): string => {
    const emojiMap: Record<string, string> = {
      'Clear': '☀️',
      'Clouds': '☁️',
      'Rain': '🌧️',
      'Drizzle': '🌦️',
      'Thunderstorm': '⛈️',
      'Snow': '❄️',
      'Fog': '🌫️',
    };
    return emojiMap[condition] || '🌤️';
  };

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-md text-sm">
        <span className="text-lg">{getWeatherEmoji(weather.conditions.main)}</span>
        <span className="font-medium">
          {weather.temperature.min}°-{weather.temperature.max}°C
        </span>
      </div>
    );
  }

  return (
    <div className="weather-badge bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-1">
            Weather on {new Date(weather.date).toLocaleDateString()}
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-3xl">{getWeatherEmoji(weather.conditions.main)}</span>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {weather.temperature.avg}°C
              </p>
              <p className="text-xs text-gray-600">
                {weather.temperature.min}° - {weather.temperature.max}°
              </p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-700 capitalize">
            {weather.conditions.description}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {/* Feels-like temperature */}
        {weather.apparentTemperature && (
          <div className="flex items-center gap-2">
            <span className="text-lg">🌡️</span>
            <div>
              <p className="text-xs text-gray-600">Feels like</p>
              <p className="font-medium">
                {weather.apparentTemperature.min}° - {weather.apparentTemperature.max}°C
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-lg">💧</span>
          <div>
            <p className="text-xs text-gray-600">Precipitation</p>
            <p className="font-medium">{weather.precipitation.probability}%</p>
            {weather.precipitation.hours > 0 && (
              <p className="text-xs text-gray-500">({weather.precipitation.hours}h)</p>
            )}
          </div>
        </div>

        {/* Rain/Snow breakdown */}
        {(weather.precipitation.rain > 0 || weather.precipitation.snow > 0) && (
          <div className="flex items-center gap-2">
            <span className="text-lg">{weather.precipitation.snow > 0 ? '❄️' : '🌧️'}</span>
            <div>
              <p className="text-xs text-gray-600">
                {weather.precipitation.snow > 0 ? 'Snow' : 'Rain'}
              </p>
              <p className="font-medium">
                {weather.precipitation.snow > 0
                  ? `${weather.precipitation.snow} cm`
                  : `${weather.precipitation.rain} mm`}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-lg">💨</span>
          <div>
            <p className="text-xs text-gray-600">Wind</p>
            <p className="font-medium">{weather.wind.speed} km/h</p>
            {weather.wind.gusts && weather.wind.gusts > weather.wind.speed && (
              <p className="text-xs text-gray-500">Gusts: {weather.wind.gusts} km/h</p>
            )}
          </div>
        </div>

        {/* Sunshine duration */}
        {weather.sunshineDuration !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-lg">☀️</span>
            <div>
              <p className="text-xs text-gray-600">Sunshine</p>
              <p className="font-medium">
                {Math.round(weather.sunshineDuration / 3600)}h
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-lg">🔆</span>
          <div>
            <p className="text-xs text-gray-600">UV Index</p>
            <p className="font-medium">{weather.uvIndex}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 4.3: Update FlightCard Component

**File**: `frontend/src/components/FlightCard.tsx` (UPDATE)

Add weather display to flight cards:

```tsx
import WeatherBadge from './WeatherBadge';

// Inside FlightCard component, add:
{flight.weather && flight.weather.forecasts.length > 0 && (
  <div className="mt-4 pt-4 border-t border-gray-200">
    <WeatherBadge weather={flight.weather.forecasts[0]} compact />
    {flight.weather.forecasts.length > 1 && (
      <details className="mt-2">
        <summary className="text-sm text-blue-600 cursor-pointer hover:underline">
          View 7-day forecast
        </summary>
        <div className="mt-3 grid grid-cols-7 gap-2">
          {flight.weather.forecasts.slice(0, 7).map((forecast) => (
            <div key={forecast.date} className="text-center p-2 bg-gray-50 rounded">
              <p className="text-xs text-gray-600">
                {new Date(forecast.date).toLocaleDateString('en', { weekday: 'short' })}
              </p>
              <p className="text-lg my-1">
                {getWeatherEmoji(forecast.conditions.main)}
              </p>
              <p className="text-sm font-semibold">
                {forecast.temperature.avg}°
              </p>
            </div>
          ))}
        </div>
      </details>
    )}
  </div>
)}
```

---

### Phase 4 Completion Checklist

✅ **Frontend types updated**
✅ **WeatherBadge component enhanced**
✅ **FlightCard component updated**
✅ **UI responsive and accessible**

---

## Phase 5: Polish & Production Readiness (2-3 hours)

### Task 5.1: Add Environment Validation

**File**: `backend/src/config/validateEnv.ts` (NEW)

```typescript
export function validateEnvironment(): void {
  const required = ['AMADEUS_API_KEY', 'AMADEUS_API_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Warn about optional weather API keys
  if (!process.env.WEATHER_API_KEY) {
    console.warn('⚠️  WEATHER_API_KEY not set - backup provider will be unavailable');
  }

  console.log('✅ Environment variables validated');
}
```

Call in `server.ts`:
```typescript
import { validateEnvironment } from './config/validateEnv.js';

validateEnvironment();
```

---

### Task 5.2: Add Error Handling Improvements

Create custom error classes, improve logging, add monitoring.

---

### Task 5.3: Create Documentation

**File**: `WEATHER_API_DOCUMENTATION.md`

Document all endpoints, request/response formats, examples.

---

## Success Criteria

✅ Weather data displayed for 95%+ of flight searches
✅ P95 response time < 2 seconds
✅ Cache hit rate > 60%
✅ Zero weather-related failures breaking flight search
✅ Graceful degradation when weather API fails

---

## Troubleshooting

### Common Issues

1. **"Unknown airport IATA code"**
   - Add airport to `geocoding.ts` database

2. **"Weather API timeout"**
   - Increase timeout value
   - Check network connectivity

3. **"All weather providers failed"**
   - Check API keys
   - Verify provider availability
   - Check rate limits

### Support

For issues, refer to:
- Open-Meteo docs: https://open-meteo.com/en/docs
- WeatherAPI docs: https://www.weatherapi.com/docs/

---

## Enhanced Open-Meteo Integration

This implementation leverages the **full capabilities of the Open-Meteo API** with comprehensive weather parameters:

### Temperature Data
- ✅ **Actual temperature** (min/max/avg)
- ✅ **Apparent temperature** (feels-like) - Critical for packing decisions
  - Factors in wind chill and heat index
  - More accurate representation of outdoor comfort

### Precipitation Intelligence
- ✅ **Total precipitation** (mm)
- ✅ **Rain breakdown** (mm) - Separated from snow
- ✅ **Snowfall amount** (cm) - Important for winter travel
- ✅ **Showers** (mm) - Short, intense rain
- ✅ **Precipitation hours** - Duration of wet weather
- ✅ **Precipitation probability** (%) - Chance of rain/snow

### Wind & Safety
- ✅ **Wind speed** (km/h max)
- ✅ **Wind gusts** (km/h) - **Critical for flight delays/safety**
  - Strong gusts can cause turbulence or delays
  - Important for outdoor activities

### Solar & Daylight
- ✅ **Sunrise/sunset times** (ISO timestamps)
- ✅ **Daylight duration** (seconds) - Total potential daylight
- ✅ **Sunshine duration** (seconds) - **Actual sunny hours vs cloudy**
  - Helps differentiate between cloudy days and sunny days
  - Better activity planning (beach, hiking, sightseeing)
- ✅ **UV Index** - Sun protection guidance

### Travel Planning Benefits

**For Users:**
- 📦 **Better packing**: Apparent temperature helps decide on clothing
- 🏖️ **Activity planning**: Sunshine duration for outdoor activities
- ⚠️ **Safety alerts**: Wind gusts warn about flight delays
- 🌧️ **Detailed forecasts**: Know if it's rain, snow, or showers
- ⏰ **Time planning**: Precipitation hours help schedule activities

**For Developers:**
- 🔧 All data from a single API call (no need for multiple providers)
- 💰 Completely free (no API key required)
- 📊 Rich data for building smart travel recommendations
- 🌍 Global coverage with 16-day forecasts

## Final Notes

- **Always use `.js` extensions** in imports (TypeScript NodeNext requirement)
- **Use try-catch blocks** in all async functions
- **Validate inputs** before processing
- **Log extensively** for debugging
- **Never expose API keys** in responses or logs
- **Test manually** after implementing each major component
- **Focus on implementation first**, add tests later if needed
- **Open-Meteo is free**: No API key needed, respects 10,000 requests/day limit

### API Documentation
- Open-Meteo docs: https://open-meteo.com/en/docs
- Weather codes: https://open-meteo.com/en/docs#weathervariables
- Try the API: https://open-meteo.com/en/docs?latitude=52.2298&longitude=21.0118

Good luck with the implementation! 🚀
