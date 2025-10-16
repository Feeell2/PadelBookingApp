// ==========================================
// Common Types & Interfaces
// Generic types used across multiple domains
// ==========================================

/**
 * Geographic coordinates
 */
export interface Coordinates {
  latitude: number;   // -90 to 90
  longitude: number;  // -180 to 180
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: Record<string, any>;
}

/**
 * Cache entry with TTL
 */
export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;   // Unix timestamp (ms)
  expiresAt: number;   // Unix timestamp (ms)
  accessCount: number;
  lastAccessed: number; // Unix timestamp (ms)
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  ttl: number;         // Time to live in milliseconds
  maxSize?: number;    // Max entries (LRU eviction)
  namespace?: string;  // Cache namespace
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}
