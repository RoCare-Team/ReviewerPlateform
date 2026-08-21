"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Globe2,
  ImagePlus,
  IndianRupee,
  Link2,
  Loader2,
  MapPin,
  MessageSquareText,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { inr } from "../../lib/campaigns";
import { Label, Input, FormError } from "../auth/Field";
import CityMultiSelect from "../business/CityMultiSelect";
import { toast } from "../../lib/toast";

const selectClass =
  "w-full appearance-none rounded-btn border border-default bg-surface py-2.5 pl-10 pr-3 text-primary outline-none transition-all duration-200 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50";

// "N reviews every Y day(s)" is how the owner thinks about pacing, but it's
// enforced as a single fixed gap between reviews (see lib/pacing.js) — this
// converts the two numbers into that gap and a human sentence, so the owner
// sees exactly what they're actually setting up before they save it.
function formatPacingGap(count, days) {
  const n = Number(count);
  const d = Number(days);
  if (!(n > 0) || !(d > 0)) return "";
  const gapHours = (d * 24) / n;
  const round = (v) => (Number.isInteger(v) ? v : v.toFixed(1));
  if (gapHours >= 24) {
    const gapDays = round(gapHours / 24);
    return `≈ 1 review every ${gapDays} day${gapDays === 1 ? "" : "s"}`;
  }
  const h = round(gapHours);
  return `≈ 1 review every ${h} hour${h === 1 ? "" : "s"}`;
}

/**
 * Create-campaign modal. The owner enters how many reviews they want, not a
 * ₹ amount — the price is derived live at the admin-controlled ₹/review rate
 * and shown as a read-only total. Blocks submit when that price exceeds the
 * wallet balance. Posts to /api/business/campaigns (still budget-based) which
 * debits the wallet.
 *
 * Google + connected GMB locations gets a different mode: instead of one
 * review URL / one review count, the owner picks any number of locations
 * (one row each, "+ Add location") — each row auto-fills its own review URL
 * from that location and takes its own review-count slice. Submitting
 * creates one campaign PER selected location, all funded from a single
 * wallet debit. Any other platform, or no connected locations at all, falls
 * back to the original single review-URL / single-count form.
 */
