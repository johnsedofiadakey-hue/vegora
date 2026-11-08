import { HttpError, jsonError, readJson } from "@/lib/server/http";
import { parseCartItems, quoteClothes } from "@/lib/server/orders";
import { clientAddress, createRateLimiter, rateLimited } from "@/lib/server/rate-limit";
import { quoteVoucher } from "@/lib/server/vouchers";

export const runtime = "nodejs";

// Codes are 60 random bits, so guessing is not practical, but every attempt is
// still counted so nobody can hammer this page. A wrong code and an expired or
// used-up one give the same answer.
const perCaller = createRateLimiter({ limit: 20, windowMs: 10 * 60_000 });

export async function POST(request: Request) {
  try {
    const caller = perCaller.check(clientAddress(request));
    if (!caller.ok) return rateLimited(caller.retryAfterSeconds);
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Invalid request");
    const { code, items } = body as Record<string, unknown>;
    const clothesMinor = await quoteClothes(parseCartItems(items));
    const quote = await quoteVoucher(code, clothesMinor);
    // The code itself is not echoed back.
    return Response.json({ percentOff: quote.percentOff, discountMinor: quote.discountMinor, clothesMinor },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
