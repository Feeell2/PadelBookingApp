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
