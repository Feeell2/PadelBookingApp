// ==========================================
// Amadeus API Types & Interfaces
// All types related to Amadeus API integration
// ==========================================

/**
 * Amadeus OAuth Token Response
 */
export interface AmadeusTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Amadeus Flight Offer Search Response
 * GET v2/shopping/flight-offers
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

/**
 * Amadeus City Search API Response
 * GET v1/reference-data/locations
 */
export interface AmadeusLocationResponse {
  meta: {
    count: number;
    links?: {
      self: string;
    };
  };
  data: Array<{
    type: string;                  // "location"
    subType: string;               // "CITY" or "AIRPORT"
    name: string;                  // "BARCELONA"
    detailedName?: string;         // "Barcelona, ES"
    id: string;                    // "CBCN"
    self?: {
      href: string;
      methods: string[];
    };
    timeZoneOffset?: string;       // "+02:00"
    iataCode: string;              // "BCN"
    geoCode: {
      latitude: number;            // 41.2974
      longitude: number;           // 2.0833
    };
    address: {
      cityName: string;            // "BARCELONA"
      cityCode?: string;           // "BCN"
      countryName?: string;        // "SPAIN"
      countryCode: string;         // "ES"
      regionCode?: string;         // "EUROP"
    };
    analytics?: {
      travelers: {
        score: number;
      };
    };
  }>;
}
