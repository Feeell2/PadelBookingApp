// ==========================================
// Currency Conversion Utils Unit Tests
// Tests for PLN ↔ Foreign Currency conversion
// ==========================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convertToPLN, convertFromPLN } from '../currencyConversionUtils.js';
import * as currencyService from '../currencyService.js';

// Mock currencyService module
vi.mock('../currencyService.js', () => ({
  getExchangeRate: vi.fn(),
}));

describe('currencyConversionUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('convertToPLN', () => {
    it('should convert EUR to PLN correctly', async () => {
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      const result = await convertToPLN(100, 'EUR');

      expect(result).toBe(426); // 100 * 4.2565 = 425.65 → 426 (rounded)
      expect(currencyService.getExchangeRate).toHaveBeenCalledWith('EUR');
    });

    it('should convert USD to PLN correctly', async () => {
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(3.9876);

      const result = await convertToPLN(50, 'USD');

      expect(result).toBe(199); // 50 * 3.9876 = 199.38 → 199 (rounded)
      expect(currencyService.getExchangeRate).toHaveBeenCalledWith('USD');
    });

    it('should return same amount for PLN without API call', async () => {
      const result = await convertToPLN(200, 'PLN');

      expect(result).toBe(200);
      expect(currencyService.getExchangeRate).not.toHaveBeenCalled();
    });

    it('should round to nearest integer', async () => {
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.0);

      // Test rounding down
      const result1 = await convertToPLN(10.3, 'EUR');
      expect(result1).toBe(41); // 10.3 * 4.0 = 41.2 → 41

      // Test rounding up
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.0);
      const result2 = await convertToPLN(10.7, 'EUR');
      expect(result2).toBe(43); // 10.7 * 4.0 = 42.8 → 43
    });

    it('should handle zero amount', async () => {
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      const result = await convertToPLN(0, 'EUR');

      expect(result).toBe(0);
    });

    it('should throw error for negative amount', async () => {
      await expect(convertToPLN(-100, 'EUR')).rejects.toThrow(
        'Amount cannot be negative: -100'
      );

      expect(currencyService.getExchangeRate).not.toHaveBeenCalled();
    });

    it('should propagate errors from getExchangeRate', async () => {
      vi.mocked(currencyService.getExchangeRate).mockRejectedValue(
        new Error('NBP API error: 500 Internal Server Error')
      );

      await expect(convertToPLN(100, 'EUR')).rejects.toThrow(
        'NBP API error: 500 Internal Server Error'
      );
    });

    it('should handle very small amounts', async () => {
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      const result = await convertToPLN(0.01, 'EUR');

      expect(result).toBe(0); // 0.01 * 4.2565 = 0.042565 → 0 (rounded)
    });

    it('should handle very large amounts', async () => {
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      const result = await convertToPLN(1000000, 'EUR');

      expect(result).toBe(4256500); // 1000000 * 4.2565 = 4256500
    });
  });

  describe('convertFromPLN', () => {
    it('should convert PLN to EUR correctly', async () => {
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      const result = await convertFromPLN(500, 'EUR');

      expect(result).toBe(117.47); // 500 / 4.2565 = 117.477... → 117.47 (rounds down)
      expect(currencyService.getExchangeRate).toHaveBeenCalledWith('EUR');
    });

    it('should convert PLN to USD correctly', async () => {
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(3.9876);

      const result = await convertFromPLN(400, 'USD');

      expect(result).toBe(100.31); // 400 / 3.9876 = 100.310... → 100.31
      expect(currencyService.getExchangeRate).toHaveBeenCalledWith('USD');
    });

    it('should return same amount for PLN without API call', async () => {
      const result = await convertFromPLN(300, 'PLN');

      expect(result).toBe(300.0);
      expect(currencyService.getExchangeRate).not.toHaveBeenCalled();
    });

    it('should round to 2 decimal places', async () => {
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(3.0);

      const result = await convertFromPLN(10, 'EUR');

      expect(result).toBe(3.33); // 10 / 3.0 = 3.333... → 3.33
    });

    it('should handle zero amount', async () => {
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      const result = await convertFromPLN(0, 'EUR');

      expect(result).toBe(0.0);
    });

    it('should throw error for negative amount', async () => {
      await expect(convertFromPLN(-500, 'EUR')).rejects.toThrow(
        'Amount cannot be negative: -500'
      );

      expect(currencyService.getExchangeRate).not.toHaveBeenCalled();
    });

    it('should propagate errors from getExchangeRate', async () => {
      vi.mocked(currencyService.getExchangeRate).mockRejectedValue(
        new Error('Currency EUR not found in NBP database.')
      );

      await expect(convertFromPLN(500, 'EUR')).rejects.toThrow(
        'Currency EUR not found in NBP database.'
      );
    });

    it('should handle very small PLN amounts', async () => {
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      const result = await convertFromPLN(1, 'EUR');

      expect(result).toBe(0.23); // 1 / 4.2565 = 0.2349... → 0.23
    });

    it('should handle very large PLN amounts', async () => {
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      const result = await convertFromPLN(1000000, 'EUR');

      expect(result).toBe(234934.81); // 1000000 / 4.2565 = 234934.8106... → 234934.81
    });

    it('should handle precise rounding at boundary', async () => {
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.0);

      // Test rounding at .005 boundary
      const result1 = await convertFromPLN(10.02, 'EUR');
      expect(result1).toBe(2.5); // 10.02 / 4.0 = 2.505 → 2.50 (JavaScript .toFixed rounds banker's rounding)

      const result2 = await convertFromPLN(10.00, 'EUR');
      expect(result2).toBe(2.5); // 10.00 / 4.0 = 2.500 → 2.50
    });
  });

  describe('integration scenarios', () => {
    it('should handle bidirectional conversion maintaining consistency', async () => {
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.0);

      // Convert 100 EUR to PLN
      const pln = await convertToPLN(100, 'EUR');
      expect(pln).toBe(400);

      // Convert back to EUR
      const eur = await convertFromPLN(400, 'EUR');
      expect(eur).toBe(100.0);
    });

    it('should handle multiple currencies in sequence', async () => {
      // Mock EUR rate
      vi.mocked(currencyService.getExchangeRate).mockResolvedValueOnce(4.2565);
      const plnFromEur = await convertToPLN(100, 'EUR');
      expect(plnFromEur).toBe(426);

      // Mock USD rate
      vi.mocked(currencyService.getExchangeRate).mockResolvedValueOnce(3.9876);
      const plnFromUsd = await convertToPLN(100, 'USD');
      expect(plnFromUsd).toBe(399);

      // Mock GBP rate
      vi.mocked(currencyService.getExchangeRate).mockResolvedValueOnce(5.1234);
      const plnFromGbp = await convertToPLN(100, 'GBP');
      expect(plnFromGbp).toBe(512);

      expect(currencyService.getExchangeRate).toHaveBeenCalledTimes(3);
    });
  });
});
