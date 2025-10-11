// ==========================================
// Flight & Weather API (Mock Data)
// ==========================================

import type { FlightOffer, WeatherInfo, Destination, SearchFlightsInput, GetWeatherInput, GetDestinationsInput } from '../types/index.js';

/**
 * Mock destinations database
 */
const DESTINATIONS: Destination[] = [
  {
    city: 'Barcelona',
    country: 'Spain',
    code: 'BCN',
    description: 'Vibrant coastal city with stunning Gaudí architecture and Mediterranean beaches',
    highlights: ['Sagrada Familia', 'Park Güell', 'La Rambla', 'Gothic Quarter'],
    bestFor: ['culture', 'party', 'relaxation'],
    averageTemp: 22,
    estimatedBudget: 289,
  },
  {
    city: 'Prague',
    country: 'Czech Republic',
    code: 'PRG',
    description: 'Fairy-tale medieval city with stunning castle and historic charm',
    highlights: ['Prague Castle', 'Charles Bridge', 'Old Town Square', 'Astronomical Clock'],
    bestFor: ['culture', 'relaxation', 'party'],
    averageTemp: 15,
    estimatedBudget: 180,
  },
  {
    city: 'Lisbon',
    country: 'Portugal',
    code: 'LIS',
    description: 'Hilly coastal capital with colorful tiles, trams, and Atlantic beaches',
    highlights: ['Belém Tower', 'Jerónimos Monastery', 'Alfama District', 'Tram 28'],
    bestFor: ['culture', 'relaxation', 'adventure'],
    averageTemp: 20,
    estimatedBudget: 420,
  },
  {
    city: 'Budapest',
    country: 'Hungary',
    code: 'BUD',
    description: 'Danube-divided city famous for thermal baths and grand architecture',
    highlights: ['Parliament Building', 'Thermal Baths', 'Buda Castle', 'Ruin Bars'],
    bestFor: ['culture', 'relaxation', 'party'],
    averageTemp: 16,
    estimatedBudget: 210,
  },
  {
    city: 'Copenhagen',
    country: 'Denmark',
    code: 'CPH',
    description: 'Scandinavian design capital with cycling culture and waterfront charm',
    highlights: ['Nyhavn', 'Tivoli Gardens', 'Little Mermaid', 'Christiania'],
    bestFor: ['culture', 'nature', 'relaxation'],
    averageTemp: 12,
    estimatedBudget: 380,
  },
];

/**
 * Mock weather database
 */
const WEATHER_DATA: Record<string, WeatherInfo> = {
  BCN: {
    destination: 'Barcelona',
    temperature: 22,
    condition: 'Sunny',
    humidity: 65,
    forecast: 'Perfect beach weather with clear skies and gentle Mediterranean breeze',
  },
  PRG: {
    destination: 'Prague',
    temperature: 15,
    condition: 'Partly Cloudy',
    humidity: 55,
    forecast: 'Pleasant autumn weather, ideal for walking through historic streets',
  },
  LIS: {
    destination: 'Lisbon',
    temperature: 20,
    condition: 'Sunny',
    humidity: 70,
    forecast: 'Warm and sunny with occasional Atlantic breeze',
  },
  BUD: {
    destination: 'Budapest',
    temperature: 16,
    condition: 'Cloudy',
    humidity: 60,
    forecast: 'Mild weather, perfect for thermal baths and exploring the city',
  },
  CPH: {
    destination: 'Copenhagen',
    temperature: 12,
    condition: 'Partly Cloudy',
    humidity: 75,
    forecast: 'Cool and crisp Scandinavian weather, bring a light jacket',
  },
};

/**
 * Generate random flight dates (7-14 days from now)
 */
