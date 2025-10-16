// ==========================================
// Weather Types & Interfaces
// Weather domain types and provider interfaces
// ==========================================

import type { Coordinates } from './common.js';

// Re-export Coordinates for backward compatibility
export type { Coordinates };

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
 * Airport geographic data (Amadeus API format)
 */
export interface AirportLocation {
  iataCode: string;                // "BCN"
  name: string;                    // "BARCELONA"
  cityName: string;                // "BARCELONA"
  countryCode: string;             // "ES"
  coordinates: Coordinates;
  timeZoneOffset?: string;         // "+02:00"
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

