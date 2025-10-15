// ==========================================
// Amadeus API Service (Pure Fetch - No SDK)
// ==========================================

import type {
  AmadeusTokenResponse,
  AmadeusFlightResponse,
  AmadeusDestinationResponse,
  FlightOffer,
  FlightInspirationParams
} from '../types/index.js';
import { FLIGHT_INSPIRATION_ERRORS } from '../types/index.js';

const AMADEUS_API_KEY = process.env.AMADEUS_API_KEY?.trim();
const AMADEUS_API_SECRET = process.env.AMADEUS_API_SECRET?.trim();
const AMADEUS_BASE_URL = 'https://test.api.amadeus.com';

/**
 * Token cache (in-memory)
 */
let cachedToken: {
  access_token: string;
  expires_at: number; // timestamp in ms
} | null = null;

/**
 * Get OAuth token from Amadeus API
 * Implements token caching with auto-refresh
 */
export async function getAmadeusToken(): Promise<string> {
  // Check if cached token is still valid);
  if (cachedToken && Date.now() < cachedToken.expires_at) {
    const validFor = Math.floor((cachedToken.expires_at - Date.now()) / 1000);
    console.log(`💾 [Amadeus] Using cached token (valid for ${validFor}s)`);
    return cachedToken.access_token;
  }

  console.log('🔑 [Amadeus] Requesting new OAuth token...');

  if (!process.env.AMADEUS_API_KEY || !process.env.AMADEUS_API_SECRET) {
    throw new Error('AMADEUS_API_KEY and AMADEUS_API_SECRET must be set in .env');
  }

  // Debug logging
  console.log(`🔍 [Amadeus Debug] API Key length: ${process.env.AMADEUS_API_KEY.length}`);
  console.log(`🔍 [Amadeus Debug] API Secret length: ${process.env.AMADEUS_API_SECRET.length}`);
  console.log(`🔍 [Amadeus Debug] API Key first 10 chars: ${process.env.AMADEUS_API_KEY.substring(0, 10)}`);

  const tokenUrl = `${AMADEUS_BASE_URL}/v1/security/oauth2/token`;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.AMADEUS_API_KEY,
    client_secret: process.env.AMADEUS_API_SECRET,
  });

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [Amadeus] Token request failed');
      console.error('   Status:', response.status);
      console.error('   Response:', errorText);
      console.error('   Request body:', body.toString());
      throw new Error(`Amadeus token request failed: ${response.status} - ${errorText}`);
    }

    const data: AmadeusTokenResponse = await response.json();

    // Cache token with 30s buffer before expiration
    const expiresInMs = (data.expires_in - 30) * 1000;
    cachedToken = {
      access_token: data.access_token,
      expires_at: Date.now() + expiresInMs,
    };

    console.log(`🔑 [Amadeus] Token obtained: ${data.access_token.substring(0, 20)}... (expires in ${data.expires_in}s)`);

    return data.access_token;
  } catch (error) {
    console.error('❌ [Amadeus] Failed to obtain token:', error);
    throw error;
  }
}

/**
 * Search for flights using Amadeus Flight Offers Search API
 */
export async function searchAmadeusFlights(
  origin: string,
  destination: string,
  departureDate: string, // YYYY-MM-DD
  adults: number = 1,
  maxResults: number = 5
): Promise<FlightOffer[]> {
  console.log(`✈️ [Amadeus] Searching flights: ${origin} → ${destination} on ${departureDate}`);

  try {
    // Get valid token
    const token = await getAmadeusToken();

    // Build API URL
    const searchUrl = new URL(`${AMADEUS_BASE_URL}/v2/shopping/flight-offers`);
    searchUrl.searchParams.set('originLocationCode', origin);
    searchUrl.searchParams.set('destinationLocationCode', destination);
    searchUrl.searchParams.set('departureDate', departureDate);
    searchUrl.searchParams.set('adults', adults.toString());
    searchUrl.searchParams.set('max', maxResults.toString());
    searchUrl.searchParams.set('currencyCode', 'PLN');

    console.log(`🌐 [Amadeus] API Call: ${searchUrl.toString()}`);

    const response = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Handle 401 - token expired (shouldn't happen with caching, but just in case)
      if (response.status === 401) {
        console.log('🔄 [Amadeus] Token expired, clearing cache and retrying...');
        cachedToken = null;
        // Retry once
        return searchAmadeusFlights(origin, destination, departureDate, adults, maxResults);
      }

      throw new Error(`Amadeus search failed: ${response.status} - ${errorText}`);
    }

    const data: AmadeusFlightResponse = await response.json();

    console.log(`✅ [Amadeus] Found ${data.data?.length || 0} real flight offers`);


    // Convert Amadeus format to our FlightOffer format
    const flights = convertAmadeusToFlightOffers(data, origin);
    console.log(flights);
    return flights;
  } catch (error) {
    console.error('❌ [Amadeus] Search error:', error);
    throw error;
  }
}

