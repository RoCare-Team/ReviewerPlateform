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
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Token refresh failed: ${res.status} ${body}`);
    // Google returns invalid_grant when the refresh token itself is dead —
    // manually revoked from the Google Account, the connected account's
    // password changed, unused for 6+ months, or (most common cause here) the
    // OAuth consent screen is still in "Testing" mode, which caps refresh
    // tokens at 7 days regardless of how correctly this app uses them. No
    // amount of retrying fixes this — only re-consenting does.
    err.invalidGrant = /invalid_grant/i.test(body);
    throw err;
  }
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

  try {
    const tok = await refreshAccessToken(conn.refreshToken);
    conn.accessToken = tok.access_token;
    conn.tokenExpiresAt = new Date(Date.now() + (tok.expires_in ?? 3600) * 1000);
    // Recovered from a previous failed refresh (e.g. was transiently down) —
    // clear any stale "revoked"/"error" flag so the business UI stops asking
    // to reconnect something that just worked.
    if (conn.status !== "active" || conn.lastError) {
      conn.status = "active";
      conn.lastError = "";
    }
    await conn.save();
    return conn.accessToken;
  } catch (e) {
    // invalid_grant means the refresh token itself is dead — persist that so
    // the business sees "reconnect required" instead of this cron silently
    // failing the same way every 10-15 minutes forever with no visible cause.
    if (e.invalidGrant) {
      conn.status = "revoked";
      conn.lastError = "Google access expired or was revoked — reconnect this account.";
      await conn.save();
    }
    throw e;
  }
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

/** Same as gapi() but PUTs a JSON body — used for posting a review reply. */
async function gapiPut(url, accessToken, body) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
  // instead of asking the business owner to go find and paste it. `categories`
  // carries the business's own Google category (e.g. "Dental clinic") — used
  // to steer the AI review-draft prompt toward business-relevant phrasing,
  // see lib/aiReviewDrafts.js.
  const readMask = "name,title,storeCode,storefrontAddress,metadata,categories";
  const url = `${INFO_API}/${accountName}/locations?readMask=${encodeURIComponent(readMask)}&pageSize=100`;
  const data = await gapi(url, accessToken);
  return data.locations ?? []; // [{ name: "locations/456", title, storefrontAddress, categories }]
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

/**
 * Post (or overwrite) the business's reply to a review. Google's v4 API only
 * supports a single reply per review — calling this again replaces whatever
 * reply is already there, same as editing a reply from the Google Maps app.
 * `reviewId` must be the bare id (GmbReview.reviewId), matching how
 * `listReviews`/`normalizeReview` store it.
 */
export async function postReviewReply(accessToken, accountName, locationName, reviewId, comment) {
  const url = `${V4_API}/${accountName}/${locationName}/reviews/${reviewId}/reply`;
  const data = await gapiPut(url, accessToken, { comment });
  return data; // { comment, updateTime }
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

/**
 * Sync reviews for every location of a connection into GmbReview, updating
 * each location's reviewCount/averageRating/lastSyncedAt. Shared by the
 * manual "Sync reviews" button (api/business/gmb/sync), the auto-sync on
 * page load (business/reviews), and the reviewer-submission GMB cross-check
 * (lib/gmbVerification.js) — one code path, so all three stay consistent.
 *
 * `conn` must be selected WITH token fields (+accessToken +refreshToken).
 * Returns { totalSynced, errors }. Never throws — per-location failures are
 * collected into `errors` so one broken location doesn't block the rest.
 */
export async function syncConnectionReviews(conn, locations) {
  // Lazy import to avoid a require cycle (models import nothing from gmb.js).
  const { default: GmbReview } = await import("../models/GmbReview.js");
  const { default: GmbLocation } = await import("../models/GmbLocation.js");

  let accessToken;
  try {
    accessToken = await getValidAccessToken(conn);
  } catch (e) {
    return { totalSynced: 0, errors: [`Token refresh failed: ${e.message}`] };
  }

  let totalSynced = 0;
  const errors = [];

  for (const loc of locations) {
    try {
      const data = await listReviews(accessToken, loc.accountName, loc.locationName);
      const reviews = data.reviews ?? [];
      for (const raw of reviews) {
        const r = normalizeReview(raw);
        if (!r.reviewId) continue;
        await GmbReview.findOneAndUpdate(
          { location: loc._id, reviewId: r.reviewId },
          { $set: { ...r, user: conn.user, connection: conn._id, location: loc._id } },
          { upsert: true, setDefaultsOnInsert: true }
        );
        totalSynced += 1;
      }
      await GmbLocation.updateOne(
        { _id: loc._id },
        {
          $set: {
            reviewCount: data.totalReviewCount ?? reviews.length,
            averageRating: data.averageRating ?? 0,
            lastSyncedAt: new Date(),
          },
        }
      );
    } catch (e) {
      errors.push(`${loc.title || loc.locationName}: ${e.message}`);
    }
  }

  return { totalSynced, errors };
}

export function formatAddress(storefrontAddress) {
  if (!storefrontAddress) return "";
  const lines = storefrontAddress.addressLines ?? [];
  return [...lines, storefrontAddress.locality, storefrontAddress.administrativeArea]
    .filter(Boolean)
    .join(", ");
}
