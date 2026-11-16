"use client";

import { useState, type FormEvent } from "react";
import {
  allowedNextStatuses, emptyFulfillment, fulfillmentIndex, maxNoteLength,
  type Fulfillment, type FulfillmentInput, type FulfillmentStatus,
} from "@/lib/fulfillment";
import { formatGhs } from "@/lib/catalog";
import { deliveryUnlocked, isCodOrder } from "@/lib/payment-method";
import styles from "./admin.module.css";

const statusLabel: Record<FulfillmentStatus, string> = {
  unfulfilled: "Not started", preparing: "Preparing", dispatched: "Dispatched", delivered: "Delivered",
};

export function FulfillmentEditor({ order, busy, onSave }: {
  order: { reference: string; status: string; fulfillment?: Fulfillment; paymentMethod?: string; codConfirmedAt?: string | null; totalMinor: number };
  busy: boolean;
  onSave: (reference: string, input: FulfillmentInput) => Promise<void>;
}) {
  const current = order.fulfillment ?? emptyFulfillment;
  const [status, setStatus] = useState<FulfillmentStatus>(current.status);
  const [provider, setProvider] = useState(current.provider ?? "");
  const [trackingReference, setTrackingReference] = useState(current.trackingReference ?? "");
  const [note, setNote] = useState("");
  // Delivery steps open once the money is in, or a pay-on-delivery order has been confirmed by phone.
  const canEdit = deliveryUnlocked(order);
  const cod = isCodOrder(order) && order.status === "pay_on_delivery";
  const [cashReceived, setCashReceived] = useState(false);
  const needsReference = status === "dispatched" || status === "delivered";
  const movingBack = fulfillmentIndex(status) < fulfillmentIndex(current.status);
  const cancelled = order.status === "cancelled";
  const paymentChangedAfterStart = !canEdit && !cancelled && !cod && current.status !== "unfulfilled";
  const handingOver = cod && status === "delivered" && current.status !== "delivered";
  const changed = status !== current.status || provider.trim() !== (current.provider ?? "") ||
    trackingReference.trim() !== (current.trackingReference ?? "") || note.trim() !== "";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || busy || !changed) return;
    void onSave(order.reference, {
      status, provider: provider.trim(), trackingReference: trackingReference.trim(), note: note.trim(),
      cashReceived: handingOver && cashReceived,
    });
  }

  return <form className={styles.fulfillmentForm} onSubmit={submit}>
    <h2>Delivery progress</h2>
    <p>Payment: <strong>{order.status === "pay_on_delivery" ? "pay on delivery" : order.status.replaceAll("_", " ")}</strong> · Delivery: <strong>{statusLabel[current.status]}</strong></p>
    {paymentChangedAfterStart
      ? <p className={styles.fulfillmentWarning} role="alert">Payment is no longer verified, but delivery had already started. Stop dispatch and check this payment in Paystack before continuing. Delivery updates stay locked until payment is verified again.</p>
      : cancelled ? <p className={styles.fulfillmentHint}>This order was cancelled, so delivery cannot change.</p>
      : cod && !canEdit ? <p className={styles.fulfillmentHint}>Ring the customer and press <strong>Confirm order</strong> above. Delivery steps unlock after that.</p>
      : !canEdit && <p className={styles.fulfillmentHint}>Delivery updates unlock after payment is verified.</p>}
    <div className={styles.grid}>
      <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as FulfillmentStatus)} disabled={!canEdit || busy}>
        {allowedNextStatuses(current.status).map((item) => <option key={item} value={item}>{statusLabel[item]}</option>)}
      </select></label>
      <label>Delivery provider<input value={provider} onChange={(event) => setProvider(event.target.value)} maxLength={100} disabled={!canEdit || busy} required={needsReference} placeholder="e.g. VEGORA delivery" /></label>
    </div>
    <label>Tracking reference<input value={trackingReference} onChange={(event) => setTrackingReference(event.target.value)} maxLength={100} minLength={3} pattern="[A-Za-z0-9._/-]{3,100}" disabled={!canEdit || busy} required={needsReference} placeholder="Enter the reference used for this delivery" /></label>
    <label>Internal note<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={maxNoteLength} rows={3} disabled={!canEdit || busy} placeholder="Optional. Only the VEGORA team can see this." /></label>
    {handingOver && <label className={styles.cashCheck}><input type="checkbox" checked={cashReceived} onChange={(event) => setCashReceived(event.target.checked)} disabled={!canEdit || busy} required /><span><strong>I received {formatGhs(order.totalMinor)} from the customer</strong> (cash or mobile money). This marks the order as paid.</span></label>}
    {movingBack && <p className={styles.fulfillmentWarning} role="status">This moves the order back a step. The customer&apos;s tracking page will drop the update you are undoing.</p>}
    <p className={styles.fulfillmentHint}>Record the provider and reference before marking an order dispatched. A delivered order is final. Customers see delivery progress after entering their order number and phone number; notes are never shown to them.</p>
    <button type="submit" disabled={!canEdit || busy || !changed}>{busy ? "Saving…" : "Save delivery update"}</button>
  </form>;
}
