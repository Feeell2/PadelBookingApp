// ==========================================
// Amadeus Flight Service
// Flight search and inspiration API integration
// ==========================================

import type {
  AmadeusFlightResponse,
  AmadeusDestinationResponse,
  FlightInspirationParams,
  AmadeusFlightOffersDetailResponse,
  AmadeusFlightDatesResponse,
} from '../../types/amadeus.js';
import type { FlightOffer } from '../../types/flight.js';
import { FLIGHT_INSPIRATION_ERRORS } from '../../types/amadeus.js';
import { getAmadeusToken } from './amadeusAuthService.js';
import { convertFromPLN, convertToPLN } from '../currency/currencyConversionUtils.js';
import { getExchangeRate } from '../currency/currencyService.js';

const AMADEUS_BASE_URL = 'https://test.api.amadeus.com';

/**
 * Generate array of dates within ±N days range
 *
 * @param baseDate - Base date string (YYYY-MM-DD)
 * @param flexDays - Number of days flexibility (e.g., 3 for ±3 days)
 * @returns Array of date strings (YYYY-MM-DD) sorted chronologically
 */
function generateFlexibleDates(baseDate: string, flexDays: number = 3): string[] {
  const dates: string[] = [];
  const base = new Date(baseDate);

  // Generate dates from -flexDays to +flexDays
  for (let i = -flexDays; i <= flexDays; i++) {
    const date = new Date(base);
    date.setDate(date.getDate() + i);

    // Format to YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

  return dates;
}

/**
 * Remove duplicate offers (same destination + similar dates)
 * Keeps the cheapest offer for each destination-date combination
 */
function deduplicateOffers(offers: FlightOffer[]): FlightOffer[] {
  const uniqueMap = new Map<string, FlightOffer>();

  for (const offer of offers) {
    // Create unique key: destination + departure week
    const departureWeek = Math.floor(
      new Date(offer.departureDate).getTime() / (7 * 24 * 60 * 60 * 1000)
    );
    const key = `${offer.destinationCode}-week${departureWeek}`;

    // Keep only the cheapest offer for this key
    const existing = uniqueMap.get(key);
    if (!existing || offer.price < existing.price) {
      uniqueMap.set(key, offer);
    }
  }

  return Array.from(uniqueMap.values());
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
        console.log('🔄 [Amadeus] Token expired, retrying...');
        // Auth service will handle token refresh
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
  const { origin, maxPrice, departureDate, duration, oneWay, viewBy, flexibleDates } = params;

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

  // Flexible dates logic
  if (flexibleDates && departureDate) {
    console.log(`📅 [Amadeus] Flexible dates enabled: searching ±3 days from ${departureDate}`);
    return await searchFlexibleDates(params);
  }

  // Original single-date search
  return await searchSingleDate(params);
}

/**
 * Search for flights on a single departure date
 * (Original searchFlightInspiration logic)
 */
async function searchSingleDate(
  params: FlightInspirationParams
): Promise<FlightOffer[]> {
  const { origin, maxPrice, departureDate, duration, oneWay, viewBy } = params;

  // Get OAuth token (reuse existing getAmadeusToken function)
  const token = await getAmadeusToken();

  // Convert maxPrice from PLN to EUR (Amadeus requires EUR)
  let maxPriceInEUR = maxPrice;
  if (maxPrice) {
    maxPriceInEUR = await convertFromPLN(maxPrice, 'EUR');
    console.log(`💱 [Amadeus] Converted budget: ${maxPrice} PLN → ${maxPriceInEUR} EUR`);
  }

  // Build API URL with query parameters
  const baseUrl = 'https://test.api.amadeus.com/v1/shopping/flight-destinations';
  const queryParams = new URLSearchParams({
    origin: origin,
    ...(departureDate && { departureDate }),
    ...(oneWay !== undefined && { oneWay: oneWay.toString() }),
    ...(duration && { duration: duration.toString() }),
    ...(maxPriceInEUR && { maxPrice: Math.round(maxPriceInEUR).toString() }),
    ...(viewBy && { viewBy }),
  });
  const url = `${baseUrl}?${queryParams.toString()}`;

  console.log(`✈️  [Amadeus Inspiration] Calling API for origin: ${origin}, maxPrice: ${maxPriceInEUR ? `${maxPriceInEUR} EUR` : 'any'}`);

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
      // Token will be auto-refreshed by authService
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
      return await transformInspirationToOffers(retryData);
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

    return await transformInspirationToOffers(data);

  } catch (error) {
    console.error('❌ [Amadeus Inspiration] Error calling API:', error);
    throw error;
  }
}

