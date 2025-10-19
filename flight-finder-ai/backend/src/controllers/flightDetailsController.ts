// ==========================================
// Flight Details Controller
// Proxy endpoints for Amadeus flight details
// ==========================================

import type { Request, Response } from 'express';
import {
  fetchFlightOffersDetails,
  fetchFlightDates
} from '../services/amadeus/amadeusFlightService.js';
import { convertToPLN } from '../services/currency/currencyConversionUtils.js';
import type { ApiResponse } from '../types/index.js';

/**
 * GET /api/flights/details/offers
 * Fetch detailed flight offers from Amadeus URL
 * Query params: url (Amadeus flight offers URL)
 */
export async function getFlightOfferDetails(req: Request, res: Response): Promise<void> {
  try {
    const url = req.query.url as string;

    if (!url) {
      const response: ApiResponse = {
        success: false,
        error: 'URL parameter is required',
      };
      res.status(400).json(response);
      return;
    }

    // Validate URL is from Amadeus
    if (!url.includes('api.amadeus.com')) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid URL - must be from Amadeus API',
      };
      res.status(400).json(response);
      return;
    }

    console.log('✈️  [Controller] Fetching flight offer details');

    const data = await fetchFlightOffersDetails(url);

    // Convert prices to PLN
    const convertedData = {
      ...data,
      data: await Promise.all(
        data.data.map(async (offer) => {
          const originalCurrency = offer.price.currency;
          const originalPrice = parseFloat(offer.price.total);
          const priceInPLN = await convertToPLN(originalPrice, originalCurrency);

          return {
            ...offer,
            price: {
              total: priceInPLN.toFixed(2),
              currency: 'PLN',
              originalPrice: originalPrice,
              originalCurrency: originalCurrency,
            },
          };
        })
      ),
    };

    const response: ApiResponse = {
      success: true,
      data: convertedData,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('❌ [Controller] Error fetching flight offer details:', error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch flight details',
    };

    res.status(500).json(response);
  }
}

/**
 * GET /api/flights/details/dates
 * Fetch flexible date options from Amadeus URL
 * Query params: url (Amadeus flight dates URL)
 */
export async function getFlightDates(req: Request, res: Response): Promise<void> {
  try {
    const url = req.query.url as string;

    if (!url) {
      const response: ApiResponse = {
        success: false,
        error: 'URL parameter is required',
      };
      res.status(400).json(response);
      return;
    }

    // Validate URL is from Amadeus
    if (!url.includes('api.amadeus.com')) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid URL - must be from Amadeus API',
      };
      res.status(400).json(response);
      return;
    }

    console.log('📅 [Controller] Fetching flight dates');

    const data = await fetchFlightDates(url);

    // Detect currency from response (usually in meta or assume EUR)
    const originalCurrency = data.meta?.currency || 'EUR';

    // Convert prices to PLN
    const convertedData = {
      ...data,
      data: await Promise.all(
        data.data.map(async (dateOption) => {
          const originalPrice = parseFloat(dateOption.price.total);
          const priceInPLN = await convertToPLN(originalPrice, originalCurrency);

          return {
            ...dateOption,
            price: {
              total: priceInPLN.toFixed(2),
              currency: 'PLN',
              originalPrice: originalPrice,
              originalCurrency: originalCurrency,
            },
          };
        })
      ),
    };

    const response: ApiResponse = {
      success: true,
      data: convertedData,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('❌ [Controller] Error fetching flight dates:', error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch flight dates',
    };

    res.status(500).json(response);
  }
}
