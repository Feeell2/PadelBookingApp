// ==========================================
// Flight Controller
// ==========================================

import type { Request, Response } from 'express';
import { runFlightAgent } from '../services/orchestrators/flightRecommendationOrchestrator.js';
import type { UserPreferences, ApiResponse } from '../types/index.js';

/**
 * Validate date parameters
 *
 * @param departureDate - Departure date string (YYYY-MM-DD)
 * @param returnDate - Return date string (YYYY-MM-DD)
 * @returns Validation result with error message if invalid
 */
function validateDates(
  departureDate: any,
  returnDate: any
): { valid: boolean; error?: string } {
  // 1. Check if dates are provided (REQUIRED)
  if (!departureDate || typeof departureDate !== 'string') {
    return { valid: false, error: 'Departure date is required (format: YYYY-MM-DD)' };
  }

  if (!returnDate || typeof returnDate !== 'string') {
    return { valid: false, error: 'Return date is required (format: YYYY-MM-DD)' };
  }

  // 2. Validate format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(departureDate)) {
    return { valid: false, error: 'Invalid departure date format. Use YYYY-MM-DD' };
  }

  if (!dateRegex.test(returnDate)) {
    return { valid: false, error: 'Invalid return date format. Use YYYY-MM-DD' };
  }

  // 3. Parse dates
  const departure = new Date(departureDate);
  const returnD = new Date(returnDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if dates are valid
  if (isNaN(departure.getTime())) {
    return { valid: false, error: 'Invalid departure date' };
  }

  if (isNaN(returnD.getTime())) {
    return { valid: false, error: 'Invalid return date' };
  }

  // 4. Check if departure is in the future (at least tomorrow)
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (departure < tomorrow) {
    return { valid: false, error: 'Departure date must be at least tomorrow' };
  }

  // 5. Check if departure is within 330 days (Amadeus API limit)
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 330);

  if (departure > maxDate) {
    return { valid: false, error: 'Departure date cannot be more than 330 days in the future' };
  }

  // 6. Check if return is after departure
  if (returnD <= departure) {
    return { valid: false, error: 'Return date must be after departure date' };
  }

  // 7. Check trip length (minimum 1 day, maximum 30 days)
  const tripDays = Math.ceil(
    (returnD.getTime() - departure.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (tripDays < 1) {
    return { valid: false, error: 'Trip must be at least 1 day long' };
  }

  if (tripDays > 30) {
    return { valid: false, error: 'Trip cannot be longer than 30 days' };
  }

  return { valid: true };
}

/**
 * Validate user preferences
 */
function validateUserPreferences(body: any): { valid: boolean; error?: string } {
  if (!body.budget || typeof body.budget !== 'number' || body.budget <= 0) {
    return { valid: false, error: 'Budget must be a positive number' };
  }

  if (!body.origin || typeof body.origin !== 'string') {
    return { valid: false, error: 'Origin airport code is required' };
  }

  const validTravelStyles = ['adventure', 'relaxation', 'culture', 'party', 'nature'];
  if (!body.travelStyle || !validTravelStyles.includes(body.travelStyle)) {
    return { valid: false, error: `Travel style must be one of: ${validTravelStyles.join(', ')}` };
  }

  // Validate dates (REQUIRED)
  const dateValidation = validateDates(body.departureDate, body.returnDate);
  if (!dateValidation.valid) {
    return dateValidation;
  }

  // Validate flexibleDates (optional, but must be boolean if provided)
  if (body.flexibleDates !== undefined && typeof body.flexibleDates !== 'boolean') {
    return { valid: false, error: 'flexibleDates must be a boolean' };
  }

  return { valid: true };
}

/**
 * POST /api/flights/search
 * Search for flights using AI agent
 */
export async function searchFlights(req: Request, res: Response): Promise<void> {
  try {
    console.log('\n📥 [Controller] Received flight search request');
    console.log('📋 [Controller] Request body:', JSON.stringify(req.body, null, 2));

    // Validate request
    const validation = validateUserPreferences(req.body);
    if (!validation.valid) {
      const response: ApiResponse = {
        success: false,
        error: validation.error,
        details: {
          field: 'preferences',
          message: validation.error,
        },
      };
      res.status(400).json(response);
      return;
    }

    const preferences: UserPreferences = {
      budget: req.body.budget,
      origin: req.body.origin,
      travelStyle: req.body.travelStyle,
      preferredDestinations: req.body.preferredDestinations,
      departureDate: req.body.departureDate,        // Now required
      returnDate: req.body.returnDate,              // Now required
      flexibleDates: req.body.flexibleDates || false, // New field
    };

    // Run AI agent
    console.log('🚀 [Controller] Starting AI agent...');
    const agentResponse = await runFlightAgent(preferences);
    console.log('✅ [Controller] AI agent completed successfully');

    const response: ApiResponse = {
      success: true,
      data: agentResponse,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('❌ [Controller] Error in searchFlights:', error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      details: {
        type: 'agent_error',
        message: 'Failed to process flight search with AI agent',
      },
    };

    res.status(500).json(response);
  }
}

