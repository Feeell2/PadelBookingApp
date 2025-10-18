// ==========================================
// Currency Types & Interfaces
// NBP API integration types
// ==========================================

/**
 * Supported currency codes from NBP API
 * Whitelist of popular currencies that NBP API supports
 */
export const SUPPORTED_CURRENCIES = [
  'EUR', // Euro
  'USD', // US Dollar
  'GBP', // British Pound
  'CHF', // Swiss Franc
  'AUD', // Australian Dollar
  'CAD', // Canadian Dollar
  'SEK', // Swedish Krona
  'NOK', // Norwegian Krone
  'DKK', // Danish Krone
  'JPY', // Japanese Yen
  'CZK', // Czech Koruna
  'HUF', // Hungarian Forint
  'PLN', // Polish Zloty (always 1.0)
] as const;

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

/**
 * NBP API Exchange Rate Response
 * Endpoint: https://api.nbp.pl/api/exchangerates/rates/a/{code}/
 *
 * @example
 * {
 *   "table": "A",
 *   "currency": "euro",
 *   "code": "EUR",
 *   "rates": [
 *     {
 *       "no": "202/A/NBP/2025",
 *       "effectiveDate": "2025-10-17",
 *       "mid": 4.2565
 *     }
 *   ]
 * }
 */
export interface NBPExchangeRateResponse {
  table: string;           // Exchange rate table ("A")
  currency: string;        // Full currency name ("euro")
  code: string;            // ISO 4217 code ("EUR")
  rates: Array<{
    no: string;            // Publication number
    effectiveDate: string; // Date YYYY-MM-DD
    mid: number;           // Middle rate to PLN
  }>;
}

/**
 * Cached Exchange Rate Entry
 * In-memory cache with 24h TTL
 */
export interface CachedRate {
  rate: number;            // Exchange rate to PLN (e.g., 4.2565 means 1 EUR = 4.2565 PLN)
  fetchedAt: number;       // Unix timestamp (ms) when rate was fetched
  expiresAt: number;       // Unix timestamp (ms) when cache expires (fetchedAt + 24h)
}
