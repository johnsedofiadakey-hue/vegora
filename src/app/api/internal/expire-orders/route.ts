import { timingSafeEqual } from "node:crypto";
import { HttpError, jsonError } from "@/lib/server/http";
import { expireReservations } from "@/lib/server/orders";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const expected = process.env.VEGORA_CRON_SECRET ?? "";
    const provided = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const expectedBytes = Buffer.from(expected);
    const providedBytes = Buffer.from(provided);
    if (expectedBytes.length < 32 || providedBytes.length !== expectedBytes.length ||
        !timingSafeEqual(providedBytes, expectedBytes)) {
      throw new HttpError(401, "Unauthorized");
    }
    const expired = await expireReservations();
    return Response.json({ expired }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
