// ==========================================
// Flight Controller Date Validation Tests
// Tests for date validation in flight search
// ==========================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import httpMocks from 'node-mocks-http';
import { searchFlights } from '../flightController.js';
import * as orchestrator from '../../services/orchestrators/flightRecommendationOrchestrator.js';

// Mock the orchestrator
vi.mock('../../services/orchestrators/flightRecommendationOrchestrator.js', () => ({
  runFlightAgent: vi.fn(),
}));

describe('flightController - Date Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBody = {
    budget: 500,
    origin: 'WAW',
    travelStyle: 'culture',
  };

  describe('Missing Dates', () => {
    it('should reject request without departure date', async () => {
      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          returnDate: '2025-12-01',
          // departureDate missing
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(400);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Departure date is required');
    });

    it('should reject request without return date', async () => {
      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: '2025-11-01',
          // returnDate missing
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(400);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Return date is required');
    });

    it('should reject request with both dates missing', async () => {
      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: validBody,
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(400);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Departure date is required');
    });
  });

  describe('Invalid Date Format', () => {
    it('should reject invalid departure date format', async () => {
      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: '2025/11/01', // Wrong format
          returnDate: '2025-12-01',
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(400);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid departure date format');
    });

    it('should reject invalid return date format', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: tomorrowStr,
          returnDate: '12-01-2025', // Wrong format
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(400);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid return date format');
    });

    it('should reject non-string date values', async () => {
      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: 20251101, // Number instead of string
          returnDate: '2025-12-01',
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(400);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Departure date is required');
    });
  });

  describe('Date Range Validation', () => {
    it('should reject past departure date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: yesterdayStr,
          returnDate: '2025-12-01',
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(400);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
      expect(data.error).toContain('must be at least tomorrow');
    });

    it('should reject today as departure date', async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: todayStr,
          returnDate: tomorrowStr,
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(400);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
      expect(data.error).toContain('must be at least tomorrow');
    });

    it('should reject return date before departure', async () => {
      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: '2025-12-01',
          returnDate: '2025-11-25', // Before departure
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(400);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Return date must be after departure');
    });

    it('should reject return date same as departure', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 5); // Use +5 to be sure it's in future
      tomorrow.setHours(0, 0, 0, 0);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: tomorrowStr,
          returnDate: tomorrowStr, // Same as departure
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(400);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Return date must be after departure');
    });
  });

  describe('Trip Length Validation', () => {
    it('should accept trip exactly 1 day long', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 5);
      tomorrow.setHours(0, 0, 0, 0);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      // Mock the orchestrator
      vi.mocked(orchestrator.runFlightAgent).mockResolvedValue({
        recommendations: [],
        reasoning: 'Test',
        alternatives: [],
        executionTime: 0,
        toolsUsed: [],
      });

      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: tomorrow.toISOString().split('T')[0],
          returnDate: dayAfter.toISOString().split('T')[0], // 1 day trip
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      // 1 day is minimum and should be valid
      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
    });

    it('should reject trip longer than 30 days', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 5);
      tomorrow.setHours(0, 0, 0, 0);
      const wayTooLate = new Date(tomorrow);
      wayTooLate.setDate(wayTooLate.getDate() + 31);

      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: tomorrow.toISOString().split('T')[0],
          returnDate: wayTooLate.toISOString().split('T')[0],
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(400);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
      expect(data.error).toContain('cannot be longer than 30 days');
    });

    it('should accept trip exactly 30 days long', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 5);
      tomorrow.setHours(0, 0, 0, 0);
      const thirtyDaysLater = new Date(tomorrow);
      thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

      // Mock the orchestrator to return success
      vi.mocked(orchestrator.runFlightAgent).mockResolvedValue({
        recommendations: [],
        reasoning: 'Test',
        alternatives: [],
        executionTime: 0,
        toolsUsed: [],
      });

      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: tomorrow.toISOString().split('T')[0],
          returnDate: thirtyDaysLater.toISOString().split('T')[0],
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
    });
  });

  describe('Amadeus API Limits', () => {
    it('should reject departure > 330 days in future', async () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 331);
      const evenFurther = new Date(farFuture);
      evenFurther.setDate(evenFurther.getDate() + 7);

      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: farFuture.toISOString().split('T')[0],
          returnDate: evenFurther.toISOString().split('T')[0],
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(400);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
      expect(data.error).toContain('cannot be more than 330 days');
    });

    it('should accept departure exactly 330 days in future', async () => {
      const maxFuture = new Date();
      maxFuture.setDate(maxFuture.getDate() + 330);
      const returnDate = new Date(maxFuture);
      returnDate.setDate(returnDate.getDate() + 7);

      // Mock the orchestrator
      vi.mocked(orchestrator.runFlightAgent).mockResolvedValue({
        recommendations: [],
        reasoning: 'Test',
        alternatives: [],
        executionTime: 0,
        toolsUsed: [],
      });

      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: maxFuture.toISOString().split('T')[0],
          returnDate: returnDate.toISOString().split('T')[0],
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
    });
  });

  describe('Valid Dates', () => {
    it('should accept valid dates', async () => {
      const departure = new Date();
      departure.setDate(departure.getDate() + 14);
      const returnDate = new Date(departure);
      returnDate.setDate(returnDate.getDate() + 7);

      // Mock the orchestrator
      vi.mocked(orchestrator.runFlightAgent).mockResolvedValue({
        recommendations: [],
        reasoning: 'Test reasoning',
        alternatives: [],
        executionTime: 100,
        toolsUsed: ['searchFlightInspiration'],
      });

      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: departure.toISOString().split('T')[0],
          returnDate: returnDate.toISOString().split('T')[0],
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });
  });

  describe('Flexible Dates Parameter', () => {
    it('should accept flexibleDates flag as true', async () => {
      const departure = new Date();
      departure.setDate(departure.getDate() + 14);
      const returnDate = new Date(departure);
      returnDate.setDate(returnDate.getDate() + 7);

      // Mock the orchestrator
      vi.mocked(orchestrator.runFlightAgent).mockResolvedValue({
        recommendations: [],
        reasoning: 'Test',
        alternatives: [],
        executionTime: 0,
        toolsUsed: [],
      });

      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: departure.toISOString().split('T')[0],
          returnDate: returnDate.toISOString().split('T')[0],
          flexibleDates: true,
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
    });

    it('should accept flexibleDates flag as false', async () => {
      const departure = new Date();
      departure.setDate(departure.getDate() + 14);
      const returnDate = new Date(departure);
      returnDate.setDate(returnDate.getDate() + 7);

      // Mock the orchestrator
      vi.mocked(orchestrator.runFlightAgent).mockResolvedValue({
        recommendations: [],
        reasoning: 'Test',
        alternatives: [],
        executionTime: 0,
        toolsUsed: [],
      });

      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: departure.toISOString().split('T')[0],
          returnDate: returnDate.toISOString().split('T')[0],
          flexibleDates: false,
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(200);
      const data = res._getJSONData();
      expect(data.success).toBe(true);
    });

    it('should reject non-boolean flexibleDates value', async () => {
      const departure = new Date();
      departure.setDate(departure.getDate() + 14);
      const returnDate = new Date(departure);
      returnDate.setDate(returnDate.getDate() + 7);

      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: departure.toISOString().split('T')[0],
          returnDate: returnDate.toISOString().split('T')[0],
          flexibleDates: 'yes', // Should be boolean
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(400);
      const data = res._getJSONData();
      expect(data.success).toBe(false);
      expect(data.error).toContain('flexibleDates must be a boolean');
    });

    it('should default flexibleDates to false if not provided', async () => {
      const departure = new Date();
      departure.setDate(departure.getDate() + 14);
      const returnDate = new Date(departure);
      returnDate.setDate(returnDate.getDate() + 7);

      // Mock the orchestrator and check what preferences it receives
      const mockRunFlightAgent = vi.mocked(orchestrator.runFlightAgent);
      mockRunFlightAgent.mockResolvedValue({
        recommendations: [],
        reasoning: 'Test',
        alternatives: [],
        executionTime: 0,
        toolsUsed: [],
      });

      const req = httpMocks.createRequest({
        method: 'POST',
        url: '/api/flights/search',
        body: {
          ...validBody,
          departureDate: departure.toISOString().split('T')[0],
          returnDate: returnDate.toISOString().split('T')[0],
          // flexibleDates not provided
        },
      });
      const res = httpMocks.createResponse();

      await searchFlights(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockRunFlightAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          flexibleDates: false, // Should default to false
        })
      );
    });
  });
});
