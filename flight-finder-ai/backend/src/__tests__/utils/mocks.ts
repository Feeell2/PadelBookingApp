// ==========================================
// Test Mock Utilities and Factories
// ==========================================

import type {
  UserPreferences,
  FlightOffer,
  WeatherData,
  AmadeusTokenResponse,
  AmadeusFlightResponse,
  AmadeusDestinationResponse,
} from '../../types/index.js';
import type {
  WeatherForecast,
  Coordinates,
  AirportLocation,
} from '../../types/weather.js';
import type { OpenMeteoGeocodingResponse } from '../../types/openMeteo.js';
import { createRequest, createResponse } from 'node-mocks-http';
import { vi } from 'vitest';

/**
 * Mock User Preferences
 */
export const mockUserPreferences = (overrides?: Partial<UserPreferences>): UserPreferences => ({
  budget: 1000,
  origin: 'WAW',
  travelStyle: 'culture',
  preferredDestinations: [],
  departureDate: '2024-12-01',
  returnDate: '2024-12-08',
  ...overrides,
});

/**
 * Mock Flight Offer
 */
export const mockFlightOffer = (overrides?: Partial<FlightOffer>): FlightOffer => ({
  id: 'FL001',
  destination: 'Barcelona',
  destinationCode: 'BCN',
  origin: 'WAW',
  price: 450,
  currency: 'PLN',
  departureDate: '2024-12-01',
  returnDate: '2024-12-08',
  airline: 'Ryanair',
  duration: '2h 30m',
  stops: 0,
  ...overrides,
});

/**
 * Mock Weather Data
 */
export const mockWeatherData = (overrides?: Partial<WeatherData>): WeatherData => ({
  destination: 'Barcelona',
  destinationCode: 'BCN',
  temperature: 22,
  condition: 'Sunny',
  description: 'Perfect beach weather with clear skies',
  humidity: 65,
  windSpeed: 10,
  fetchedAt: '2024-12-01T10:00:00Z',
  ...overrides,
});

/**
 * Mock Weather Forecast
 */
export const mockWeatherForecast = (overrides?: Partial<WeatherForecast>): WeatherForecast => ({
  date: '2024-12-01',
  destination: 'Barcelona',
  destinationCode: 'BCN',
  coordinates: { latitude: 41.3874, longitude: 2.1686 },
  temperature: {
    min: 18,
    max: 25,
    avg: 22,
  },
  apparentTemperature: {
    min: 17,
    max: 24,
  },
  conditions: {
    main: 'Clear',
    description: 'clear sky',
    icon: '01d',
  },
  precipitation: {
    probability: 10,
    amount: 0,
    rain: 0,
    snow: 0,
    showers: 0,
    hours: 0,
  },
  wind: {
    speed: 15,
    gusts: 20,
    direction: 180,
  },
  humidity: 65,
  visibility: 10,
  uvIndex: 5,
  sunrise: '2024-12-01T07:30:00Z',
  sunset: '2024-12-01T17:30:00Z',
  daylightDuration: 36000,
  sunshineDuration: 32000,
  ...overrides,
});

/**
 * Mock Coordinates
 */
export const mockCoordinates = (overrides?: Partial<Coordinates>): Coordinates => ({
  latitude: 41.3874,
  longitude: 2.1686,
  ...overrides,
});

/**
 * Mock Airport Location
 */
export const mockAirportLocation = (overrides?: Partial<AirportLocation>): AirportLocation => ({
  iataCode: 'BCN',
  name: 'Barcelona',
  cityName: 'BARCELONA',
  countryCode: 'ES',
  coordinates: {
    latitude: 41.3874,
    longitude: 2.1686,
  },
  timeZoneOffset: undefined,
  ...overrides,
});

/**
 * Mock Amadeus Token Response
 */
export const mockAmadeusTokenResponse = (overrides?: Partial<AmadeusTokenResponse>): AmadeusTokenResponse => ({
  access_token: 'mock_token_12345',
  token_type: 'Bearer',
  expires_in: 1799,
  ...overrides,
});

/**
 * Mock Amadeus Flight Response
 */
export const mockAmadeusFlightResponse = (overrides?: Partial<AmadeusFlightResponse>): AmadeusFlightResponse => ({
  data: [
    {
      id: '1',
      price: {
        total: '450.00',
        currency: 'PLN',
      },
      itineraries: [
        {
          duration: 'PT2H30M',
          segments: [
            {
              departure: {
                iataCode: 'WAW',
                at: '2024-12-01T10:00:00',
              },
              arrival: {
                iataCode: 'BCN',
                at: '2024-12-01T12:30:00',
              },
              carrierCode: 'FR',
              number: '1234',
            },
          ],
        },
      ],
      validatingAirlineCodes: ['FR'],
    },
  ],
  ...overrides,
});

/**
 * Mock Amadeus Destination Response
 */
export const mockAmadeusDestinationResponse = (overrides?: Partial<AmadeusDestinationResponse>): AmadeusDestinationResponse => ({
  data: [
    {
      type: 'flight-destination',
      origin: 'WAW',
      destination: 'BCN',
      departureDate: '2024-12-01',
      returnDate: '2024-12-08',
      price: {
        total: '450.00',
        currency: 'PLN',
      },
    },
  ],
  dictionaries: {
    currencies: { PLN: 'Polish Zloty' },
    locations: {
      BCN: {
        subType: 'CITY',
        detailedName: 'Barcelona, Spain',
      },
    },
  },
  ...overrides,
});

/**
 * Mock Open-Meteo Geocoding Response
 */
export const mockOpenMeteoGeocodingResponse = (overrides?: Partial<OpenMeteoGeocodingResponse>): OpenMeteoGeocodingResponse => ({
  results: [
    {
      id: 1,
      name: 'Barcelona',
      latitude: 41.3874,
      longitude: 2.1686,
      feature_code: 'PPLA',
      country: 'Spain',
      country_code: 'ES',
      timezone: 'Europe/Madrid',
    },
  ],
  ...overrides,
});

/**
 * Mock Express Request
 */
export const mockExpressRequest = (options?: any) => {
  return createRequest(options);
};

/**
 * Mock Express Response
 */
export const mockExpressResponse = () => {
  return createResponse();
};

/**
 * Mock fetch - Success response
 */
export const mockFetchSuccess = (data: any, status: number = 200) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response);
};

/**
 * Mock fetch - Error response
 */
export const mockFetchError = (status: number, message: string) => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: message,
    json: async () => ({ error: message }),
    text: async () => message,
  } as Response);
};

/**
 * Mock fetch - Network error
 */
export const mockFetchNetworkError = (error: string = 'Network error') => {
  global.fetch = vi.fn().mockRejectedValue(new Error(error));
};

/**
 * Mock fetch - Timeout
 */
export const mockFetchTimeout = () => {
  global.fetch = vi.fn().mockImplementation(() => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error('Request timeout');
        error.name = 'AbortError';
        reject(error);
      }, 10);
    });
  });
};

/**
 * Mock Date.now() for time-dependent tests
 */
export const mockDateNow = (timestamp: number) => {
  vi.spyOn(Date, 'now').mockReturnValue(timestamp);
};

/**
 * Restore all mocks
 */
export const restoreAllMocks = () => {
  vi.restoreAllMocks();
};
