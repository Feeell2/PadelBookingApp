// ==========================================
// TypeScript Types & Interfaces
// ==========================================

/**
 * User preferences for flight search
 */
export interface UserPreferences {
  budget: number;
  origin: string;
  travelStyle: 'adventure' | 'relaxation' | 'culture' | 'party' | 'nature';
  preferredDestinations?: string[];
  departureDate?: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD
}

/**
 * Weather data for flight destination enrichment
 */
export interface WeatherData {
  destination: string;
  destinationCode: string;
  temperature: number; // Celsius
  condition: string; // "Sunny", "Cloudy", "Rainy", etc.
  description: string; // Detailed forecast
  humidity?: number; // Percentage
  windSpeed?: number; // km/h
  fetchedAt: string; // ISO timestamp
}

/**
 * Flight offer with pricing and details
 */
export interface FlightOffer {
  id: string;
  destination: string;
  destinationCode: string;
  origin: string;
  price: number;
  currency: string;
  departureDate: string; // YYYY-MM-DD
  returnDate: string; // YYYY-MM-DD
  airline: string;
  duration: string; // "5h 30m"
  stops: number;
  weatherData?: WeatherData; // Optional weather enrichment
}

/**
 * Weather information for a destination
 */
export interface WeatherInfo {
  destination: string;
  temperature: number; // Celsius
  condition: string; // "Sunny", "Cloudy", etc.
  humidity: number; // Percentage
  forecast: string;
}

/**
 * Destination details
 */
export interface Destination {
  city: string;
  country: string;
  code: string;
  description: string;
  highlights: string[];
  bestFor: string[];
  averageTemp: number;
  estimatedBudget: number;
}

/**
 * Tool definition for AI agent
 */
export interface AgentTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

/**
 * AI Agent response with reasoning
 */
export interface AgentResponse {
  recommendations: FlightOffer[];
  reasoning: string;
  alternatives?: FlightOffer[];
  weatherInfo?: WeatherInfo[];
  executionTime: number;
  toolsUsed: string[];
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: Record<string, any>;
}

/**
 * Tool use input for search_flights
 */
export interface SearchFlightsInput {
  budget: number;
  origin: string;
  preferences: {
    travelStyle: string;
    preferredDestinations?: string[];
  };
}

/**
 * Tool use input for get_weather
 */
export interface GetWeatherInput {
  destinationCode: string;
}

/**
 * Tool use input for get_destinations
 */
export interface GetDestinationsInput {
  travelStyle?: string;
  maxBudget?: number;
}

/**
 * Amadeus API Token Response
 */
export interface AmadeusTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Amadeus Flight Offer Response
 */
export interface AmadeusFlightResponse {
  data: Array<{
    id: string;
    price: {
      total: string;
      currency: string;
    };
    itineraries: Array<{
      duration: string;
      segments: Array<{
        departure: {
          iataCode: string;
          at: string;
        };
        arrival: {
          iataCode: string;
          at: string;
        };
        carrierCode: string;
        number: string;
      }>;
    }>;
    validatingAirlineCodes?: string[];
  }>;
}

/**
 * Amadeus Flight Inspiration Search Response
 * GET v1/shopping/flight-destinations
 */
export interface AmadeusDestinationResponse {
  data: Array<{
    type: string;                    // "flight-destination"
    origin: string;                  // "WAW"
    destination: string;             // "BCN"
    departureDate: string;           // "2025-10-20"
    returnDate: string;              // "2025-10-27"
    price: {
      total: string;                 // "450.00"
      currency: string;              // "PLN"
    };
    links?: {
      flightDates?: string;
      flightOffers?: string;
    };
  }>;
  meta?: {
    currency: string;
    links?: {
      self: string;
    };
    defaults?: {
      departureDate: string;
      oneWay: boolean;
      duration: string;
      nonStop: boolean;
      viewBy: string;
    };
  };
  dictionaries?: {
    currencies?: Record<string, string>;
    locations?: Record<string, {
      subType: string;
      detailedName: string;
    }>;
  };
}

/**
 * Flight Inspiration Search Parameters
 */
export interface FlightInspirationParams {
  origin: string;                    // Required: IATA code
  departureDate?: string;            // Optional: YYYY-MM-DD
  oneWay?: boolean;                  // Optional: true/false
  duration?: number;                 // Optional: trip duration in days (1-15)
  maxPrice?: number;                 // Optional: maximum price
  viewBy?: 'DATE' | 'DESTINATION' | 'DURATION' | 'WEEK' | 'COUNTRY';
}

/**
 * Error messages for Flight Inspiration API
 */
export const FLIGHT_INSPIRATION_ERRORS = {
  INVALID_IATA: 'Invalid origin IATA code. Must be 3 uppercase letters.',
  INVALID_BUDGET: 'Budget must be between 0 and 50000 PLN.',
  INVALID_DURATION: 'Duration must be between 1 and 15 days.',
  NO_RESULTS: 'No destinations found for the given criteria.',
  API_ERROR: 'Failed to fetch flight inspiration data from Amadeus API.',
  TOKEN_ERROR: 'Failed to authenticate with Amadeus API.',
} as const;

// ==========================================
// Weather Types Export
// ==========================================

// Export all weather types
export * from './weather.js';
