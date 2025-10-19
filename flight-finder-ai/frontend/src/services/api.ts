// ==========================================
// API Service - Axios Client
// ==========================================

import axios from 'axios';
import type {
  UserPreferences,
  AgentResponse,
  ApiResponse,
  FlightOfferDetail,
  FlightDateOption,
  FlightOffersDetailsResponse,
  FlightDatesResponse,
  FlightItinerary
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 seconds for AI agent processing
});

/**
 * Search for flights using AI agent
 */
export async function searchFlights(
  preferences: UserPreferences
): Promise<AgentResponse> {
  try {
    const response = await apiClient.post<ApiResponse<AgentResponse>>(
      '/api/flights/search',
      preferences
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to search flights');
    }

    return response.data.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message =
        error.response?.data?.error ||
        error.message ||
        'Network error occurred';
      throw new Error(message);
    }
    throw error;
  }
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await apiClient.get('/api/health');
    return response.data.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Fetch detailed flight offers from backend proxy
 */
export async function fetchFlightOfferDetails(
  url: string
): Promise<FlightOfferDetail[]> {
  try {
    const response = await apiClient.get<ApiResponse<FlightOffersDetailsResponse>>(
      '/api/flights/details/offers',
      {
        params: { url },
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch flight details');
    }

    // Transform API response to FlightOfferDetail format
    return transformFlightOffersResponse(response.data.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message =
        error.response?.data?.error ||
        error.message ||
        'Failed to fetch flight details';
      throw new Error(message);
    }
    throw error;
  }
}

/**
 * Fetch flexible date options from backend proxy
 */
export async function fetchFlightDates(
  url: string
): Promise<FlightDateOption[]> {
  try {
    const response = await apiClient.get<ApiResponse<FlightDatesResponse>>(
      '/api/flights/details/dates',
      {
        params: { url },
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch flight dates');
    }

    // Transform API response to FlightDateOption format
    return response.data.data.data.map((dateOption) => ({
      departureDate: dateOption.departureDate,
      returnDate: dateOption.returnDate,
      price: parseFloat(dateOption.price.total),
      currency: dateOption.price.currency,
      originalPrice: dateOption.price.originalPrice,
      originalCurrency: dateOption.price.originalCurrency,
    }));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message =
        error.response?.data?.error ||
        error.message ||
        'Failed to fetch flight dates';
      throw new Error(message);
    }
    throw error;
  }
}

/**
 * Transform Amadeus flight offers response to our format
 */
function transformFlightOffersResponse(
  response: FlightOffersDetailsResponse
): FlightOfferDetail[] {
  return response.data.map((offer) => {
    const outbound = transformItinerary(offer.itineraries[0]);
    const inbound = offer.itineraries[1]
      ? transformItinerary(offer.itineraries[1])
      : undefined;

    return {
      id: offer.id,
      price: parseFloat(offer.price.total),
      currency: offer.price.currency,
      originalPrice: offer.price.originalPrice,
      originalCurrency: offer.price.originalCurrency,
      outbound,
      inbound,
    };
  });
}

/**
 * Transform single itinerary from API format
 */
function transformItinerary(itinerary: any): FlightItinerary {
  const segments = itinerary.segments.map((seg: any) => ({
    departureTime: seg.departure.at,
    departureAirport: seg.departure.iataCode,
    departureTerminal: seg.departure.terminal,
    arrivalTime: seg.arrival.at,
    arrivalAirport: seg.arrival.iataCode,
    arrivalTerminal: seg.arrival.terminal,
    airline: getAirlineName(seg.carrierCode),
    airlineCode: seg.carrierCode,
    flightNumber: `${seg.carrierCode}${seg.number}`,
    duration: seg.duration,
    aircraft: seg.aircraft.code,
  }));

  return {
    segments,
    totalDuration: itinerary.duration,
    stops: segments.length - 1,
  };
}

/**
 * Get airline name from IATA code
 */
function getAirlineName(code: string): string {
  const airlines: Record<string, string> = {
    LO: 'LOT Polish Airlines',
    FR: 'Ryanair',
    W6: 'Wizz Air',
    LH: 'Lufthansa',
    U2: 'easyJet',
    BA: 'British Airways',
    KL: 'KLM',
    AF: 'Air France',
    LX: 'Swiss',
    OS: 'Austrian Airlines',
    SK: 'SAS',
    AY: 'Finnair',
    IB: 'Iberia',
    VY: 'Vueling',
    TP: 'TAP Portugal',
  };

  return airlines[code] || code;
}
