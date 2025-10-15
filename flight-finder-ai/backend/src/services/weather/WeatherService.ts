// ==========================================
// Weather Service (NO CACHE)
// ==========================================

import type {
  WeatherForecast,
  WeatherForecastResponse,
  Coordinates,
  AirportLocation,
} from '../../types/weather.js';
import { OpenMeteoProvider } from './providers/OpenMeteoProvider.js';
import { getAirportLocation } from '../OpenMeteoGeocodingService.js';

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
   * Get weather forecast using pre-fetched airport location
   * - Bypasses geocoding (coordinates already provided)
   * - Used for batch operations to avoid redundant API calls
   *
   * @param airportLocation - Pre-fetched airport location with coordinates
   * @param date - Start date (YYYY-MM-DD)
   * @param days - Number of days to forecast (default: 7)
   * @returns Weather forecast response
   *
   * @example
   * const location = await getAirportLocation('BCN');
   * const weather = await weatherService.getForecastWithLocation(location, '2024-12-01', 7);
   */
  async getForecastWithLocation(
    airportLocation: AirportLocation,
    date: string,
    days: number = 7
  ): Promise<WeatherForecastResponse> {
    console.log(`🌤️  [WeatherService] Fetching weather for ${airportLocation.iataCode} using pre-fetched coordinates...`);

    const startDate = date;
    const endDate = this.calculateEndDate(date, days);

    // Fetch weather using provided coordinates (no geocoding needed)
    let forecasts = await this.getForecast(airportLocation.coordinates, startDate, endDate);

    // Fill in destination info
    forecasts = forecasts.map(f => ({
      ...f,
      destination: airportLocation.cityName,
      destinationCode: airportLocation.iataCode,
    }));

    return {
      destination: airportLocation.cityName,
      destinationCode: airportLocation.iataCode,
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
