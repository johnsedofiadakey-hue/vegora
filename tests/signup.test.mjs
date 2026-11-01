import test from "node:test";
import assert from "node:assert/strict";
import { mergeInterests, parseSignup, signupInterests, SignupInputError } from "../src/lib/signup.ts";

const valid = { email: "Ama@Example.com ", interests: ["deals"], consent: true };
const rejects = (body) => assert.throws(() => parseSignup(body), SignupInputError, JSON.stringify(body));

test("a minimal sign-up is accepted and tidied", () => {
  const result = parseSignup(valid);
  assert.equal(result.spam, false);
  assert.deepEqual(result.signup, { email: "ama@example.com", name: "", phone: "", interests: ["deals"], message: "" });
});

test("every detail can be supplied", () => {
  const result = parseSignup({ ...valid, name: "  Ama Mensah ", phone: "+233 24 123 4567", message: "50 shirts\r\nwith our logo", interests: ["bulk", "customization", "bulk"] });
  assert.deepEqual(result.signup, {
    email: "ama@example.com", name: "Ama Mensah", phone: "+233 24 123 4567", interests: ["customization", "bulk"], message: "50 shirts\nwith our logo",
  });
});

test("interests keep the form's order and have no repeats", () => {
  assert.deepEqual(signupInterests.map((interest) => interest.id), ["deals", "customization", "bulk", "other"]);
  assert.deepEqual(mergeInterests(["other", "deals"], ["bulk", "deals"]), ["deals", "bulk", "other"]);
  assert.deepEqual(mergeInterests([], []), []);
  assert.deepEqual(mergeInterests(["nonsense"]), []);
});

test("a robot that fills the hidden field is thanked and ignored", () => {
  assert.deepEqual(parseSignup({ ...valid, website: "http://spam.example" }), { spam: true });
  // Even a body that would otherwise be refused: nothing about it is stored or explained.
  assert.deepEqual(parseSignup({ email: "x", website: "x" }), { spam: true });
  assert.equal(parseSignup({ ...valid, website: "" }).spam, false);
  assert.equal(parseSignup({ ...valid, website: "   " }).spam, false);
});

test("consent and at least one interest are required", () => {
  rejects({ email: "a@b.co", interests: ["deals"] });
  rejects({ email: "a@b.co", interests: ["deals"], consent: false });
  rejects({ email: "a@b.co", interests: ["deals"], consent: "true" });
  rejects({ email: "a@b.co", interests: [], consent: true });
  rejects({ email: "a@b.co", consent: true });
  rejects({ email: "a@b.co", interests: "deals", consent: true });
  rejects({ email: "a@b.co", interests: ["deals", "everything"], consent: true });
  rejects({ email: "a@b.co", interests: [1], consent: true });
  rejects({ email: "a@b.co", interests: ["deals", "customization", "bulk", "other", "deals"], consent: true });
});

test("the email must look like one", () => {
  for (const email of ["", "   ", "not-an-email", "a@b", "a@@b.co", "a b@c.co", "<a@b.co>", "a@b.co<script>", `${"a".repeat(250)}@b.co`, 5, null, ["a@b.co"]]) {
    rejects({ ...valid, email });
  }
});

test("name, phone and message are plain text within limits", () => {
  rejects({ ...valid, name: "x".repeat(101) });
  rejects({ ...valid, name: "<b>Ama</b>" });
  rejects({ ...valid, name: "Ama\u0000" });
  rejects({ ...valid, name: "Ama\nMensah" });
  rejects({ ...valid, name: "‮evil" });
  rejects({ ...valid, name: 5 });
  rejects({ ...valid, phone: "call me" });
  rejects({ ...valid, phone: "123" });
  rejects({ ...valid, phone: "+233".padEnd(25, "1") });
  rejects({ ...valid, message: "x".repeat(501) });
  rejects({ ...valid, message: "<img src=x onerror=alert(1)>" });
  rejects({ ...valid, message: "bad\u0007bell" });
  rejects({ ...valid, message: ["a"] });
  assert.equal(parseSignup({ ...valid, message: "x".repeat(500) }).signup.message.length, 500);
  assert.equal(parseSignup({ ...valid, message: "5 < 6 and 7 > 3" }).signup.message, "5 < 6 and 7 > 3");
  assert.equal(parseSignup({ ...valid, message: "one\n\n\n\n\ntwo" }).signup.message, "one\n\ntwo");
  assert.equal(parseSignup({ ...valid, name: null, phone: undefined, message: null }).signup.name, "");
});

test("anything that is not a form body is refused", () => {
  for (const body of [null, undefined, [], "email", 5, true]) rejects(body);
});

test("the CSV export cannot be turned into a spreadsheet formula", async () => {
  const { csvCell, signupsToCsv } = await import("../src/lib/signup.ts");
  assert.equal(csvCell("plain"), '"plain"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell(3), '"3"');
  for (const risky of ["=HYPERLINK(\"http://evil.example\")", "+1+1", "-2+3", "@SUM(1)", "\tcmd", "\rcmd"]) {
    assert.ok(csvCell(risky).startsWith('"\''), risky);
  }
  assert.equal(csvCell("a=b"), '"a=b"');
  const csv = signupsToCsv([{ email: "ama@example.com", name: '=cmd|"/c calc"', phone: "+233 24 123 4567", interests: ["deals", "bulk"], message: "50 shirts\nwith logo, please",
    createdAt: "2026-11-01T10:00:00.000Z", updatedAt: "2026-11-02T10:00:00.000Z", count: 2 }]);
  const lines = csv.split("\r\n");
  assert.equal(lines.length, 2);
  assert.equal(lines[0], '"Signed up","Last updated","Name","Email","Phone","Interested in","Note","Times submitted"');
  assert.ok(lines[1].includes("\"'=cmd|"));
  assert.ok(lines[1].includes('"New deals; Bulk orders"'));
  assert.ok(lines[1].includes('"50 shirts with logo, please"'));
  assert.ok(lines[1].includes("\"'+233 24 123 4567\""), "a phone number starting with + is also kept as text");
  assert.equal(signupsToCsv([]).split("\r\n").length, 1);
});
