// A small in-memory limiter for the public endpoints that take guessable
// input. Each server instance counts on its own, so with several instances the
// real limit is a multiple of this. It is a brake on guessing and spam, not a
// guarantee, and nothing here is stored.
export interface RateLimiter {
  check(key: string, now?: number): { ok: boolean; retryAfterSeconds: number };
}

export function createRateLimiter({ limit, windowMs, maxKeys = 5000 }: { limit: number; windowMs: number; maxKeys?: number }): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  function prune(now: number) {
    for (const [key, entry] of windows) if (entry.resetAt <= now) windows.delete(key);
    // Still too many live keys: drop the oldest so memory stays bounded.
    for (const key of windows.keys()) {
      if (windows.size <= maxKeys) break;
      windows.delete(key);
    }
  }

  return {
    check(key: string, now = Date.now()) {
      const entry = windows.get(key);
      if (!entry || entry.resetAt <= now) {
        if (windows.size >= maxKeys) prune(now);
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, retryAfterSeconds: 0 };
      }
      if (entry.count < limit) {
        entry.count += 1;
        return { ok: true, retryAfterSeconds: 0 };
      }
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
    },
  };
}

/** The caller's address as reported by the platform. A client can add to this header, so treat it as best effort. */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded && forwarded.length <= 45 ? forwarded : "unknown";
}

export function rateLimited(retryAfterSeconds: number): Response {
  return Response.json({ error: "Too many attempts. Please wait a few minutes and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store" } });
}
