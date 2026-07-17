import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import dbConnect from "../../db";
import User from "../../../models/User";
import { verifyPassword } from "../password";
import { verifyTotp } from "../totp";
import { ROLES, requiresTotp } from "../roles";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp: z.string().optional(),
  // Which login surface the request came from. NOT a role claim — it only
  // decides whether an admin is allowed through this door. The role itself is
  // always read from the DB.
  scope: z.enum(["user", "admin"]).default("user"),
});

export default Credentials({
  name: "credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
    totp: { label: "Authenticator code", type: "text" },
  },

  async authorize(raw) {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return null;
    const { email, password, totp, scope } = parsed.data;

    await dbConnect();

    // passwordHash and totpSecret are select:false — ask for them explicitly.
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+passwordHash +totpSecret"
    );

    // Always run the compare, even with no user: bailing early makes response
    // time an account-existence oracle.
    const ok = await verifyPassword(password, user?.passwordHash ?? null);
    if (!user || !ok) return null;

    // An admin may only authenticate through /admin/login, and a non-admin may
    // never authenticate through it. Without this, a stolen admin password works
    // on the ordinary /login form, which has no TOTP field to satisfy.
    const isAdmin = user.role === ROLES.ADMIN;
    if (scope === "admin" && !isAdmin) return null;
    if (scope !== "admin" && isAdmin) return null;

    if (user.status === "suspended") return null;
    if (user.status === "pending") {
      // Signed up but never verified. Surfaced to the UI as a distinct error so
      // it can route to /verify-otp rather than saying "wrong password".
      throw new Error("EMAIL_NOT_VERIFIED");
    }

    if (requiresTotp(user.role)) {
      if (!user.totpEnabled || !user.totpSecret) throw new Error("TOTP_NOT_SET_UP");
      if (!(await verifyTotp(totp, user.totpSecret))) return null;
    }

    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    return {
      id: String(user._id),
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      status: user.status,
    };
  },
});
