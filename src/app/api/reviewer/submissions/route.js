import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import dbConnect from "../../../../lib/db";
import Campaign from "../../../../models/Campaign";
import Submission from "../../../../models/Submission";
import { apiRequirePermission } from "../../../../lib/auth/guards";

/**
 * Reviewer submits their participation in a campaign with a screenshot proof.
 * Guarded by feedback:submit. Multipart form-data: { campaignId, note, screenshot }.
 *
 * The screenshot is saved under public/uploads/submissions and referenced by URL.
 * (Local/dev storage — a production build would push to S3; the shape is the same.)
 */
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function POST(request) {
  const { user, response } = await apiRequirePermission("feedback:submit");
  if (response) return response;

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Invalid form data" }, { status: 400 });

  const campaignId = form.get("campaignId");
  const note = String(form.get("note") ?? "").slice(0, 500);
  const file = form.get("screenshot");

  if (!campaignId || typeof file !== "object" || typeof file.arrayBuffer !== "function") {
    return Response.json({ error: "Screenshot and campaign are required." }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) return Response.json({ error: "Screenshot must be PNG, JPG or WebP." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Screenshot must be under 5 MB." }, { status: 400 });

  await dbConnect();

  const campaign = await Campaign.findById(campaignId);
  if (!campaign || campaign.status !== "active") {
    return Response.json({ error: "Campaign is not available." }, { status: 400 });
  }
  if (campaign.collected >= campaign.targetReviews) {
    return Response.json({ error: "This campaign has reached its target." }, { status: 400 });
  }

  // One submission per reviewer per campaign.
  const existing = await Submission.findOne({ campaign: campaign._id, reviewer: user.id });
  if (existing) {
    return Response.json({ error: "You've already submitted for this campaign." }, { status: 409 });
  }

  // Save the screenshot to public/uploads/submissions.
  const bytes = Buffer.from(await file.arrayBuffer());
  const name = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "submissions");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  const screenshotUrl = `/uploads/submissions/${name}`;

  try {
    await Submission.create({
      campaign: campaign._id,
      reviewer: user.id,
      business: campaign.user,
      screenshotUrl,
      note,
      status: "pending",
    });
  } catch (e) {
    if (e?.code === 11000) {
      return Response.json({ error: "You've already submitted for this campaign." }, { status: 409 });
    }
    throw e;
  }

  return Response.json({ ok: true });
}
