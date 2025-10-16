// ==========================================
// Flight Controller
// ==========================================

import type { Request, Response } from 'express';
import { runFlightAgent } from '../services/orchestrators/flightRecommendationOrchestrator.js';
import type { UserPreferences, ApiResponse } from '../types/index.js';

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
      departureDate: req.body.departureDate,
      returnDate: req.body.returnDate,
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

