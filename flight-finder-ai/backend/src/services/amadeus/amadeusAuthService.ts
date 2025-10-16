// ==========================================
// Amadeus Authentication Service
// OAuth token management with caching
// ==========================================

import type { AmadeusTokenResponse } from '../../types/amadeus.js';

const AMADEUS_BASE_URL = 'https://test.api.amadeus.com';

/**
 * Token cache (in-memory)
 */
let cachedToken: {
  access_token: string;
  expires_at: number; // timestamp in ms
} | null = null;

/**
 * Get OAuth token from Amadeus API
 * Implements token caching with auto-refresh
 */
export async function getAmadeusToken(): Promise<string> {
  // Check if cached token is still valid
  if (cachedToken && Date.now() < cachedToken.expires_at) {
    const validFor = Math.floor((cachedToken.expires_at - Date.now()) / 1000);
    console.log(`💾 [Amadeus Auth] Using cached token (valid for ${validFor}s)`);
    return cachedToken.access_token;
  }

  console.log('🔑 [Amadeus Auth] Requesting new OAuth token...');

  if (!process.env.AMADEUS_API_KEY || !process.env.AMADEUS_API_SECRET) {
    throw new Error('AMADEUS_API_KEY and AMADEUS_API_SECRET must be set in .env');
  }

  // Debug logging
  console.log(`🔍 [Amadeus Auth] API Key length: ${process.env.AMADEUS_API_KEY.length}`);
  console.log(`🔍 [Amadeus Auth] API Secret length: ${process.env.AMADEUS_API_SECRET.length}`);
  console.log(`🔍 [Amadeus Auth] API Key first 10 chars: ${process.env.AMADEUS_API_KEY.substring(0, 10)}`);

  const tokenUrl = `${AMADEUS_BASE_URL}/v1/security/oauth2/token`;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.AMADEUS_API_KEY,
    client_secret: process.env.AMADEUS_API_SECRET,
  });

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [Amadeus Auth] Token request failed');
      console.error('   Status:', response.status);
      console.error('   Response:', errorText);
      throw new Error(`Amadeus authentication failed: ${response.status} - ${errorText}`);
    }

    const data: AmadeusTokenResponse = await response.json();

    // Cache token with 30s buffer before expiration
    const expiresInMs = (data.expires_in - 30) * 1000;
    cachedToken = {
      access_token: data.access_token,
      expires_at: Date.now() + expiresInMs,
    };

    console.log(`🔑 [Amadeus Auth] Token obtained: ${data.access_token.substring(0, 20)}... (expires in ${data.expires_in}s)`);

    return data.access_token;
  } catch (error) {
    console.error('❌ [Amadeus Auth] Failed to obtain token:', error);
    throw error;
  }
}

/**
 * Clear cached token (useful for testing or forced refresh)
 */
export function clearTokenCache(): void {
  cachedToken = null;
  console.log('🗑️  [Amadeus Auth] Token cache cleared');
}
