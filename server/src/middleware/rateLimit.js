/**
 * In-memory per-user rate limiter for expensive commands (AI, code execution).
 * Sliding window: max N calls per windowMs.
 */
const windows = new Map(); // userId -> timestamp[]

export function rateLimit({ max, windowMs, message }) {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return next();

    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = (windows.get(userId) || []).filter((t) => t > cutoff);

    if (timestamps.length >= max) {
      const retryAfter = Math.ceil((timestamps[0] - cutoff) / 1000);
      return ctx.reply(message || `⏳ Too many requests. Try again in ${retryAfter}s.`);
    }

    timestamps.push(now);
    windows.set(userId, timestamps);
    return next();
  };
}

// Cleanup stale entries every 10 minutes to prevent memory leak
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [id, ts] of windows.entries()) {
    if (ts[ts.length - 1] < cutoff) windows.delete(id);
  }
}, 10 * 60 * 1000);
