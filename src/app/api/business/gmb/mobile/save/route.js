import { z } from "zod";
import dbConnect from "../../../../../../lib/db";
import GmbConnection from "../../../../../../models/GmbConnection";
import GmbLocation from "../../../../../../models/GmbLocation";
import { apiRequirePermission } from "../../../../../../lib/auth/guards";

/**
 * Mobile counterpart to /api/business/gmb/mobile/connect — but instead of
 * this server doing the Google token exchange + accounts/locations lookup
 * itself, the phone app already has everything (it signed in with the
 * native Google Business Profile SDK / API on-device) and just hands it
 * over to be persisted. Saves the same fields the web callback and
 * mobile/connect routes save, so downstream code (sync, reply, auto-reply)
 * works identically regardless of which route created the connection.
 *
 * Body: {
 *   googleEmail, googleSub, accessToken, refreshToken?, tokenExpiresAt?, scope?,
 *   locations: [{ accountName, locationName, title?, storeCode?, address?, category?, reviewUrl? }]
 * }
 * Response: { ok, connectionId, googleEmail, locations: [...] }
 */
const locationSchema = z.object({
  accountName: z.string().min(1),
  locationName: z.string().min(1),
  title: z.string().optional(),
  storeCode: z.string().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  reviewUrl: z.string().optional(),
});

const schema = z
  .object({
    googleEmail: z.string().email(),
    googleSub: z.string().min(1),
    accessToken: z.string().min(1),
    refreshToken: z.string().optional(),
    tokenExpiresAt: z.coerce.date().optional(),
    scope: z.string().optional(),
    locations: z.array(locationSchema).default([]),
  })
  .strict();

export async function POST(request) {
  const { user, response } = await apiRequirePermission("connection:google:manage");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

  const data = parsed.data;
  await dbConnect();

  const set = {
    user: user.id,
    userEmail: user.email,
    googleEmail: data.googleEmail,
    googleSub: data.googleSub,
    accessToken: data.accessToken,
    tokenExpiresAt: data.tokenExpiresAt ?? new Date(Date.now() + 3600 * 1000),
    scope: data.scope ?? "",
    status: "active",
    lastError: "",
  };
  // Same "only overwrite when present" guard as the web callback / mobile
  // connect route — a re-save without a fresh refresh token shouldn't wipe
  // the one already on file.
  if (data.refreshToken) set.refreshToken = data.refreshToken;

  const conn = await GmbConnection.findOneAndUpdate(
    { user: user.id, googleSub: data.googleSub },
    { $set: set },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true }
  );

  const savedLocations = [];
  for (const loc of data.locations) {
    const doc = await GmbLocation.findOneAndUpdate(
      { connection: conn._id, locationName: loc.locationName },
      {
        $set: {
          user: user.id,
          connection: conn._id,
          googleEmail: data.googleEmail,
          accountName: loc.accountName,
          locationName: loc.locationName,
          title: loc.title ?? "",
          storeCode: loc.storeCode ?? "",
          address: loc.address ?? "",
          reviewUrl: loc.reviewUrl ?? "",
          category: loc.category ?? "",
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

  return Response.json({
    ok: true,
    connectionId: String(conn._id),
    googleEmail: data.googleEmail,
    locations: savedLocations,
  });
}
