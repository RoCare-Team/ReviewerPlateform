import crypto from "node:crypto";

/**
 * Google Business Profile (GMB) OAuth + API client.
 *
 * ★ SEPARATE from sign-in-with-Google. This uses its own OAuth client
 *   (GMB_CLIENT_ID / GMB_CLIENT_SECRET) with the business.manage scope. Never
 *   reuse the AUTH_GOOGLE_* sign-in client here — a business owner routinely
 *   signs in with one Gmail and connects a different Google account that owns
 *   the listing.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

// Account + location management and the v4 reviews surface.
const ACCOUNTS_API = "https://mybusinessaccountmanagement.googleapis.com/v1";
const INFO_API = "https://mybusinessbusinessinformation.googleapis.com/v1";
const V4_API = "https://mybusiness.googleapis.com/v4";

// business.manage for GMB; openid+email to read WHICH Google account connected.
const SCOPES = ["https://www.googleapis.com/auth/business.manage", "openid", "email", "profile"];

function appUrl() {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export function redirectUri() {
  return `${appUrl()}/api/business/gmb/callback`;
}

export function isConfigured() {
  return Boolean(process.env.GMB_CLIENT_ID && process.env.GMB_CLIENT_SECRET);
}

/* ------------------------------- OAuth state ------------------------------ */
// Signed, short-lived state bound to the user id — prevents CSRF and login-CSRF.
// Format: base64url(payload).hmac  where payload = {u, n, exp}.

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function hmac(data) {
  const secret = process.env.AUTH_SECRET ?? "dev-secret";
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

export function signState(userId) {
  const payload = b64url(
    JSON.stringify({ u: String(userId), n: crypto.randomBytes(8).toString("hex"), exp: Date.now() + 10 * 60 * 1000 })
  );
  return `${payload}.${hmac(payload)}`;
}

export function verifyState(state, userId) {
  if (typeof state !== "string" || !state.includes(".")) return false;
  const [payload, sig] = state.split(".");
  const expected = hmac(payload);
  // Constant-time compare.
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return false;
  }
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return u === String(userId) && Date.now() < exp;
  } catch {
    return false;
  }
}

/* ------------------------------ OAuth flow -------------------------------- */

export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GMB_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // ask for a refresh token
    prompt: "consent", // force refresh token even on re-consent
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GMB_CLIENT_ID,
      client_secret: process.env.GMB_CLIENT_SECRET,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return res.json(); // { access_token, refresh_token, expires_in, scope, id_token }
}

export async function refreshAccessToken(refreshToken) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GMB_CLIENT_ID,
      client_secret: process.env.GMB_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  return res.json(); // { access_token, expires_in, scope }
}

export async function getUserInfo(accessToken) {
  const res = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`userinfo failed: ${res.status}`);
  return res.json(); // { sub, email, ... }
}

export async function revokeToken(token) {
  try {
    await fetch(`${REVOKE_ENDPOINT}?token=${encodeURIComponent(token)}`, { method: "POST" });
  } catch {
    // Best-effort — we delete our records regardless.
  }
}

/**
 * Return a valid access token for a connection doc, refreshing (and persisting)
 * if it's within 60s of expiry. `conn` must have been selected WITH the token
 * fields (+accessToken +refreshToken).
 */
export async function getValidAccessToken(conn) {
  const soon = Date.now() + 60 * 1000;
  if (conn.accessToken && conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() > soon) {
    return conn.accessToken;
  }
  if (!conn.refreshToken) throw new Error("No refresh token — reconnect required.");

  const tok = await refreshAccessToken(conn.refreshToken);
  conn.accessToken = tok.access_token;
  conn.tokenExpiresAt = new Date(Date.now() + (tok.expires_in ?? 3600) * 1000);
  await conn.save();
  return conn.accessToken;
}

/* ------------------------------- GMB API ---------------------------------- */

async function gapi(url, accessToken) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return json;
}

/** List GMB accounts the connected Google account can manage. */
export async function listAccounts(accessToken) {
  const data = await gapi(`${ACCOUNTS_API}/accounts`, accessToken);
  return data.accounts ?? []; // [{ name: "accounts/123", accountName, type }]
}

/** List locations under an account ("accounts/123"). */
export async function listLocations(accessToken, accountName) {
  // `metadata` carries `newReviewUri` — Google's own "write a review" link for
  // the location, so a campaign can be pre-filled with the real review URL
  // instead of asking the business owner to go find and paste it.
  const readMask = "name,title,storeCode,storefrontAddress,metadata";
  const url = `${INFO_API}/${accountName}/locations?readMask=${encodeURIComponent(readMask)}&pageSize=100`;
  const data = await gapi(url, accessToken);
  return data.locations ?? []; // [{ name: "locations/456", title, storefrontAddress }]
}

/**
 * List reviews for a location. Uses the v4 endpoint which needs the combined
 * account+location path. NOTE: the v4 reviews API requires Google to allowlist
 * the project; if it isn't, this throws with the API's error message, which the
 * route surfaces to the UI.
 */
export async function listReviews(accessToken, accountName, locationName) {
  const url = `${V4_API}/${accountName}/${locationName}/reviews?pageSize=50`;
  const data = await gapi(url, accessToken);
  return data; // { reviews, averageRating, totalReviewCount }
}

const STAR_MAP = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export function normalizeReview(r) {
  return {
    reviewId: r.reviewId ?? r.name ?? "",
    reviewerName: r.reviewer?.displayName ?? "Anonymous",
    reviewerPhoto: r.reviewer?.profilePhotoUrl ?? "",
    starRating: STAR_MAP[r.starRating] ?? 0,
    comment: r.comment ?? "",
    createTime: r.createTime ? new Date(r.createTime) : undefined,
    updateTime: r.updateTime ? new Date(r.updateTime) : undefined,
    reply: r.reviewReply?.comment ?? "",
  };
}

export function formatAddress(storefrontAddress) {
  if (!storefrontAddress) return "";
  const lines = storefrontAddress.addressLines ?? [];
  return [...lines, storefrontAddress.locality, storefrontAddress.administrativeArea]
    .filter(Boolean)
    .join(", ");
}
