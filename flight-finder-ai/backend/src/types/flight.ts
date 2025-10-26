// ==========================================
// Flight Types & Interfaces
// Flight domain types and user preferences
// ==========================================

/**
 * User preferences for flight search
 */
export interface UserPreferences {
  budget: number;
  origin: string;
  travelStyle: 'adventure' | 'relaxation' | 'culture' | 'party' | 'nature';
  preferredDestinations?: string[];
  departureDate: string; // YYYY-MM-DD - REQUIRED
  returnDate: string; // YYYY-MM-DD - REQUIRED
  flexibleDates?: boolean; // Optional: Enable ±3 days search
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
  flightOffersUrl?: string; // Link to detailed flight offers API
  flightDatesUrl?: string;  // Link to flexible dates API
  weatherData?: WeatherData; // Optional weather enrichment
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
