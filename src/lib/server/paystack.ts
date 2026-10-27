import { createHmac, timingSafeEqual } from "node:crypto";

export interface PaystackVerification {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  domain: string;
  customerEmail: string | null;
}

export class PaystackError extends Error {
  constructor(message = "Payment provider is unavailable") {
    super(message);
    this.name = "PaystackError";
  }
}

async function paystackRequest(path: string, secretKey: string, options: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(`https://api.paystack.co${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", ...options.headers },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
  } catch {
    throw new PaystackError();
  }
  if (!response.ok) throw new PaystackError();
  const body: unknown = await response.json().catch(() => null);
  if (!body || typeof body !== "object" || !("status" in body) || body.status !== true || !("data" in body)) {
    throw new PaystackError();
  }
  return body.data;
}

export async function initializePaystack(input: {
  secretKey: string; email: string; amountMinor: number; reference: string; callbackUrl: string;
}, fetcher: typeof fetch = fetch): Promise<{ authorizationUrl: string; reference: string }> {
  const data = await paystackRequest("/transaction/initialize", input.secretKey, {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: String(input.amountMinor),
      currency: "GHS",
      reference: input.reference,
      callback_url: input.callbackUrl,
    }),
  }, fetcher) as Record<string, unknown>;
  if (typeof data.authorization_url !== "string" || typeof data.reference !== "string" ||
      data.reference !== input.reference || !data.authorization_url.startsWith("https://checkout.paystack.com/")) {
    throw new PaystackError("Payment provider returned an invalid checkout link");
  }
  return { authorizationUrl: data.authorization_url, reference: data.reference };
}

export async function verifyPaystack(reference: string, secretKey: string, fetcher: typeof fetch = fetch): Promise<PaystackVerification> {
  if (!/^[A-Za-z0-9.=-]{1,100}$/.test(reference)) throw new PaystackError("Invalid payment reference");
  const data = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`, secretKey, {}, fetcher) as Record<string, unknown>;
  const customer = data.customer && typeof data.customer === "object" ? data.customer as Record<string, unknown> : null;
  if (typeof data.status !== "string" || typeof data.reference !== "string" ||
      !Number.isSafeInteger(data.amount) || typeof data.currency !== "string" || typeof data.domain !== "string") {
    throw new PaystackError("Payment provider returned incomplete verification");
  }
  return {
    status: data.status,
    reference: data.reference,
    amount: Number(data.amount),
    currency: data.currency,
    domain: data.domain,
    customerEmail: typeof customer?.email === "string" ? customer.email : null,
  };
}

export function validPaystackSignature(rawBody: Buffer, signature: string | null, secretKey: string): boolean {
  if (!signature || !/^[0-9a-f]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest();
  const provided = Buffer.from(signature, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
