// Footer sign-ups: what a visitor can ask for, and the rules for what we accept.
// Pure functions with no server imports so they can be tested directly and used
// by both the form and the server. Everything is plain text.

export const signupInterests = [
  { id: "deals", label: "New deals" },
  { id: "customization", label: "Customization" },
  { id: "bulk", label: "Bulk orders" },
  { id: "other", label: "Something else" },
] as const;

export type SignupInterest = (typeof signupInterests)[number]["id"];

export interface Signup {
  email: string;
  name: string;
  phone: string;
  interests: SignupInterest[];
  message: string;
}

export const maxSignupMessage = 500;

/** Why a sign-up was refused. The route maps it to HTTP 400. */
export class SignupInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignupInputError";
  }
}

const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const phonePattern = /^\+?[0-9][0-9 ()-]{5,19}$/;
const singleLineControls = /[\u0000-\u001F\u007F]/;
const multiLineControls = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const bidiControls = /[‪-‮⁦-⁩]/;
const markup = /<\/?[A-Za-z!][^>]*>/;

function text(value: unknown, label: string, max: number, multiline = false): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new SignupInputError(`${label} is not valid`);
  const clean = (multiline ? value.replace(/\r\n?/g, "\n") : value).trim();
  if (clean.length > max) throw new SignupInputError(`${label} must be ${max} characters or fewer`);
  if ((multiline ? multiLineControls : singleLineControls).test(clean) || bidiControls.test(clean) || markup.test(clean)) {
    throw new SignupInputError(`${label} must be plain text`);
  }
  return multiline ? clean.replace(/\n{3,}/g, "\n\n") : clean;
}

/** In the order the form shows them, without repeats. */
export function mergeInterests(...lists: readonly string[][]): SignupInterest[] {
  const wanted = new Set(lists.flat());
  return signupInterests.filter((interest) => wanted.has(interest.id)).map((interest) => interest.id);
}

export type ParsedSignup = { spam: true } | { spam: false; signup: Signup };

/**
 * Checks a submitted form. `website` is a field real visitors never see; a
 * robot that fills it in is told "thanks" and nothing is stored.
 */
export function parseSignup(input: unknown): ParsedSignup {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new SignupInputError("Enter your email to sign up");
  const body = input as Record<string, unknown>;
  if (typeof body.website === "string" && body.website.trim() !== "") return { spam: true };

  if (body.consent !== true) throw new SignupInputError("Please agree to be contacted about what you picked");
  if (typeof body.email !== "string") throw new SignupInputError("Enter a valid email address");
  const email = body.email.trim().toLowerCase();
  if (email.length > 254 || !emailPattern.test(email)) throw new SignupInputError("Enter a valid email address");

  if (!Array.isArray(body.interests) || body.interests.length === 0 || body.interests.length > signupInterests.length) {
    throw new SignupInputError("Choose at least one thing you would like to hear about");
  }
  const known = new Set<string>(signupInterests.map((interest) => interest.id));
  if (body.interests.some((interest) => typeof interest !== "string" || !known.has(interest))) {
    throw new SignupInputError("Choose from the options shown");
  }
  const interests = mergeInterests(body.interests as string[]);

  const name = text(body.name, "Name", 100);
  const phone = text(body.phone, "Phone number", 20);
  if (phone && !phonePattern.test(phone)) throw new SignupInputError("Enter a valid phone number, or leave it empty");
  const message = text(body.message, "Message", maxSignupMessage, true);

  return { spam: false, signup: { email, name, phone, interests, message } };
}

// ---------------------------------------------------------------- CSV export

interface ExportableSignup {
  email: string; name: string; phone: string; interests: readonly string[]; message: string;
  createdAt: string; updatedAt: string; count: number;
}

/**
 * One CSV cell. Quotes are doubled, and a cell that starts with = + - @ or a
 * control character gets a leading apostrophe, so a spreadsheet shows it as
 * text instead of running it as a formula. Anyone can type into this form, so
 * what they typed must never be able to act when the owner opens the file.
 */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function signupsToCsv(items: readonly ExportableSignup[]): string {
  const labels = new Map<string, string>(signupInterests.map((interest) => [interest.id, interest.label]));
  const header = ["Signed up", "Last updated", "Name", "Email", "Phone", "Interested in", "Note", "Times submitted"];
  const rows = items.map((item) => [
    item.createdAt, item.updatedAt, item.name, item.email, item.phone,
    item.interests.map((interest) => labels.get(interest) ?? interest).join("; "), item.message.replace(/\n/g, " "), item.count,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
