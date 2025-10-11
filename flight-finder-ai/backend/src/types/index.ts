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
  weatherPreference: 'hot' | 'mild' | 'cold' | 'any';
  preferredDestinations?: string[];
  departureDate?: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD
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
    weatherPreference: string;
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
