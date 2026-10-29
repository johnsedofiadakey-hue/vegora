import "server-only";

import { ServerConfigError } from "./firebase-admin";
import { PaystackError } from "./paystack";
import { classifyServiceError } from "./service-errors";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function jsonError(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ServerConfigError) {
    return Response.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof PaystackError) {
    return Response.json({ error: "Payment provider is unavailable. Please try again later" }, { status: 502 });
  }
  const service = classifyServiceError(error);
  if (service) {
    console.error(`VEGORA store service ${service.kind}: ${service.hint}`, error);
    return Response.json({ error: "Store service is unavailable", reason: service.kind }, { status: 503 });
  }
  console.error("VEGORA API error", error);
  return Response.json({ error: "Unable to complete this request" }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    throw new HttpError(415, "Expected application/json");
  }
  const maxBytes = 100_000;
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    throw new HttpError(413, "Request is too large");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "JSON body is required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "Request is too large");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
