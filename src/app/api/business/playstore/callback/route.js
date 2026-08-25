import { redirect } from "next/navigation";
import dbConnect from "../../../../../lib/db";
import PlayStoreConnection from "../../../../../models/PlayStoreConnection";
import { getCurrentUser } from "../../../../../lib/auth/session";
import { can } from "../../../../../lib/auth/permissions";
import { verifyState, exchangeCodeForTokens, getUserInfo } from "../../../../../lib/playstore";

/**
 * OAuth callback. Verifies the signed state (bound to the session user),
 * exchanges the code, stores/updates the connection keyed by (user, googleSub).
 * Unlike GMB there's no "list my locations" equivalent to prefetch — the user
 * adds package names manually afterwards (see /api/business/playstore/apps).
 */
export async function GET(request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "connection:playstore:manage")) redirect("/login");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) redirect(`/business/connections?playstore=denied`);
  if (!code || !verifyState(state, user.id)) {
    redirect(`/business/connections?playstore=invalid_state`);
  }

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

    await PlayStoreConnection.findOneAndUpdate(
      { user: user.id, googleSub: info.sub },
      { $set: set },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (e) {
    redirect(`/business/connections?playstore=error&msg=${encodeURIComponent(String(e.message).slice(0, 120))}`);
  }

  redirect(`/business/connections?playstore=connected`);
}
