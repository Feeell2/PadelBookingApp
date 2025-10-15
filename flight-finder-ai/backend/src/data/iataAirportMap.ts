/**
 * ==========================================
 * IATA Airport Code to City Name Mapping
 * ==========================================
 *
 * Purpose: Convert IATA codes to searchable city names for Open-Meteo Geocoding API
 * Maintenance: Add new airports as needed
 * Fallback: If unmapped, will try IATA code itself as search term
 * Source: https://en.wikipedia.org/wiki/List_of_airports_by_IATA_code
 */

/**
 * IATA → City Name mapping
 */
export const IATA_AIRPORT_MAP: Record<string, string> = {
  // Europe - Major Hubs
  'BCN': 'Barcelona',
  'WAW': 'Warsaw',
  'PRG': 'Prague',
  'LIS': 'Lisbon',
  'BUD': 'Budapest',
  'CPH': 'Copenhagen',
  'MAD': 'Madrid',
  'ROM': 'Rome',
  'FCO': 'Rome',        // Fiumicino
  'CIA': 'Rome',        // Ciampino
  'LHR': 'London',
  'LGW': 'London',      // Gatwick
  'STN': 'London',      // Stansted
  'LTN': 'London',      // Luton
  'LCY': 'London',      // City Airport
  'CDG': 'Paris',
  'ORY': 'Paris',       // Orly
  'AMS': 'Amsterdam',
  'BER': 'Berlin',
  'TXL': 'Berlin',      // Tegel (closed but may appear in data)
  'SXF': 'Berlin',      // Schönefeld
  'MUC': 'Munich',
  'VIE': 'Vienna',
  'ZRH': 'Zurich',
  'DUB': 'Dublin',
  'ATH': 'Athens',
  'IST': 'Istanbul',
  'OSL': 'Oslo',
  'STO': 'Stockholm',
  'ARN': 'Stockholm',   // Arlanda
  'HEL': 'Helsinki',
  'EDI': 'Edinburgh',
  'GLA': 'Glasgow',
  'MAN': 'Manchester',
  'BHX': 'Birmingham',
  'BRU': 'Brussels',
  'VIL': 'Vilnius',
  'VNO': 'Vilnius',
  'RIX': 'Riga',
  'TLL': 'Tallinn',
  'KRK': 'Krakow',
  'GDN': 'Gdansk',
  'WRO': 'Wroclaw',
  'BTS': 'Bratislava',
  'LJU': 'Ljubljana',
  'ZAG': 'Zagreb',
  'BEG': 'Belgrade',
  'SOF': 'Sofia',
  'OTP': 'Bucharest',

  // North America - Major Airports
  'JFK': 'New York',
  'LGA': 'New York',    // LaGuardia
  'EWR': 'Newark',
  'LAX': 'Los Angeles',
  'ORD': 'Chicago',
  'SFO': 'San Francisco',
  'MIA': 'Miami',
  'DFW': 'Dallas',
  'SEA': 'Seattle',
  'BOS': 'Boston',
  'ATL': 'Atlanta',
  'DEN': 'Denver',
  'LAS': 'Las Vegas',
  'PHX': 'Phoenix',
  'IAH': 'Houston',
  'YYZ': 'Toronto',
  'YVR': 'Vancouver',
  'YUL': 'Montreal',

  // Asia - Major Airports
  'DXB': 'Dubai',
  'HKG': 'Hong Kong',
  'SIN': 'Singapore',
  'NRT': 'Tokyo',
  'HND': 'Tokyo',       // Haneda
  'ICN': 'Seoul',
  'BKK': 'Bangkok',
  'KUL': 'Kuala Lumpur',
  'DEL': 'New Delhi',
  'BOM': 'Mumbai',

  // Add more as needed...
};

/**
 * Get city name for IATA code
 * Falls back to IATA code itself if not mapped
 *
 * @param iataCode - 3-letter IATA code
 * @returns Searchable city name or IATA code as fallback
 *
 * @example
 * getCityNameForIATA('BCN') // Returns: "Barcelona"
 * getCityNameForIATA('XYZ') // Returns: "XYZ" (unmapped, fallback)
 */
export function getCityNameForIATA(iataCode: string): string {
  const normalized = iataCode.toUpperCase().trim();
  const cityName = IATA_AIRPORT_MAP[normalized];

  if (!cityName) {
    console.warn(`⚠️  [IATA Mapping] No mapping for ${normalized}, using code as fallback`);
  }

  return cityName || normalized;
}

/**
 * Check if IATA code has explicit mapping
 *
 * @param iataCode - 3-letter IATA code
 * @returns True if mapping exists, false otherwise
 */
export function hasIATAMapping(iataCode: string): boolean {
  return iataCode.toUpperCase().trim() in IATA_AIRPORT_MAP;
}

/**
 * Get all mapped IATA codes
 *
 * @returns Array of all IATA codes with explicit mappings
 */
export function getAllMappedCodes(): string[] {
  return Object.keys(IATA_AIRPORT_MAP);
}

/**
 * Get mapping statistics
 */
export function getMappingStats() {
  const codes = Object.keys(IATA_AIRPORT_MAP);
  const cities = new Set(Object.values(IATA_AIRPORT_MAP));

  return {
    totalCodes: codes.length,
    uniqueCities: cities.size,
    avgCodesPerCity: (codes.length / cities.size).toFixed(2),
  };
}
