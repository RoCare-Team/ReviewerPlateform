/**
 * Pixel dimensions straight from the file bytes — no image-processing
 * library, same "no extra dependency" posture as the magic-byte sniff in
 * api/business/campaigns/upload-image/route.js. Returns `{ width, height }`
 * or `null` if the format isn't one of the three this app accepts
 * (PNG/JPEG/WebP) or the bytes are malformed — callers treat `null` as
 * "couldn't verify", not "definitely invalid".
 */
export function getImageDimensions(buf, mime) {
  try {
    if (mime === "image/png") return pngDimensions(buf);
    if (mime === "image/jpeg") return jpegDimensions(buf);
    if (mime === "image/webp") return webpDimensions(buf);
  } catch {
    // Fall through to null — a parse error here is a "can't tell", not a
    // "reject this image" signal (see docblock above).
  }
  return null;
}

// PNG: 8-byte signature, then the IHDR chunk — 4-byte length, 4-byte type
// ("IHDR"), then width and height as big-endian uint32s. Fixed offsets,
// always the first chunk in a valid PNG.
function pngDimensions(buf) {
  if (buf.length < 24) return null;
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// JPEG: walk the marker segments (each is 0xFF + a marker byte + a
// big-endian 2-byte length covering the segment) until a Start-Of-Frame
// marker (0xC0–0xCF, excluding the DHT/JPG/DAC markers 0xC4/0xC8/0xCC) —
// that segment's payload starts with 1 byte of sample precision, then
// height and width as big-endian uint16s, in that order.
function jpegDimensions(buf) {
  const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let p = 2; // past the 0xFFD8 SOI marker
  while (p + 4 <= buf.length) {
    if (buf[p] !== 0xff) return null; // desynced — not a marker where we expect one
    const marker = buf[p + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      p += 2; // markers with no length field
      continue;
    }
    if (marker === 0xd9) return null; // EOI reached, no SOF found
    const length = buf.readUInt16BE(p + 2);
    if (SOF.has(marker)) {
      if (p + 9 > buf.length) return null;
      return { height: buf.readUInt16BE(p + 5), width: buf.readUInt16BE(p + 7) };
    }
    p += 2 + length;
  }
  return null;
}

// WebP: RIFF container: "RIFF" + 4-byte size + "WEBP", then one chunk whose
// fourCC tells us which of the three sub-formats (each encodes dimensions
// differently) this is. See the WebP container/bitstream spec — VP8X is the
// extended format (explicit canvas size), VP8 is lossy (dimensions inside
// the compressed frame header), VP8L is lossless (dimensions bit-packed
// right after its own signature byte).
function webpDimensions(buf) {
  if (buf.length < 30) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const fourCC = buf.toString("ascii", 12, 16);
  const payload = 20; // past RIFF header (12) + chunk fourCC/size (8)

  if (fourCC === "VP8X") {
    // 1 byte flags, 3 bytes reserved, then width-1 and height-1 as 3-byte
    // little-endian integers.
    const width = 1 + (buf[payload + 4] | (buf[payload + 5] << 8) | (buf[payload + 6] << 16));
    const height = 1 + (buf[payload + 7] | (buf[payload + 8] << 8) | (buf[payload + 9] << 16));
    return { width, height };
  }
  if (fourCC === "VP8 ") {
    // Byte 3 starts the frame tag; bytes 3-5 must be the 0x9d 0x01 0x2a start
    // code, then two little-endian uint16s (top 2 bits are a scale factor,
    // masked off) give width then height.
    if (buf[payload + 3] !== 0x9d || buf[payload + 4] !== 0x01 || buf[payload + 5] !== 0x2a) return null;
    const width = buf.readUInt16LE(payload + 6) & 0x3fff;
    const height = buf.readUInt16LE(payload + 8) & 0x3fff;
    return { width, height };
  }
  if (fourCC === "VP8L") {
    if (buf[payload] !== 0x2f) return null; // signature byte
    const bits = buf.readUInt32LE(payload + 1);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}
