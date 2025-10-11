// ==========================================
// Flight Routes
// ==========================================

import { Router } from 'express';
import { searchFlights, listDestinations, getDestinationWeather } from '../controllers/flightController.js';

const router = Router();

/**
 * POST /api/flights/search
 * Search for flights using AI agent
 */
router.post('/flights/search', searchFlights);

/**
 * GET /api/destinations
 * Get list of available destinations
 */
router.get('/destinations', listDestinations);

/**
 * GET /api/weather/:destinationCode
 * Get weather for a specific destination
 */
router.get('/weather/:destinationCode', getDestinationWeather);

export default router;
