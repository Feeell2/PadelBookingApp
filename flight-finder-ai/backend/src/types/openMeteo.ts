// ==========================================
// Open-Meteo API Types & Interfaces
// Types for Open-Meteo Geocoding API
// ==========================================

/**
 * Open-Meteo Geocoding API Response
 * https://open-meteo.com/en/docs/geocoding-api
 */
export interface OpenMeteoGeocodingResponse {
  results?: Array<{
    id: number;                  // Location ID
    name: string;                // Location name (e.g., "Barcelona")
    latitude: number;            // -90 to 90
    longitude: number;           // -180 to 180
    elevation?: number;          // meters above sea level
    feature_code: string;        // Type code (e.g., "PPLA")
    country_code: string;        // ISO 3166-1 alpha-2 (e.g., "ES")
    country?: string;            // Country name (e.g., "Spain")
    country_id?: number;
    timezone?: string;           // IANA timezone (e.g., "Europe/Madrid")
    population?: number;
    postcodes?: string[];
    admin1?: string;             // Administrative level 1
    admin2?: string;             // Administrative level 2
    admin3?: string;             // Administrative level 3
    admin4?: string;             // Administrative level 4
    admin1_id?: number;
    admin2_id?: number;
    admin3_id?: number;
    admin4_id?: number;
  }>;
  generationtime_ms?: number;
}
