"use client";

import { useState, type FormEvent } from "react";
import {
  allowedNextStatuses, emptyFulfillment, fulfillmentIndex, maxNoteLength,
  type Fulfillment, type FulfillmentInput, type FulfillmentStatus,
} from "@/lib/fulfillment";
import styles from "./admin.module.css";

const statusLabel: Record<FulfillmentStatus, string> = {
  unfulfilled: "Not started", preparing: "Preparing", dispatched: "Dispatched", delivered: "Delivered",
};

export function FulfillmentEditor({ order, busy, onSave }: {
  order: { reference: string; status: string; fulfillment?: Fulfillment };
  busy: boolean;
  onSave: (reference: string, input: FulfillmentInput) => Promise<void>;
}) {
  const current = order.fulfillment ?? emptyFulfillment;
  const [status, setStatus] = useState<FulfillmentStatus>(current.status);
  const [provider, setProvider] = useState(current.provider ?? "");
  const [trackingReference, setTrackingReference] = useState(current.trackingReference ?? "");
  const [note, setNote] = useState("");
  const canEdit = order.status === "paid";
  const needsReference = status === "dispatched" || status === "delivered";
  const movingBack = fulfillmentIndex(status) < fulfillmentIndex(current.status);
  const paymentChangedAfterStart = !canEdit && current.status !== "unfulfilled";
  const changed = status !== current.status || provider.trim() !== (current.provider ?? "") ||
    trackingReference.trim() !== (current.trackingReference ?? "") || note.trim() !== "";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || busy || !changed) return;
    void onSave(order.reference, {
      status, provider: provider.trim(), trackingReference: trackingReference.trim(), note: note.trim(),
    });
  }

  return <form className={styles.fulfillmentForm} onSubmit={submit}>
    <h2>Delivery progress</h2>
    <p>Payment: <strong>{order.status.replaceAll("_", " ")}</strong> · Delivery: <strong>{statusLabel[current.status]}</strong></p>
    {paymentChangedAfterStart
      ? <p className={styles.fulfillmentWarning} role="alert">Payment is no longer verified, but delivery had already started. Stop dispatch and check this payment in Paystack before continuing. Delivery updates stay locked until payment is verified again.</p>
      : !canEdit && <p className={styles.fulfillmentHint}>Delivery updates unlock after payment is verified.</p>}
    <div className={styles.grid}>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as FulfillmentStatus)} disabled={!canEdit || busy}>
        {allowedNextStatuses(current.status).map((item) => <option key={item} value={item}>{statusLabel[item]}</option>)}
      </select></label>
      <label>Delivery provider<input value={provider} onChange={(event) => setProvider(event.target.value)} maxLength={100} disabled={!canEdit || busy} required={needsReference} placeholder="e.g. VEGORA delivery" /></label>
    </div>
    <label>Tracking reference<input value={trackingReference} onChange={(event) => setTrackingReference(event.target.value)} maxLength={100} minLength={3} pattern="[A-Za-z0-9._/-]{3,100}" disabled={!canEdit || busy} required={needsReference} placeholder="Enter the reference used for this delivery" /></label>
    <label>Internal note<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={maxNoteLength} rows={3} disabled={!canEdit || busy} placeholder="Optional. Only the VEGORA team can see this." /></label>
    {movingBack && <p className={styles.fulfillmentWarning} role="status">This moves the order back a step. The customer&apos;s tracking page will drop the update you are undoing.</p>}
    <p className={styles.fulfillmentHint}>Record the provider and reference before marking an order dispatched. A delivered order is final. Customers see delivery progress after entering their order ID and email; notes are never shown to them.</p>
    <button type="submit" disabled={!canEdit || busy || !changed}>{busy ? "Saving…" : "Save delivery update"}</button>
  </form>;
}
