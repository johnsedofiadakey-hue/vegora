import { parseClientError } from "@/lib/client-error";
import { clientAddress, createRateLimiter } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

// A few reports per visitor is plenty, and it stops anyone filling the logs.
const perCaller = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

export async function POST(request: Request) {
  // Always answer "no content": this is a one-way message, and it should never show an error to the visitor.
  const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  try {
    if (!perCaller.check(clientAddress(request)).ok) return done();
    if (Number(request.headers.get("content-length") ?? 0) > 4_000) return done();
    const report = parseClientError(JSON.parse((await request.text()).slice(0, 4_000)));
    // Written as a WARNING to standard output so it is easy to find in the logs and does not raise the
    // "server errors" alert (that fires on ERROR only).
    if (report) console.log(JSON.stringify({ severity: "WARNING", event: "client-error", ...report }));
  } catch {
    // Anything unreadable is ignored.
  }
  return done();
}
