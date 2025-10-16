// ==========================================
// Weather Controller
// Weather forecast endpoints
// ==========================================

import type { Request, Response } from 'express';
import type { ApiResponse } from '../types/index.js';
import { weatherService } from '../services/weather/weatherService.js';

/**
 * GET /api/weather/forecast/:destinationCode
 * Get weather forecast for destination
 */
export async function getWeatherForecast(req: Request, res: Response): Promise<void> {
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
    console.error('❌ [Weather Controller] Weather forecast error:', error);
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
export async function getWeatherStatus(req: Request, res: Response): Promise<void> {
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
    console.error('❌ [Weather Controller] Status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    });
  }
}
