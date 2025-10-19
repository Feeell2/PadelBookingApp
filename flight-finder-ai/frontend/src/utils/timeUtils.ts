/**
 * Time and duration utility functions
 */

/**
 * Parse ISO 8601 duration (PT2H30M) to human readable format
 * @param isoDuration - Duration in ISO 8601 format (e.g., "PT2H30M")
 * @returns Human readable duration (e.g., "2h 30m")
 */
export function parseDuration(isoDuration: string): string {
  const matches = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!matches) return isoDuration;

  const hours = matches[1] || '0';
  const minutes = matches[2] || '0';

  if (parseInt(minutes) === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

/**
 * Format ISO 8601 datetime to human readable time
 * @param isoDateTime - DateTime in ISO 8601 format (e.g., "2025-10-20T08:30:00")
 * @returns Formatted time (e.g., "08:30")
 */
export function formatTime(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return date.toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format ISO 8601 datetime to human readable date
 * @param isoDateTime - DateTime in ISO 8601 format
 * @returns Formatted date (e.g., "20 Oct 2025")
 */
export function formatDate(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return date.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Calculate layover duration between two segments
 * @param arrivalTime - Arrival time of first segment
 * @param departureTime - Departure time of next segment
 * @returns Duration string (e.g., "1h 45m")
 */
export function calculateLayover(
  arrivalTime: string,
  departureTime: string
): string {
  const arrival = new Date(arrivalTime);
  const departure = new Date(departureTime);
  const diffMs = departure.getTime() - arrival.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  const hours = Math.floor(diffMins / 60);
  const minutes = diffMins % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

/**
 * Format date for display in date options
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Formatted date (e.g., "Mon, 20 Oct")
 */
export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pl-PL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