function generateFlightDates(departureDate?: string, returnDate?: string): { departure: string; return: string } {
  if (departureDate && returnDate) {
    return { departure: departureDate, return: returnDate };
  }

  const today = new Date();
  const daysOut = Math.floor(Math.random() * 7) + 7; // 7-14 days
  const tripLength = Math.floor(Math.random() * 5) + 3; // 3-7 days

  const departure = new Date(today);
  departure.setDate(today.getDate() + daysOut);

  const returnFlight = new Date(departure);
  returnFlight.setDate(departure.getDate() + tripLength);

  return {
    departure: departure.toISOString().split('T')[0],
    return: returnFlight.toISOString().split('T')[0],
  };
}

/**
 * Generate mock flight offer
 */
function createFlightOffer(destination: Destination, origin: string, dates: { departure: string; return: string }): FlightOffer {
  const airlines = ['Ryanair', 'Wizz Air', 'LOT Polish Airlines', 'Lufthansa', 'easyJet'];
  const randomAirline = airlines[Math.floor(Math.random() * airlines.length)];

  const hours = Math.floor(Math.random() * 3) + 2; // 2-4 hours
  const minutes = Math.floor(Math.random() * 6) * 10; // 0, 10, 20, 30, 40, 50
  const duration = `${hours}h ${minutes > 0 ? minutes + 'm' : ''}`.trim();

  const stops = Math.random() > 0.7 ? 1 : 0;

  return {
    id: `FL${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    destination: destination.city,
    destinationCode: destination.code,
    origin,
    price: destination.estimatedBudget,
    currency: 'PLN',
    departureDate: dates.departure,
    returnDate: dates.return,
    airline: randomAirline,
    duration,
    stops,
  };
}

/**
 * Search flights based on criteria
 */
export function searchFlights(input: SearchFlightsInput): FlightOffer[] {
  console.log('🔍 [FlightAPI] Searching flights with:', JSON.stringify(input, null, 2));

  const { budget, origin, preferences } = input;
  const { travelStyle, preferredDestinations } = preferences;

  // Filter destinations by budget
  let filteredDestinations = DESTINATIONS.filter(d => d.estimatedBudget <= budget);

  // Filter by travel style
  if (travelStyle && travelStyle !== 'any') {
    filteredDestinations = filteredDestinations.filter(d => d.bestFor.includes(travelStyle));
  }

  // Filter by preferred destinations if specified
  if (preferredDestinations && preferredDestinations.length > 0) {
    const preferred = filteredDestinations.filter(d =>
      preferredDestinations.some(pref => pref.toLowerCase() === d.city.toLowerCase())
    );
    if (preferred.length > 0) {
      filteredDestinations = preferred;
    }
  }

  // Generate flight dates
  const dates = generateFlightDates();

  // Create flight offers
  const flights = filteredDestinations.map(dest => createFlightOffer(dest, origin, dates));

  // Sort by price (cheapest first)
  flights.sort((a, b) => a.price - b.price);

  console.log(`✈️  [FlightAPI] Found ${flights.length} flights`);

  return flights;
}

/**
 * Get weather for a destination
 */
export function getWeather(input: GetWeatherInput): WeatherInfo | null {
  console.log(`☀️  [FlightAPI] Getting weather for: ${input.destinationCode}`);

  const weather = WEATHER_DATA[input.destinationCode.toUpperCase()];

  if (!weather) {
    console.log(`❌ [FlightAPI] Weather not found for: ${input.destinationCode}`);
    return null;
  }

  console.log(`✅ [FlightAPI] Weather: ${weather.temperature}°C, ${weather.condition}`);

  return weather;
}

/**
 * Get all available destinations
 */
export function getDestinations(input?: GetDestinationsInput): Destination[] {
  console.log('🌍 [FlightAPI] Getting destinations with:', JSON.stringify(input || {}, null, 2));

  let destinations = [...DESTINATIONS];

  // Filter by travel style
  if (input?.travelStyle) {
    destinations = destinations.filter(d => d.bestFor.includes(input.travelStyle!));
  }

  // Filter by max budget
  if (input?.maxBudget) {
    destinations = destinations.filter(d => d.estimatedBudget <= input.maxBudget!);
  }

  console.log(`✅ [FlightAPI] Found ${destinations.length} destinations`);

  return destinations;
}