export default function NewCampaignModal({ walletBalance, locations = [], rate = 100 }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // "All India" vs "Preferred city" — a campaign defaults to open-to-everyone
  // (empty `cities`, same meaning campaignOpenToCity() already gives an empty
  // array) rather than forcing the owner to pick a city up front. The city
  // search box only shows up once they switch to the second tab. See
  // onSubmit() below for how `cityMode` maps to what's actually sent — an
  // explicit `allIndia: true` rather than just an empty array, since an empty
  // array alone is ambiguous with "this location's city hasn't loaded yet"
  // in batch mode (api/business/campaigns/route.js's createBatch).
  const [values, setValues] = useState({
    name: "",
    platform: "google",
    reviews: "",
    notes: "",
    locationId: "",
    targetUrl: "",
    cities: [],
    cityMode: "all_india",
  });
  const [rows, setRows] = useState(
    locations.length > 0
      ? [
          {
            locationId: "",
            reviews: "",
            targetUrl: "",
            cities: [],
            cityMode: "all_india",
            keywords: [],
            images: [],
            pacingOn: false,
            pacingMode: "daily",
            pacingCount: "1",
            pacingDays: "1",
          },
        ]
      : []
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  // Review-draft flow for reviewers to copy — single-campaign mode. Suggest
  // `reviewsNum` local-search KEYWORDS, then write one full review PER
  // keyword, kept as one list (`keywords[i].review`) instead of two separate
  // lists — a keyword and the review built around it are one unit, so
  // editing a keyword and regenerating ITS review alone (not the whole
  // batch) is a single button next to that one item. Nothing is
  // generated/saved until the owner explicitly asks; see aiKeywords.js /
  // aiReviewDrafts.js for why this exists and its risk. Multi mode keeps its
  // own keywords/reviews PER ROW instead — each location's own review-count's
  // worth, generated separately, never pooled across locations.
  const [keywords, setKeywords] = useState([]); // [{ text, selected, review, regenerating }]
  const [keywordsPending, setKeywordsPending] = useState(false);
  const [draftsPending, setDraftsPending] = useState(false); // bulk (re)generate-all
  const [rowDraftsPending, setRowDraftsPending] = useState({}); // bulk, per row
  const [rowKeywordsPending, setRowKeywordsPending] = useState({});
  // Per-item "regenerate just this one" in-flight flags, keyed by keyword
  // index (single mode) or `${rowIndex}:${keywordIndex}` (multi mode).
  const [regeneratingOne, setRegeneratingOne] = useState({});
  const [rowRegeneratingOne, setRowRegeneratingOne] = useState({});
  // Search-phrase inputs are read-only by default (they're AI-generated —
  // typo-ing one by accident while just skimming the list would silently
  // drift the review text out of sync with what's actually shown). The
  // pencil icon unlocks ONE at a time, same keying as regeneratingOne above.
  const [editingKeyword, setEditingKeyword] = useState({});
  const [rowEditingKeyword, setRowEditingKeyword] = useState({});

  // Optional pool of images for reviewers to download and attach to the
  // review they post — one per review, same "up to reviewsNum" cap as
  // keywords. Uploaded to Cloudinary as each file is picked (not deferred to
  // submit), so the owner sees real thumbnails and upload failures
  // immediately rather than at the very end. Single-campaign mode only;
  // multi mode keeps its own pool PER ROW (row.images).
  const [images, setImages] = useState([]); // [{ url, uploading }]
  const [rowImagesUploading, setRowImagesUploading] = useState({});

  // Optional "drip" pacing (single-campaign mode) — caps how many reviews
  // can land within a trailing time window, so Google doesn't see a burst of
  // reviews all at once (that pattern trips fake-engagement detection and
  // can get reviews pulled). Off by default. Multi mode keeps this PER ROW
  // instead (row.pacingOn/pacingCount/pacingDays) — each location decides
  // its own pace independently. See lib/pacing.js.
  const [pacingOn, setPacingOn] = useState(false);
  const [pacingCount, setPacingCount] = useState("1");
  const [pacingDays, setPacingDays] = useState("1");
  // Daily/Alternate are just shortcuts that set pacingCount/pacingDays for
  // you (1 review/1 day, 1 review/2 days) — Custom is the only one that
  // actually shows the raw number fields. Doesn't touch what gets submitted
  // (still pacingLimit/pacingWindowHours, same as before); purely which UI
  // is on screen.
  const [pacingMode, setPacingMode] = useState("daily");

  const multiMode = values.platform === "google" && locations.length > 0;

  // Max reviews the wallet can fund — the number-of-reviews field is clamped
  // to this instead of a raw ₹ amount, so the price is always derived, never
  // entered directly.
  const maxReviews = Math.floor(walletBalance / rate);

  const reviewsNum = Number(values.reviews) || 0;
  const budgetNum = reviewsNum * rate;
  const reviews = reviewsNum;
  const overBudget = budgetNum > walletBalance;
  const selectedLocation = locations.find((l) => l.id === values.locationId);
  const autoFilledUrl =
    values.platform === "google" &&
    Boolean(selectedLocation?.reviewUrl) &&
    values.targetUrl === selectedLocation.reviewUrl;

  const rowsTotal = rows.reduce((sum, r) => sum + (Number(r.reviews) || 0) * rate, 0);
  const rowsOverBudget = rowsTotal > walletBalance;
  const usedLocationIds = new Set(rows.map((r) => r.locationId).filter(Boolean));
  const canAddRow = rows.length < locations.length;

  function set(key) {
    return (e) => {
      let value = e.target.value;
      // Reviews can't even be TYPED past what the wallet affords — clamp it
      // live instead of only catching it on submit, and say why with a toast.
      if (key === "reviews" && value !== "") {
        const n = Number(value);
        if (!Number.isNaN(n) && n > maxReviews) {
          value = String(maxReviews);
          toast.error("You don't have enough funds in your wallet. Add funds to request more reviews.");
        }
      }

      setValues((v) => {
        const next = { ...v, [key]: value };

        // Only Google locations carry a real "write a review" link (synced
        // from the connected GMB account) — auto-fill the review URL from
        // whichever location ends up selected, but only for Google. Picking
        // any other platform, or a location with no saved link, leaves the
        // field as-is so the owner can paste one manually.
        if (key === "platform" || key === "locationId") {
          const loc = locations.find((l) => l.id === next.locationId);
          if (next.platform === "google" && loc?.reviewUrl) {
            next.targetUrl = loc.reviewUrl;
          }
          // Same auto-add for city — only when the list is still empty or
          // still holding just the previous location's auto-added city, so a
          // manually built city list never gets clobbered by switching
          // locations.
          const prevLoc = locations.find((l) => l.id === v.locationId);
          const citiesUntouched = next.cities.length === 0 || (next.cities.length === 1 && next.cities[0] === prevLoc?.city);
          if (key === "locationId" && citiesUntouched && loc?.city) {
            next.cities = [loc.city];
          }
        }

        return next;
      });
    };
  }

  function addRow() {
    setRows((r) => [
      ...r,
      {
        locationId: "",
        reviews: "",
        targetUrl: "",
        cities: [],
        cityMode: "all_india",
        keywords: [],
        images: [],
        pacingOn: false,
        pacingMode: "daily",
        pacingCount: "1",
        pacingDays: "1",
      },
    ]);
  }

  function removeRow(index) {
    setRows((r) => r.filter((_, i) => i !== index));
  }

  // `value` may be the new value directly, or an updater `(prevValue) =>
  // newValue` — pass an updater when the new value must be derived from
  // this row's CURRENT state after an `await` (e.g. merging AI results back
  // onto whatever keywords exist by the time the response arrives). Reading
  // the outer `rows` closure directly after an await is stale — it's frozen
  // at whatever `rows` was when the async function started, not updated by
  // any setRow() calls made earlier in that same async function.
  function setRow(index, key, value) {
    setRows((r) => {
      const next = [...r];
      const resolvedValue = typeof value === "function" ? value(next[index][key]) : value;
      const row = { ...next[index], [key]: resolvedValue };

      // Picking a location auto-fills its review URL, but only if the field
      // is still untouched (empty, or still holding the PREVIOUS location's
      // auto-filled link) — an owner's manual edit is never clobbered by
      // switching locations back and forth.
      if (key === "locationId") {
        const prevLoc = locations.find((l) => l.id === next[index].locationId);
        const untouched = !row.targetUrl || row.targetUrl === prevLoc?.reviewUrl;
        const newLoc = locations.find((l) => l.id === value);
        if (untouched && newLoc?.reviewUrl) row.targetUrl = newLoc.reviewUrl;

        const citiesUntouched = row.cities.length === 0 || (row.cities.length === 1 && row.cities[0] === prevLoc?.city);
        if (citiesUntouched && newLoc?.city) {
          row.cities = [newLoc.city];
        }
      }

      // Clamp per-row reviews so the running total can never be typed past
      // the wallet balance either.
      if (key === "reviews" && value !== "") {
        const n = Number(value);
        const otherTotal = next.reduce((sum, x, i) => (i === index ? sum : sum + (Number(x.reviews) || 0) * rate), 0);
        if (!Number.isNaN(n) && otherTotal + n * rate > walletBalance) {
          row.reviews = String(Math.max(0, Math.floor((walletBalance - otherTotal) / rate)));
          toast.error("You don't have enough funds in your wallet. Add funds to request more reviews.");
        }
      }

      next[index] = row;
      return next;
    });
  }

  function close() {
    setOpen(false);
    setError("");
  }

  // Single-campaign mode: this location's own category (e.g. "Dental
  // clinic") steers the AI toward business-relevant local-search phrasing
  // ("RO service near me") instead of generic praise.
  const suggestCategory = locations.find((l) => l.id === values.locationId)?.category || "";

  // Step 1 — keywords only. Used to also chain straight into generating
  // reviews for all of them in the same click; now deliberately stops here
  // so the owner can look over/edit the keyword list first. Generating the
  // actual review text is its own separate click — the "Generate reviews"
  // button below (generateReviewsFromKeywords).
  async function suggestKeywords() {
    if (reviewsNum < 1) {
      toast.error("Enter how many reviews you need first.");
      return;
    }
    setKeywordsPending(true);
    const res = await fetch("/api/business/campaigns/suggest-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: values.name.trim(), category: suggestCategory, count: Math.min(reviewsNum, 50) }),
    });
    setKeywordsPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't generate keywords.");
      return;
    }
    const kw = data.keywords.map((text) => ({ text, selected: true })); // no `.review` yet — set once generation actually returns
    setKeywords(kw);
  }

  function toggleKeyword(i) {
    setKeywords((list) => list.map((k, idx) => (idx === i ? { ...k, selected: !k.selected } : k)));
  }

  function updateKeyword(i, text) {
    setKeywords((list) => list.map((k, idx) => (idx === i ? { ...k, text } : k)));
  }

  function removeKeyword(i) {
    setKeywords((list) => list.filter((_, idx) => idx !== i));
  }

  function updateKeywordReview(i, text) {
    setKeywords((list) => list.map((k, idx) => (idx === i ? { ...k, review: text } : k)));
  }

  // Bulk (re)generate — writes one full review PER SELECTED keyword, in
  // order, merged back onto that same keyword's `.review`. `fromList` lets
  // suggestKeywords() chain straight into this with the just-fetched list
  // (state set via setKeywords() above isn't readable yet in the same tick).
  // Used for the first pass and for "Regenerate all"; editing a single
  // keyword's text does NOT auto-run this — use its own regenerate button.
  async function generateReviewsFromKeywords(fromList) {
    const source = fromList ?? keywords;
    const chosen = source.filter((k) => k.selected && k.text.trim());
    if (chosen.length === 0) {
      toast.error("Select at least one keyword first.");
      return;
    }
    setDraftsPending(true);
    const res = await fetch("/api/business/campaigns/suggest-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name.trim(),
        platform: values.platform,
        notes: values.notes.trim(),
        category: suggestCategory,
        keywords: chosen.map((k) => k.text.trim()),
      }),
    });
    setDraftsPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't generate reviews.");
      return;
    }
    if (!Array.isArray(data.reviews) || data.reviews.length === 0) {
      toast.error("The AI didn't return any reviews — try again.");
      return;
    }
    if (data.reviews.length < chosen.length) {
      toast.error(`Only ${data.reviews.length} of ${chosen.length} reviews came back — regenerate the rest individually.`);
    }
    // Reviews come back in the same order as `chosen` — write each back onto
    // its own keyword by matching text, not index, so a keyword the owner
    // renamed or reordered in between still gets paired correctly.
    const reviewByText = new Map(chosen.map((k, i) => [k.text.trim(), data.reviews[i] ?? ""]));
    setKeywords((list) => list.map((k) => (reviewByText.has(k.text.trim()) ? { ...k, review: reviewByText.get(k.text.trim()) } : k)));
  }

  // Regenerate the review for exactly ONE keyword — what the owner reaches
  // for after editing that keyword's text, instead of re-running every
  // review in the list.
  async function regenerateOneReview(i) {
    const k = keywords[i];
    if (!k?.text.trim()) {
      toast.error("Add keyword text first.");
      return;
    }
    setRegeneratingOne((p) => ({ ...p, [i]: true }));
    const res = await fetch("/api/business/campaigns/suggest-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name.trim(),
        platform: values.platform,
        notes: values.notes.trim(),
        category: suggestCategory,
        keywords: [k.text.trim()],
      }),
    });
    setRegeneratingOne((p) => ({ ...p, [i]: false }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't regenerate that review.");
      return;
    }
    updateKeywordReview(i, data.reviews[0] ?? "");
  }

  // Multi mode: each location runs its OWN keyword → review pipeline, sized
  // and categorized to that location alone — never pooled across locations,
  // so a 5-review location always gets exactly its own 5 keywords and 5
  // reviews, not a share of some combined total.
  async function suggestKeywordsForRow(index) {
    const row = rows[index];
    const n = Number(row.reviews) || 0;
    if (n < 1) {
      toast.error("Enter how many reviews this location needs first.");
      return;
    }
    setRowKeywordsPending((p) => ({ ...p, [index]: true }));
    const loc = locations.find((l) => l.id === row.locationId);
    const res = await fetch("/api/business/campaigns/suggest-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: loc?.title || values.name.trim(), category: loc?.category || "", count: Math.min(n, 50) }),
    });
    setRowKeywordsPending((p) => ({ ...p, [index]: false }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't generate keywords.");
      return;
    }
    const kw = data.keywords.map((text) => ({ text, selected: true })); // no `.review` yet — set once generation actually returns
    setRow(index, "keywords", kw);
  }

  function toggleRowKeyword(rowIndex, i) {
    setRow(rowIndex, "keywords", rows[rowIndex].keywords.map((k, idx) => (idx === i ? { ...k, selected: !k.selected } : k)));
  }

  function updateRowKeyword(rowIndex, i, text) {
    setRow(rowIndex, "keywords", rows[rowIndex].keywords.map((k, idx) => (idx === i ? { ...k, text } : k)));
  }

  function removeRowKeyword(rowIndex, i) {
    setRow(rowIndex, "keywords", rows[rowIndex].keywords.filter((_, idx) => idx !== i));
  }

  function updateRowKeywordReview(rowIndex, i, text) {
    // Functional updater for the same reason as generateReviewsFromRowKeywords
    // above — this is also called after an `await` (from
    // regenerateOneRowReview), where the `rows` closure can be stale.
    setRow(rowIndex, "keywords", (prevKeywords) => prevKeywords.map((k, idx) => (idx === i ? { ...k, review: text } : k)));
  }

  // Bulk (re)generate for this row — same "merge back by matching keyword
  // text" logic as the single-mode version above.
  async function generateReviewsFromRowKeywords(index, fromList) {
    const row = rows[index];
    const source = fromList ?? row.keywords;
    const chosen = source.filter((k) => k.selected && k.text.trim());
    if (chosen.length === 0) {
      toast.error("Select at least one keyword first.");
      return;
    }
    setRowDraftsPending((p) => ({ ...p, [index]: true }));
    const loc = locations.find((l) => l.id === row.locationId);
    const res = await fetch("/api/business/campaigns/suggest-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: loc?.title || values.name.trim(),
        platform: "google",
        notes: values.notes.trim(),
        category: loc?.category || "",
        keywords: chosen.map((k) => k.text.trim()),
      }),
    });
    setRowDraftsPending((p) => ({ ...p, [index]: false }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't generate reviews.");
      return;
    }
    if (!Array.isArray(data.reviews) || data.reviews.length === 0) {
      toast.error("The AI didn't return any reviews — try again.");
      return;
    }
    if (data.reviews.length < chosen.length) {
      toast.error(`Only ${data.reviews.length} of ${chosen.length} reviews came back — regenerate the rest individually.`);
    }
    const reviewByText = new Map(chosen.map((k, i) => [k.text.trim(), data.reviews[i] ?? ""]));
    // Functional updater — reads the row's CURRENT keywords at flush time,
    // not the `rows` closure (stale after the `await` above: it's frozen at
    // whatever `rows` was when this function started, from BEFORE the
    // setRow(index, "keywords", kw) call that suggestKeywordsForRow() made
    // just before calling this — reading that stale closure here used to
    // wipe the just-fetched keywords back to empty).
    setRow(index, "keywords", (prevKeywords) =>
      prevKeywords.map((k) => (reviewByText.has(k.text.trim()) ? { ...k, review: reviewByText.get(k.text.trim()) } : k))
    );
  }

  // Regenerate the review for exactly ONE keyword in one row.
  async function regenerateOneRowReview(rowIndex, i) {
    const row = rows[rowIndex];
    const k = row.keywords[i];
    if (!k?.text.trim()) {
      toast.error("Add keyword text first.");
      return;
    }
    const key = `${rowIndex}:${i}`;
    setRowRegeneratingOne((p) => ({ ...p, [key]: true }));
    const loc = locations.find((l) => l.id === row.locationId);
    const res = await fetch("/api/business/campaigns/suggest-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: loc?.title || values.name.trim(),
        platform: "google",
        notes: values.notes.trim(),
        category: loc?.category || "",
        keywords: [k.text.trim()],
      }),
    });
    setRowRegeneratingOne((p) => ({ ...p, [key]: false }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't regenerate that review.");
      return;
    }
    updateRowKeywordReview(rowIndex, i, data.reviews[0] ?? "");
  }

  async function uploadOneImage(file) {
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch("/api/business/campaigns/upload-image", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Upload failed.");
    return data.url;
  }

  // Single-campaign mode — capped at `reviewsNum`, same as keywords. Files
  // upload one at a time (not parallel) so a slow connection doesn't fire
  // N simultaneous Cloudinary uploads; each success appends immediately so
  // the owner sees progress rather than waiting for the whole batch.
  async function addImages(fileList) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    const room = Math.max(0, reviewsNum - images.length);
    if (room === 0) {
      toast.error(`You can only add ${reviewsNum || 0} image(s) — one per review.`);
      return;
    }
    const toUpload = files.slice(0, room);
    if (files.length > toUpload.length) {
      toast.error(`Only ${room} more image(s) fit — one per review. The rest were skipped.`);
    }
    for (const file of toUpload) {
      const placeholder = { url: "", uploading: true };
      setImages((list) => [...list, placeholder]);
      try {
        const url = await uploadOneImage(file);
        setImages((list) => {
          const idx = list.indexOf(placeholder);
          if (idx === -1) return list;
          const next = [...list];
          next[idx] = { url, uploading: false };
          return next;
        });
      } catch (e) {
        setImages((list) => list.filter((it) => it !== placeholder));
        toast.error(e.message ?? "Couldn't upload image.");
      }
    }
  }

  function removeImage(i) {
    setImages((list) => list.filter((_, idx) => idx !== i));
  }

  // Multi mode — each row capped at its OWN review count.
  async function addRowImages(index, fileList) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    const row = rows[index];
    const cap = Number(row.reviews) || 0;
    const room = Math.max(0, cap - row.images.length);
    if (room === 0) {
      toast.error(`You can only add ${cap} image(s) for this location — one per review.`);
      return;
    }
    const toUpload = files.slice(0, room);
    if (files.length > toUpload.length) {
      toast.error(`Only ${room} more image(s) fit for this location. The rest were skipped.`);
    }
    setRowImagesUploading((p) => ({ ...p, [index]: true }));
    // Accumulate locally rather than reading rows[index] inside the loop —
    // setRow()'s state update isn't visible on `rows` again until the next
    // render, so re-reading it mid-loop would drop every upload but the last.
    let current = row.images;
    for (const file of toUpload) {
      try {
        const url = await uploadOneImage(file);
        current = [...current, { url, uploading: false }];
        setRow(index, "images", current);
      } catch (e) {
        toast.error(e.message ?? "Couldn't upload image.");
      }
    }
    setRowImagesUploading((p) => ({ ...p, [index]: false }));
  }

  function removeRowImage(rowIndex, i) {
    setRow(rowIndex, "images", rows[rowIndex].images.filter((_, idx) => idx !== i));
  }

  // Escape closes the modal; background scroll is locked while it's open —
  // same behaviour as the app's other modals (ContactModal, ScreenshotViewer).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") close();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!values.name.trim()) return setError("Give your campaign a name.");
    if (images.some((im) => im.uploading) || rows.some((r) => r.images?.some((im) => im.uploading))) {
      return setError("Wait for the image uploads to finish.");
    }
    if (pacingOn && (!(Number(pacingCount) >= 1) || !(Number(pacingDays) >= 1))) {
      return setError("Enter valid pacing numbers.");
    }
    const pacingFields = pacingOn
      ? { pacingLimit: Math.floor(Number(pacingCount)), pacingWindowHours: Math.floor(Number(pacingDays)) * 24 }
      : {};

    let body;
    if (multiMode) {
      const filled = rows.filter((r) => r.locationId && r.reviews);
      if (filled.length === 0) return setError("Add at least one location with a number of reviews.");
      for (const r of filled) {
        const loc = locations.find((l) => l.id === r.locationId);
        if (!r.targetUrl?.trim()) {
          return setError(`Add a review URL for ${loc?.title || "each location"}.`);
        }
        if (r.cityMode !== "all_india" && (!r.cities || r.cities.length === 0)) {
          return setError(`Add at least one city for ${loc?.title || "each location"}, or switch it to All India.`);
        }
        if ((Number(r.reviews) || 0) < 1) {
          return setError(`Ask for at least 1 review for ${loc?.title || "each location"}.`);
        }
        if (r.pacingOn && (!(Number(r.pacingCount) >= 1) || !(Number(r.pacingDays) >= 1))) {
          return setError(`Enter valid pacing numbers for ${loc?.title || "each location"}.`);
        }
      }
      if (rowsOverBudget) {
        toast.error("You don't have enough funds in your wallet. Add funds to request more reviews.");
        return;
      }
      body = {
        name: values.name.trim(),
        platform: "google",
        notes: values.notes.trim(),
        // Each location keeps its OWN generated drafts, images, and pacing —
        // never pooled/shared across locations, so a 5-review location sends
        // exactly its own 5 (or however many it generated), independent of
        // every other row.
        locations: filled.map((r) => {
          const n = Math.floor(Number(r.reviews)) || 0;
          const drafts = (r.keywords ?? [])
            .filter((k) => k.selected && k.review?.trim())
            .map((k) => ({ text: k.review.trim(), keyword: k.text?.trim() || undefined }));
          const imgs = (r.images ?? []).filter((im) => !im.uploading && im.url).map((im) => im.url);
          const rowPacing = r.pacingOn
            ? { pacingLimit: Math.floor(Number(r.pacingCount)), pacingWindowHours: Math.floor(Number(r.pacingDays)) * 24 }
            : {};
          return {
            locationId: r.locationId,
            budget: n * rate,
            targetUrl: r.targetUrl?.trim() || undefined,
            cities: r.cityMode === "all_india" ? [] : (r.cities ?? []),
            allIndia: r.cityMode === "all_india",
            reviewDrafts: drafts.length > 0 ? drafts : undefined,
            reviewImages: imgs.length > 0 ? imgs : undefined,
            ...rowPacing,
          };
        }),
      };
    } else {
      if (!values.targetUrl.trim()) return setError("Add the review URL where customers should leave a review.");
      if (values.cityMode !== "all_india" && values.cities.length === 0) {
        return setError("Add at least one city this campaign is for, or switch to All India.");
      }
      if (reviewsNum < 1) return setError("Ask for at least 1 review.");
      if (overBudget) {
        toast.error("You don't have enough funds in your wallet. Add funds to request more reviews.");
        return;
      }
      body = {
        name: values.name.trim(),
        platform: values.platform,
        budget: Math.floor(budgetNum),
        notes: values.notes.trim(),
        targetUrl: values.targetUrl.trim(),
        cities: values.cityMode === "all_india" ? [] : values.cities,
        allIndia: values.cityMode === "all_india",
        locationId: values.locationId || undefined,
        reviewDrafts: keywords
          .filter((k) => k.selected && k.review?.trim())
          .map((k) => ({ text: k.review.trim(), keyword: k.text?.trim() || undefined })),
        reviewImages: images.filter((im) => !im.uploading && im.url).map((im) => im.url),
        ...pacingFields,
      };
    }

    setPending(true);
    const res = await fetch("/api/business/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // The API's own insufficient-balance message is a race-safety net (the
      // wallet could have been spent elsewhere between page load and submit)
      // — still surfaced as the same toast, not a generic inline error.
      if (/insufficient/i.test(data.error ?? "")) {
        toast.error("You don't have enough funds in your wallet. Add funds to increase your budget.");
        return;
      }
      const message = data.error ?? "Couldn't create the campaign.";
      setError(message);
      toast.error(message);
      return;
    }

    toast.success(multiMode && body.locations.length > 1 ? `${body.locations.length} campaigns created.` : "Campaign created.");
    setValues({ name: "", platform: "google", reviews: "", notes: "", locationId: "", targetUrl: "", cities: [], cityMode: "all_india" });
    setRows(
      locations.length > 0
        ? [
            {
              locationId: "",
              reviews: "",
              targetUrl: "",
              cities: [],
              cityMode: "all_india",
              keywords: [],
              images: [],
              pacingOn: false,
              pacingMode: "daily",
              pacingCount: "1",
              pacingDays: "1",
            },
          ]
        : []
    );
    setKeywords([]);
    setImages([]);
    setPacingOn(false);
    setPacingMode("daily");
    setPacingCount("1");
    setPacingDays("1");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md sm:w-auto"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        New campaign
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="New campaign"
          className="animate-fade-up fixed inset-0 z-50 flex items-center justify-center bg-surface-inverse/60 p-4 backdrop-blur-sm"
          style={{ animationDuration: "200ms" }}
          onClick={close}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-card border border-default bg-surface-raised shadow-xl lg:max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — sticky, stays put while the form body scrolls */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-default px-6 py-4 sm:px-8">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-primary">New campaign</h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-secondary">
                  <span className="inline-flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                    Wallet: <span className="font-bold text-primary">{inr(walletBalance)}</span>
                  </span>
                  <Link href="/business/settings" className="font-semibold text-accent hover:underline">
                    Add funds
                  </Link>
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="shrink-0 rounded-full p-1.5 text-muted transition-all duration-200 hover:scale-110 hover:bg-surface-sunken hover:text-primary"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Body — the only part that scrolls */}
            <form
              id="new-campaign-form"
              onSubmit={onSubmit}
              // Hitting Enter in ANY single-line input here (most easily
              // triggered while editing a keyword) natively submits the
              // form — if the rest of the fields already validate, that
              // silently creates the campaign for real and resets/closes
              // the modal, wiping whatever was just generated. Only the
              // explicit "Start campaign" button should submit.
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
              }}
              className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8"
            >
              <FormError>{error}</FormError>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="c-name">Campaign name</Label>
                  <Input
                    id="c-name"
                    value={values.name}
                    onChange={set("name")}
                    placeholder="Summer Google reviews"
                    icon={Tag}
                  />
                </div>

                <div>
                  <Label htmlFor="c-platform">Platform</Label>
                  <div className="group relative">
                    <Globe2
                      className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within:text-accent"
                      aria-hidden="true"
                    />
                    <select id="c-platform" value={values.platform} onChange={set("platform")} className={selectClass}>
                      <option value="google">Google</option>
                      <option value="trustpilot">Trustpilot</option>
                      <option value="capterra">Capterra</option>
                      <option value="amazon">Amazon</option>
                      <option value="playstore">Play Store</option>
                    </select>
                  </div>
                </div>

                {multiMode ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="c-loc-0">Locations</Label>
                      <span className="text-xs text-muted">Pick a location, its review URL fills in automatically.</span>
                    </div>

                    {rows.map((row, i) => {
                      const loc = locations.find((l) => l.id === row.locationId);
                      const rowReviews = Number(row.reviews) || 0;
                      const rowPrice = rowReviews * rate;
                      return (
                        <div key={i} className="rounded-card border border-default bg-surface p-4">
                          {/* Row header — "Location N" + remove, so a stack of rows reads
                              as a numbered list rather than identical unlabeled cards. */}
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                              Location {i + 1}
                            </span>
                            {rows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeRow(i)}
                                aria-label="Remove location"
                                className="rounded-full p-1 text-muted transition-colors duration-200 hover:bg-danger-subtle hover:text-danger"
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>

                          <div className="mt-2.5 space-y-2.5">
                            <select
                              id={`c-loc-${i}`}
                              value={row.locationId}
                              onChange={(e) => setRow(i, "locationId", e.target.value)}
                              className="w-full appearance-none rounded-btn border border-default bg-surface-raised px-3 py-2.5 text-sm text-primary outline-none transition-all duration-200 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50"
                            >
                              <option value="">Choose a location…</option>
                              {locations
                                .filter((l) => l.id === row.locationId || !usedLocationIds.has(l.id))
                                .map((l) => (
                                  <option key={l.id} value={l.id}>
                                    {l.title}
                                    {l.areaLabel ? ` — ${l.areaLabel}` : ""}
                                  </option>
                                ))}
                            </select>

                            {row.locationId && (
                              <div>
                                <Input
                                  id={`c-url-${i}`}
                                  type="url"
                                  inputMode="url"
                                  value={row.targetUrl}
                                  onChange={(e) => setRow(i, "targetUrl", e.target.value)}
                                  placeholder="https://g.page/r/your-business/review"
                                  icon={Link2}
                                  className="text-sm"
                                />
                                {row.targetUrl && row.targetUrl === loc?.reviewUrl ? (
                                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-verified">
                                    <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
                                    Auto-filled — edit if this isn&apos;t right.
                                  </p>
                                ) : !loc?.reviewUrl ? (
                                  <p className="mt-1 text-xs text-danger">No review link synced for this location — paste one manually.</p>
                                ) : (
                                  <p className="mt-1 text-xs text-muted">Where reviewers should leave their review.</p>
                                )}

                                <div className="mt-2.5">
                                  <div className="inline-flex rounded-lg border border-default bg-surface p-0.5" role="tablist" aria-label="Which reviewers can see this location">
                                    <button
                                      type="button"
                                      role="tab"
                                      aria-selected={row.cityMode !== "preferred"}
                                      onClick={() => setRow(i, "cityMode", "all_india")}
                                      className={`rounded-[5px] px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                                        row.cityMode !== "preferred" ? "bg-accent text-on-brand" : "text-secondary hover:text-primary"
                                      }`}
                                    >
                                      All India
                                    </button>
                                    <button
                                      type="button"
                                      role="tab"
                                      aria-selected={row.cityMode === "preferred"}
                                      onClick={() => setRow(i, "cityMode", "preferred")}
                                      className={`rounded-[5px] px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                                        row.cityMode === "preferred" ? "bg-accent text-on-brand" : "text-secondary hover:text-primary"
                                      }`}
                                    >
                                      Preferred city
                                    </button>
                                  </div>

                                  {row.cityMode === "preferred" ? (
                                    <div className="mt-2">
                                      <CityMultiSelect
                                        idPrefix={`c-loc-${i}`}
                                        cities={row.cities}
                                        onChange={(cities) => setRow(i, "cities", cities)}
                                      />
                                      {row.cities.length === 1 && row.cities[0] === loc?.city && (
                                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-verified">
                                          <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
                                          Auto-filled — edit if this isn&apos;t right.
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="mt-1.5 text-xs text-muted">Open to reviewers anywhere in India.</p>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="flex flex-col gap-2 border-t border-default pt-2.5 sm:flex-row sm:items-center sm:gap-2.5">
                              <div className="w-full shrink-0 sm:w-32">
                                <Input
                                  id={`c-reviews-${i}`}
                                  type="number"
                                  min={1}
                                  max={maxReviews}
                                  step="1"
                                  inputMode="numeric"
                                  value={row.reviews}
                                  onChange={(e) => setRow(i, "reviews", e.target.value)}
                                  placeholder="Reviews"
                                  icon={Star}
                                  className="text-sm"
                                />
                              </div>
                              <p className="text-xs text-secondary">
                                {row.reviews ? (
                                  <>
                                    <span className="font-semibold text-primary">{inr(rowPrice)}</span> for this location
                                  </>
                                ) : (
                                  `Number of reviews at this location (${inr(rate)} each)`
                                )}
                              </p>
                            </div>

                            {/* This location's own keyword → review pipeline
                                — sized to exactly this row's review count,
                                never pooled with other locations. */}
                            {row.locationId && rowReviews >= 1 && (
                              <div className="rounded-card border border-default bg-surface-raised p-2.5">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-xs font-semibold text-primary">
                                    Reviews For Reviewers to Copy <span className="font-normal text-muted">(optional)</span>
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => suggestKeywordsForRow(i)}
                                    disabled={rowKeywordsPending[i] || rowDraftsPending[i]}
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-btn border border-accent bg-accent-subtle px-2.5 py-1 text-xs font-semibold text-accent transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:text-on-brand disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                                  >
                                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                    {rowKeywordsPending[i]
                                      ? "Finding keywords…"
                                      : rowDraftsPending[i]
                                        ? "Writing reviews…"
                                        : row.keywords?.length > 0
                                          ? "Regenerate"
                                          : `Suggest ${rowReviews} with AI`}
                                  </button>
                                </div>
                                <p className="mt-0.5 text-[11px] leading-snug text-muted">
                                  Two steps: generate {rowReviews} search-phrase keyword{rowReviews === 1 ? "" : "s"} first, then
                                  click &quot;Generate reviews&quot; below to write the actual review text for each one.
                                </p>

                                {row.keywords?.length > 0 && (
                                  <>
                                    <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                                      <span className="inline-flex items-center gap-1"><span className="font-semibold text-primary">✓</span> tick = include this review</span>
                                      <span className="inline-flex items-center gap-1"><Pencil className="h-3 w-3" aria-hidden="true" /> = edit the search phrase</span>
                                      <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" aria-hidden="true" /> = rewrite just this one</span>
                                      <span className="inline-flex items-center gap-1"><Trash2 className="h-3 w-3" aria-hidden="true" /> = discard this one</span>
                                    </p>
                                    {/* Keyword + its own review together, one
                                        unit per item — editing a keyword and
                                        hitting the refresh icon on ITS review
                                        regenerates only that one, not the
                                        whole list. */}
                                    <ul className="mt-2 space-y-2">
                                      {row.keywords.map((k, ki) => {
                                        const busy = rowRegeneratingOne[`${i}:${ki}`];
                                        return (
                                          <li key={ki} className="rounded-xl border border-default bg-surface-sunken p-2">
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="checkbox"
                                                checked={k.selected}
                                                onChange={() => toggleRowKeyword(i, ki)}
                                                className="h-4 w-4 shrink-0 rounded border-default accent-accent"
                                                aria-label={`Include review #${ki + 1}`}
                                                title="Untick to leave this one out of the campaign"
                                              />
                                              <div className="w-full flex-1">
                                                <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted">
                                                  Search phrase
                                                </span>
                                                <input
                                                  type="text"
                                                  value={k.text}
                                                  onChange={(e) => updateRowKeyword(i, ki, e.target.value)}
                                                  readOnly={!rowEditingKeyword[`${i}:${ki}`]}
                                                  maxLength={100}
                                                  title="What the reviewer searched for — the review below is written around this phrase"
                                                  className={`mt-0.5 w-full rounded-btn border border-default px-2.5 py-1.5 text-xs outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/50 ${
                                                    rowEditingKeyword[`${i}:${ki}`] ? "bg-surface" : "cursor-default bg-surface-sunken"
                                                  } ${k.selected ? "text-primary" : "text-muted line-through"}`}
                                                />
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setRowEditingKeyword((prev) => ({
                                                    ...prev,
                                                    [`${i}:${ki}`]: !prev[`${i}:${ki}`],
                                                  }))
                                                }
                                                aria-label={rowEditingKeyword[`${i}:${ki}`] ? "Save this search phrase" : "Edit this search phrase"}
                                                title={rowEditingKeyword[`${i}:${ki}`] ? "Save this search phrase" : "Edit this search phrase"}
                                                className={`shrink-0 self-end rounded-full p-1.5 transition-all duration-200 ${
                                                  rowEditingKeyword[`${i}:${ki}`]
                                                    ? "bg-verified text-white hover:opacity-90"
                                                    : "text-muted hover:bg-accent-subtle hover:text-accent"
                                                }`}
                                              >
                                                {rowEditingKeyword[`${i}:${ki}`] ? (
                                                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                                ) : (
                                                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                                )}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => removeRowKeyword(i, ki)}
                                                aria-label="Discard this review"
                                                title="Discard this review"
                                                className="shrink-0 self-end rounded-full p-1.5 text-muted transition-all duration-200 hover:bg-danger-subtle hover:text-danger"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                              </button>
                                            </div>

                                            {k.review !== undefined && (
                                              <div className="mt-1.5 flex items-start gap-2 border-t border-default pt-1.5">
                                                <div className="w-full flex-1">
                                                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted">
                                                    Review text — reviewers copy this
                                                  </span>
                                                  <textarea
                                                    rows={2}
                                                    value={k.review}
                                                    onChange={(e) => updateRowKeywordReview(i, ki, e.target.value)}
                                                    maxLength={1000}
                                                    className="mt-0.5 w-full resize-none rounded-xl border border-default bg-surface px-3 py-2 text-xs text-primary outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/50"
                                                  />
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => regenerateOneRowReview(i, ki)}
                                                  disabled={busy}
                                                  aria-label="Regenerate this review"
                                                  title="Rewrite just this review — leaves every other review untouched"
                                                  className="shrink-0 self-end rounded-full border border-accent bg-accent-subtle p-1.5 text-accent transition-all duration-200 hover:bg-accent hover:text-on-brand disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                  <Sparkles className={`h-3.5 w-3.5 ${busy ? "animate-pulse" : ""}`} aria-hidden="true" />
                                                </button>
                                              </div>
                                            )}
                                          </li>
                                        );
                                      })}
                                    </ul>

                                    {/* Bulk regenerate — for when several
                                        keywords changed at once; a single
                                        keyword edit is better served by the
                                        refresh icon on that one item above. */}
                                    <button
                                      type="button"
                                      onClick={() => generateReviewsFromRowKeywords(i)}
                                      disabled={rowDraftsPending[i] || row.keywords.filter((k) => k.selected).length === 0}
                                      title={
                                        row.keywords.some((k) => k.review !== undefined)
                                          ? "Rewrites every ticked review above at once — an unticked one is skipped and kept as-is"
                                          : "Writes a full review for each ticked keyword above"
                                      }
                                      className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-btn bg-accent px-3 py-1.5 text-xs font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                                    >
                                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                      {rowDraftsPending[i]
                                        ? "Writing reviews…"
                                        : row.keywords.some((k) => k.review !== undefined)
                                          ? `Rewrite all ${row.keywords.filter((k) => k.selected).length} ticked reviews`
                                          : `Generate ${row.keywords.filter((k) => k.selected).length} review${row.keywords.filter((k) => k.selected).length === 1 ? "" : "s"}`}
                                    </button>
                                  </>
                                )}

                                {/* This location's own images — capped at its
                                    own review count, never pooled. */}
                                <div className="mt-3 border-t border-default pt-2.5">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-primary">
                                        Images to attach <span className="font-normal text-muted">(optional, up to {rowReviews})</span>
                                      </p>
                                      <p className="mt-0.5 text-[11px] leading-snug text-muted">
                                        Upload photos here — each reviewer downloads one to attach when posting their review.
                                      </p>
                                    </div>
                                    <label
                                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-btn border border-accent bg-accent-subtle px-2.5 py-1 text-xs font-semibold text-accent transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:text-on-brand ${
                                        rowImagesUploading[i] || row.images.length >= rowReviews ? "pointer-events-none opacity-60" : "cursor-pointer"
                                      }`}
                                    >
                                      <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                                      Add
                                      <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => {
                                          addRowImages(i, e.target.files);
                                          e.target.value = "";
                                        }}
                                      />
                                    </label>
                                  </div>

                                  {row.images.length > 0 && (
                                    <div className="mt-2 grid grid-cols-4 gap-2">
                                      {row.images.map((im, ii) => (
                                        <div key={ii} className="relative aspect-square overflow-hidden rounded-lg border border-default bg-surface-sunken">
                                          {im.uploading ? (
                                            <div className="flex h-full w-full items-center justify-center">
                                              <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden="true" />
                                            </div>
                                          ) : (
                                            <>
                                              <img src={im.url} alt="" className="h-full w-full object-cover" />
                                              <button
                                                type="button"
                                                onClick={() => removeRowImage(i, ii)}
                                                aria-label="Remove"
                                                className="absolute right-0.5 top-0.5 rounded-full bg-surface-inverse/80 p-0.5 text-white transition-colors duration-150 hover:bg-danger"
                                              >
                                                <X className="h-3 w-3" aria-hidden="true" />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* This location's own drip pacing — decided
                                    independently per location, not shared
                                    across the batch. */}
                                <div className="mt-3 border-t border-default pt-2.5">
                                  <label className="flex cursor-pointer items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-primary">
                                      Frequency of review per day <span className="font-normal text-muted">(optional)</span>
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={row.pacingOn}
                                      onChange={(e) => setRow(i, "pacingOn", e.target.checked)}
                                      className="h-4.5 w-4.5 shrink-0 rounded border-default accent-accent"
                                    />
                                  </label>

                                  <div className={`mt-2 transition-opacity duration-150 ${row.pacingOn ? "" : "pointer-events-none opacity-40"}`}>
                                    <div className="inline-flex rounded-lg border border-default bg-surface-sunken p-0.5" role="tablist" aria-label="Review frequency">
                                      {[
                                        { key: "daily", label: "Daily" },
                                        { key: "alternate", label: "Alternate" },
                                        { key: "custom", label: "Custom" },
                                      ].map((t) => (
                                        <button
                                          key={t.key}
                                          type="button"
                                          role="tab"
                                          aria-selected={row.pacingMode === t.key}
                                          onClick={() => {
                                            setRow(i, "pacingMode", t.key);
                                            if (t.key === "daily") { setRow(i, "pacingCount", "1"); setRow(i, "pacingDays", "1"); }
                                            else if (t.key === "alternate") { setRow(i, "pacingCount", "1"); setRow(i, "pacingDays", "2"); }
                                          }}
                                          className={`rounded-[5px] px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                                            row.pacingMode === t.key ? "bg-accent text-on-brand" : "text-secondary hover:text-primary"
                                          }`}
                                        >
                                          {t.label}
                                        </button>
                                      ))}
                                    </div>

                                    {row.pacingMode === "custom" && (
                                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-secondary">
                                        <span>Allow</span>
                                        <input
                                          type="number"
                                          min={1}
                                          max={1000}
                                          value={row.pacingCount}
                                          disabled={!row.pacingOn}
                                          onChange={(e) => setRow(i, "pacingCount", e.target.value)}
                                          className="w-16 rounded-btn border border-default bg-surface-sunken px-2 py-1.5 text-center text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50"
                                        />
                                        <span>review{Number(row.pacingCount) === 1 ? "" : "s"} every</span>
                                        <input
                                          type="number"
                                          min={1}
                                          max={90}
                                          value={row.pacingDays}
                                          disabled={!row.pacingOn}
                                          onChange={(e) => setRow(i, "pacingDays", e.target.value)}
                                          className="w-16 rounded-btn border border-default bg-surface-sunken px-2 py-1.5 text-center text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50"
                                        />
                                        <span>day{Number(row.pacingDays) === 1 ? "" : "s"}.</span>
                                      </div>
                                    )}
                                  </div>
                                  {row.pacingOn && (
                                    <p className="mt-1.5 text-xs font-medium text-accent">{formatPacingGap(row.pacingCount, row.pacingDays)}</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={addRow}
                      disabled={!canAddRow}
                      className="inline-flex items-center gap-1.5 rounded-btn border border-dashed border-default bg-surface px-3.5 py-2 text-sm font-semibold text-accent transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-accent-subtle disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add another location
                    </button>

                    {/* Live estimate — total across every row */}
                    {(() => {
                      const filledCount = rows.filter((r) => r.locationId && r.reviews).length;
                      const totalReviews = rows.reduce((sum, r) => sum + (Number(r.reviews) || 0), 0);
                      if (filledCount === 0) {
                        return (
                          <div className="rounded-card border border-dashed border-default bg-surface px-4 py-3 text-center text-xs text-muted">
                            Pick a location and set the number of reviews to see the price.
                          </div>
                        );
                      }
                      return (
                        <div className="flex items-center gap-3 rounded-card border border-accent-border bg-accent-subtle p-4">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15">
                            <Star className="h-5 w-5 fill-accent text-accent" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Total reviews</p>
                            <p className="text-2xl font-bold leading-tight tracking-tight text-primary">
                              {totalReviews} review{totalReviews === 1 ? "" : "s"}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-lg font-bold leading-tight text-primary">{inr(rowsTotal)}</p>
                            <p className="text-xs text-secondary">{filledCount} location{filledCount === 1 ? "" : "s"}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <>
                    {locations.length > 0 && (
                      <div>
                        <Label htmlFor="c-loc">Location (optional)</Label>
                        <div className="group relative">
                          <MapPin
                            className="pointer-events-none absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted transition-colors duration-200 group-focus-within:text-accent"
                            aria-hidden="true"
                          />
                          <select id="c-loc" value={values.locationId} onChange={set("locationId")} className={selectClass}>
                            <option value="">All locations</option>
                            {locations.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.title}
                                {l.areaLabel ? ` — ${l.areaLabel}` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="c-url">Review URL</Label>
                      <Input
                        id="c-url"
                        type="url"
                        inputMode="url"
                        value={values.targetUrl}
                        onChange={set("targetUrl")}
                        placeholder="https://g.page/r/your-business/review"
                        icon={Link2}
                      />
                      {autoFilledUrl ? (
                        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-verified">
                          <Sparkles className="h-3 w-3" aria-hidden="true" />
                          Auto-filled from your connected Google location — edit it if this isn&apos;t right.
                        </p>
                      ) : (
                        <p className="mt-1.5 text-xs text-muted">The link where reviewers should leave their review (e.g. your Google review link).</p>
                      )}
                    </div>

                    <div>
                      <Label>Who can see this campaign</Label>
                      <div className="inline-flex rounded-lg border border-default bg-surface p-0.5" role="tablist" aria-label="Which reviewers can see this campaign">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={values.cityMode !== "preferred"}
                          onClick={() => setValues((v) => ({ ...v, cityMode: "all_india" }))}
                          className={`rounded-[5px] px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                            values.cityMode !== "preferred" ? "bg-accent text-on-brand" : "text-secondary hover:text-primary"
                          }`}
                        >
                          All India
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={values.cityMode === "preferred"}
                          onClick={() => setValues((v) => ({ ...v, cityMode: "preferred" }))}
                          className={`rounded-[5px] px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                            values.cityMode === "preferred" ? "bg-accent text-on-brand" : "text-secondary hover:text-primary"
                          }`}
                        >
                          Preferred city
                        </button>
                      </div>

                      {values.cityMode === "preferred" ? (
                        <div className="mt-2">
                          <CityMultiSelect
                            idPrefix="c-cities"
                            cities={values.cities}
                            onChange={(cities) => setValues((v) => ({ ...v, cities }))}
                          />
                          <p className="mt-1.5 text-xs text-muted">
                            Add every city you want reviewers from — this campaign shows up for reviewers in ANY of them.
                          </p>
                        </div>
                      ) : (
                        <p className="mt-1.5 text-xs text-muted">Open to reviewers anywhere in India.</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="c-reviews">Number of reviews</Label>
                      <Input
                        id="c-reviews"
                        type="number"
                        min={1}
                        max={maxReviews}
                        step="1"
                        inputMode="numeric"
                        value={values.reviews}
                        onChange={set("reviews")}
                        placeholder="100"
                        icon={Star}
                        error={overBudget}
                      />
                      <p className="mt-1.5 text-xs text-muted">Flat rate {inr(rate)} per verified review.</p>
                    </div>

                    {/* Live price */}
                    <div className="rounded-btn border border-accent-border bg-accent-subtle px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                          <IndianRupee className="h-4 w-4 text-accent" aria-hidden="true" />
                          Total price
                        </span>
                        <span className="text-2xl font-bold tracking-tight text-primary">{inr(budgetNum)}</span>
                      </div>
                      <p className="mt-1 text-xs text-secondary">
                        {reviews} review{reviews === 1 ? "" : "s"} × {inr(rate)} per review
                      </p>
                    </div>

                    {/* Step 1 — keywords. Never generated/saved unless the
                        owner explicitly asks and reviews the list. */}
                    <div className="rounded-card border border-default bg-surface p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-primary">Reviews for reviewers to copy (optional)</p>
                          <p className="mt-0.5 text-xs text-muted">
                            Two steps: generate {reviewsNum || "N"} search-phrase keywords first, review/edit them, then click
                            &quot;Generate reviews&quot; below to write the actual review text for each one.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={suggestKeywords}
                          disabled={keywordsPending || draftsPending || reviewsNum < 1}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-btn border border-accent bg-accent-subtle px-3 py-1.5 text-xs font-semibold text-accent transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:text-on-brand disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                        >
                          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                          {keywordsPending ? "Finding keywords…" : draftsPending ? "Writing reviews…" : keywords.length > 0 ? "Regenerate" : "Suggest with AI"}
                        </button>
                      </div>

                      {keywords.length > 0 && (
                        <>
                          <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                            <span className="inline-flex items-center gap-1"><span className="font-semibold text-primary">✓</span> tick = include this review</span>
                            <span className="inline-flex items-center gap-1"><Pencil className="h-3 w-3" aria-hidden="true" /> = edit the search phrase</span>
                            <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" aria-hidden="true" /> = rewrite just this one</span>
                            <span className="inline-flex items-center gap-1"><Trash2 className="h-3 w-3" aria-hidden="true" /> = discard this one</span>
                          </p>
                          {/* Keyword + its own review together, one unit per
                              item — editing a keyword and hitting the
                              refresh icon on ITS review regenerates only
                              that one, not the whole list. */}
                          <ul className="mt-2 space-y-2">
                            {keywords.map((k, i) => {
                              const busy = regeneratingOne[i];
                              return (
                                <li key={i} className="rounded-xl border border-default bg-surface-sunken p-2">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={k.selected}
                                      onChange={() => toggleKeyword(i)}
                                      className="h-4 w-4 shrink-0 rounded border-default accent-accent"
                                      aria-label={`Include review #${i + 1}`}
                                      title="Untick to leave this one out of the campaign"
                                    />
                                    <div className="w-full flex-1">
                                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted">
                                        Search phrase
                                      </span>
                                      <input
                                        type="text"
                                        value={k.text}
                                        onChange={(e) => updateKeyword(i, e.target.value)}
                                        readOnly={!editingKeyword[i]}
                                        maxLength={100}
                                        title="What the reviewer searched for — the review below is written around this phrase"
                                        className={`mt-0.5 w-full rounded-btn border border-default px-2.5 py-1.5 text-xs outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/50 ${
                                          editingKeyword[i] ? "bg-surface" : "cursor-default bg-surface-sunken"
                                        } ${k.selected ? "text-primary" : "text-muted line-through"}`}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setEditingKeyword((prev) => ({ ...prev, [i]: !prev[i] }))}
                                      aria-label={editingKeyword[i] ? "Save this search phrase" : "Edit this search phrase"}
                                      title={editingKeyword[i] ? "Save this search phrase" : "Edit this search phrase"}
                                      className={`shrink-0 self-end rounded-full p-1.5 transition-all duration-200 ${
                                        editingKeyword[i]
                                          ? "bg-verified text-white hover:opacity-90"
                                          : "text-muted hover:bg-accent-subtle hover:text-accent"
                                      }`}
                                    >
                                      {editingKeyword[i] ? (
                                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                      ) : (
                                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeKeyword(i)}
                                      aria-label="Discard this review"
                                      title="Discard this review"
                                      className="shrink-0 self-end rounded-full p-1.5 text-muted transition-all duration-200 hover:bg-danger-subtle hover:text-danger"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                  </div>

                                  {k.review !== undefined && (
                                    <div className="mt-1.5 flex items-start gap-2 border-t border-default pt-1.5">
                                      <div className="w-full flex-1">
                                        <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted">
                                          Review text — reviewers copy this
                                        </span>
                                        <textarea
                                          rows={2}
                                          value={k.review}
                                          onChange={(e) => updateKeywordReview(i, e.target.value)}
                                          maxLength={1000}
                                          className="mt-0.5 w-full resize-none rounded-xl border border-default bg-surface px-3 py-2 text-xs text-primary outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/50"
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => regenerateOneReview(i)}
                                        disabled={busy}
                                        aria-label="Regenerate this review"
                                        title="Rewrite just this review — leaves every other review untouched"
                                        className="shrink-0 self-end rounded-full border border-accent bg-accent-subtle p-1.5 text-accent transition-all duration-200 hover:bg-accent hover:text-on-brand disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <Sparkles className={`h-3.5 w-3.5 ${busy ? "animate-pulse" : ""}`} aria-hidden="true" />
                                      </button>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>

                          {/* Step 2 — write the actual review text. Separate,
                              explicit click from step 1's keyword list above;
                              doubles as "regenerate" once reviews already
                              exist (bulk-rewrites every ticked one — a single
                              keyword edit is better served by the refresh
                              icon on that one item above). */}
                          <button
                            type="button"
                            onClick={() => generateReviewsFromKeywords()}
                            disabled={draftsPending || keywords.filter((k) => k.selected).length === 0}
                            title={
                              keywords.some((k) => k.review !== undefined)
                                ? "Rewrites every ticked review above at once — an unticked one is skipped and kept as-is"
                                : "Writes a full review for each ticked keyword above"
                            }
                            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-btn bg-accent px-3 py-2 text-xs font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                          >
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            {draftsPending
                              ? "Writing reviews…"
                              : keywords.some((k) => k.review !== undefined)
                                ? `Rewrite all ${keywords.filter((k) => k.selected).length} ticked reviews`
                                : `Generate ${keywords.filter((k) => k.selected).length} review${keywords.filter((k) => k.selected).length === 1 ? "" : "s"}`}
                          </button>
                        </>
                      )}
                    </div>

                    {/* Images for reviewers to download and attach to the
                        review they post — one per review, never generated,
                        just uploaded. */}
                    <div className="rounded-card border border-default bg-surface p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-primary">Images for reviewers to attach (optional)</p>
                          <p className="mt-0.5 text-xs text-muted">
                            Up to {reviewsNum || "N"} images — one per reviewer to download and attach to their review.
                          </p>
                        </div>
                        <label
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-btn border border-accent bg-accent-subtle px-3 py-1.5 text-xs font-semibold text-accent transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:text-on-brand ${
                            reviewsNum < 1 || images.length >= reviewsNum ? "pointer-events-none opacity-60" : "cursor-pointer"
                          }`}
                        >
                          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                          Add images
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              addImages(e.target.files);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>

                      {images.length > 0 && (
                        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {images.map((im, i) => (
                            <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-default bg-surface-sunken">
                              {im.uploading ? (
                                <div className="flex h-full w-full items-center justify-center">
                                  <Loader2 className="h-5 w-5 animate-spin text-muted" aria-hidden="true" />
                                </div>
                              ) : (
                                <>
                                  <img src={im.url} alt="" className="h-full w-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => removeImage(i)}
                                    aria-label="Remove"
                                    className="absolute right-1 top-1 rounded-full bg-surface-inverse/80 p-1 text-white transition-colors duration-150 hover:bg-danger"
                                  >
                                    <X className="h-3 w-3" aria-hidden="true" />
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Drip pacing — single-campaign mode only. Multi mode has
                    its own per-location pacing inside each row above. */}
                {!multiMode && (
                  <div className="rounded-card border border-default bg-surface p-3">
                    <label className="flex cursor-pointer items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-primary">Frequency of review per day</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          Spread reviews over time instead of all at once — safer for Google&apos;s spam detection. Off means all
                          reviews can come in the same day.
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={pacingOn}
                        onChange={(e) => setPacingOn(e.target.checked)}
                        className="h-4.5 w-4.5 shrink-0 rounded border-default accent-accent"
                      />
                    </label>

                    <div className={`mt-3 border-t border-default pt-3 transition-opacity duration-150 ${pacingOn ? "" : "pointer-events-none opacity-40"}`}>
                      <div className="inline-flex rounded-lg border border-default bg-surface-sunken p-0.5" role="tablist" aria-label="Review frequency">
                        {[
                          { key: "daily", label: "Daily" },
                          { key: "alternate", label: "Alternate" },
                          { key: "custom", label: "Custom" },
                        ].map((t) => (
                          <button
                            key={t.key}
                            type="button"
                            role="tab"
                            aria-selected={pacingMode === t.key}
                            onClick={() => {
                              setPacingMode(t.key);
                              if (t.key === "daily") { setPacingCount("1"); setPacingDays("1"); }
                              else if (t.key === "alternate") { setPacingCount("1"); setPacingDays("2"); }
                            }}
                            className={`rounded-[5px] px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                              pacingMode === t.key ? "bg-accent text-on-brand" : "text-secondary hover:text-primary"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {pacingMode === "custom" && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-secondary">
                          <span>Allow</span>
                          <input
                            type="number"
                            min={1}
                            max={1000}
                            value={pacingCount}
                            disabled={!pacingOn}
                            onChange={(e) => setPacingCount(e.target.value)}
                            className="w-16 rounded-btn border border-default bg-surface-sunken px-2 py-1.5 text-center text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50"
                          />
                          <span>review{Number(pacingCount) === 1 ? "" : "s"} every</span>
                          <input
                            type="number"
                            min={1}
                            max={90}
                            value={pacingDays}
                            disabled={!pacingOn}
                            onChange={(e) => setPacingDays(e.target.value)}
                            className="w-16 rounded-btn border border-default bg-surface-sunken px-2 py-1.5 text-center text-sm text-primary outline-none focus:border-accent focus:ring-2 focus:ring-accent/50"
                          />
                          <span>day{Number(pacingDays) === 1 ? "" : "s"}.</span>
                        </div>
                      )}
                    </div>
                    {pacingOn && (
                      <p className="mt-1.5 text-xs font-medium text-accent">{formatPacingGap(pacingCount, pacingDays)}</p>
                    )}
                  </div>
                )}

                <div>
                  <Label htmlFor="c-notes">What do you need? (optional)</Label>
                  <div className="group relative">
                    <MessageSquareText
                      className="pointer-events-none absolute left-3 top-3 h-4.5 w-4.5 text-muted transition-colors duration-200 group-focus-within:text-accent"
                      aria-hidden="true"
                    />
                    <textarea
                      id="c-notes"
                      rows={3}
                      value={values.notes}
                      onChange={set("notes")}
                      maxLength={500}
                      placeholder="e.g. Focus on our new outlet, verified customers only, target a 4.5+ average."
                      className="w-full resize-none rounded-2xl border border-default bg-surface py-2.5 pl-10 pr-3 text-primary outline-none transition-all duration-200 placeholder:text-muted/70 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50"
                    />
                  </div>
                </div>
              </div>
            </form>

            {/* Footer — sticky. Stacks full-width on mobile (primary action on
                top) since the submit label is dynamic and can run long
                ("Start 3 campaign(s) · ₹15,000") — side-by-side would clip it
                on a narrow screen. */}
            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-default px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
              <button
                type="button"
                onClick={close}
                className="w-full rounded-btn border border-default bg-surface px-4 py-2.5 text-sm font-semibold text-secondary transition-colors duration-200 hover:bg-surface-sunken sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="new-campaign-form"
                disabled={pending || (multiMode ? rowsOverBudget : overBudget)}
                className="w-full rounded-btn bg-accent px-5 py-2.5 text-sm font-semibold text-on-brand shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:w-auto"
              >
                {pending
                  ? "Creating…"
                  : multiMode
                    ? `Start ${rows.filter((r) => r.locationId).length || ""} campaign(s) · ${inr(rowsTotal)}`
                    : `Start campaign · ${inr(budgetNum)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
