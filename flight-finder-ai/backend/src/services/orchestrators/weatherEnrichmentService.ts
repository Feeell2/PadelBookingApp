// ==========================================
// Weather Enrichment Service
// Enriches flight offers with weather data
// ==========================================

import type { FlightOffer, WeatherData } from '../../types/flight.js';
import { weatherService } from '../weather/weatherService.js';
import { batchGetAirportLocations } from '../geocoding/openMeteoGeocodingService.js';

/**
 * Enrich flight offers with REAL weather data (Open-Meteo)
 * OPTIMIZED: Batch geocoding to reduce API calls
 * Fallback: Real API → No weather (graceful degradation)
 */
export async function enrichFlightsWithWeather(flights: FlightOffer[]): Promise<FlightOffer[]> {
  console.log(`\n🌤️  [Weather Enrichment] Enriching ${flights.length} flights with REAL weather (Open-Meteo)...`);

  if (flights.length === 0) {
    console.log(`✅ [Weather Enrichment] No flights to enrich`);
    return [];
  }

  // STEP 1: Batch geocode all unique destination codes (OPTIMIZATION)
  const destinationCodes = flights.map(f => f.destinationCode);
  let airportLocations: Map<string, any>;

  try {
    airportLocations = await batchGetAirportLocations(destinationCodes);
    console.log(`✅ [Weather Enrichment] Batch geocoding: ${airportLocations.size} locations fetched`);
  } catch (error: any) {
    console.error(`❌ [Weather Enrichment] Batch geocoding failed: ${error.message}`);
    // Return flights without weather (graceful degradation)
    return flights;
  }

  // STEP 2: Fetch weather for each flight using pre-fetched coordinates
  const enrichmentPromises = flights.map(async (flight) => {
    // Check if we have geocoding data
    const location = airportLocations.get(flight.destinationCode);

    if (!location) {
      console.warn(`⚠️  [Weather Enrichment] No geocoding data for ${flight.destinationCode}`);
      return flight; // Return without weather
    }

    try {
      // Fetch real weather from Open-Meteo
      const weatherResponse = await weatherService.getForecastWithLocation(
        location,
        flight.departureDate,
        7
      );

      // Convert WeatherForecast[] to simple WeatherData for backward compatibility
      const firstForecast = weatherResponse.forecasts[0];
      if (!firstForecast) {
        throw new Error('No forecast data');
      }

      const weatherData: WeatherData = {
        destination: flight.destination,
        destinationCode: flight.destinationCode,
        temperature: firstForecast.temperature.avg,
        condition: firstForecast.conditions.main,
        description: firstForecast.conditions.description,
        humidity: firstForecast.humidity,
        windSpeed: firstForecast.wind.speed,
        fetchedAt: new Date().toISOString(),
      };

      console.log(`✅ [Weather Enrichment] Real weather for ${flight.destinationCode}: ${weatherData.temperature}°C, ${weatherData.condition}`);
      return { ...flight, weatherData };

    } catch (error: any) {
      console.warn(`⚠️  [Weather Enrichment] Failed to fetch weather for ${flight.destinationCode}: ${error.message}`);
      // Return flight without weather (graceful degradation)
      return flight;
    }
  });

  const results = await Promise.allSettled(enrichmentPromises);

  const enrichedFlights = results
    .filter((result): result is PromiseFulfilledResult<FlightOffer> => result.status === 'fulfilled')
    .map(result => result.value);

  const successRate = (enrichedFlights.filter(f => f.weatherData).length / flights.length) * 100;
  console.log(`✅ [Weather Enrichment] Weather enrichment: ${successRate.toFixed(0)}% success rate`);

  return enrichedFlights;
}
