/**
 * Vehicles Cache Utility
 * Caches the vehicles list to avoid repeated API calls
 * Cache expires after 1 hour (3600000ms)
 */

const CACHE_KEY = 'fleet_vehicles_cache';
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Get cached vehicles if still valid
 * @returns {Array|null} Cached vehicles array or null if expired/missing
 */
export function getCachedVehicles() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { vehicles, timestamp } = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is still valid (not expired)
    if (now - timestamp < CACHE_EXPIRY) {
      return vehicles;
    }

    // Cache expired, remove it
    localStorage.removeItem(CACHE_KEY);
    return null;
  } catch (err) {
    console.error('Error reading vehicles cache:', err);
    return null;
  }
}

/**
 * Save vehicles to cache
 * @param {Array} vehicles - Array of vehicle numbers
 */
export function setCachedVehicles(vehicles) {
  try {
    const cacheData = {
      vehicles,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (err) {
    console.error('Error saving vehicles cache:', err);
  }
}

/**
 * Clear the vehicles cache (useful for manual refresh)
 */
export function clearVehiclesCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (err) {
    console.error('Error clearing vehicles cache:', err);
  }
}

/**
 * Check if cache exists and is valid
 * @returns {boolean}
 */
export function hasValidCache() {
  return getCachedVehicles() !== null;
}

