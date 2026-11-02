"use client";

import { Camera, Check, Copy, Download, Share2 } from "lucide-react";
import { useState } from "react";
import { trackLink } from "@/lib/saved-orders";

type Notice = "copied" | "shared" | "saved" | "failed" | null;

// Draws a plain card with the order number so it can be kept in the phone's
// photos. Nothing leaves the device.
function orderCardImage(code: string, host: string): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = "#f6f5f2"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111"; ctx.textAlign = "center";
  ctx.font = "500 64px Georgia, serif"; ctx.fillText("V E G O R A", 540, 220);
  ctx.fillStyle = "#762c3a"; ctx.font = "500 30px Helvetica, Arial, sans-serif"; ctx.fillText("YOUR ORDER NUMBER", 540, 520);
  ctx.fillStyle = "#111"; ctx.font = "400 140px Georgia, serif"; ctx.fillText(code, 540, 690);
  ctx.fillStyle = "#555"; ctx.font = "400 36px Helvetica, Arial, sans-serif";
  const lines = ["Keep this picture.", "To see where your order is, open", `${host}/track`, "and type this number with", "the phone number you gave us."];
  lines.forEach((line, index) => ctx.fillText(line, 540, 840 + index * 58));
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

export function OrderNumberCard({ code, remembered, onForget }: { code: string; remembered: boolean; onForget: () => void }) {
  const [notice, setNotice] = useState<Notice>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const flash = (value: Notice) => { setNotice(value); window.setTimeout(() => setNotice(null), 3500); };

  async function copy() {
    try { await navigator.clipboard.writeText(code); flash("copied"); } catch { flash("failed"); }
  }
  async function share() {
    try {
      await navigator.share({ title: "My VEGORA order", text: `My VEGORA order number is ${code}. Track it with the email I used.`, url: trackLink(window.location.origin, code) });
      flash("shared");
    } catch (error) { if ((error as Error).name !== "AbortError") flash("failed"); }
  }
  async function saveImage() {
    try {
      const blob = await orderCardImage(code, window.location.host);
      if (!blob) throw new Error("no image");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `vegora-order-${code}.png`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      flash("saved");
    } catch { flash("failed"); }
  }

  return <section className="order-card" aria-labelledby="order-card-title">
    <span className="order-card-label" id="order-card-title">YOUR ORDER NUMBER</span>
    <strong className="order-card-code" translate="no">{code}</strong>
    <p className="order-card-warning"><Camera size={16} aria-hidden="true" /> <span><b>Take a screenshot now.</b> We do not send emails or texts. You need this number and your phone number to see where your order is. Use them on the Track order page any time.</span></p>
    <div className="order-card-actions">
      <button type="button" onClick={() => void copy()}><Copy size={15} aria-hidden="true" /> Copy number</button>
      <button type="button" onClick={() => void saveImage()}><Download size={15} aria-hidden="true" /> Save as picture</button>
      {canShare && <button type="button" onClick={() => void share()}><Share2 size={15} aria-hidden="true" /> Share</button>}
    </div>
    <p className="order-card-notice" role="status" aria-live="polite">
      {notice === "copied" && <><Check size={14} aria-hidden="true" /> Order number copied.</>}
      {notice === "shared" && <><Check size={14} aria-hidden="true" /> Shared.</>}
      {notice === "saved" && <><Check size={14} aria-hidden="true" /> Picture saved. Look in your photos or downloads.</>}
      {notice === "failed" && "That did not work on this phone. Please take a screenshot instead."}
    </p>
    {remembered && <p className="order-card-remember">This order is saved on this phone, so Track order can open it with one tap. <button type="button" onClick={onForget}>Not your phone? Remove it</button></p>}
  </section>;
}
