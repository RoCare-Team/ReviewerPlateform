import { cookies } from "next/headers";
import dbConnect from "../db";
import User from "../../models/User";
import Account from "../../models/Account";
import googleProvider from "./providers/google";
import credentialsProvider from "./providers/credentials";
import { ROLES, canSelfSignup, supportsAuthMethod, sessionMaxAge } from "./roles";

/** Set by /signup/reviewer and /signup/business before starting Google OAuth.
 *  It carries signup INTENT only; it is validated against canSelfSignup() below
 *  and can never yield `admin`. */
export const SIGNUP_ROLE_COOKIE = "rh_signup_role";

export const authConfig = {
  providers: [googleProvider, credentialsProvider],

  session: {
    // `credentials` requires JWT sessions — Auth.js does not support database
    // sessions alongside it. Session rows would be dead weight, so User/Account
    // stay the single Mongoose source of truth and the session lives in the cookie.
    strategy: "jwt",
    maxAge: sessionMaxAge(ROLES.REVIEWER), // 30d default; admin is clamped in jwt()
  },

  pages: {
    signIn: "/login",
    error: "/auth-error",
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true; // credentials: authorize() already decided

      // Google says whether it verified the address. Never trust the bare email.
      if (!profile?.email_verified || !profile.email) return "/auth-error?e=unverified_google";

      await dbConnect();
      const email = profile.email.toLowerCase();
      const existing = await User.findOne({ email });

      if (existing) {
        if (existing.status === "suspended") return "/auth-error?e=suspended";

        // Admin must never come in through Google. An OAuth compromise must not
        // reach the admin panel.
        if (!supportsAuthMethod(existing.role, "google")) {
          return "/auth-error?e=oauth_not_allowed";
        }

        // ACCOUNT LINKING — only onto a VERIFIED email.
        //
        // The attack this blocks: attacker registers victim@x.com with a password
        // and never verifies it. Victim later clicks "Continue with Google" with
        // their real address. If we linked here, the attacker's password would be
        // a live credential on the victim's account.
        //
        // emailVerified is set only by a redeemed OTP or by a previous Google
        // sign-in, so an unverified row is never linkable.
        if (!existing.emailVerified) {
          return "/auth-error?e=verify_email_first";
        }

        await Account.updateOne(
          { provider: "google", providerAccountId: account.providerAccountId },
          {
            $set: {
              userId: existing._id,
              type: "oauth",
              scope: account.scope,
              expires_at: account.expires_at,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
            },
          },
          { upsert: true }
        );

        await User.updateOne(
          { _id: existing._id },
          {
            $set: {
              lastLoginAt: new Date(),
              ...(existing.image ? {} : { image: profile.picture }),
              ...(existing.name ? {} : { name: profile.name }),
            },
          }
        );

        user.id = String(existing._id);
        user.role = existing.role;
        user.status = existing.status;
        return true;
      }

      // New user via Google. Role comes from the signup route the user came
      // through, never from anything Google or the client sent.
      const jar = await cookies();
      const intent = jar.get(SIGNUP_ROLE_COOKIE)?.value;

      if (!intent || !canSelfSignup(intent)) {
        // Hit "Continue with Google" on /login with no account: we cannot guess
        // whether they're a reviewer or a business. Send them to pick.
        return "/signup?e=choose_role";
      }

      const created = await User.create({
        email,
        name: profile.name,
        image: profile.picture,
        role: intent,
        // Google already verified the address, so no OTP round-trip.
        emailVerified: new Date(),
        status: "active",
        passwordHash: null,
        lastLoginAt: new Date(),
      });

      await Account.create({
        userId: created._id,
        provider: "google",
        providerAccountId: account.providerAccountId,
        type: "oauth",
        scope: account.scope,
        expires_at: account.expires_at,
        access_token: account.access_token,
        refresh_token: account.refresh_token,
      });

      user.id = String(created._id);
      user.role = created.role;
      user.status = created.status;
      return true;
    },

    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;
        // Admin sessions expire in 8h, not 30d — the session cookie's maxAge is
        // global, so we carry an absolute deadline on the token and enforce it here.
        token.exp = Math.floor(Date.now() / 1000) + sessionMaxAge(user.role);
      }

      // Re-read role/status from the DB on explicit update() so a suspension or
      // role change takes effect without waiting for the token to expire.
      if (trigger === "update" && token.id) {
        await dbConnect();
        const fresh = await User.findById(token.id).select("role status");
        if (!fresh || fresh.status === "suspended") return null;
        token.role = fresh.role;
        token.status = fresh.status;
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.status = token.status;
      }
      return session;
    },
  },
};
