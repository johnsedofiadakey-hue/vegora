// The shop does not ask for an email address. A phone number is how a customer
// is recognised: it is the second thing needed (after the order number) to look
// at an order. Paystack needs some email to start a payment, so each order gets
// a private placeholder made from the phone number. It is never shown as a real
// address and nothing is ever sent to it.

const placeholderDomain = "customer.shopvegora.com";

/**
 * The last nine digits of a Ghana phone number, so 0244 123 456, +233 244 123 456
 * and 233244123456 are all the same person. Returns null when there are too few digits.
 */
export function phoneKey(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return null;
  // A local number starts with 0 and has ten digits, so nine digits starting with 0 is a typing slip.
  if (digits.length === 9 && digits.startsWith("0")) return null;
  return digits.slice(-9);
}

/** The placeholder email used for Paystack, or null when the phone number is too short. */
export function placeholderEmail(phone: string): string | null {
  const key = phoneKey(phone);
  return key ? `p${key}@${placeholderDomain}` : null;
}

export function isPlaceholderEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${placeholderDomain}`);
}

/** Shows only the end of a phone number, for example "••• ••• 456". */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 3 ? `••• ••• ${digits.slice(-3)}` : "•••";
}
