import { parseSignup, SignupInputError } from "@/lib/signup";
import { HttpError, jsonError, readJson } from "@/lib/server/http";
import { clientAddress, createRateLimiter, rateLimited } from "@/lib/server/rate-limit";
import { saveSignup } from "@/lib/server/signups";

export const runtime = "nodejs";

// Public form, so it is limited. Counting per email also stops one person's
// address being used to fill the list with copies.
const perEmail = createRateLimiter({ limit: 3, windowMs: 10 * 60_000 });
const perCaller = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

const thanks = () => Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  try {
    const caller = perCaller.check(clientAddress(request));
    if (!caller.ok) return rateLimited(caller.retryAfterSeconds);
    let parsed: ReturnType<typeof parseSignup>;
    try {
      parsed = parseSignup(await readJson(request));
    } catch (error) {
      if (error instanceof SignupInputError) throw new HttpError(400, error.message);
      throw error;
    }
    // A robot that filled in the hidden field is thanked and ignored.
    if (parsed.spam) return thanks();
    const email = perEmail.check(parsed.signup.email);
    if (!email.ok) return rateLimited(email.retryAfterSeconds);
    await saveSignup(parsed.signup);
    // The same answer whether or not this address was already on the list, so
    // the form cannot be used to find out who has signed up.
    return thanks();
  } catch (error) {
    return jsonError(error);
  }
}
