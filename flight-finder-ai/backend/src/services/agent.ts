// ==========================================
// AI Agent with Amadeus API Integration
// ==========================================

import type { UserPreferences, AgentResponse } from '../types/index.js';
import { searchFlights, getWeather, getDestinations } from './flightAPI.js';
import { searchAmadeusFlights } from './amadeusAPI.js';

/**
 * Flight Agent with Amadeus API Integration
 * - Searches real flights via Amadeus Flight Offers Search API
 * - Falls back to mock data if Amadeus API fails
 * - Generates reasoning locally (no AI API calls)
 */
export async function runFlightAgent(preferences: UserPreferences): Promise<AgentResponse> {
  const startTime = Date.now();
  const toolsUsed: string[] = [];

  console.log('\n🤖 ========================================');
  console.log('🤖 Starting AI Flight Agent');
  console.log('🤖 ========================================');
  console.log('📋 User Preferences:', JSON.stringify(preferences, null, 2));

  // Tool 1: Search real flights via Amadeus API (with fallback to mock)
  let flights = [];

  // Calculate departure date (7 days from now)
  const departureDate = new Date();
  departureDate.setDate(departureDate.getDate() + 7);
  const departureDateStr = departureDate.toISOString().split('T')[0];

  // Try to get preferred destination, otherwise use popular ones
  const possibleDestinations = preferences.preferredDestinations && preferences.preferredDestinations.length > 0
    ? preferences.preferredDestinations.map(d => d.toUpperCase())
    : ['BCN', 'PRG', 'LIS', 'BUD', 'CPH'];

  // Try Amadeus API for first destination
  const targetDestination = possibleDestinations[0];

  console.log(`\n🔧 [Agent] Executing: search_real_flights`);
  console.log(`🎯 [Agent] Target: ${preferences.origin} → ${targetDestination} on ${departureDateStr}`);
  toolsUsed.push('search_real_flights');

  try {
    const realFlights = await searchAmadeusFlights(
      preferences.origin,
      targetDestination,
      departureDateStr,
      1, // adults
      5  // max results
    );

    if (realFlights.length > 0) {
      flights = realFlights;
      console.log(`✅ [Agent] Successfully retrieved ${flights.length} real flights from Amadeus API`);
    } else {
      throw new Error('No flights found in Amadeus response');
    }
  } catch (error: any) {
    console.log(`❌ [Agent] Amadeus API error: ${error.message}`);
    console.log(`🔄 [Agent] Falling back to mock data...`);

    // Fallback to mock data
    toolsUsed.push('search_flights_mock');
    flights = searchFlights({
      budget: preferences.budget,
      origin: preferences.origin,
      preferences: {
        travelStyle: preferences.travelStyle,
        weatherPreference: preferences.weatherPreference,
        preferredDestinations: preferences.preferredDestinations,
      },
    });
    console.log(`✅ [Agent] Using ${flights.length} mock flights`);
  }

  // Tool 2: Get weather for each flight (MOCK)
  const weatherInfo = [];
  if (flights.length > 0) {
    console.log('\n🔧 [Mock Agent] Executing: get_weather (for all destinations)');
    toolsUsed.push('get_weather');

    for (const flight of flights.slice(0, 3)) { // Max 3 weather checks
      const weather = getWeather({ destinationCode: flight.destinationCode });
      if (weather) {
        weatherInfo.push(weather);
      }
    }
  }

  // Generate MOCK reasoning (no AI needed)
  const reasoning = generateMockReasoning(preferences, flights, weatherInfo);

  const executionTime = Date.now() - startTime;

  console.log('\n✅ [Agent] Completed successfully');
  console.log(`⏱️  [Agent] Execution time: ${executionTime}ms`);
  console.log(`🔧 [Agent] Tools used: ${toolsUsed.join(', ')}`);
  console.log(`💰 [Agent] Amadeus API Cost: Check your Amadeus dashboard`);
  console.log('🤖 ========================================\n');

  return {
    recommendations: flights,
    reasoning,
    weatherInfo,
    executionTime,
    toolsUsed,
  };
}

/**
 * Generate mock reasoning based on search results (NO AI)
 */
function generateMockReasoning(
  preferences: UserPreferences,
  flights: any[],
  weatherInfo: any[]
): string {
  if (flights.length === 0) {
    return `Unfortunately, no flights were found within your budget of ${preferences.budget} PLN from ${preferences.origin}. Try increasing your budget or adjusting your travel preferences.`;
  }

  const topFlight = flights[0];
  const savings = preferences.budget - topFlight.price;

  let reasoning = `## ✈️ Flight Recommendations for Your ${preferences.travelStyle} Trip\n\n`;
  reasoning += `Based on your preferences (budget: ${preferences.budget} PLN, origin: ${preferences.origin}, style: ${preferences.travelStyle}, weather: ${preferences.weatherPreference}), `;
  reasoning += `I found **${flights.length} excellent option${flights.length > 1 ? 's' : ''}** for you.\n\n`;

  // Top recommendation
  reasoning += `### 🏆 Top Recommendation: ${topFlight.destination}\n\n`;
  reasoning += `**Flight Details:**\n`;
  reasoning += `- **Price:** ${topFlight.price} PLN (saves you ${savings} PLN!)\n`;
  reasoning += `- **Airline:** ${topFlight.airline}\n`;
  reasoning += `- **Duration:** ${topFlight.duration}\n`;
  reasoning += `- **Stops:** ${topFlight.stops === 0 ? 'Direct flight ✓' : `${topFlight.stops} stop(s)`}\n`;
  reasoning += `- **Dates:** ${topFlight.departureDate} → ${topFlight.returnDate}\n\n`;

  // Weather info
  const topWeather = weatherInfo.find(w => w.destination === topFlight.destination);
  if (topWeather) {
    reasoning += `**Weather Forecast:**\n`;
    reasoning += `- Temperature: ${topWeather.temperature}°C\n`;
    reasoning += `- Condition: ${topWeather.condition}\n`;
    reasoning += `- ${topWeather.forecast}\n\n`;
  }

  // Why this is great
  reasoning += `**Why ${topFlight.destination}?**\n`;
  if (preferences.travelStyle === 'culture') {
    reasoning += `- Perfect for culture enthusiasts with rich historical sites and museums\n`;
  } else if (preferences.travelStyle === 'adventure') {
    reasoning += `- Ideal for adventure seekers with exciting outdoor activities\n`;
  } else if (preferences.travelStyle === 'relaxation') {
    reasoning += `- Great for relaxation with peaceful atmosphere and comfortable amenities\n`;
  } else if (preferences.travelStyle === 'party') {
    reasoning += `- Excellent nightlife and vibrant party scene\n`;
  } else if (preferences.travelStyle === 'nature') {
    reasoning += `- Beautiful natural landscapes and outdoor experiences\n`;
  }
  reasoning += `- Well within your budget, leaving money for activities and dining\n`;
  if (topFlight.stops === 0) {
    reasoning += `- Direct flight means less travel time and hassle\n`;
  }
  reasoning += `\n`;

  // Alternative options
  if (flights.length > 1) {
    reasoning += `### 🌍 Alternative Options:\n\n`;
    for (let i = 1; i < Math.min(flights.length, 3); i++) {
      const alt = flights[i];
      reasoning += `**${i + 1}. ${alt.destination}** - ${alt.price} PLN (${alt.airline}, ${alt.duration})\n`;
    }
    reasoning += `\n`;
  }

  reasoning += `*💡 All prices in PLN. Book early for best availability!*`;

  return reasoning;
}
