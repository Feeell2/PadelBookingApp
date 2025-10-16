// ==========================================
// Open-Meteo Geocoding Service
// Converts IATA codes to coordinates using Open-Meteo Geocoding API
// NO AUTHENTICATION REQUIRED - Free service
// ==========================================

import type {
  AirportLocation,
  Coordinates,
} from '../../types/weather.js';
import type { OpenMeteoGeocodingResponse } from '../../types/openMeteo.js';
import { getCityNameForIATA, hasIATAMapping } from '../../data/iataAirportMap.js';

const GEOCODING_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const REQUEST_TIMEOUT = 5000; // 5 seconds
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const BATCH_STAGGER_MS = 20; // Minimal delay for parallel requests

/**
 * Geocoding Cache with TTL and statistics
 */
class GeocodingCache {
  private cache: Map<string, { location: AirportLocation; expiresAt: number }>;
  private stats = { hits: 0, misses: 0 };

  constructor(private readonly ttl: number = CACHE_TTL) {
    this.cache = new Map();
  }

  get(iataCode: string): AirportLocation | null {
    const entry = this.cache.get(iataCode.toUpperCase());

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(iataCode);
      this.stats.misses++;
      console.log(`🗑️  [Geocoding Cache] Expired: ${iataCode}`);
      return null;
    }

    this.stats.hits++;
    console.log(`💾 [Geocoding Cache] HIT: ${iataCode}`);
    return entry.location;
  }

  set(iataCode: string, location: AirportLocation): void {
    this.cache.set(iataCode.toUpperCase(), {
      location,
      expiresAt: Date.now() + this.ttl,
    });
    console.log(`💾 [Geocoding Cache] SET: ${iataCode} (expires in 24h)`);
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(1) : '0.0';
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: `${hitRate}%`,
    };
  }
}

const cache = new GeocodingCache();

/**
 * Fetch single location from Open-Meteo Geocoding API
 */
async function fetchGeocodingAPI(
  cityName: string,
  iataCode: string
): Promise<AirportLocation> {
  const url = new URL(GEOCODING_API_URL);
  url.searchParams.set('name', cityName);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  console.log(`🌐 [Open-Meteo Geocoding] API Call: ${url.toString()}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: OpenMeteoGeocodingResponse = await response.json();

    if (!data.results || data.results.length === 0) {
      throw new Error(`No results for city: ${cityName}`);
    }

    const result = data.results[0];

    const location: AirportLocation = {
      iataCode: iataCode.toUpperCase(),
      name: result.name,
      cityName: result.name.toUpperCase(),
      countryCode: result.country_code.toUpperCase(),
      coordinates: {
        latitude: result.latitude,
        longitude: result.longitude,
      },
      timeZoneOffset: undefined, // Not provided by Open-Meteo
    };

    console.log(`✅ [Open-Meteo Geocoding] ${location.name} at (${location.coordinates.latitude}, ${location.coordinates.longitude})`);

    return location;

  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Geocoding timeout for ${cityName}`);
    }
    throw error;
  }
}

/**
 * Get airport location by IATA code using Open-Meteo Geocoding API
 * @param iataCode - 3-letter IATA code (e.g., "BCN")
 * @returns Airport location with coordinates
 * @throws Error if location not found or API fails
 */
export async function getAirportLocation(iataCode: string): Promise<AirportLocation> {
  const normalized = iataCode.toUpperCase().trim();

  // Validate IATA code format
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error(`Invalid IATA code format: ${iataCode} (must be 3 letters)`);
  }

  // Check cache first
  const cached = cache.get(normalized);
  if (cached) return cached;

  console.log(`🌍 [Open-Meteo Geocoding] Fetching coordinates for ${normalized}...`);

  // Warn if no explicit mapping
  if (!hasIATAMapping(normalized)) {
    console.warn(`⚠️  [Open-Meteo Geocoding] No city mapping for ${normalized}, trying IATA code as fallback...`);
  }

  const cityName = getCityNameForIATA(normalized);

  try {
    const location = await fetchGeocodingAPI(cityName, normalized);

    // Cache successful result
    cache.set(normalized, location);

    return location;

  } catch (error) {
    console.error(`❌ [Open-Meteo Geocoding] Error for ${normalized}:`, error);
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
 * - Uses cache for known locations (fast path)
 * - Parallel API requests with minimal stagger
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
 * // Uses cache for duplicate BCN
 */
export async function batchGetAirportLocations(
  iataCodes: string[]
): Promise<Map<string, AirportLocation>> {
  const startTime = Date.now();

  // Extract unique IATA codes
  const uniqueCodes = Array.from(new Set(iataCodes.map(code => code.toUpperCase().trim())));
  const uniqueCount = uniqueCodes.length;
  const duplicateCount = iataCodes.length - uniqueCount;

  console.log(`\n🌍 [Open-Meteo Batch Geocoding] Processing ${iataCodes.length} codes (${uniqueCount} unique, ${duplicateCount} duplicates)`);

  if (uniqueCount === 0) {
    console.log(`✅ [Open-Meteo Batch Geocoding] No codes to process`);
    return new Map();
  }

  // Check cache for each code
  const locationMap = new Map<string, AirportLocation>();
  const uncachedCodes: string[] = [];

  for (const code of uniqueCodes) {
    const cached = cache.get(code);
    if (cached) {
      locationMap.set(code, cached);
    } else {
      uncachedCodes.push(code);
    }
  }

  const cachedCount = locationMap.size;
  console.log(`💾 [Open-Meteo Batch Geocoding] Cache: ${cachedCount} hits, ${uncachedCodes.length} misses`);

  // Fetch uncached codes in PARALLEL
  if (uncachedCodes.length > 0) {
    console.log(`🌐 [Open-Meteo Batch Geocoding] Fetching ${uncachedCodes.length} locations in parallel...`);

    const locationPromises = uncachedCodes.map(async (code, index) => {
      try {
        // Add minimal delay between requests (20ms)
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, BATCH_STAGGER_MS));
        }

        const location = await getAirportLocation(code);
        return { code, location, error: null };
      } catch (error: any) {
        console.warn(`⚠️  [Open-Meteo Batch Geocoding] Failed to geocode ${code}: ${error.message}`);
        return { code, location: null, error: error.message };
      }
    });

    // Wait for all geocoding requests to complete
    const results = await Promise.all(locationPromises);

    // Build result Map (only successful lookups)
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

    console.log(`✅ [Open-Meteo Batch Geocoding] Fetched: ${successCount} succeeded, ${failureCount} failed`);
  }

  const elapsedTime = Date.now() - startTime;
  const successRate = uniqueCount > 0 ? ((locationMap.size / uniqueCount) * 100).toFixed(1) : '0.0';

  console.log(`✅ [Open-Meteo Batch Geocoding] Completed in ${elapsedTime}ms`);
  console.log(`📊 [Open-Meteo Batch Geocoding] Success: ${locationMap.size}/${uniqueCount} (${successRate}%), Cache hit rate: ${cache.getStats().hitRate}\n`);

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

/**
 * Clear geocoding cache (for testing)
 */
export function clearGeocodingCache(): void {
  cache.clear();
  console.log('🗑️  [Geocoding Cache] Cleared all entries');
}

/**
 * Get cache statistics
 */
export function getGeocodingCacheStats() {
  return cache.getStats();
}
