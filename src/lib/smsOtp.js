/**
 * SMS OTP delivery via the external gateway (the same PHP backend used for
 * phone verification elsewhere).
 *
 * ✅ Confirmed working shapes (verified by direct testing against the live
 * endpoints — the two endpoints authenticate differently, both confirmed):
 *  - SEND requires the `X-App-Token` request header — without it, rejected
 *    as "Unauthorized". Body is just `{ phoneNumber }`.
 *  - VERIFY needs no auth at all — plain `Content-Type: application/json`
 *    and `{ phoneNumber, newOtp }` body. Adding the header doesn't hurt, but
 *    it isn't required, so it's left out to match the confirmed-working shape.
 */
const SEND_URL = process.env.NEXT_PUBLIC_API_SEND_OTP;
const VERIFY_URL = process.env.NEXT_PUBLIC_API_VERIFY_OTP;
const OTP_TOKEN = process.env.OTP_TOKEN;

/**
 * Test numbers that skip the real SMS gateway entirely — no OTP is sent, and
 * "1234" always verifies. Add more 10-digit numbers here as needed (e.g. for
 * app-store review accounts or internal QA).
 */
const TEST_PHONES = ["8709877815","8709877816", "8709877817"];
const TEST_OTP = "1234";

function isTestPhone(phone) {
  return TEST_PHONES.includes(phone);
}

export function smsOtpConfigured() {
  return Boolean(SEND_URL && VERIFY_URL && OTP_TOKEN);
}

function isSuccess(data) {
  return Boolean(data && typeof data === "object" && data.error === false);
}

async function callGateway(url, body, label, extraHeaders = {}) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    console.error(`[smsOtp] ${label} request failed`, e.message);
    return { ok: false, data: {} };
  }

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  const ok = res.ok && isSuccess(data);
  if (!ok) console.error(`[smsOtp] ${label} unsuccessful`, { status: res.status, data });
  return { ok, data };
}

/** Send a 4-digit OTP SMS to `phone` (10 digits, no country code). */
export async function sendSmsOtp(phone) {
  if (isTestPhone(phone)) {
    return { ok: true, message: "OTP sent." };
  }
  if (!smsOtpConfigured()) {
    return { ok: false, message: "SMS OTP isn't configured on the server." };
  }
  const { ok, data } = await callGateway(SEND_URL, { phoneNumber: phone }, "send", { "X-App-Token": OTP_TOKEN });
  return { ok, message: data?.msg || data?.message || (ok ? "OTP sent." : "Failed to send OTP. Please try again.") };
}

/** Verify a 4-digit OTP previously sent to `phone`. */
export async function verifySmsOtp(phone, otp) {
  if (isTestPhone(phone)) {
    return otp === TEST_OTP
      ? { ok: true, message: "Verified." }
      : { ok: false, message: "That code isn't valid." };
  }
  if (!smsOtpConfigured()) {
    return { ok: false, message: "SMS OTP isn't configured on the server." };
  }
  const { ok, data } = await callGateway(VERIFY_URL, { phoneNumber: phone, newOtp: otp }, "verify");
  return { ok, message: data?.msg || data?.message || (ok ? "Verified." : "That code isn't valid.") };
}
