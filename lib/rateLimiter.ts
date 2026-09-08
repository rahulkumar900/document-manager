/**
 * Lightweight, in-memory sliding-window rate limiter for Next.js API routes.
 * Suitable for serverless & Node runtime instances without external Redis dependencies.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const ipMap = new Map<string, RateLimitRecord>();

// Cleanup stale records every 5 minutes to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const cutoff = now - 60000 * 5; // 5 minutes
    for (const [ip, record] of ipMap.entries()) {
      record.timestamps = record.timestamps.filter((t) => t > cutoff);
      if (record.timestamps.length === 0) {
        ipMap.delete(ip);
      }
    }
  }, 60000 * 5);
}

/**
 * Checks if a given identifier (e.g. client IP) has exceeded the rate limit.
 * @param identifier Client IP or user ID
 * @param maxRequests Maximum allowed requests in the window
 * @param windowMs Window duration in milliseconds (default: 60,000ms = 1 minute)
 * @returns { isLimited: boolean, remaining: number, resetMs: number }
 */
export function checkRateLimit(
  identifier: string,
  maxRequests = 30,
  windowMs = 60000
): { isLimited: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  let record = ipMap.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    ipMap.set(identifier, record);
  }

  // Filter out timestamps older than the window
  record.timestamps = record.timestamps.filter((t) => t > windowStart);

  if (record.timestamps.length >= maxRequests) {
    const oldestTimestamp = record.timestamps[0] || now;
    const resetMs = Math.max(0, oldestTimestamp + windowMs - now);
    return {
      isLimited: true,
      remaining: 0,
      resetMs,
    };
  }

  // Record this request
  record.timestamps.push(now);

  return {
    isLimited: false,
    remaining: maxRequests - record.timestamps.length,
    resetMs: windowMs,
  };
}

/**
 * Extracts client IP from standard request headers.
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}
