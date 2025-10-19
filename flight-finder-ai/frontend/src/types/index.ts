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
  flightOffersUrl?: string;  // Link to detailed flight offers API
  flightDatesUrl?: string;   // Link to flexible dates API
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

// ==========================================
// Flight Details Types
// ==========================================

/**
 * Single flight segment (one leg of journey)
 */
export interface FlightSegment {
  departureTime: string;      // ISO 8601: "2025-10-20T08:30:00"
  departureAirport: string;   // IATA code: "WAW"
  departureTerminal?: string; // "A" or undefined
  arrivalTime: string;        // ISO 8601: "2025-10-20T11:00:00"
  arrivalAirport: string;     // IATA code: "BCN"
  arrivalTerminal?: string;   // "1" or undefined
  airline: string;            // "LOT Polish Airlines"
  airlineCode: string;        // "LO"
  flightNumber: string;       // "LO456"
  duration: string;           // "PT2H30M" (ISO 8601 duration)
  aircraft: string;           // "Boeing 737-800" or just "73H"
}

/**
 * Flight itinerary (outbound or inbound)
 * Contains one or more segments
 */
export interface FlightItinerary {
  segments: FlightSegment[];
  totalDuration: string;      // "PT5H30M" (ISO 8601 duration)
  stops: number;              // segments.length - 1
}

/**
 * Complete flight offer with detailed itinerary
 */
export interface FlightOfferDetail {
  id: string;
  price: number;
  currency: string;           // "PLN"
  originalPrice?: number;     // Price in original currency
  originalCurrency?: string;  // "EUR"
  outbound: FlightItinerary;  // Departing flight
  inbound?: FlightItinerary;  // Return flight (undefined for one-way)
}

/**
 * Alternative date option for flexible searches
 */
export interface FlightDateOption {
  departureDate: string;      // "2025-10-20" (YYYY-MM-DD)
  returnDate: string;         // "2025-10-27" (YYYY-MM-DD)
  price: number;              // 487.20
  currency: string;           // "PLN"
  originalPrice?: number;     // Price in original currency
  originalCurrency?: string;  // "EUR"
}

/**
 * API Response for flight offers details
 */
export interface FlightOffersDetailsResponse {
  data: Array<{
    id: string;
    price: {
      total: string;
      currency: string;
      originalPrice?: number;
      originalCurrency?: string;
    };
    itineraries: Array<{
      duration: string;
      segments: Array<{
        departure: {
          iataCode: string;
          at: string;
          terminal?: string;
        };
        arrival: {
          iataCode: string;
          at: string;
          terminal?: string;
        };
        carrierCode: string;
        number: string;
        aircraft: {
          code: string;
        };
        duration: string;
      }>;
    }>;
  }>;
}

/**
 * API Response for flight dates
 */
export interface FlightDatesResponse {
  data: Array<{
    type: string;
    origin: string;
    destination: string;
    departureDate: string;
    returnDate: string;
    price: {
      total: string;
      currency: string;
      originalPrice?: number;
      originalCurrency?: string;
    };
  }>;
}
