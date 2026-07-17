/**
 * In-memory fixed-window limiter.
 *
 * ⚠️ SINGLE INSTANCE ONLY. This resets on deploy and is per-process, so on
 * Vercel/multi-pod it limits per lambda, not globally — an attacker spreading
 * requests across instances gets N× the budget. It is a speed bump, not a
 * control. Before production, back this with Redis/Upstash and keep the same
 * signature so call sites don't change.
 *
 * The real brute-force protection for OTP is the per-document attempt counter in
 * lib/auth/otp.js, which IS durable. This limits request volume, not guesses.
 */
const buckets = new Map();

function sweep(now) {
  if (buckets.size < 5000) return; // cheap guard against unbounded growth
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

/** @returns {{ok: boolean, retryAfter?: number}} */
export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true };
}

/** Client IP from the proxy chain. Spoofable if your host doesn't strip
 *  x-forwarded-for at the edge — verify yours does before trusting it. */
export function clientIp(request) {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
