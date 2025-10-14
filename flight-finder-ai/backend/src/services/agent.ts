// ==========================================
// AI Agent with Amadeus API Integration
// ==========================================

import type { UserPreferences, AgentResponse, FlightOffer, WeatherData } from '../types/index.js';
import { searchFlights, getWeather } from './flightAPI.js';
import { searchFlightInspiration } from './amadeusAPI.js';

/**
 * Flight Agent with Amadeus Inspiration API Integration
 * - Searches flight destinations via Amadeus Flight Inspiration Search API
 * - Enriches results with real-time weather data
 * - Filters and ranks destinations by user preferences
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

  // Tool 1: Search flight inspiration via Amadeus API (with fallback to mock)
  let flights: FlightOffer[] = [];

  // Calculate departure date and trip duration
  const departureDate = preferences.departureDate || (() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  })();

  const tripDuration = calculatePreferredDuration(preferences);

  console.log(`\n🔧 [Agent] Executing: search_flight_inspiration`);
  console.log(`🎯 [Agent] Origin: ${preferences.origin}, Budget: ${preferences.budget} PLN, Duration: ${tripDuration} days`);
  toolsUsed.push('search_flight_inspiration');

  try {
    const inspirationResults = await searchFlightInspiration({
      origin: preferences.origin,
      departureDate,
      oneWay: false,
      duration: tripDuration,
      maxPrice: preferences.budget,
      viewBy: 'DESTINATION',
    });

    if (inspirationResults.length > 0) {
      flights = inspirationResults;
      console.log(`✅ [Agent] Successfully retrieved ${flights.length} destinations from Amadeus Inspiration API`);

      // Enrich with weather data
      toolsUsed.push('enrich_weather');
      flights = await enrichWithWeather(flights);

      // Filter and rank by user preferences
      toolsUsed.push('filter_and_rank');
      flights = filterAndRankInspirationResults(flights, preferences);

      console.log(`✅ [Agent] Final selection: ${flights.length} ranked flights`);
    } else {
      throw new Error('No destinations found in Amadeus Inspiration response');
    }
  } catch (error: any) {
    console.log(`❌ [Agent] Amadeus Inspiration API error: ${error.message}`);
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

    // Enrich mock flights with weather
    toolsUsed.push('enrich_weather');
    flights = await enrichWithWeather(flights);

    // Filter and rank mock flights by user preferences
    toolsUsed.push('filter_and_rank');
    flights = filterAndRankInspirationResults(flights, preferences);
  }

  // Tool 2: Get weather for each flight (LEGACY FALLBACK)
  const weatherInfo = [];
  if (flights.length > 0 && !flights[0]?.weatherData) {
    console.log('\n🔧 [Legacy Agent] Executing: get_weather (fallback for destinations without weatherData)');
    toolsUsed.push('get_weather_legacy');

    for (const flight of flights.slice(0, 3)) { // Max 3 weather checks
      const weather = getWeather({ destinationCode: flight.destinationCode });
      if (weather) {
        weatherInfo.push(weather);
      }
    }
  }

  // Generate reasoning based on data source
  const reasoning = flights[0]?.weatherData
    ? generateInspirationReasoning(flights, preferences)
    : generateMockReasoning(preferences, flights, weatherInfo);

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

/**
 * Calculate preferred trip duration from user preferences
 */
function calculatePreferredDuration(preferences: UserPreferences): number {
  // If user provided specific dates, calculate duration
  if (preferences.departureDate && preferences.returnDate) {
    const departure = new Date(preferences.departureDate);
    const returnDate = new Date(preferences.returnDate);
    const durationMs = returnDate.getTime() - departure.getTime();
    const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

    // Clamp to Amadeus API limits (1-15 days)
    return Math.max(1, Math.min(15, durationDays));
  }

  // Default durations by travel style
  const durationByStyle: Record<string, number> = {
    'adventure': 10,
    'relaxation': 7,
    'culture': 5,
    'party': 4,
    'nature': 8,
  };

  return durationByStyle[preferences.travelStyle] || 7;
}

