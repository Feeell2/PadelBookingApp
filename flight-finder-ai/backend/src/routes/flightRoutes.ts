// ==========================================
// Flight Routes
// ==========================================

import { Router } from 'express';
import { searchFlights } from '../controllers/flightController.js';
import {
  getFlightOfferDetails,
  getFlightDates
} from '../controllers/flightDetailsController.js';

const router = Router();

/**
 * POST /api/flights/search
 * Search for flights using AI agent
 */
router.post('/flights/search', searchFlights);

/**
 * GET /api/flights/details/offers
 * Fetch detailed flight offers from Amadeus URL
 */
router.get('/flights/details/offers', getFlightOfferDetails);

/**
 * GET /api/flights/details/dates
 * Fetch flexible date options from Amadeus URL
 */
router.get('/flights/details/dates', getFlightDates);

export default router;
