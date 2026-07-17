import Google from "next-auth/providers/google";

/**
 * Sign-in-with-Google — IDENTITY ONLY.
 *
 * This is NOT the Google Business Profile connection. Do not add business.manage
 * scope here, and do not reuse the token this issues for GBP API calls. A business
 * owner will routinely sign in with a personal Gmail and connect a different
 * Google account that actually owns the GBP listing — reusing this token breaks
 * the first time that happens.
 *
 * GBP lives at /business/connections/google with its own consent flow and its own
 * long-lived refresh token stored per organisation.
 */
export default Google({
  clientId: process.env.AUTH_GOOGLE_ID,
  clientSecret: process.env.AUTH_GOOGLE_SECRET,
  authorization: {
    params: {
      scope: "openid email profile",
      prompt: "select_account",
    },
  },
});