/**
 * Enrich flight offers with real-time weather data
 */
async function enrichWithWeather(flights: FlightOffer[]): Promise<FlightOffer[]> {
  console.log(`\n🌤️  [Agent] Enriching ${flights.length} flights with weather data...`);

  const enrichmentPromises = flights.map(async (flight) => {
    try {
      // For now, convert mock weather to WeatherData format
      const mockWeather = getWeather({ destinationCode: flight.destinationCode });

      if (!mockWeather) {
        return flight;
      }

      const weatherData: WeatherData = {
        destination: flight.destination,
        destinationCode: flight.destinationCode,
        temperature: mockWeather.temperature,
        condition: mockWeather.condition,
        description: mockWeather.forecast,
        humidity: mockWeather.humidity,
        fetchedAt: new Date().toISOString(),
      };

      return {
        ...flight,
        weatherData,
      };
    } catch (error: any) {
      console.log(`⚠️  [Agent] Failed to fetch weather for ${flight.destinationCode}: ${error.message}`);
      return flight;
    }
  });

  const results = await Promise.allSettled(enrichmentPromises);

  const enrichedFlights = results
    .filter((result): result is PromiseFulfilledResult<FlightOffer> => result.status === 'fulfilled')
    .map(result => result.value);

  const successRate = (enrichedFlights.filter(f => f.weatherData).length / flights.length) * 100;
  console.log(`✅ [Agent] Weather enrichment: ${successRate.toFixed(0)}% success rate`);

  return enrichedFlights;
}

/**
 * Check if destination matches travel style preference
 */
function matchesTravelStyle(destination: string, style: string): boolean {
  const styleMapping: Record<string, string[]> = {
    'culture': ['Prague', 'Budapest', 'Lisbon', 'Barcelona'],
    'party': ['Barcelona', 'Budapest', 'Lisbon'],
    'relaxation': ['Barcelona', 'Lisbon', 'Copenhagen'],
    'adventure': ['Lisbon', 'Copenhagen'],
    'nature': ['Copenhagen', 'Lisbon'],
  };

  const preferredDestinations = styleMapping[style] || [];
  return preferredDestinations.includes(destination);
}

/**
 * Check if weather matches user preference
 */
function matchesWeatherPreference(weatherData: WeatherData | undefined, preference: string): boolean {
  if (preference === 'any' || !weatherData) {
    return true;
  }

  const temp = weatherData.temperature;

  switch (preference) {
    case 'hot':
      return temp > 25;
    case 'mild':
      return temp >= 15 && temp <= 25;
    case 'cold':
      return temp < 15;
    default:
      return true;
  }
}

/**
 * Filter and rank inspiration results based on user preferences
 */
function filterAndRankInspirationResults(
  flights: FlightOffer[],
  preferences: UserPreferences
): FlightOffer[] {
  console.log(`\n🎯 [Agent] Ranking ${flights.length} flights by preferences...`);

  const rankedFlights = flights.map(flight => {
    let score = 0;

    // Travel style match (+10 points)
    if (matchesTravelStyle(flight.destination, preferences.travelStyle)) {
      score += 10;
    }

    // Weather preference match (+5 points)
    if (matchesWeatherPreference(flight.weatherData, preferences.weatherPreference)) {
      score += 5;
    }

    // Budget efficiency (+5 for <50%, +3 for <80%)
    const budgetRatio = flight.price / preferences.budget;
    if (budgetRatio < 0.5) {
      score += 5;
    } else if (budgetRatio < 0.8) {
      score += 3;
    }

    // Preferred destinations (+15 points)
    if (preferences.preferredDestinations?.some(
      pref => pref.toLowerCase() === flight.destination.toLowerCase()
    )) {
      score += 15;
    }

    // Direct flights preferred (+3 points)
    if (flight.stops === 0) {
      score += 3;
    }

    return { flight, score };
  });

  // Sort by score (descending)
  rankedFlights.sort((a, b) => b.score - a.score);

  const topFlights = rankedFlights.slice(0, 10).map(item => item.flight);

  console.log(`✅ [Agent] Top ranked flight: ${topFlights[0]?.destination} (score: ${rankedFlights[0]?.score})`);

  return topFlights;
}