/**
 * Search for flights with flexible dates (±3 days)
 * Calls API multiple times for each date in range
 *
 * @param params - Flight search parameters
 * @returns Aggregated and sorted flight offers
 */
async function searchFlexibleDates(
  params: FlightInspirationParams
): Promise<FlightOffer[]> {
  const { departureDate, duration } = params;

  if (!departureDate) {
    throw new Error('Departure date is required for flexible date search');
  }

  // Generate ±3 days range
  const departureDates = generateFlexibleDates(departureDate, 3);
  console.log(`📅 [Amadeus] Flexible dates: ${departureDates.join(', ')}`);

  // If duration is specified, generate flexible return dates too
  let returnDates: string[] | undefined;
  if (duration && params.oneWay === false) {
    const baseReturnDate = new Date(departureDate);
    baseReturnDate.setDate(baseReturnDate.getDate() + duration);
    const baseReturnStr = baseReturnDate.toISOString().split('T')[0];
    returnDates = generateFlexibleDates(baseReturnStr, 3);
    console.log(`📅 [Amadeus] Flexible return dates: ${returnDates.join(', ')}`);
  }

  // Search all date combinations
  const allOffers: FlightOffer[] = [];
  const searchPromises: Promise<FlightOffer[]>[] = [];

  for (const depDate of departureDates) {
    // Create search params for this date
    const searchParams: FlightInspirationParams = {
      ...params,
      departureDate: depDate,
      flexibleDates: false, // Disable recursion
    };

    // Call searchSingleDate for each departure date
    searchPromises.push(
      searchSingleDate(searchParams).catch(err => {
        console.warn(`⚠️  [Amadeus] Failed to search date ${depDate}:`, err.message);
        return []; // Return empty array on error
      })
    );
  }

  // Wait for all searches to complete
  const results = await Promise.all(searchPromises);

  // Flatten results
  results.forEach(offers => {
    allOffers.push(...offers);
  });

  console.log(`✅ [Amadeus] Flexible search found ${allOffers.length} total offers across all dates`);

  // Remove duplicates (same destination, similar price)
  const uniqueOffers = deduplicateOffers(allOffers);

  // Sort by price (cheapest first)
  const sorted = uniqueOffers.sort((a, b) => a.price - b.price);

  // Return top 15 offers
  const topOffers = sorted.slice(0, 15);
  console.log(`✅ [Amadeus] Returning top ${topOffers.length} offers from flexible search`);

  return topOffers;
}

/**
 * Transform Amadeus Inspiration response to FlightOffer format
 * Maintains compatibility with existing agent.ts expectations
 * Converts all prices to PLN
 *
 * @param response - Amadeus destination response
 * @returns Promise resolving to array of FlightOffer objects
 */