/**
 * Convert Amadeus flight response to our FlightOffer format
 */
function convertAmadeusToFlightOffers(
  amadeusResponse: AmadeusFlightResponse,
  origin: string
): FlightOffer[] {
  if (!amadeusResponse.data || amadeusResponse.data.length === 0) {
    return [];
  }

  return amadeusResponse.data.map((flight) => {
    const firstItinerary = flight.itineraries[0];
    const firstSegment = firstItinerary.segments[0];
    const lastSegment = firstItinerary.segments[firstItinerary.segments.length - 1];

    // Calculate number of stops (segments - 1)
    const stops = firstItinerary.segments.length - 1;

    // Parse duration (PT2H30M format) to readable format
    const duration = parseDuration(firstItinerary.duration);

    // Get airline from first segment or validating airline codes
    const airline = getAirlineName(
      flight.validatingAirlineCodes?.[0] || firstSegment.carrierCode
    );

    // Extract dates
    const departureDate = firstSegment.departure.at.split('T')[0];
    const returnDate = flight.itineraries[1]
      ? flight.itineraries[1].segments[0].departure.at.split('T')[0]
      : departureDate; // fallback if no return

    // Get destination
    const destination = lastSegment.arrival.iataCode;

    return {
      id: flight.id,
      destination: getCityName(destination),
      destinationCode: destination,
      origin: origin,
      price: Math.round(parseFloat(flight.price.total)),
      currency: flight.price.currency,
      departureDate,
      returnDate,
      airline,
      duration,
      stops,
    };
  });
}

/**
 * Parse ISO 8601 duration (PT2H30M) to readable format (2h 30m)
 */
