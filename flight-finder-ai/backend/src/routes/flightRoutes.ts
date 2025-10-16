// ==========================================
// Flight Routes
// ==========================================

import { Router } from 'express';
import { searchFlights } from '../controllers/flightController.js';

const router = Router();

/**
 * POST /api/flights/search
 * Search for flights using AI agent
 */
router.post('/flights/search', searchFlights);

export default router;