/**
 * Generate reasoning for inspiration-based results
 */
function generateInspirationReasoning(
  flights: FlightOffer[],
  preferences: UserPreferences
): string {
  if (flights.length === 0) {
    return `Unfortunately, no destinations were found within your budget of ${preferences.budget} PLN from ${preferences.origin}. Try increasing your budget or adjusting your travel preferences.`;
  }

  const topFlight = flights[0];
  const savings = preferences.budget - topFlight.price;
  const savingsPercent = ((savings / preferences.budget) * 100).toFixed(0);

  let reasoning = `## ✈️ Personalized Travel Recommendations\n\n`;
  reasoning += `Based on your preferences (budget: ${preferences.budget} PLN, origin: ${preferences.origin}, style: ${preferences.travelStyle}, weather: ${preferences.weatherPreference}), `;
  reasoning += `I discovered **${flights.length} amazing destination${flights.length > 1 ? 's' : ''}** perfect for you.\n\n`;

  // Top recommendation
  reasoning += `### 🏆 Best Match: ${topFlight.destination}\n\n`;
  reasoning += `**Flight Details:**\n`;
  reasoning += `- **Price:** ${topFlight.price} PLN (saves you ${savings} PLN / ${savingsPercent}% under budget!)\n`;
  reasoning += `- **Airline:** ${topFlight.airline}\n`;
  reasoning += `- **Duration:** ${topFlight.duration}\n`;
  reasoning += `- **Stops:** ${topFlight.stops === 0 ? 'Direct flight ✓' : `${topFlight.stops} stop(s)`}\n`;
  reasoning += `- **Dates:** ${topFlight.departureDate} → ${topFlight.returnDate}\n\n`;

  // Weather info
  if (topFlight.weatherData) {
    reasoning += `**Weather Forecast:**\n`;
    reasoning += `- Temperature: ${topFlight.weatherData.temperature}°C\n`;
    reasoning += `- Condition: ${topFlight.weatherData.condition}\n`;
    reasoning += `- ${topFlight.weatherData.description}\n\n`;
  }

  // Why this destination
  reasoning += `**Why ${topFlight.destination}?**\n`;
  if (matchesTravelStyle(topFlight.destination, preferences.travelStyle)) {
    reasoning += `- ✓ Perfect match for ${preferences.travelStyle} enthusiasts\n`;
  }
  if (topFlight.weatherData && matchesWeatherPreference(topFlight.weatherData, preferences.weatherPreference)) {
    reasoning += `- ✓ Weather matches your ${preferences.weatherPreference} preference\n`;
  }
  reasoning += `- ✓ Excellent value - ${savingsPercent}% under your budget\n`;
  if (topFlight.stops === 0) {
    reasoning += `- ✓ Direct flight for maximum convenience\n`;
  }
  reasoning += `\n`;

  // Alternative options
  if (flights.length > 1) {
    reasoning += `### 🌍 Other Great Options:\n\n`;
    for (let i = 1; i < Math.min(flights.length, 4); i++) {
      const alt = flights[i];
      const altSavings = preferences.budget - alt.price;
      reasoning += `**${i + 1}. ${alt.destination}** - ${alt.price} PLN (saves ${altSavings} PLN)\n`;
      if (alt.weatherData) {
        reasoning += `   Weather: ${alt.weatherData.temperature}°C, ${alt.weatherData.condition}\n`;
      }
    }
    reasoning += `\n`;
  }

  reasoning += `*💡 Prices in PLN. Weather data updated in real-time. Book early!*`;

  return reasoning;
}
