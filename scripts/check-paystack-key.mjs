import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
let source;
try {
  source = await readFile(envPath, "utf8");
} catch {
  console.error("No .env.local file found. Copy .env.example to .env.local first.");
  process.exitCode = 1;
}

if (source !== undefined) {
  const line = source.match(/^PAYSTACK_SECRET_KEY=(.*)$/m)?.[1]?.trim() ?? "";
  const key = line.replace(/^(['"])(.*)\1$/, "$2");
  if (!key.startsWith("sk_test_") || key.length < 20) {
    console.error("Add your Paystack Test Secret Key to PAYSTACK_SECRET_KEY in .env.local. It must begin sk_test_.");
    process.exitCode = 1;
  } else {
    try {
      const response = await fetch("https://api.paystack.co/balance", {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        console.log("Paystack accepted the test secret key. Checkout remains closed until delivery and webhook setup is complete.");
      } else {
        console.error(`Paystack did not accept the test key (HTTP ${response.status}). Check that you copied the Test Secret Key.`);
        process.exitCode = 1;
      }
    } catch {
      console.error("Could not reach Paystack. Check your internet connection and try again.");
      process.exitCode = 1;
    }
  }
}
