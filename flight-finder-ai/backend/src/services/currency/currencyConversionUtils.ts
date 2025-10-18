// ==========================================
// Currency Conversion Utilities
// Bidirectional PLN ↔ Foreign Currency
// ==========================================

import { getExchangeRate } from './currencyService.js';

/**
 * Convert amount from foreign currency to PLN
 *
 * @param amount - Amount in foreign currency
 * @param fromCurrency - ISO 4217 currency code (e.g., "EUR", "USD")
 * @returns Amount in PLN (rounded to integer)
 * @throws {Error} If currency code is invalid or NBP API fails
 *
 * @example
 * await convertToPLN(100, 'EUR')  // Returns: 426 PLN (if rate is 4.26)
 * await convertToPLN(50, 'USD')   // Returns: 199 PLN (if rate is 3.98)
 * await convertToPLN(200, 'PLN')  // Returns: 200 PLN (no conversion)
 */
export async function convertToPLN(
  amount: number,
  fromCurrency: string
): Promise<number> {
  // Validation
  if (amount < 0) {
    throw new Error(`Amount cannot be negative: ${amount}`);
  }

  // No conversion needed for PLN
  if (fromCurrency === 'PLN') {
    return Math.round(amount);
  }

  // Get exchange rate (from cache or NBP API)
  const rate = await getExchangeRate(fromCurrency);

  // Convert: amount * rate = PLN
  // Example: 100 EUR × 4.2565 = 425.65 → 426 PLN
  const amountInPLN = amount * rate;
  const roundedAmount = Math.round(amountInPLN);

  console.log(`💱 [Conversion] ${amount} ${fromCurrency} → ${roundedAmount} PLN (rate: ${rate})`);

  return roundedAmount;
}

/**
 * Convert amount from PLN to foreign currency
 *
 * @param amount - Amount in PLN
 * @param toCurrency - ISO 4217 currency code (e.g., "EUR", "USD")
 * @returns Amount in foreign currency (rounded to 2 decimal places)
 * @throws {Error} If currency code is invalid or NBP API fails
 *
 * @example
 * await convertFromPLN(500, 'EUR')  // Returns: 117.48 EUR (if rate is 4.2565)
 * await convertFromPLN(400, 'USD')  // Returns: 100.31 USD (if rate is 3.9876)
 * await convertFromPLN(300, 'PLN')  // Returns: 300.00 PLN (no conversion)
 */
export async function convertFromPLN(
  amount: number,
  toCurrency: string
): Promise<number> {
  // Validation
  if (amount < 0) {
    throw new Error(`Amount cannot be negative: ${amount}`);
  }

  // No conversion needed for PLN
  if (toCurrency === 'PLN') {
    return parseFloat(amount.toFixed(2));
  }

  // Get exchange rate (from cache or NBP API)
  const rate = await getExchangeRate(toCurrency);

  // Convert: amount ÷ rate = Foreign Currency
  // Example: 500 PLN ÷ 4.2565 = 117.48 EUR
  const amountInForeignCurrency = amount / rate;
  const roundedAmount = parseFloat(amountInForeignCurrency.toFixed(2));

  console.log(`💱 [Conversion] ${amount} PLN → ${roundedAmount} ${toCurrency} (rate: ${rate})`);

  return roundedAmount;
}
