// ==========================================
// Weather Routes
// ==========================================

import { Router } from 'express';
import {
  getWeatherForecast,
  getWeatherStatus
} from '../controllers/weatherController.js';

const router = Router();

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

export default router;
