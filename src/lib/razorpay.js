import crypto from "crypto";
import Razorpay from "razorpay";

/**
 * Single Razorpay client, shared by:
 *  - Standard Checkout (business wallet top-ups) — key_id/key_secret.
 *  - RazorpayX Payouts (reviewer withdrawals) — same key_id/key_secret pair
 *    (RazorpayX uses the account's regular API key, not a separate one),
 *    plus RAZORPAYX_ACCOUNT_NUMBER identifying which RazorpayX current
 *    account payouts are debited from.
 *
 * Lazily constructed so a missing key doesn't crash the app at import time
 * (e.g. build, or routes that never touch payments) — it throws only when a
 * payment/payout route actually tries to use it.
 */
let client = null;
function getClient() {
  if (client) return client;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }
  client = new Razorpay({ key_id, key_secret });
  return client;
}

/** Rupees → paise. Razorpay amounts are always in the smallest currency unit. */
function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

/* ------------------------------ Checkout (top-ups) ------------------------------ */

/** Create a Razorpay order for a wallet top-up. `receipt` should be unique-ish for tracing. */
export async function createTopupOrder({ amount, receipt, notes }) {
  const rp = getClient();
  return rp.orders.create({
    amount: toPaise(amount),
    currency: "INR",
    receipt,
    notes,
  });
}

/** Verify the client-returned Checkout signature: HMAC-SHA256(order_id|payment_id, key_secret). */
export function verifyPaymentSignature({ orderId, paymentId, signature }) {
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_secret) throw new Error("Razorpay is not configured.");
  const expected = crypto
    .createHmac("sha256", key_secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}

/** Verify a webhook payload's `X-Razorpay-Signature` against RAZORPAY_WEBHOOK_SECRET. */
export function verifyWebhookSignature({ rawBody, signature }) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured.");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return expected === signature;
}

/* ------------------------------ RazorpayX (payouts) ------------------------------ */

const RAZORPAYX_BASE = "https://api.razorpay.com/v1";

function authHeader() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error("Razorpay is not configured.");
  return "Basic " + Buffer.from(`${key_id}:${key_secret}`).toString("base64");
}

async function rpxRequest(path, { method = "GET", body } = {}) {
  const res = await fetch(`${RAZORPAYX_BASE}${path}`, {
    method,
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.description || `RazorpayX request failed (${res.status})`;
    const err = new Error(message);
    err.razorpay = data;
    throw err;
  }
  return data;
}

/** Create a RazorpayX contact for a reviewer (idempotent-ish: caller stores the id on the User). */
export async function createContact({ name, phone, reference_id }) {
  return rpxRequest("/contacts", {
    method: "POST",
    body: {
      name,
      contact: phone || undefined,
      type: "employee",
      reference_id,
    },
  });
}

/** Attach a bank account to a contact — required before a payout can target it. */
export async function createFundAccount({ contactId, accountHolderName, accountNumber, ifsc }) {
  return rpxRequest("/fund_accounts", {
    method: "POST",
    body: {
      contact_id: contactId,
      account_type: "bank_account",
      bank_account: {
        name: accountHolderName,
        ifsc,
        account_number: accountNumber,
      },
    },
  });
}

/**
 * Send money out to a fund account. `mode` IMPS is instant-ish and works for
 * most amounts/hours; RazorpayX falls back sensibly if IMPS isn't available
 * for a given bank, but callers can pass NEFT/RTGS explicitly if needed.
 */
export async function createPayout({ fundAccountId, amount, mode = "IMPS", referenceId, narration }) {
  const account_number = process.env.RAZORPAYX_ACCOUNT_NUMBER;
  if (!account_number) throw new Error("RAZORPAYX_ACCOUNT_NUMBER is not configured.");
  return rpxRequest("/payouts", {
    method: "POST",
    body: {
      account_number,
      fund_account_id: fundAccountId,
      amount: toPaise(amount),
      currency: "INR",
      mode,
      purpose: "payout",
      queue_if_low_balance: true,
      reference_id: referenceId,
      narration: narration?.slice(0, 30),
    },
  });
}

export default getClient;
