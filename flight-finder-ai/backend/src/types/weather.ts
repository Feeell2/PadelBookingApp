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
