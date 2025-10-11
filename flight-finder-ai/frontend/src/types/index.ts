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
  departureDate?: string;
  returnDate?: string;
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
  departureDate: string;
  returnDate: string;
  airline: string;
  duration: string;
  stops: number;
}

/**
 * Weather information for a destination
 */
export interface WeatherInfo {
  destination: string;
  temperature: number;
  condition: string;
  humidity: number;
  forecast: string;
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
