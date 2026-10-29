import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyServiceError } from "../src/lib/server/service-errors.ts";

test("classifies Firestore provisioning failures", () => {
  assert.equal(classifyServiceError({ code: 7, message: "7 PERMISSION_DENIED: Cloud Firestore API has not been used in project vegoragh before or it is disabled" })?.kind, "api_disabled");
  assert.equal(classifyServiceError({ code: 7, message: "7 PERMISSION_DENIED: Missing or insufficient permissions." })?.kind, "permission_denied");
  assert.equal(classifyServiceError({ code: 5, message: "5 NOT_FOUND: The database (default) does not exist for project vegoragh" })?.kind, "database_missing");
  assert.equal(classifyServiceError({ code: 9, message: "9 FAILED_PRECONDITION: The query requires an index." })?.kind, "index_missing");
  assert.equal(classifyServiceError({ code: 14, message: "14 UNAVAILABLE" })?.kind, "unavailable");
});

test("leaves application errors unclassified", () => {
  assert.equal(classifyServiceError(new Error("boom")), null);
  assert.equal(classifyServiceError({ code: 5, message: "5 NOT_FOUND: No document to update" }), null);
  assert.equal(classifyServiceError({ code: 6, message: "6 ALREADY_EXISTS" }), null);
  assert.equal(classifyServiceError(null), null);
});
