/**
 * Repairs the two data faults that silently make a campaign invisible to
 * every reviewer. Dry run by default — nothing is written without --apply:
 *
 *   node --env-file=.env scripts/repair-campaign-visibility.js
 *   node --env-file=.env scripts/repair-campaign-visibility.js --apply
 *
 * 1. CITY IS NOT A CITY. A campaign's city is derived from its GMB address,
 *    and an address that omits the state segment ("…, Sevoke Road, Siliguri")
 *    used to leave a STREET stored as the city. Reviewers pick a real city at
 *    signup, so such a campaign can never match anyone — it just sits there
 *    active and unreachable. Only rewritten when the stored value isn't a
 *    known Indian city AND the address derives one that is; a campaign the
 *    owner deliberately aimed at one or more real cities is never touched.
 *
 * 2. PHANTOM RESERVED SLOTS. Campaign.claimed must equal
 *    (live claims) + (pending submissions) — a slot is reserved by a claim,
 *    the claim settles into a pending submission, and the decrement happens
 *    when that submission is approved or rejected (lib/verification.js).
 *    A decrement missed anywhere (an admin deleting a submission, a claim
 *    removed out of band) leaves the slot reserved forever, and the campaign
 *    reads as full at e.g. 4+1/5 with nothing actually holding that 1.
 *    Only ever LOWERS a drifted counter — never raises one, so a real
 *    in-flight reservation can't be stolen by a badly-timed run.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI missing — run with --env-file=.env");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const campaigns = db.collection("campaigns");
const locations = db.collection("gmblocations");
const claims = db.collection("claims");
const submissions = db.collection("submissions");

// Same parse as lib/campaigns.js#deriveCityFromAddress — duplicated rather
// than imported because src/ uses extensionless imports that plain node
// can't resolve without a loader. Keep the two in step if that one changes.
function deriveCityFromAddress(address) {
  let parts = String(address || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length > 1 && /^india$/i.test(parts[parts.length - 1])) parts = parts.slice(0, -1);
  if (parts.length <= 2) return parts[parts.length - 1] || "";
  return parts[parts.length - 2];
}

const { INDIA_STATES } = await import("../src/lib/data/indiaStatesCities.js");
const KNOWN_CITIES = new Set(INDIA_STATES.flatMap((s) => s.cities.map((c) => c.toLowerCase())));
const isKnownCity = (name) => KNOWN_CITIES.has(String(name || "").trim().toLowerCase());

let cityFixes = 0;
let slotFixes = 0;

console.log(`\n=== 1. campaigns whose "city" is not a city ===`);
for (const c of await campaigns.find({ status: { $in: ["active", "paused"] } }).toArray()) {
  const stored = (c.cities ?? []).map((x) => String(x).trim()).filter(Boolean);
  if (stored.length !== 1 || isKnownCity(stored[0])) continue;

  const loc = c.location ? await locations.findOne({ _id: c.location }) : null;
  const derived = deriveCityFromAddress(loc?.address);
  if (!isKnownCity(derived) || derived.toLowerCase() === stored[0].toLowerCase()) {
    console.log(`  SKIP  ${c.name} | "${stored[0]}" — no better city available from its address`);
    continue;
  }

  console.log(`  ${APPLY ? "FIX " : "WOULD"}  ${c.name} | "${stored[0]}" -> "${derived}"`);
  if (APPLY) await campaigns.updateOne({ _id: c._id }, { $set: { cities: [derived] } });
  cityFixes++;
}

console.log(`\n=== 2. phantom reserved slots ===`);
for (const c of await campaigns.find({ status: "active", claimed: { $gt: 0 } }).toArray()) {
  const live = await claims.countDocuments({ campaign: c._id });
  const pending = await submissions.countDocuments({ campaign: c._id, status: "pending" });
  const real = live + pending;
  if (c.claimed <= real) continue;

  console.log(
    `  ${APPLY ? "FIX " : "WOULD"}  ${c.name} | claimed ${c.claimed} -> ${real}` +
      ` (live claims ${live}, pending ${pending}) — frees ${c.claimed - real} slot(s)`
  );
  if (APPLY) await campaigns.updateOne({ _id: c._id }, { $set: { claimed: real } });
  slotFixes++;
}

console.log(
  `\n${APPLY ? "applied" : "dry run"} — ${cityFixes} city fix(es), ${slotFixes} slot fix(es).` +
    (APPLY ? "" : "  Re-run with --apply to write.")
);
await mongoose.disconnect();
