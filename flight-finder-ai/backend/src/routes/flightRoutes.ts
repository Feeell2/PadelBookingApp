// ==========================================
// Flight Routes
// ==========================================

import { Router } from 'express';
import {
  searchFlights,
  listDestinations,
  getDestinationWeather,
  getWeatherForecast,
  getWeatherStatus
} from '../controllers/flightController.js';

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
 * GET /api/weather/status
 * Check weather service status (must be before :destinationCode routes)
 */
router.get('/weather/status', getWeatherStatus);

/**
 * GET /api/weather/forecast/:destinationCode
 * Get detailed weather forecast for destination
 */
router.get('/weather/forecast/:destinationCode', getWeatherForecast);

/**
 * GET /api/weather/:destinationCode
 * Get weather for a specific destination
 */
router.get('/weather/:destinationCode', getDestinationWeather);

export default router;
