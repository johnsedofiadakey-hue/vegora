import "server-only";

import { HttpError } from "./http";
import { ServerConfigError, storeAuth } from "./firebase-admin";

export async function requireAdmin(request: Request): Promise<string> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "Admin sign-in required");
  }
  const token = authorization.slice(7).trim();
  if (!token) throw new HttpError(401, "Admin sign-in required");
  try {
    const claims = await storeAuth().verifyIdToken(token, true);
    if (claims.admin !== true) throw new HttpError(403, "Admin access required");
    return claims.uid;
  } catch (error) {
    if (error instanceof HttpError || error instanceof ServerConfigError) throw error;
    throw new HttpError(401, "Session expired. Sign in again");
  }
}
