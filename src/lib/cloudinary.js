import crypto from "node:crypto";

/**
 * Minimal Cloudinary signed-upload client — no SDK dependency. Uploads a buffer
 * to Cloudinary and returns the secure URL + public id. Signing is done with the
 * API secret so uploads can't be forged from the client.
 *
 * Env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
 */
const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const KEY = process.env.CLOUDINARY_API_KEY;
const SECRET = process.env.CLOUDINARY_API_SECRET;

export function cloudinaryConfigured() {
  return Boolean(CLOUD && KEY && SECRET);
}

/** Sign the (alphabetically sorted) params with the API secret (Cloudinary spec). */
function sign(params) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(toSign + SECRET).digest("hex");
}

/**
 * Upload an image buffer. `folder` groups uploads in Cloudinary. Returns
 * { url, publicId }. Throws with the API message on failure.
 */
export async function uploadImage(buffer, mime, folder = "reviewhub/submissions") {
  if (!cloudinaryConfigured()) {
    throw new Error("Cloudinary is not configured on the server.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = sign({ folder, timestamp });
  const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;

  const form = new FormData();
  form.append("file", dataUri);
  form.append("api_key", KEY);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Cloudinary upload failed (${res.status})`);
  }
  return { url: data.secure_url, publicId: data.public_id };
}
