"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

type Status = "idle" | "sending" | "done" | "error";

// Sits under the logo in the footer: one email field, nothing else. Every
// sign-up is recorded as interested in new deals; the owner reads the list
// in the admin's Sign-ups tab.
export function FooterSignup({ privacyHref }: { privacyHref: string | null }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending"); setError("");
    try {
      const response = await fetch("/api/signup", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ email, interests: ["deals"], consent: true, website: trap }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "We could not save that just now. Please try again.");
      setStatus("done");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "We could not save that just now. Please try again.");
    }
  }

  if (status === "done") {
    return <div className="footer-signup" role="status">
      <h3>Thank you.</h3>
      <p className="footer-signup-lead">You are on our list. We will send you news.</p>
    </div>;
  }

  return <form className="footer-signup" onSubmit={submit} aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>Get our news</h3>
    <p className="footer-signup-lead">New clothes and offers. Leave your email and we will write to you.</p>
    <div className="footer-signup-field">
      <label className="footer-signup-sr" htmlFor={`${id}-email`}>Email address</label>
      <input id={`${id}-email`} type="email" name="email" autoComplete="email" required maxLength={254} placeholder="Your email"
        value={email} onChange={(event) => setEmail(event.target.value)} disabled={status === "sending"} />
      <button type="submit" aria-label="Sign up" disabled={status === "sending"}><ArrowRight size={20} strokeWidth={1.5} aria-hidden="true" /></button>
    </div>
    <div className="footer-signup-trap" aria-hidden="true">
      <label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={(event) => setTrap(event.target.value)} /></label>
    </div>
    {privacyHref && <p className="footer-signup-consent">See our <Link href={privacyHref}>privacy policy</Link>.</p>}
    <p className="footer-signup-error" role="alert">{status === "error" ? error : ""}</p>
  </form>;
}
