// ==========================================
// Currency Service
// NBP API integration with in-memory caching
// ==========================================

import type { NBPExchangeRateResponse, CachedRate, SupportedCurrency } from '../../types/currency.js';
import { SUPPORTED_CURRENCIES } from '../../types/currency.js';

const NBP_BASE_URL = 'https://api.nbp.pl/api/exchangerates/rates/a';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * In-memory cache for exchange rates
 * Key: Currency code (e.g., "EUR")
 * Value: CachedRate with rate and expiry
 */
const exchangeRateCache = new Map<string, CachedRate>();

/**
 * Validate if currency code is supported by NBP API
 *
 * @param currencyCode - ISO 4217 currency code
 * @returns true if currency is in whitelist
 */
function isSupportedCurrency(currencyCode: string): currencyCode is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(currencyCode as SupportedCurrency);
}

/**
 * Get exchange rate from NBP API or cache
 *
 * @param currencyCode - ISO 4217 currency code (e.g., "EUR", "USD")
 * @returns Exchange rate to PLN (e.g., 4.2565 means 1 EUR = 4.2565 PLN)
 * @throws {Error} If currency code is invalid or NBP API fails
 *
 * @example
 * const eurRate = await getExchangeRate('EUR');
 * // Returns: 4.2565 (1 EUR = 4.2565 PLN)
 */
export async function getExchangeRate(currencyCode: string): Promise<number> {
  // Validate currency code format
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    throw new Error(`Invalid currency code: ${currencyCode}. Must be 3 uppercase letters (ISO 4217).`);
  }

  // Check if currency is in whitelist
  if (!isSupportedCurrency(currencyCode)) {
    throw new Error(
      `Currency ${currencyCode} is not supported. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`
    );
  }

  // PLN doesn't need conversion
  if (currencyCode === 'PLN') {
    return 1.0;
  }

  // Check cache first
  const cached = getCachedRate(currencyCode);
  if (cached !== null) {
    console.log(`💾 [Currency Cache] Using cached ${currencyCode} rate: ${cached}`);
    return cached;
  }

  // Cache miss - fetch from NBP API
  console.log(`🌐 [NBP API] Fetching exchange rate for ${currencyCode}...`);

  try {
    const url = `${NBP_BASE_URL}/${currencyCode}/`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Currency ${currencyCode} not found in NBP database. Check if code is correct.`);
      }
      throw new Error(`NBP API error: ${response.status} ${response.statusText}`);
    }

    const data: NBPExchangeRateResponse = await response.json();

    // Extract rate from response
    if (!data.rates || data.rates.length === 0) {
      throw new Error(`No exchange rate data returned for ${currencyCode}`);
    }

    const rate = data.rates[0].mid;
    console.log(`✅ [NBP API] Fetched ${currencyCode} rate: ${rate} PLN (effective: ${data.rates[0].effectiveDate})`);

    // Store in cache
    setCachedRate(currencyCode, rate);

    return rate;

  } catch (error) {
    console.error(`❌ [NBP API] Error fetching ${currencyCode} rate:`, error);
    throw error;
  }
}

/**
 * Get cached exchange rate if valid
 *
 * @param currencyCode - Currency code
 * @returns Rate if cached and not expired, null otherwise
 */
function getCachedRate(currencyCode: string): number | null {
  const cached = exchangeRateCache.get(currencyCode);

  if (!cached) {
    return null;
  }

  // Check if expired
  const now = Date.now();
  if (now >= cached.expiresAt) {
    console.log(`⚠️  [Currency Cache] ${currencyCode} rate expired, will refetch`);
    exchangeRateCache.delete(currencyCode);
    return null;
  }

  return cached.rate;
}

/**
 * Store exchange rate in cache with 24h TTL
 *
 * @param currencyCode - Currency code
 * @param rate - Exchange rate to PLN
 */
function setCachedRate(currencyCode: string, rate: number): void {
  const now = Date.now();
  const cached: CachedRate = {
    rate,
    fetchedAt: now,
    expiresAt: now + CACHE_TTL_MS,
  };

  exchangeRateCache.set(currencyCode, cached);
  console.log(`💾 [Currency Cache] Cached ${currencyCode} rate: ${rate} (expires in 24h)`);
}

/**
 * Clear all cached exchange rates
 * Useful for testing or manual refresh
 */
export function clearExchangeRateCache(): void {
  const size = exchangeRateCache.size;
  exchangeRateCache.clear();
  console.log(`🗑️  [Currency Cache] Cleared ${size} cached rates`);
}

/**
 * Get cache statistics
 * Useful for monitoring and debugging
 */
export function getCacheStats(): { size: number; currencies: string[] } {
  return {
    size: exchangeRateCache.size,
    currencies: Array.from(exchangeRateCache.keys()),
  };
}
