import crypto from "node:crypto";

/**
 * Google Play Store (androidpublisher) OAuth + API client.
 *
 * ★ SEPARATE from sign-in-with-Google and from GMB (see lib/gmb.js). This uses
 *   its own OAuth client (PLAYSTORE_CLIENT_ID / PLAYSTORE_CLIENT_SECRET) with
 *   the androidpublisher scope. A connected Google account can only fetch
 *   reviews for apps IT has Play Console access to — there is no endpoint to
 *   read an arbitrary third-party app's reviews. Ownership isn't checked by
 *   this app; Google enforces it and a sync call 403s if access is missing.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

const PUBLISHER_API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

const SCOPES = ["https://www.googleapis.com/auth/androidpublisher", "openid", "email", "profile"];

function appUrl() {
  return process.env.APP_URL ?? "http://localhost:3000";
}

export function redirectUri() {
  return `${appUrl()}/api/business/playstore/callback`;
}

export function isConfigured() {
  return Boolean(process.env.PLAYSTORE_CLIENT_ID && process.env.PLAYSTORE_CLIENT_SECRET);
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
    client_id: process.env.PLAYSTORE_CLIENT_ID,
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
      client_id: process.env.PLAYSTORE_CLIENT_ID,
      client_secret: process.env.PLAYSTORE_CLIENT_SECRET,
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
      client_id: process.env.PLAYSTORE_CLIENT_ID,
      client_secret: process.env.PLAYSTORE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Token refresh failed: ${res.status} ${body}`);
    // Same invalid_grant caveat as GMB — see lib/gmb.js for the causes.
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
    if (conn.status !== "active" || conn.lastError) {
      conn.status = "active";
      conn.lastError = "";
    }
    await conn.save();
    return conn.accessToken;
  } catch (e) {
    if (e.invalidGrant) {
      conn.status = "revoked";
      conn.lastError = "Google access expired or was revoked — reconnect this account.";
      await conn.save();
    }
    throw e;
  }
}

/* ---------------------------- androidpublisher ----------------------------- */

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
    // 403 here almost always means the connected Google account has no Play
    // Console access to this package — surface Google's own message.
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return json;
}

async function gapiPost(url, accessToken, body) {
  const res = await fetch(url, {
    method: "POST",
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

/**
 * List reviews for a package. `token` paginates (androidpublisher returns up
 * to ~20 per page); pass `undefined` for the first page.
 */
export async function listReviews(accessToken, packageName, token) {
  const params = new URLSearchParams({ maxResults: "100" });
  if (token) params.set("token", token);
  const url = `${PUBLISHER_API}/${encodeURIComponent(packageName)}/reviews?${params.toString()}`;
  const data = await gapi(url, accessToken);
  return data; // { reviews, tokenPagination: { nextPageToken } }
}

/**
 * Reply to (or overwrite) the developer reply on a review. Android Publisher
 * only supports one reply per review — this replaces it, same as replying
 * again from the Play Console.
 */
export async function postReviewReply(accessToken, packageName, reviewId, replyText) {
  const url = `${PUBLISHER_API}/${encodeURIComponent(packageName)}/reviews/${encodeURIComponent(reviewId)}:reply`;
  const data = await gapiPost(url, accessToken, { replyText });
  return data; // { result: { replyText, lastEdited } }
}

const STAR = (n) => Math.max(0, Math.min(5, Number(n) || 0));

/** Flatten one androidpublisher review resource into our storage shape. */
export function normalizeReview(r) {
  const uc = r.comments?.[0]?.userComment ?? {};
  const dc = r.comments?.find((c) => c.developerComment)?.developerComment;
  const seconds = uc.lastModified?.seconds;
  return {
    reviewId: r.reviewId ?? "",
    authorName: r.authorName ?? "Anonymous",
    starRating: STAR(uc.starRating),
    text: uc.text ?? "",
    reviewerLanguage: uc.reviewerLanguage ?? "",
    device: uc.device ?? "",
    appVersionName: uc.appVersionName ?? "",
    thumbsUpCount: uc.thumbsUpCount ?? 0,
    thumbsDownCount: uc.thumbsDownCount ?? 0,
    lastModified: seconds ? new Date(Number(seconds) * 1000) : undefined,
    reply: dc?.text ?? "",
    replyLastModified: dc?.lastModified?.seconds ? new Date(Number(dc.lastModified.seconds) * 1000) : undefined,
  };
}

/**
 * Sync reviews for every tracked app of a connection into PlayStoreReview,
 * updating each app's reviewCount/averageRating/lastSyncedAt. Never throws —
 * per-app failures (e.g. no Play Console access to that package) are
 * collected into `errors` so one broken app doesn't block the rest.
 *
 * `conn` must be selected WITH token fields (+accessToken +refreshToken).
 * Returns { totalSynced, errors }.
 */
export async function syncConnectionReviews(conn, apps) {
  // Lazy import to avoid a require cycle (models import nothing from playstore.js).
  const { default: PlayStoreReview } = await import("../models/PlayStoreReview.js");
  const { default: PlayStoreApp } = await import("../models/PlayStoreApp.js");

  let accessToken;
  try {
    accessToken = await getValidAccessToken(conn);
  } catch (e) {
    return { totalSynced: 0, errors: [`Token refresh failed: ${e.message}`] };
  }

  let totalSynced = 0;
  const errors = [];

  for (const app of apps) {
    try {
      let pageToken;
      const all = [];
      // Android Publisher paginates ~20-100 at a time; follow nextPageToken
      // but cap it so one huge app can't loop forever inside a request.
      for (let page = 0; page < 20; page++) {
        const data = await listReviews(accessToken, app.packageName, pageToken);
        all.push(...(data.reviews ?? []));
        pageToken = data.tokenPagination?.nextPageToken;
        if (!pageToken) break;
      }

      let sum = 0;
      for (const raw of all) {
        const r = normalizeReview(raw);
        if (!r.reviewId) continue;
        await PlayStoreReview.findOneAndUpdate(
          { app: app._id, reviewId: r.reviewId },
          { $set: { ...r, user: conn.user, connection: conn._id, app: app._id } },
          { upsert: true, setDefaultsOnInsert: true }
        );
        totalSynced += 1;
        sum += r.starRating;
      }

      await PlayStoreApp.updateOne(
        { _id: app._id },
        {
          $set: {
            reviewCount: all.length,
            averageRating: all.length ? sum / all.length : 0,
            lastSyncedAt: new Date(),
          },
        }
      );
    } catch (e) {
      errors.push(`${app.label || app.packageName}: ${e.message}`);
    }
  }

  return { totalSynced, errors };
}
