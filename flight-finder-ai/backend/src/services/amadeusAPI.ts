// ==========================================
// Amadeus API Service (Pure Fetch - No SDK)
// ==========================================

import dotenv from 'dotenv';
import type { AmadeusTokenResponse, AmadeusFlightResponse, FlightOffer } from '../types/index.js';

dotenv.config();

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
  // Check if cached token is still valid
  if (cachedToken && Date.now() < cachedToken.expires_at) {
    const validFor = Math.floor((cachedToken.expires_at - Date.now()) / 1000);
    console.log(`💾 [Amadeus] Using cached token (valid for ${validFor}s)`);
    return cachedToken.access_token;
  }

  console.log('🔑 [Amadeus] Requesting new OAuth token...');

  if (!AMADEUS_API_KEY || !AMADEUS_API_SECRET) {
    throw new Error('AMADEUS_API_KEY and AMADEUS_API_SECRET must be set in .env');
  }

  // Debug logging
  console.log(`🔍 [Amadeus Debug] API Key length: ${AMADEUS_API_KEY.length}`);
  console.log(`🔍 [Amadeus Debug] API Secret length: ${AMADEUS_API_SECRET.length}`);
  console.log(`🔍 [Amadeus Debug] API Key first 10 chars: ${AMADEUS_API_KEY.substring(0, 10)}`);

  const tokenUrl = `${AMADEUS_BASE_URL}/v1/security/oauth2/token`;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: AMADEUS_API_KEY,
    client_secret: AMADEUS_API_SECRET,
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
 * Get city name from IATA code
 */
function getCityName(code: string): string {
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
  };

  return cities[code] || code;
}
