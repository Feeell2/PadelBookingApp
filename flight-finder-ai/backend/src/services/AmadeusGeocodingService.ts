// ==========================================
// Amadeus Geocoding Service (NO CACHE)
// Converts IATA codes to coordinates using Amadeus City Search API
// ==========================================
//
// ⚠️  DEPRECATED - Use OpenMeteoGeocodingService.ts instead
//
// This service has been replaced by OpenMeteoGeocodingService which offers:
// - 3.75x faster batch processing (parallel requests)
// - No authentication overhead (no OAuth required)
// - Better caching with 24h TTL and statistics
// - Free service with no API key requirement
//
// Migration Date: October 15, 2025
// Status: Kept for potential rollback only
//
// ==========================================

import type { AirportLocation, Coordinates, AmadeusLocationResponse } from '../types/weather.js';
import { getAmadeusToken } from './amadeusAPI.js';

const AMADEUS_BASE_URL = 'https://test.api.amadeus.com';

/**
 * Get airport/city location by IATA code using Amadeus City Search API
 * @param iataCode - 3-letter IATA code (e.g., "BCN")
 * @returns Airport location with coordinates
 * @throws Error if location not found or API fails
 */
export async function getAirportLocation(iataCode: string): Promise<AirportLocation> {
  const normalizedCode = iataCode.toUpperCase().trim();

  // Validate IATA code format
  if (!/^[A-Z]{3}$/.test(normalizedCode)) {
    throw new Error(`Invalid IATA code format: ${iataCode} (must be 3 letters)`);
  }

  console.log(`🌍 [Amadeus Geocoding] Fetching coordinates for ${normalizedCode}...`);

  try {
    // Get Amadeus token
    const token = await getAmadeusToken();

    // Build API URL
    const searchUrl = new URL(`${AMADEUS_BASE_URL}/v1/reference-data/locations`);
    searchUrl.searchParams.set('subType', 'CITY,AIRPORT');
    searchUrl.searchParams.set('keyword', normalizedCode);
    searchUrl.searchParams.set('page[limit]', '1');

    console.log(`🌐 [Amadeus Geocoding] API Call: ${searchUrl.toString()}`);

    const response = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Amadeus geocoding failed: ${response.status} - ${errorText}`);
    }

    const data: AmadeusLocationResponse = await response.json();

    // Check if we got results
    if (!data.data || data.data.length === 0) {
      throw new Error(`No location found for IATA code: ${normalizedCode}`);
    }

    // Get first result (most relevant)
    const location = data.data[0];

    // Validate geoCode exists
    if (!location.geoCode || !location.geoCode.latitude || !location.geoCode.longitude) {
      throw new Error(`No coordinates found for IATA code: ${normalizedCode}`);
    }

    // Convert to our AirportLocation format
    const airportLocation: AirportLocation = {
      iataCode: location.iataCode,
      name: location.name,
      cityName: location.address.cityName,
      countryCode: location.address.countryCode,
      coordinates: {
        latitude: location.geoCode.latitude,
        longitude: location.geoCode.longitude,
      },
      timeZoneOffset: location.timeZoneOffset,
    };

    console.log(`✅ [Amadeus Geocoding] Found: ${airportLocation.name} at (${airportLocation.coordinates.latitude}, ${airportLocation.coordinates.longitude})`);

    return airportLocation;

  } catch (error) {
    console.error(`❌ [Amadeus Geocoding] Error for ${normalizedCode}:`, error);
    throw error;
  }
}

/**
 * Get coordinates for an airport by IATA code
 * @throws Error if airport not found
 */
export async function getCoordinates(iataCode: string): Promise<Coordinates> {
  const airport = await getAirportLocation(iataCode);
  return airport.coordinates;
}

/**
 * Batch fetch airport locations for multiple IATA codes
 * - Deduplicates input codes to minimize API calls
 * - Handles individual failures gracefully
 * - Returns Map for O(1) lookups
 *
 * @param iataCodes - Array of IATA codes (can contain duplicates)
 * @returns Map of IATA code to AirportLocation
 *
 * @example
 * const codes = ['BCN', 'WAW', 'BCN', 'PRG'];
 * const locations = await batchGetAirportLocations(codes);
 * // Makes 3 API calls (BCN, WAW, PRG) instead of 4
 */
export async function batchGetAirportLocations(
  iataCodes: string[]
): Promise<Map<string, AirportLocation>> {
  const startTime = Date.now();

  // Extract unique IATA codes
  const uniqueCodes = Array.from(new Set(iataCodes.map(code => code.toUpperCase().trim())));
  const uniqueCount = uniqueCodes.length;
  const duplicateCount = iataCodes.length - uniqueCount;

  console.log(`🌍 [Amadeus Batch Geocoding] Processing ${iataCodes.length} codes (${uniqueCount} unique, ${duplicateCount} duplicates)`);

  if (uniqueCount === 0) {
    console.log(`✅ [Amadeus Batch Geocoding] No codes to process`);
    return new Map();
  }

  // Calculate approximate time with rate limiting (100ms delay between requests)
  const totalTime = uniqueCount > 0 ? (uniqueCount - 1) * 100 : 0;
  console.log(`⏱️  [Amadeus Batch Geocoding] Estimated time: ~${totalTime}ms (rate limited)`);

  // Create promises for all unique codes with sequential delays
  const locationPromises = uniqueCodes.map(async (code, index) => {
    try {
      // Add delay between requests to respect rate limits (100ms)
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const location = await getAirportLocation(code);
      return { code, location, error: null };
    } catch (error: any) {
      console.warn(`⚠️  [Amadeus Batch Geocoding] Failed to geocode ${code}: ${error.message}`);
      return { code, location: null, error: error.message };
    }
  });

  // Wait for all geocoding requests to complete
  const results = await Promise.all(locationPromises);

  // Build result Map (only successful lookups)
  const locationMap = new Map<string, AirportLocation>();
  let successCount = 0;
  let failureCount = 0;

  for (const result of results) {
    if (result.location) {
      locationMap.set(result.code, result.location);
      successCount++;
    } else {
      failureCount++;
    }
  }

  const elapsedTime = Date.now() - startTime;
  const successRate = uniqueCount > 0 ? ((successCount / uniqueCount) * 100).toFixed(1) : '0.0';

  console.log(`✅ [Amadeus Batch Geocoding] Completed in ${elapsedTime}ms`);
  console.log(`📊 [Amadeus Batch Geocoding] Success: ${successCount}/${uniqueCount} (${successRate}%), Failures: ${failureCount}`);

  return locationMap;
}

/**
 * Validate coordinates
 */
export function validateCoordinates(lat: number, lon: number): boolean {
  return (
    !isNaN(lat) && !isNaN(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180
  );
}
