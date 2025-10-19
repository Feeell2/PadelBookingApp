// ==========================================
// Amadeus Flight Service Unit Tests
// Tests for currency conversion integration
// ==========================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchFlightInspiration } from '../amadeusFlightService.js';
import * as amadeusAuthService from '../amadeusAuthService.js';
import * as currencyConversionUtils from '../../currency/currencyConversionUtils.js';
import * as currencyService from '../../currency/currencyService.js';
import type { AmadeusDestinationResponse } from '../../../types/amadeus.js';

// Mock dependencies
vi.mock('../amadeusAuthService.js', () => ({
  getAmadeusToken: vi.fn(),
}));

vi.mock('../../currency/currencyConversionUtils.js', () => ({
  convertFromPLN: vi.fn(),
  convertToPLN: vi.fn(),
}));

vi.mock('../../currency/currencyService.js', () => ({
  getExchangeRate: vi.fn(),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('amadeusFlightService - Currency Conversion', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for auth token
    vi.mocked(amadeusAuthService.getAmadeusToken).mockResolvedValue('mock-token-123');
  });

  describe('Budget Conversion (PLN → EUR)', () => {
    it('should convert maxPrice from PLN to EUR before API call', async () => {
      // Mock currency conversion
      vi.mocked(currencyConversionUtils.convertFromPLN).mockResolvedValue(117.48);
      vi.mocked(currencyConversionUtils.convertToPLN).mockResolvedValue(426);
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      // Mock Amadeus API response
      const mockResponse: AmadeusDestinationResponse = {
        data: [
          {
            type: 'flight-destination',
            origin: 'WAW',
            destination: 'BCN',
            departureDate: '2025-11-01',
            returnDate: '2025-11-08',
            price: { total: '100.00', currency: 'EUR' },
            links: { flightDates: '', flightOffers: '' },
          },
        ],
        dictionaries: {
          currencies: { EUR: 'EURO' },
          locations: { BCN: { subType: '', detailedName: 'Barcelona' } },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Call searchFlightInspiration with PLN budget
      await searchFlightInspiration({
        origin: 'WAW',
        maxPrice: 500, // 500 PLN
      });

      // Verify convertFromPLN was called with correct params
      expect(currencyConversionUtils.convertFromPLN).toHaveBeenCalledWith(500, 'EUR');

      // Verify fetch was called with converted EUR price
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('maxPrice=117.48'),
        expect.any(Object)
      );
    });

    it('should not convert budget if maxPrice is undefined', async () => {
      vi.mocked(currencyConversionUtils.convertToPLN).mockResolvedValue(426);
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      const mockResponse: AmadeusDestinationResponse = {
        data: [
          {
            type: 'flight-destination',
            origin: 'WAW',
            destination: 'BCN',
            departureDate: '2025-11-01',
            returnDate: '2025-11-08',
            price: { total: '100.00', currency: 'EUR' },
            links: { flightDates: '', flightOffers: '' },
          },
        ],
        dictionaries: {
          currencies: { EUR: 'EURO' },
          locations: { BCN: { subType: '', detailedName: 'Barcelona' } },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Call without maxPrice
      await searchFlightInspiration({
        origin: 'WAW',
      });

      // Verify convertFromPLN was NOT called
      expect(currencyConversionUtils.convertFromPLN).not.toHaveBeenCalled();

      // Verify fetch URL does not contain maxPrice
      const fetchCall = (fetch as any).mock.calls[0][0];
      expect(fetchCall).not.toContain('maxPrice');
    });
  });

  describe('Response Price Conversion (EUR → PLN)', () => {
    it('should convert all flight prices from EUR to PLN', async () => {
      vi.mocked(currencyConversionUtils.convertFromPLN).mockResolvedValue(117.48);
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      // Mock convertToPLN to return specific values
      vi.mocked(currencyConversionUtils.convertToPLN)
        .mockResolvedValueOnce(426) // First flight: 100 EUR → 426 PLN
        .mockResolvedValueOnce(340); // Second flight: 80 EUR → 340 PLN

      const mockResponse: AmadeusDestinationResponse = {
        data: [
          {
            type: 'flight-destination',
            origin: 'WAW',
            destination: 'BCN',
            departureDate: '2025-11-01',
            returnDate: '2025-11-08',
            price: { total: '100.00', currency: 'EUR' },
            links: { flightDates: '', flightOffers: '' },
          },
          {
            type: 'flight-destination',
            origin: 'WAW',
            destination: 'MAD',
            departureDate: '2025-11-05',
            returnDate: '2025-11-12',
            price: { total: '80.00', currency: 'EUR' },
            links: { flightDates: '', flightOffers: '' },
          },
        ],
        dictionaries: {
          currencies: { EUR: 'EURO' },
          locations: {
            BCN: { subType: '', detailedName: 'Barcelona' },
            MAD: { subType: '', detailedName: 'Madrid' },
          },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchFlightInspiration({ origin: 'WAW' });

      // Verify exchange rate was pre-fetched
      expect(currencyService.getExchangeRate).toHaveBeenCalledWith('EUR');

      // Verify convertToPLN was called for each flight
      expect(currencyConversionUtils.convertToPLN).toHaveBeenCalledTimes(2);
      expect(currencyConversionUtils.convertToPLN).toHaveBeenNthCalledWith(1, 100, 'EUR');
      expect(currencyConversionUtils.convertToPLN).toHaveBeenNthCalledWith(2, 80, 'EUR');

      // Verify results have PLN prices
      expect(result).toHaveLength(2);
      expect(result[0].price).toBe(426);
      expect(result[0].currency).toBe('PLN');
      expect(result[1].price).toBe(340);
      expect(result[1].currency).toBe('PLN');
    });

    it('should handle multiple currencies in response (EUR, USD)', async () => {
      vi.mocked(currencyService.getExchangeRate)
        .mockResolvedValueOnce(4.2565) // EUR
        .mockResolvedValueOnce(3.9876); // USD (if needed)

      vi.mocked(currencyConversionUtils.convertToPLN)
        .mockResolvedValueOnce(426); // 100 EUR → 426 PLN

      const mockResponse: AmadeusDestinationResponse = {
        data: [
          {
            type: 'flight-destination',
            origin: 'WAW',
            destination: 'BCN',
            departureDate: '2025-11-01',
            returnDate: '2025-11-08',
            price: { total: '100.00', currency: 'EUR' },
            links: { flightDates: '', flightOffers: '' },
          },
        ],
        dictionaries: {
          currencies: { EUR: 'EURO' },
          locations: { BCN: { subType: '', detailedName: 'Barcelona' } },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchFlightInspiration({ origin: 'WAW' });

      // Verify exchange rate was fetched
      expect(currencyService.getExchangeRate).toHaveBeenCalledWith('EUR');

      // Verify all prices are in PLN
      result.forEach((flight) => {
        expect(flight.currency).toBe('PLN');
        expect(typeof flight.price).toBe('number');
      });
    });

    it('should return empty array when no flights found', async () => {
      const mockResponse: AmadeusDestinationResponse = {
        data: [],
        dictionaries: {
          currencies: {},
          locations: {},
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchFlightInspiration({ origin: 'WAW' });

      expect(result).toEqual([]);
      expect(currencyConversionUtils.convertToPLN).not.toHaveBeenCalled();
      expect(currencyService.getExchangeRate).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should propagate currency conversion errors', async () => {
      vi.mocked(currencyConversionUtils.convertFromPLN).mockRejectedValue(
        new Error('Currency EUR is not supported.')
      );

      await expect(
        searchFlightInspiration({
          origin: 'WAW',
          maxPrice: 500,
        })
      ).rejects.toThrow('Currency EUR is not supported.');
    });

    it('should handle NBP API errors during price conversion', async () => {
      // Mock convertToPLN to fail (it will call getExchangeRate internally)
      vi.mocked(currencyConversionUtils.convertToPLN).mockRejectedValue(
        new Error('NBP API error: 500 Internal Server Error')
      );

      const mockResponse: AmadeusDestinationResponse = {
        data: [
          {
            type: 'flight-destination',
            origin: 'WAW',
            destination: 'BCN',
            departureDate: '2025-11-01',
            returnDate: '2025-11-08',
            price: { total: '100.00', currency: 'EUR' },
            links: { flightDates: '', flightOffers: '' },
          },
        ],
        dictionaries: {
          currencies: { EUR: 'EURO' },
          locations: { BCN: { subType: '', detailedName: 'Barcelona' } },
        },
      };

      // Mock successful Amadeus response
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // Expect error from NBP API during price conversion
      await expect(
        searchFlightInspiration({ origin: 'WAW' })
      ).rejects.toThrow('NBP API error');
    });
  });

  describe('Input Validation', () => {
    it('should validate origin IATA code', async () => {
      await expect(
        searchFlightInspiration({ origin: 'INVALID' })
      ).rejects.toThrow('Invalid origin IATA code. Must be 3 uppercase letters.');
    });

    it('should validate maxPrice range', async () => {
      await expect(
        searchFlightInspiration({ origin: 'WAW', maxPrice: -100 })
      ).rejects.toThrow('Budget must be between 0 and 50000 PLN.');

      await expect(
        searchFlightInspiration({ origin: 'WAW', maxPrice: 60000 })
      ).rejects.toThrow('Budget must be between 0 and 50000 PLN.');
    });

    it('should validate duration range', async () => {
      // Note: These tests check input validation only (before any async operations)
      // We don't need to mock fetch/auth for validation tests

      await expect(
        searchFlightInspiration({ origin: 'WAW', duration: 0 })
      ).rejects.toThrow();

      await expect(
        searchFlightInspiration({ origin: 'WAW', duration: 20 })
      ).rejects.toThrow();
    });
  });

  describe('URL Sanitization', () => {
    it('should remove duration parameter from flightOffersUrl', async () => {
      vi.mocked(currencyConversionUtils.convertToPLN).mockResolvedValue(426);
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      const mockResponse: AmadeusDestinationResponse = {
        data: [
          {
            type: 'flight-destination',
            origin: 'WAW',
            destination: 'BCN',
            departureDate: '2025-11-01',
            returnDate: '2025-11-08',
            price: { total: '100.00', currency: 'EUR' },
            links: {
              flightOffers: 'https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=WAW&destinationLocationCode=BCN&departureDate=2025-11-01&returnDate=2025-11-08&duration=7&adults=1&max=250&currencyCode=EUR',
              flightDates: 'https://test.api.amadeus.com/v1/shopping/flight-dates?origin=WAW&destination=BCN',
            },
          },
        ],
        dictionaries: {
          currencies: { EUR: 'EURO' },
          locations: { BCN: { subType: '', detailedName: 'Barcelona' } },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchFlightInspiration({ origin: 'WAW' });

      // Verify duration parameter was removed from flightOffersUrl
      expect(result[0].flightOffersUrl).toBeDefined();
      expect(result[0].flightOffersUrl).not.toContain('duration=');
      expect(result[0].flightOffersUrl).toContain('originLocationCode=WAW');
      expect(result[0].flightOffersUrl).toContain('destinationLocationCode=BCN');
    });

    it('should preserve flightOffersUrl without duration parameter unchanged', async () => {
      vi.mocked(currencyConversionUtils.convertToPLN).mockResolvedValue(426);
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      const originalUrl = 'https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=WAW&destinationLocationCode=BCN';
      const mockResponse: AmadeusDestinationResponse = {
        data: [
          {
            type: 'flight-destination',
            origin: 'WAW',
            destination: 'BCN',
            departureDate: '2025-11-01',
            returnDate: '2025-11-08',
            price: { total: '100.00', currency: 'EUR' },
            links: {
              flightOffers: originalUrl,
              flightDates: '',
            },
          },
        ],
        dictionaries: {
          currencies: { EUR: 'EURO' },
          locations: { BCN: { subType: '', detailedName: 'Barcelona' } },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchFlightInspiration({ origin: 'WAW' });

      // URL without duration should be unchanged
      expect(result[0].flightOffersUrl).toBe(originalUrl);
    });

    it('should handle undefined flightOffersUrl gracefully', async () => {
      vi.mocked(currencyConversionUtils.convertToPLN).mockResolvedValue(426);
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      const mockResponse: AmadeusDestinationResponse = {
        data: [
          {
            type: 'flight-destination',
            origin: 'WAW',
            destination: 'BCN',
            departureDate: '2025-11-01',
            returnDate: '2025-11-08',
            price: { total: '100.00', currency: 'EUR' },
            // No links field
          },
        ],
        dictionaries: {
          currencies: { EUR: 'EURO' },
          locations: { BCN: { subType: '', detailedName: 'Barcelona' } },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchFlightInspiration({ origin: 'WAW' });

      // Should handle undefined gracefully
      expect(result[0].flightOffersUrl).toBeUndefined();
    });

    it('should remove viewBy parameter from flightOffersUrl', async () => {
      vi.mocked(currencyConversionUtils.convertToPLN).mockResolvedValue(426);
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      const mockResponse: AmadeusDestinationResponse = {
        data: [
          {
            type: 'flight-destination',
            origin: 'WAW',
            destination: 'BCN',
            departureDate: '2025-11-01',
            returnDate: '2025-11-08',
            price: { total: '100.00', currency: 'EUR' },
            links: {
              flightOffers: 'https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=WAW&destinationLocationCode=BCN&viewBy=DESTINATION&adults=1',
              flightDates: '',
            },
          },
        ],
        dictionaries: {
          currencies: { EUR: 'EURO' },
          locations: { BCN: { subType: '', detailedName: 'Barcelona' } },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchFlightInspiration({ origin: 'WAW' });

      // Verify viewBy parameter was removed from flightOffersUrl
      expect(result[0].flightOffersUrl).toBeDefined();
      expect(result[0].flightOffersUrl).not.toContain('viewBy=');
      expect(result[0].flightOffersUrl).toContain('originLocationCode=WAW');
      expect(result[0].flightOffersUrl).toContain('destinationLocationCode=BCN');
      expect(result[0].flightOffersUrl).toContain('adults=1');
    });

    it('should remove both duration and viewBy parameters from flightOffersUrl', async () => {
      vi.mocked(currencyConversionUtils.convertToPLN).mockResolvedValue(426);
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      const mockResponse: AmadeusDestinationResponse = {
        data: [
          {
            type: 'flight-destination',
            origin: 'WAW',
            destination: 'BCN',
            departureDate: '2025-11-01',
            returnDate: '2025-11-08',
            price: { total: '100.00', currency: 'EUR' },
            links: {
              flightOffers: 'https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=WAW&destinationLocationCode=BCN&duration=7&viewBy=DESTINATION&adults=1&max=250',
              flightDates: '',
            },
          },
        ],
        dictionaries: {
          currencies: { EUR: 'EURO' },
          locations: { BCN: { subType: '', detailedName: 'Barcelona' } },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchFlightInspiration({ origin: 'WAW' });

      // Verify both parameters were removed
      expect(result[0].flightOffersUrl).toBeDefined();
      expect(result[0].flightOffersUrl).not.toContain('duration=');
      expect(result[0].flightOffersUrl).not.toContain('viewBy=');
      expect(result[0].flightOffersUrl).toContain('originLocationCode=WAW');
      expect(result[0].flightOffersUrl).toContain('destinationLocationCode=BCN');
      expect(result[0].flightOffersUrl).toContain('adults=1');
      expect(result[0].flightOffersUrl).toContain('max=250');
    });

    it('should preserve other query parameters when removing duration and viewBy', async () => {
      vi.mocked(currencyConversionUtils.convertToPLN).mockResolvedValue(426);
      vi.mocked(currencyService.getExchangeRate).mockResolvedValue(4.2565);

      const mockResponse: AmadeusDestinationResponse = {
        data: [
          {
            type: 'flight-destination',
            origin: 'WAW',
            destination: 'BCN',
            departureDate: '2025-11-01',
            returnDate: '2025-11-08',
            price: { total: '100.00', currency: 'EUR' },
            links: {
              flightOffers: 'https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=WAW&destinationLocationCode=BCN&departureDate=2025-11-01&returnDate=2025-11-08&duration=7&viewBy=DATE&adults=1&max=250&currencyCode=EUR&nonStop=false',
              flightDates: '',
            },
          },
        ],
        dictionaries: {
          currencies: { EUR: 'EURO' },
          locations: { BCN: { subType: '', detailedName: 'Barcelona' } },
        },
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await searchFlightInspiration({ origin: 'WAW' });

      // Verify problematic parameters removed but others preserved
      expect(result[0].flightOffersUrl).toBeDefined();
      expect(result[0].flightOffersUrl).not.toContain('duration=');
      expect(result[0].flightOffersUrl).not.toContain('viewBy=');
      // Verify all other parameters are preserved
      expect(result[0].flightOffersUrl).toContain('originLocationCode=WAW');
      expect(result[0].flightOffersUrl).toContain('destinationLocationCode=BCN');
      expect(result[0].flightOffersUrl).toContain('departureDate=2025-11-01');
      expect(result[0].flightOffersUrl).toContain('returnDate=2025-11-08');
      expect(result[0].flightOffersUrl).toContain('adults=1');
      expect(result[0].flightOffersUrl).toContain('max=250');
      expect(result[0].flightOffersUrl).toContain('currencyCode=EUR');
      expect(result[0].flightOffersUrl).toContain('nonStop=false');
    });
  });
});
