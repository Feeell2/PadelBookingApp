// ==========================================
// Currency Service Unit Tests
// Tests for NBP API integration and caching
// ==========================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getExchangeRate, clearExchangeRateCache, getCacheStats } from '../currencyService.js';
import type { NBPExchangeRateResponse } from '../../../types/currency.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('currencyService', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearExchangeRateCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getExchangeRate', () => {
    it('should return 1.0 for PLN without API call', async () => {
      const rate = await getExchangeRate('PLN');

      expect(rate).toBe(1.0);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should fetch exchange rate from NBP API for valid currency', async () => {
      const mockResponse: NBPExchangeRateResponse = {
        table: 'A',
        currency: 'euro',
        code: 'EUR',
        rates: [
          {
            no: '202/A/NBP/2025',
            effectiveDate: '2025-10-17',
            mid: 4.2565,
          },
        ],
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const rate = await getExchangeRate('EUR');

      expect(rate).toBe(4.2565);
      expect(fetch).toHaveBeenCalledWith('https://api.nbp.pl/api/exchangerates/rates/a/EUR/');
    });

    it('should use cached rate on second request', async () => {
      const mockResponse: NBPExchangeRateResponse = {
        table: 'A',
        currency: 'euro',
        code: 'EUR',
        rates: [{ no: '202/A/NBP/2025', effectiveDate: '2025-10-17', mid: 4.2565 }],
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // First request - should fetch from API
      const rate1 = await getExchangeRate('EUR');
      expect(rate1).toBe(4.2565);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second request - should use cache
      const rate2 = await getExchangeRate('EUR');
      expect(rate2).toBe(4.2565);
      expect(fetch).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should throw error for invalid currency code format', async () => {
      await expect(getExchangeRate('INVALID')).rejects.toThrow(
        'Invalid currency code: INVALID. Must be 3 uppercase letters (ISO 4217).'
      );

      await expect(getExchangeRate('eu')).rejects.toThrow(
        'Invalid currency code: eu. Must be 3 uppercase letters (ISO 4217).'
      );

      await expect(getExchangeRate('12A')).rejects.toThrow(
        'Invalid currency code: 12A. Must be 3 uppercase letters (ISO 4217).'
      );

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should throw error for unsupported currency (not in whitelist)', async () => {
      await expect(getExchangeRate('XYZ')).rejects.toThrow(
        'Currency XYZ is not supported.'
      );

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should throw error when NBP API returns 404', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(getExchangeRate('EUR')).rejects.toThrow(
        'Currency EUR not found in NBP database. Check if code is correct.'
      );
    });

    it('should throw error when NBP API returns other error status', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(getExchangeRate('EUR')).rejects.toThrow(
        'NBP API error: 500 Internal Server Error'
      );
    });

    it('should throw error when NBP API returns empty rates array', async () => {
      const mockResponse: NBPExchangeRateResponse = {
        table: 'A',
        currency: 'euro',
        code: 'EUR',
        rates: [],
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(getExchangeRate('EUR')).rejects.toThrow(
        'No exchange rate data returned for EUR'
      );
    });

    it('should handle network errors gracefully', async () => {
      (fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(getExchangeRate('EUR')).rejects.toThrow('Network error');
    });

    it('should cache multiple currencies independently', async () => {
      const mockEURResponse: NBPExchangeRateResponse = {
        table: 'A',
        currency: 'euro',
        code: 'EUR',
        rates: [{ no: '202/A/NBP/2025', effectiveDate: '2025-10-17', mid: 4.2565 }],
      };

      const mockUSDResponse: NBPExchangeRateResponse = {
        table: 'A',
        currency: 'dolar amerykański',
        code: 'USD',
        rates: [{ no: '202/A/NBP/2025', effectiveDate: '2025-10-17', mid: 3.9876 }],
      };

      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEURResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockUSDResponse,
        });

      const eurRate = await getExchangeRate('EUR');
      const usdRate = await getExchangeRate('USD');

      expect(eurRate).toBe(4.2565);
      expect(usdRate).toBe(3.9876);
      expect(fetch).toHaveBeenCalledTimes(2);

      // Verify both are cached
      const stats = getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.currencies).toContain('EUR');
      expect(stats.currencies).toContain('USD');
    });
  });

  describe('clearExchangeRateCache', () => {
    it('should clear all cached rates', async () => {
      const mockResponse: NBPExchangeRateResponse = {
        table: 'A',
        currency: 'euro',
        code: 'EUR',
        rates: [{ no: '202/A/NBP/2025', effectiveDate: '2025-10-17', mid: 4.2565 }],
      };

      (fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // Cache EUR rate
      await getExchangeRate('EUR');
      expect(getCacheStats().size).toBe(1);

      // Clear cache
      clearExchangeRateCache();
      expect(getCacheStats().size).toBe(0);

      // Next call should fetch from API again
      await getExchangeRate('EUR');
      expect(fetch).toHaveBeenCalledTimes(2); // Called twice (before clear, after clear)
    });
  });

  describe('getCacheStats', () => {
    it('should return correct cache statistics', async () => {
      const mockEURResponse: NBPExchangeRateResponse = {
        table: 'A',
        currency: 'euro',
        code: 'EUR',
        rates: [{ no: '202/A/NBP/2025', effectiveDate: '2025-10-17', mid: 4.2565 }],
      };

      const mockGBPResponse: NBPExchangeRateResponse = {
        table: 'A',
        currency: 'funt szterling',
        code: 'GBP',
        rates: [{ no: '202/A/NBP/2025', effectiveDate: '2025-10-17', mid: 5.1234 }],
      };

      (fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEURResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockGBPResponse,
        });

      // Initially empty
      expect(getCacheStats()).toEqual({ size: 0, currencies: [] });

      // Cache EUR
      await getExchangeRate('EUR');
      expect(getCacheStats()).toEqual({ size: 1, currencies: ['EUR'] });

      // Cache GBP
      await getExchangeRate('GBP');
      const stats = getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.currencies).toContain('EUR');
      expect(stats.currencies).toContain('GBP');
    });
  });
});
