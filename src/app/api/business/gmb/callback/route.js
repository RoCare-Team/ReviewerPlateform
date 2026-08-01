import { redirect } from "next/navigation";
import dbConnect from "../../../../../lib/db";
import GmbConnection from "../../../../../models/GmbConnection";
import GmbLocation from "../../../../../models/GmbLocation";
import { getCurrentUser } from "../../../../../lib/auth/session";
import { can } from "../../../../../lib/auth/permissions";
import {
  verifyState,
  exchangeCodeForTokens,
  getUserInfo,
  listAccounts,
  listLocations,
  formatAddress,
} from "../../../../../lib/gmb";

/**
 * OAuth callback. Verifies the signed state (bound to the session user),
 * exchanges the code, stores/updates the connection keyed by (user, googleSub),
 * then best-effort syncs the account's locations. Redirects back to the
 * Connections page with a status query.
 */
export async function GET(request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "connection:google:manage")) redirect("/login");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) redirect(`/business/connections?gmb=denied`);
  if (!code || !verifyState(state, user.id)) {
    redirect(`/business/connections?gmb=invalid_state`);
  }

  let connectionId;
  try {
    const tokens = await exchangeCodeForTokens(code);
    const info = await getUserInfo(tokens.access_token);

    await dbConnect();

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
    // Only overwrite the refresh token when Google actually returns one (it does
    // on first consent / prompt=consent; a missing one must not wipe the stored).
    if (tokens.refresh_token) set.refreshToken = tokens.refresh_token;

    const conn = await GmbConnection.findOneAndUpdate(
      { user: user.id, googleSub: info.sub },
      { $set: set },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
    );
    connectionId = conn._id;

    // Best-effort: pull accounts + locations now so the UI has something to show.
    try {
      const accounts = await listAccounts(tokens.access_token);
      for (const acc of accounts) {
        const locations = await listLocations(tokens.access_token, acc.name);
        for (const loc of locations) {
          await GmbLocation.findOneAndUpdate(
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
              },
            },
            { upsert: true, setDefaultsOnInsert: true }
          );
        }
      }
    } catch (e) {
      // Locations may be empty or the API not yet enabled — keep the connection.
      await GmbConnection.updateOne({ _id: conn._id }, { $set: { lastError: String(e.message).slice(0, 300) } });
    }
  } catch (e) {
    redirect(`/business/connections?gmb=error&msg=${encodeURIComponent(String(e.message).slice(0, 120))}`);
  }

  redirect(`/business/connections?gmb=connected`);
}
