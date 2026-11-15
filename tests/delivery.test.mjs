import assert from "node:assert/strict";
import test from "node:test";
import {
  areaSlug, cedisToMinor, DeliveryInputError, feeText, maxDeliveryAreas, maxDeliveryFeeMinor, parseDeliveryAreas,
} from "../src/lib/delivery.ts";

const accra = { id: "accra", label: "Accra", region: "Greater Accra", feeMinor: 3000, active: true };
const tema = { id: "tema", label: "Tema", region: "Greater Accra", feeMinor: 5000, active: true };
const current = [accra, tema];

const rejects = (areas, pattern) => assert.throws(() => parseDeliveryAreas({ areas }, current), (error) => error instanceof DeliveryInputError && pattern.test(error.message));

test("keeps the areas as they are and lets the admin change a price", () => {
  const result = parseDeliveryAreas({ areas: [{ ...accra, feeMinor: 3500 }, tema] }, current);
  assert.deepEqual(result.map((area) => [area.id, area.feeMinor]), [["accra", 3500], ["tema", 5000]]);
});

test("a new area gets a server-made id, and a clash gets a number", () => {
  const result = parseDeliveryAreas({ areas: [accra, tema, { label: "East Legon", feeMinor: 4000, active: true }, { label: "East  Legon 2", feeMinor: 4000, active: true }] }, current);
  assert.equal(result[2].id, "east-legon");
  assert.equal(result[3].id, "east-legon-2");
  assert.equal(result[2].region, "Greater Accra");
  assert.equal(areaSlug("Ɛast Légon!!"), "ast-legon");
  assert.equal(areaSlug("???"), "area");
});

test("an admin cannot choose or invent an id", () => {
  rejects([accra, { id: "made-up", label: "Kumasi", feeMinor: 9000, active: true }], /not recognised/);
  rejects([accra, { ...tema, id: "accra" }], /twice/);
});

test("free delivery is allowed, but a bad or huge price is not", () => {
  assert.equal(parseDeliveryAreas({ areas: [{ ...accra, feeMinor: 0 }] }, current)[0].feeMinor, 0);
  rejects([{ ...accra, feeMinor: -1 }], /price/);
  rejects([{ ...accra, feeMinor: 30.5 }], /price/);
  rejects([{ ...accra, feeMinor: "30" }], /price/);
  rejects([{ ...accra, feeMinor: maxDeliveryFeeMinor + 1 }], /cannot be more than/);
  assert.equal(parseDeliveryAreas({ areas: [{ ...accra, feeMinor: maxDeliveryFeeMinor }] }, current)[0].feeMinor, maxDeliveryFeeMinor);
});

test("at least one area must stay on", () => {
  rejects([{ ...accra, active: false }, { ...tema, active: false }], /at least one area/);
  assert.equal(parseDeliveryAreas({ areas: [{ ...accra, active: false }, tema] }, current)[0].active, false);
  rejects([], /at least one delivery area/);
});

test("names are clean, unique and bounded", () => {
  rejects([accra, { ...tema, label: "accra" }], /two areas called/);
  rejects([{ ...accra, label: "" }], /Area name is required/);
  rejects([{ ...accra, label: "<b>Accra</b>" }], /not allowed/);
  rejects([{ ...accra, label: "A".repeat(41) }], /40 characters/);
  rejects([{ ...accra, active: "yes" }], /on or off/);
  rejects(["Accra"], /name and a price/);
  assert.equal(parseDeliveryAreas({ areas: [{ ...accra, label: "  Accra   Central " }] }, current)[0].label, "Accra Central");
});

test("there is a limit on how many areas", () => {
  const many = Array.from({ length: maxDeliveryAreas + 1 }, (_, index) => ({ label: `Area ${index}`, feeMinor: 1000, active: true }));
  rejects(many, /at most/);
  assert.throws(() => parseDeliveryAreas(null, current), DeliveryInputError);
  assert.throws(() => parseDeliveryAreas({ areas: "nope" }, current), DeliveryInputError);
});

test("prices typed in cedis become whole pesewas", () => {
  assert.equal(cedisToMinor("30"), 3000);
  assert.equal(cedisToMinor("45.5"), 4550);
  assert.equal(cedisToMinor(" GH₵ 12.05 "), 1205);
  assert.equal(cedisToMinor("0"), 0);
  for (const bad of ["", "abc", "1.234", "-5", "1,5", "12.", "1e3"]) assert.ok(Number.isNaN(cedisToMinor(bad)), bad);
  assert.equal(feeText(0), "Free");
  assert.equal(feeText(3000), "GH₵30.00");
});
