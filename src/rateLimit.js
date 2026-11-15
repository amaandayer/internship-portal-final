'use strict';
// Simple fixed-window in-memory rate limiter keyed by IP + bucket.
function createRateLimiter({ windowMs = 60_000 } = {}) {
  const hits = new Map();
  return function check(key, max) {
    const now = Date.now();
    let e = hits.get(key);
    if (!e || now >= e.reset) { e = { count: 0, reset: now + windowMs }; hits.set(key, e); }
    e.count++;
    if (hits.size > 10_000) for (const [k, v] of hits) if (now >= v.reset) hits.delete(k);
    return { allowed: e.count <= max, retryAfter: Math.ceil((e.reset - now) / 1000), remaining: Math.max(0, max - e.count) };
  };
}
module.exports = { createRateLimiter };
