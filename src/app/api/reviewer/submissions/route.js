import dbConnect from "../../../../lib/db";
import Campaign from "../../../../models/Campaign";
import Submission from "../../../../models/Submission";
import { apiRequirePermission } from "../../../../lib/auth/guards";
import { uploadImage, cloudinaryConfigured } from "../../../../lib/cloudinary";

/**
 * Reviewer submits their participation in a campaign with a screenshot proof.
 * Guarded by feedback:submit. Multipart form-data: { campaignId, note, screenshot }.
 *
 * The screenshot is uploaded to Cloudinary (signed) and referenced by URL — never
 * stored on the app server. All uploads validate type, size and magic bytes.
 */
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

// Magic-byte signatures so a renamed non-image can't slip past the mime check.
function sniffImage(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

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
  if (!ALLOWED[file.type]) return Response.json({ error: "Screenshot must be PNG, JPG or WebP." }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "The screenshot file is empty." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "Screenshot must be under 5 MB." }, { status: 400 });

  if (!cloudinaryConfigured()) {
    return Response.json({ error: "Image uploads are not configured on the server." }, { status: 503 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImage(bytes);
  if (!sniffed || sniffed !== file.type) {
    return Response.json({ error: "File doesn't look like a valid image." }, { status: 400 });
  }

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

  // Upload the screenshot to Cloudinary (signed).
  let upload;
  try {
    upload = await uploadImage(bytes, file.type);
  } catch (e) {
    return Response.json({ error: `Upload failed: ${e.message}` }, { status: 502 });
  }

  try {
    await Submission.create({
      campaign: campaign._id,
      reviewer: user.id,
      business: campaign.user,
      screenshotUrl: upload.url,
      screenshotPublicId: upload.publicId,
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
