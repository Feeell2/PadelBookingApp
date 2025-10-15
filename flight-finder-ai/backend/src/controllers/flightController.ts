// ==========================================
// Flight Controller
// ==========================================

import type { Request, Response } from 'express';
import { runFlightAgent } from '../services/agent.js';
import { getWeather, getDestinations } from '../services/flightAPI.js';
import type { UserPreferences, ApiResponse } from '../types/index.js';
import { weatherService } from '../services/weather/WeatherService.js';

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

  const validWeatherPreferences = ['hot', 'mild', 'cold', 'any'];
  if (!body.weatherPreference || !validWeatherPreferences.includes(body.weatherPreference)) {
    return { valid: false, error: `Weather preference must be one of: ${validWeatherPreferences.join(', ')}` };
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
      weatherPreference: req.body.weatherPreference,
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

/**
 * GET /api/destinations
 * Get list of available destinations
 */
export async function listDestinations(req: Request, res: Response): Promise<void> {
  try {
    console.log('\n📥 [Controller] Received destinations request');

    const travelStyle = req.query.travelStyle as string | undefined;
    const maxBudget = req.query.maxBudget ? parseInt(req.query.maxBudget as string) : undefined;

    const destinations = getDestinations({
      travelStyle,
      maxBudget,
    });

    const response: ApiResponse = {
      success: true,
      data: destinations,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('❌ [Controller] Error in listDestinations:', error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    };

    res.status(500).json(response);
  }
}

/**
 * GET /api/weather/:destinationCode
 * Get weather for a specific destination
 */
export async function getDestinationWeather(req: Request, res: Response): Promise<void> {
  try {
    console.log('\n📥 [Controller] Received weather request');

    const { destinationCode } = req.params;

    if (!destinationCode) {
      const response: ApiResponse = {
        success: false,
        error: 'Destination code is required',
      };
      res.status(400).json(response);
      return;
    }

    const weather = getWeather({ destinationCode });

    if (!weather) {
      const response: ApiResponse = {
        success: false,
        error: `Weather information not found for destination: ${destinationCode}`,
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: weather,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('❌ [Controller] Error in getDestinationWeather:', error);

    const response: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    };

    res.status(500).json(response);
  }
}

/**
 * GET /api/weather/forecast/:destinationCode
 * Get weather forecast for destination
 */
export async function getWeatherForecast(req: any, res: any): Promise<void> {
  try {
    const { destinationCode } = req.params;
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const days = parseInt((req.query.days as string) || '7');

    if (!destinationCode || destinationCode.length !== 3) {
      res.status(400).json({
        success: false,
        error: 'Invalid IATA code (must be 3 letters)',
      });
      return;
    }

    if (days < 1 || days > 14) {
      res.status(400).json({
        success: false,
        error: 'Days must be between 1 and 14',
      });
      return;
    }

    const forecast = await weatherService.getForecastByIATA(
      destinationCode.toUpperCase(),
      date,
      days
    );

    res.status(200).json({
      success: true,
      data: forecast,
    });

  } catch (error) {
    console.error('❌ [Controller] Weather error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch weather',
    });
  }
}

/**
 * GET /api/weather/status
 * Check weather service status
 */
export async function getWeatherStatus(req: any, res: any): Promise<void> {
  try {
    const health = await weatherService.checkProviderHealth();

    res.status(200).json({
      success: true,
      data: {
        provider: {
          name: health.name,
          status: health.available ? 'available' : 'unavailable',
        },
      },
    });

  } catch (error) {
    console.error('❌ [Controller] Status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    });
  }
}