async function transformInspirationToOffers(
  response: AmadeusDestinationResponse
): Promise<FlightOffer[]> {
  if (!response.data || response.data.length === 0) {
    return [];
  }

  // Detect all unique currencies in response
  const currencies = new Set<string>();
  response.data.forEach(dest => {
    // Currency is in dictionaries.currencies object (keys are currency codes)
    const currencyCode = Object.keys(response.dictionaries?.currencies || {})[0] || 'EUR';
    currencies.add(currencyCode);
  });

  console.log(`💱 [Amadeus] Detected currencies in response: ${Array.from(currencies).join(', ')}`);

  // Pre-fetch exchange rates for all currencies (sequentially as per user requirement)
  for (const currencyCode of currencies) {
    if (currencyCode !== 'PLN') {
      await getExchangeRate(currencyCode); // Loads into cache
      console.log(`💱 [Amadeus] Pre-fetched ${currencyCode} exchange rate`);
    }
  }

  // Convert all prices to PLN
  const offers = await Promise.all(
    response.data.map(async (destination) => {
      // Get currency from dictionaries (usually EUR for Amadeus)
      const originalCurrency = Object.keys(response.dictionaries?.currencies || {})[0] || 'EUR';
      const originalPrice = parseFloat(destination.price.total);

      // Convert to PLN
      const priceInPLN = await convertToPLN(originalPrice, originalCurrency);

      console.log(`💱 [Amadeus] ${destination.destination}: ${originalPrice} ${originalCurrency} → ${priceInPLN} PLN`);

      return {
        id: `inspiration-${destination.origin}-${destination.destination}-${destination.departureDate}`,
        origin: destination.origin,
        destination: getCityName(destination.destination, response.dictionaries?.locations),
        destinationCode: destination.destination,
        departureDate: destination.departureDate,
        returnDate: destination.returnDate,
        price: priceInPLN,
        currency: 'PLN', // Always PLN after conversion
        airline: 'Various', // Inspiration API doesn't return specific airlines
        duration: calculateDuration(destination.departureDate, destination.returnDate),
        stops: 0, // Unknown from inspiration API, assume direct
        flightOffersUrl: removeDurationParameter(destination.links?.flightOffers),
        flightDatesUrl: destination.links?.flightDates,
      };
    })
  );

  return offers;
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

/**
 * Remove redundant parameters from Amadeus flight offers URL
 * The duration and viewBy parameters may cause issues with the Flight Offers API
 *
 * @param url - Original Amadeus URL with potentially redundant parameters
 * @returns Sanitized URL without duration and viewBy parameters
 */
function removeDurationParameter(url: string | undefined): string | undefined {
  if (!url) return undefined;
  console.log(url);
  
  try {
    const urlObj = new URL(url);
    const removedParams: string[] = [];

    // Remove duration parameter (redundant - defined by dates)
    if (urlObj.searchParams.has('duration')) {
      urlObj.searchParams.delete('duration');
      removedParams.push('duration');
    }

    // Remove viewBy parameter (not applicable to Flight Offers API)
    if (urlObj.searchParams.has('viewBy')) {
      urlObj.searchParams.delete('viewBy');
      removedParams.push('viewBy');
    }

    const sanitizedUrl = urlObj.toString();
    console.log(`🔧 [Amadeus] Sanitized URL: ${sanitizedUrl}`);
    // Log removed parameters
    if (removedParams.length > 0) {
      console.log(`🔧 [Amadeus] Removed parameters from URL: ${removedParams.join(', ')}`);
    }

    return sanitizedUrl;
  } catch (error) {
    // If URL parsing fails, return original URL
    console.warn('⚠️  [Amadeus] Failed to parse URL for parameter removal:', error);
    return url;
  }
}

/**
 * Fetch detailed flight offers from Amadeus URL
 * Converts prices from EUR to PLN
 *
 * @param url - Complete Amadeus flight offers URL from inspiration response
 * @returns Promise resolving to detailed flight offers
 */
export async function fetchFlightOffersDetails(
  url: string
): Promise<AmadeusFlightOffersDetailResponse> {
  console.log(`✈️  [Amadeus] Fetching flight offers details from URL`);

  // Validate URL is from Amadeus
  if (!url.includes('api.amadeus.com')) {
    throw new Error('Invalid Amadeus URL');
  }

  try {
    const token = await getAmadeusToken();
    console.log(`🌐 [Amadeus] API Call: ${url}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Handle 401 - Token expired, retry once
    if (response.status === 401) {
      console.log('🔄 [Amadeus] Token expired, retrying...');
      const newToken = await getAmadeusToken();
      const retryResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${newToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!retryResponse.ok) {
        throw new Error(`Amadeus API error: ${retryResponse.status}`);
      }

      const data: AmadeusFlightOffersDetailResponse = await retryResponse.json();
      return data;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Amadeus] API error: ${response.status}`, errorText);
      throw new Error(`Amadeus API error: ${response.status}`);
    }

    const data: AmadeusFlightOffersDetailResponse = await response.json();
    console.log(`✅ [Amadeus] Found ${data.data?.length || 0} detailed flight offers`);

    return data;
  } catch (error) {
    console.error('❌ [Amadeus] Error fetching flight offers details:', error);
    throw error;
  }
}

/**
 * Fetch flexible date options from Amadeus URL
 * Converts prices from original currency to PLN
 *
 * @param url - Complete Amadeus flight dates URL from inspiration response
 * @returns Promise resolving to date options with PLN prices
 */
export async function fetchFlightDates(
  url: string
): Promise<AmadeusFlightDatesResponse> {
  console.log(`📅 [Amadeus] Fetching flight dates from URL`);

  // Validate URL is from Amadeus
  if (!url.includes('api.amadeus.com')) {
    throw new Error('Invalid Amadeus URL');
  }

  try {
    const token = await getAmadeusToken();

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Handle 401 - Token expired, retry once
    if (response.status === 401) {
      console.log('🔄 [Amadeus] Token expired, retrying...');
      const newToken = await getAmadeusToken();
      const retryResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${newToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!retryResponse.ok) {
        throw new Error(`Amadeus API error: ${retryResponse.status}`);
      }

      const data: AmadeusFlightDatesResponse = await retryResponse.json();
      return data;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Amadeus] API error: ${response.status}`, errorText);
      throw new Error(`Amadeus API error: ${response.status}`);
    }

    const data: AmadeusFlightDatesResponse = await response.json();
    console.log(`✅ [Amadeus] Found ${data.data?.length || 0} date alternatives`);

    return data;
  } catch (error) {
    console.error('❌ [Amadeus] Error fetching flight dates:', error);
    throw error;
  }
}
