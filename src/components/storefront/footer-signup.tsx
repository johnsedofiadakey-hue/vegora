"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { maxSignupMessage, signupInterests, type SignupInterest } from "@/lib/signup";

type Status = "idle" | "sending" | "done" | "error";

// Sits under the logo in the footer. A visitor says what they want to hear
// about (deals, customization, bulk orders), leaves an email, and can add
// details. The owner reads the list in the admin's Signups tab.
export function FooterSignup({ privacyHref }: { privacyHref: string | null }) {
  const id = useId();
  const [interests, setInterests] = useState<SignupInterest[]>(["deals"]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [trap, setTrap] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [thanksFor, setThanksFor] = useState<string[]>([]);

  function toggle(interest: SignupInterest) {
    setInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    if (interests.length === 0) { setStatus("error"); setError("Choose at least one thing you would like to hear about."); return; }
    setStatus("sending"); setError("");
    try {
      const response = await fetch("/api/signup", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ email, name, phone, message, interests, consent: true, website: trap }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "We could not save that just now. Please try again.");
      setThanksFor(signupInterests.filter((interest) => interests.includes(interest.id)).map((interest) => interest.label.toLowerCase()));
      setStatus("done");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "We could not save that just now. Please try again.");
    }
  }

  if (status === "done") {
    return <div className="footer-signup" role="status">
      <h3>Thank you.</h3>
      <p className="footer-signup-lead">We will be in touch about {thanksFor.join(", ")}.</p>
    </div>;
  }

  return <form className="footer-signup" onSubmit={submit} noValidate={false} aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>Stay in the loop</h3>
    <p className="footer-signup-lead">New deals, customization and bulk orders. Tell us what you would like to hear about.</p>
    <fieldset className="footer-signup-interests">
      <legend className="footer-signup-sr">I would like to hear about</legend>
      {signupInterests.map((interest) => <label key={interest.id} className="footer-signup-chip">
        <input type="checkbox" checked={interests.includes(interest.id)} onChange={() => toggle(interest.id)} disabled={status === "sending"} />
        <span>{interest.label}</span>
      </label>)}
    </fieldset>
    <div className="footer-signup-row">
      <label className="footer-signup-sr" htmlFor={`${id}-email`}>Email address</label>
      <input id={`${id}-email`} type="email" name="email" autoComplete="email" required maxLength={254} placeholder="Your email address"
        value={email} onChange={(event) => setEmail(event.target.value)} disabled={status === "sending"} />
      <button type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Sign up"}</button>
    </div>
    <details className="footer-signup-more">
      <summary>Add your name, phone or a note (optional)</summary>
      <div>
        <label htmlFor={`${id}-name`}>Name</label>
        <input id={`${id}-name`} name="name" autoComplete="name" maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
        <label htmlFor={`${id}-phone`}>Phone or WhatsApp</label>
        <input id={`${id}-phone`} name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} />
        <label htmlFor={`${id}-message`}>For bulk or custom orders, what do you have in mind?</label>
        <textarea id={`${id}-message`} name="message" rows={3} maxLength={maxSignupMessage} value={message} onChange={(event) => setMessage(event.target.value)} />
      </div>
    </details>
    <div className="footer-signup-trap" aria-hidden="true">
      <label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={(event) => setTrap(event.target.value)} /></label>
    </div>
    <p className="footer-signup-consent">
      By signing up you agree that VEGORA may contact you about the things you picked.{privacyHref && <> <Link href={privacyHref}>Privacy policy</Link></>}
    </p>
    <p className="footer-signup-error" role="alert">{status === "error" ? error : ""}</p>
  </form>;
}