function parseDuration(isoDuration: string): string {
  const matches = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!matches) return isoDuration;

  const hours = matches[1] || '0';
  const minutes = matches[2] || '0';

  if (parseInt(minutes) === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

/**
 * Get airline name from IATA code
 */
function getAirlineName(code: string): string {
  const airlines: Record<string, string> = {
    LO: 'LOT Polish Airlines',
    FR: 'Ryanair',
    W6: 'Wizz Air',
    LH: 'Lufthansa',
    U2: 'easyJet',
    BA: 'British Airways',
    KL: 'KLM',
    AF: 'Air France',
    LX: 'Swiss',
    OS: 'Austrian Airlines',
    SK: 'SAS',
    AY: 'Finnair',
    IB: 'Iberia',
    VY: 'Vueling',
    TP: 'TAP Portugal',
  };

  return airlines[code] || code;
}

/**
 * Get city name from IATA code with fallback to API dictionary
 *
 * @param iataCode - 3-letter airport code
 * @param dictionary - Optional locations dictionary from API response
 * @returns City name or IATA code if not found
 */
function getCityName(
  iataCode: string,
  dictionary?: Record<string, { subType: string; detailedName: string }>
): string {
  // Static mappings (expanded list)
  const cities: Record<string, string> = {
    BCN: 'Barcelona',
    PRG: 'Prague',
    LIS: 'Lisbon',
    BUD: 'Budapest',
    CPH: 'Copenhagen',
    WAW: 'Warsaw',
    KRK: 'Kraków',
    GDN: 'Gdańsk',
    BER: 'Berlin',
    PAR: 'Paris',
    CDG: 'Paris',
    LON: 'London',
    LHR: 'London',
    ROM: 'Rome',
    FCO: 'Rome',
    MAD: 'Madrid',
    AMS: 'Amsterdam',
    VIE: 'Vienna',
    ZRH: 'Zurich',
    MUC: 'Munich',
    IST: 'Istanbul',
    MIL: 'Milan',
    LIN: 'Milan',
    VCE: 'Venice',
    ATH: 'Athens',
    DUB: 'Dublin',
  };

  // Try static mapping first
  if (cities[iataCode]) {
    return cities[iataCode];
  }

  // Try API dictionary if available
  if (dictionary && dictionary[iataCode]) {
    const location = dictionary[iataCode];
    // Extract city name from detailed name (e.g., "Barcelona, Spain" → "Barcelona")
    const cityName = location.detailedName.split(',')[0].trim();
    return cityName;
  }

  // Fallback to IATA code
  return iataCode;
}

/**
 * Search for inspiring flight destinations from origin within budget
 * Uses Amadeus Flight Inspiration Search API (v1/shopping/flight-destinations)
 *
 * @param params - Search parameters
 * @returns Promise resolving to array of FlightOffer objects
 * @throws {Error} If API request fails or validation fails
 */
export async function searchFlightInspiration(
  params: FlightInspirationParams
): Promise<FlightOffer[]> {
  const { origin, maxPrice, departureDate, duration, oneWay, viewBy } = params;

  // Input validation
  if (!/^[A-Z]{3}$/.test(origin)) {
    throw new Error(FLIGHT_INSPIRATION_ERRORS.INVALID_IATA);
  }

  if (maxPrice && (maxPrice < 0 || maxPrice > 50000)) {
    throw new Error(FLIGHT_INSPIRATION_ERRORS.INVALID_BUDGET);
  }

  if (duration && (duration < 1 || duration > 15)) {
    throw new Error(FLIGHT_INSPIRATION_ERRORS.INVALID_DURATION);
  }

  // Get OAuth token (reuse existing getAmadeusToken function)
  const token = await getAmadeusToken();

  // Build API URL with query parameters
  const baseUrl = 'https://test.api.amadeus.com/v1/shopping/flight-destinations';
  const queryParams = new URLSearchParams({
    origin: origin,
    ...(departureDate && { departureDate }),
    ...(oneWay !== undefined && { oneWay: oneWay.toString() }),
    ...(duration && { duration: duration.toString() }),
    ...(maxPrice && { maxPrice: maxPrice.toString() }),
    ...(viewBy && { viewBy }),
  });

  const url = `${baseUrl}?${queryParams.toString()}`;

  console.log(`✈️  [Amadeus Inspiration] Calling API for origin: ${origin}, maxPrice: ${maxPrice || 'any'}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Handle 401 - Token expired, retry once
    if (response.status === 401) {
      console.log('🔄 [Amadeus Inspiration] Token expired, retrying with fresh token...');
      cachedToken = null; // Force refresh
      const newToken = await getAmadeusToken();
      const retryResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${newToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!retryResponse.ok) {
        throw new Error(`Amadeus API error after retry: ${retryResponse.status}`);
      }

      const retryData: AmadeusDestinationResponse = await retryResponse.json();
      return transformInspirationToOffers(retryData);
    }

    // Handle 404 - No destinations found
    if (response.status === 404) {
      console.log('❌ [Amadeus Inspiration] No destinations found for the given criteria');
      return [];
    }

    // Handle other errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Amadeus Inspiration] API error: ${response.status}`, errorText);
      throw new Error(`Amadeus API error: ${response.status}`);
    }

    const data: AmadeusDestinationResponse = await response.json();
    console.log(`✅ [Amadeus Inspiration] Found ${data.data?.length || 0} inspiring destinations`);

    return transformInspirationToOffers(data);

  } catch (error) {
    console.error('❌ [Amadeus Inspiration] Error calling API:', error);
    throw error;
  }
}

/**
 * Transform Amadeus Inspiration response to FlightOffer format
 * Maintains compatibility with existing agent.ts expectations
 *
 * @param response - Amadeus destination response
 * @returns Array of FlightOffer objects
 */
function transformInspirationToOffers(
  response: AmadeusDestinationResponse
): FlightOffer[] {
  if (!response.data || response.data.length === 0) {
    return [];
  }

  let currency = Object.keys(response.dictionaries?.currencies || {})[0];
  
  return response.data.map((destination) => ({
    id: `inspiration-${destination.origin}-${destination.destination}-${destination.departureDate}`,
    origin: destination.origin,
    destination: getCityName(destination.destination, response.dictionaries?.locations),
    destinationCode: destination.destination,
    departureDate: destination.departureDate,
    returnDate: destination.returnDate,
    price: parseFloat(destination.price.total),
    currency: currency,
    airline: 'Various', // Inspiration API doesn't return specific airlines
    duration: calculateDuration(destination.departureDate, destination.returnDate),
    stops: 0, // Unknown from inspiration API, assume direct
  }));
}

/**
 * Calculate trip duration in days
 *
 * @param departureDate - Departure date (YYYY-MM-DD)
 * @param returnDate - Return date (YYYY-MM-DD)
 * @returns Duration string (e.g., "7 days")
 */
function calculateDuration(departureDate: string, returnDate: string): string {
  const departure = new Date(departureDate);
  const returnD = new Date(returnDate);
  const diffTime = Math.abs(returnD.getTime() - departure.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return `${diffDays} days`;
}
