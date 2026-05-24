/**
 * Simple in-memory sliding window rate limiter
 */
type RateLimitEntry = {
  timestamps: number[];
};

const tracker = new Map<string, RateLimitEntry>();

export function isRateLimited(
  key: string,
  limitMax: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = tracker.get(key) || { timestamps: [] };

  // Filter out timestamps older than the window
  entry.timestamps = entry.timestamps.filter(
    (timestamp) => now - timestamp < windowMs
  );

  if (entry.timestamps.length >= limitMax) {
    return true;
  }

  entry.timestamps.push(now);
  tracker.set(key, entry);
  return false;
}
