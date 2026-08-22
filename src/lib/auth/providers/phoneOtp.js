import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import dbConnect from "../../db";
import User from "../../../models/User";
import { consumeToken } from "../tokens";

/**
 * Establishes the actual session after phone OTP verification. Does NOT talk
 * to the SMS gateway itself — by the time this runs, /api/auth/otp/phone/verify
 * (or /api/auth/signup/{business,reviewer}/phone) has already confirmed the
 * code with the gateway and minted a one-shot `phone_login` token
 * (lib/auth/phoneAuth.js). This provider just redeems that token, exactly
 * the same bridge the email flow uses for `otpToken` in providers/credentials.js.
 */
const schema = z.object({
  phone: z.string().trim().regex(/^\d{10}$/),
  otpToken: z.string().min(1),
});

export default Credentials({
  id: "phone-otp",
  name: "Phone OTP",
  credentials: {
    phone: { label: "Phone", type: "text" },
    otpToken: { label: "One-time login token", type: "text" },
  },

  async authorize(raw) {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return null;
    const { phone, otpToken } = parsed.data;

    const redeemed = await consumeToken(otpToken, "phone_login");
    if (!redeemed || redeemed.identifier !== phone) return null;

    await dbConnect();
    // role !== admin: this door is only for reviewer/business_owner — admin
    // never has a phone-based account (see data/roles.json).
    const user = await User.findOne({ phone, role: { $ne: "admin" } });
    if (!user || user.status !== "active") return null;

    return {
      id: String(user._id),
      name: user.name,
      role: user.role,
      status: user.status,
      phone: user.phone,
    };
  },
});
