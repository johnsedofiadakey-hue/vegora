// Classifies Google Cloud (gRPC) failures from the Admin SDK so provisioning
// problems surface as an actionable 503 instead of an opaque 500.
export type ServiceFailure = "api_disabled" | "database_missing" | "permission_denied" | "index_missing" | "unavailable";

const hints: Record<ServiceFailure, string> = {
  api_disabled: "Enable the Cloud Firestore / Cloud Storage for Firebase API for this project",
  database_missing: "Create the (default) Firestore database for this project",
  permission_denied: "Grant the server identity Firestore/Storage access",
  index_missing: "Deploy firestore.indexes.json to this project",
  unavailable: "Google Cloud service is temporarily unavailable",
};

export function classifyServiceError(error: unknown): { kind: ServiceFailure; hint: string } | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = (error as { code: unknown }).code;
  const message = String((error as { message?: unknown }).message ?? "");
  let kind: ServiceFailure | null = null;
  if (code === 7 && /SERVICE_DISABLED|has not been used|is disabled/i.test(message)) kind = "api_disabled";
  else if (code === 7) kind = "permission_denied";
  else if (code === 5 && /database .*does not exist/i.test(message)) kind = "database_missing";
  else if (code === 9 && /index/i.test(message)) kind = "index_missing";
  else if (code === 14) kind = "unavailable";
  return kind ? { kind, hint: hints[kind] } : null;
}
