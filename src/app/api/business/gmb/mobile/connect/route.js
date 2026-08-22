import { z } from "zod";
import dbConnect from "../../../../../../lib/db";
import GmbConnection from "../../../../../../models/GmbConnection";
import GmbLocation from "../../../../../../models/GmbLocation";
import { apiRequirePermission } from "../../../../../../lib/auth/guards";
import {
  isConfigured,
  exchangeServerAuthCodeForTokens,
  getUserInfo,
  listAccounts,
  listLocations,
  formatAddress,
} from "../../../../../../lib/gmb";

/**
 * Mobile counterpart to /api/business/gmb/callback. The web flow is a
 * browser redirect through Google's consent screen back to a fixed
 * redirect_uri; a phone app has no such redirect — its native Google
 * Sign-In SDK (Android GoogleSignInOptions.requestServerAuthCode /
 * iOS GIDSignIn serverClientID) gets a one-time "server auth code" and
 * hands it to the app, which POSTs it here as plain JSON. Everything after
 * the token exchange (store connection, pull accounts/locations) is
 * identical to the web callback — kept in sync manually since one is a
 * redirect handler and the other a JSON API and they can't share a route.
 *
 * Body: { serverAuthCode }
 * Response: { ok, connectionId, googleEmail, locations: [...] }
 */
const schema = z.object({ serverAuthCode: z.string().min(1) }).strict();

export async function POST(request) {
  const { user, response } = await apiRequirePermission("connection:google:manage");
  if (response) return response;

  if (!isConfigured()) {
    return Response.json({ error: "GMB is not configured on this server." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  await dbConnect();

  let tokens;
  let info;
  try {
    tokens = await exchangeServerAuthCodeForTokens(parsed.data.serverAuthCode);
    info = await getUserInfo(tokens.access_token);
  } catch (e) {
    return Response.json({ error: String(e.message).slice(0, 200) }, { status: 400 });
  }

  const now = Date.now();
  const set = {
    user: user.id,
    userEmail: user.email,
    googleEmail: info.email,
    googleSub: info.sub,
    accessToken: tokens.access_token,
    tokenExpiresAt: new Date(now + (tokens.expires_in ?? 3600) * 1000),
    scope: tokens.scope ?? "",
    status: "active",
    lastError: "",
  };
  // Mobile server-auth-code exchanges always return a refresh token (that's
  // the point of requesting offline access) — same "only overwrite when
  // present" guard as the web callback anyway, for consistency.
  if (tokens.refresh_token) set.refreshToken = tokens.refresh_token;

  const conn = await GmbConnection.findOneAndUpdate(
    { user: user.id, googleSub: info.sub },
    { $set: set },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );

  const savedLocations = [];
  try {
    const accounts = await listAccounts(tokens.access_token);
    for (const acc of accounts) {
      const locations = await listLocations(tokens.access_token, acc.name);
      for (const loc of locations) {
        const doc = await GmbLocation.findOneAndUpdate(
          { connection: conn._id, locationName: loc.name },
          {
            $set: {
              user: user.id,
              connection: conn._id,
              googleEmail: info.email,
              accountName: acc.name,
              locationName: loc.name,
              title: loc.title ?? "",
              storeCode: loc.storeCode ?? "",
              address: formatAddress(loc.storefrontAddress),
              reviewUrl: loc.metadata?.newReviewUri ?? "",
              category: loc.categories?.primaryCategory?.displayName ?? "",
            },
          },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );
        savedLocations.push({
          id: String(doc._id),
          title: doc.title,
          address: doc.address,
          reviewUrl: doc.reviewUrl,
          category: doc.category,
        });
      }
    }
  } catch (e) {
    await GmbConnection.updateOne({ _id: conn._id }, { $set: { lastError: String(e.message).slice(0, 300) } });
  }

  return Response.json({
    ok: true,
    connectionId: String(conn._id),
    googleEmail: info.email,
    locations: savedLocations,
  });
}
