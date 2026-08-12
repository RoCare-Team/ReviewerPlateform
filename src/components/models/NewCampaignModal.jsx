"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Globe2,
  ImagePlus,
  IndianRupee,
  Link2,
  Loader2,
  MapPin,
  MessageSquareText,
  Plus,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { inr } from "../../lib/campaigns";
import { findStateForCity } from "../../lib/data/indiaStatesCities";
import { Label, Input, FormError } from "../auth/Field";
import StateCitySelect from "../ui/StateCitySelect";
import { toast } from "../../lib/toast";

const selectClass =
  "w-full appearance-none rounded-btn border border-default bg-surface py-2.5 pl-10 pr-3 text-primary outline-none transition-all duration-200 hover:border-strong focus:border-accent focus:ring-2 focus:ring-accent/50";

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
  const [values, setValues] = useState({ name: "", platform: "google", reviews: "", notes: "", locationId: "", targetUrl: "", state: "", city: "" });
  const [rows, setRows] = useState(
    locations.length > 0
      ? [
          {
            locationId: "",
            reviews: "",
            targetUrl: "",
            state: "",
            city: "",
            keywords: [],
            reviewDrafts: [],
            images: [],
            pacingOn: false,
            pacingCount: "1",
            pacingDays: "1",
          },
        ]
      : []
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  // Two-step review-draft flow for reviewers to copy — single-campaign mode.
  // Step 1: suggest `reviewsNum` local-search KEYWORDS, owner picks/edits
  // which to keep. Step 2: generate one full review PER CHOSEN keyword, so
  // every review is guaranteed tied to a keyword the owner approved. Nothing
  // is generated/saved until the owner explicitly asks; see aiKeywords.js /
  // aiReviewDrafts.js for why this exists and its risk. Multi mode keeps its
  // own keywords/drafts PER ROW instead — each location's own review-count's
  // worth, generated separately, never pooled across locations.
  const [keywords, setKeywords] = useState([]); // [{ text, selected }]
  const [keywordsPending, setKeywordsPending] = useState(false);
  const [reviewDrafts, setReviewDrafts] = useState([]);
  const [draftsPending, setDraftsPending] = useState(false);
  const [rowDraftsPending, setRowDraftsPending] = useState({});
  const [rowKeywordsPending, setRowKeywordsPending] = useState({});

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
          // Same auto-fill for city — only when the field is still empty or
          // still holding the previous location's auto-filled city, so a
          // manual edit never gets clobbered by switching locations. Only
          // applied when the derived city is an exact match in the dataset
          // (findStateForCity) — otherwise the dropdown would have nothing
          // valid to show and the owner picks manually instead.
          const prevLoc = locations.find((l) => l.id === v.locationId);
          const cityUntouched = !next.city || next.city === prevLoc?.city;
          if (key === "locationId" && cityUntouched && loc?.city) {
            const matchedState = findStateForCity(loc.city);
            if (matchedState) {
              next.state = matchedState;
              next.city = loc.city;
            }
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
        state: "",
        city: "",
        keywords: [],
        reviewDrafts: [],
        images: [],
        pacingOn: false,
        pacingCount: "1",
        pacingDays: "1",
      },
    ]);
  }

  function removeRow(index) {
    setRows((r) => r.filter((_, i) => i !== index));
  }

  function setRow(index, key, value) {
    setRows((r) => {
      const next = [...r];
      const row = { ...next[index], [key]: value };

      // Picking a location auto-fills its review URL, but only if the field
      // is still untouched (empty, or still holding the PREVIOUS location's
      // auto-filled link) — an owner's manual edit is never clobbered by
      // switching locations back and forth.
      if (key === "locationId") {
        const prevLoc = locations.find((l) => l.id === next[index].locationId);
        const untouched = !row.targetUrl || row.targetUrl === prevLoc?.reviewUrl;
        const newLoc = locations.find((l) => l.id === value);
        if (untouched && newLoc?.reviewUrl) row.targetUrl = newLoc.reviewUrl;

        const cityUntouched = !row.city || row.city === prevLoc?.city;
        if (cityUntouched && newLoc?.city) {
          const matchedState = findStateForCity(newLoc.city);
          if (matchedState) {
            row.state = matchedState;
            row.city = newLoc.city;
          }
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

  // One click, two AI calls: suggest exactly `reviewsNum` keywords, then
  // immediately write one review per keyword — no separate "now generate
  // reviews" click needed. Keywords stay editable afterward; unchecking one
  // and using "Regenerate reviews" below re-runs just the review step.
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
    const kw = data.keywords.map((text) => ({ text, selected: true }));
    setKeywords(kw);
    await generateReviewsFromKeywords(kw);
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

  // Write one full review PER SELECTED keyword, in order, so reviewDrafts[i]
  // is guaranteed to be built around keywords[i]. `fromList` lets
  // suggestKeywords() chain straight into this with the just-fetched list
  // (state set via setKeywords() above isn't readable yet in the same tick);
  // the "Regenerate reviews" button below calls this with no argument, which
  // reads whatever the owner has since checked/unchecked/edited.
  async function generateReviewsFromKeywords(fromList) {
    const chosen = (fromList ?? keywords).filter((k) => k.selected && k.text.trim()).map((k) => k.text.trim());
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
        keywords: chosen,
      }),
    });
    setDraftsPending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't generate reviews.");
      return;
    }
    // Reviews come back in the same order as `chosen` — pair each with the
    // keyword it was written around, so the campaigns table (and the final
    // save) can show which review goes with which keyword.
    setReviewDrafts(data.reviews.map((text, i) => ({ text, keyword: chosen[i] || "" })));
  }

  function updateDraft(i, text) {
    setReviewDrafts((list) => list.map((d, idx) => (idx === i ? { ...d, text } : d)));
  }

  function removeDraft(i) {
    setReviewDrafts((list) => list.filter((_, idx) => idx !== i));
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
    const kw = data.keywords.map((text) => ({ text, selected: true }));
    setRow(index, "keywords", kw);
    await generateReviewsFromRowKeywords(index, kw);
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

  async function generateReviewsFromRowKeywords(index, fromList) {
    const row = rows[index];
    const chosen = (fromList ?? row.keywords).filter((k) => k.selected && k.text.trim()).map((k) => k.text.trim());
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
        keywords: chosen,
      }),
    });
    setRowDraftsPending((p) => ({ ...p, [index]: false }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't generate reviews.");
      return;
    }
    setRow(index, "reviewDrafts", data.reviews.map((text, i) => ({ text, keyword: chosen[i] || "" })));
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

  function updateRowDraft(rowIndex, draftIndex, text) {
    setRow(rowIndex, "reviewDrafts", rows[rowIndex].reviewDrafts.map((d, idx) => (idx === draftIndex ? { ...d, text } : d)));
  }

  function removeRowDraft(rowIndex, draftIndex) {
    setRow(rowIndex, "reviewDrafts", rows[rowIndex].reviewDrafts.filter((_, idx) => idx !== draftIndex));
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
        if (!r.city?.trim()) {
          return setError(`Add a city for ${loc?.title || "each location"}.`);
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
          const drafts = (r.reviewDrafts ?? [])
            .filter((d) => d.text.trim())
            .map((d) => ({ text: d.text.trim(), keyword: d.keyword || undefined }));
          const imgs = (r.images ?? []).filter((im) => !im.uploading && im.url).map((im) => im.url);
          const rowPacing = r.pacingOn
            ? { pacingLimit: Math.floor(Number(r.pacingCount)), pacingWindowHours: Math.floor(Number(r.pacingDays)) * 24 }
            : {};
          return {
            locationId: r.locationId,
            budget: n * rate,
            targetUrl: r.targetUrl?.trim() || undefined,
            city: r.city?.trim() || undefined,
            reviewDrafts: drafts.length > 0 ? drafts : undefined,
            reviewImages: imgs.length > 0 ? imgs : undefined,
            ...rowPacing,
          };
        }),
      };
    } else {
      if (!values.targetUrl.trim()) return setError("Add the review URL where customers should leave a review.");
      if (!values.city.trim()) return setError("Add the city this campaign is for.");
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
        city: values.city.trim(),
        locationId: values.locationId || undefined,
        reviewDrafts: reviewDrafts.filter((d) => d.text.trim()).map((d) => ({ text: d.text.trim(), keyword: d.keyword || undefined })),
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
    setValues({ name: "", platform: "google", reviews: "", notes: "", locationId: "", targetUrl: "", state: "", city: "" });
    setRows(
      locations.length > 0
        ? [
            {
              locationId: "",
              reviews: "",
              targetUrl: "",
              state: "",
              city: "",
              keywords: [],
              reviewDrafts: [],
              images: [],
              pacingOn: false,
              pacingCount: "1",
              pacingDays: "1",
            },
          ]
        : []
    );
    setKeywords([]);
    setReviewDrafts([]);
    setImages([]);
    setPacingOn(false);
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
            <form id="new-campaign-form" onSubmit={onSubmit} className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
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
                                    {l.city ? ` — ${l.city}` : ""}
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
                                  <StateCitySelect
                                    idPrefix={`c-loc-${i}`}
                                    state={row.state}
                                    city={row.city}
                                    onStateChange={(state) => {
                                      setRow(i, "state", state);
                                      setRow(i, "city", "");
                                    }}
                                    onCityChange={(city) => setRow(i, "city", city)}
                                  />
                                  {row.city && row.city === loc?.city && (
                                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-verified">
                                      <Sparkles className="h-3 w-3 shrink-0" aria-hidden="true" />
                                      Auto-filled — edit if this isn&apos;t right.
                                    </p>
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
                                    Reviews for reviewers to copy <span className="font-normal text-muted">(optional)</span>
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

                                {row.keywords?.length > 0 && (
                                  <>
                                    <ul className="mt-2.5 space-y-1.5">
                                      {row.keywords.map((k, ki) => (
                                        <li key={ki} className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={k.selected}
                                            onChange={() => toggleRowKeyword(i, ki)}
                                            className="h-4 w-4 shrink-0 rounded border-default accent-accent"
                                            aria-label={`Use "${k.text}"`}
                                          />
                                          <input
                                            type="text"
                                            value={k.text}
                                            onChange={(e) => updateRowKeyword(i, ki, e.target.value)}
                                            maxLength={100}
                                            className={`w-full flex-1 rounded-btn border border-default bg-surface-sunken px-2.5 py-1.5 text-xs outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/50 ${
                                              k.selected ? "text-primary" : "text-muted line-through"
                                            }`}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => removeRowKeyword(i, ki)}
                                            aria-label="Remove"
                                            className="shrink-0 rounded-full p-1.5 text-muted transition-all duration-200 hover:bg-danger-subtle hover:text-danger"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                          </button>
                                        </li>
                                      ))}
                                    </ul>

                                    {/* Only needed after editing which
                                        keywords are checked — the first
                                        click above already wrote reviews for
                                        every keyword it suggested. */}
                                    <button
                                      type="button"
                                      onClick={() => generateReviewsFromRowKeywords(i)}
                                      disabled={rowDraftsPending[i] || row.keywords.filter((k) => k.selected).length === 0}
                                      className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-btn border border-accent bg-accent-subtle px-3 py-1.5 text-xs font-semibold text-accent transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:text-on-brand disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                                    >
                                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                                      {rowDraftsPending[i]
                                        ? "Writing reviews…"
                                        : `Regenerate reviews (${row.keywords.filter((k) => k.selected).length})`}
                                    </button>
                                  </>
                                )}

                                {row.reviewDrafts?.length > 0 && (
                                  <>
                                    <p className="mt-3 text-xs font-semibold text-primary">Reviews for reviewers to copy</p>
                                    <ul className="mt-2 space-y-2">
                                      {row.reviewDrafts.map((d, di) => (
                                        <li key={di} className="flex items-start gap-2">
                                          <div className="w-full flex-1">
                                            {d.keyword && (
                                              <p className="mb-1 truncate text-[10px] font-semibold text-muted">Keyword: {d.keyword}</p>
                                            )}
                                            <textarea
                                              rows={2}
                                              value={d.text}
                                              onChange={(e) => updateRowDraft(i, di, e.target.value)}
                                              maxLength={1000}
                                              className="w-full resize-none rounded-2xl border border-default bg-surface-sunken px-3 py-2.5 text-xs text-primary outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/50"
                                            />
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => removeRowDraft(i, di)}
                                            aria-label="Remove"
                                            className="shrink-0 rounded-full p-1.5 text-muted transition-all duration-200 hover:bg-danger-subtle hover:text-danger"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  </>
                                )}

                                {/* This location's own images — capped at its
                                    own review count, never pooled. */}
                                <div className="mt-3 border-t border-default pt-2.5">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-semibold text-primary">
                                      Images to attach <span className="font-normal text-muted">(optional, up to {rowReviews})</span>
                                    </p>
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
                                      Pace out reviews <span className="font-normal text-muted">(optional)</span>
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={row.pacingOn}
                                      onChange={(e) => setRow(i, "pacingOn", e.target.checked)}
                                      className="h-4.5 w-4.5 shrink-0 rounded border-default accent-accent"
                                    />
                                  </label>
                                  <div className={`mt-2 flex flex-wrap items-center gap-2 text-sm transition-opacity duration-150 ${row.pacingOn ? "text-secondary" : "pointer-events-none opacity-40"}`}>
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
                              <option key={l.id} value={l.id}>{l.title}</option>
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
                      <Label htmlFor="c-state-state">State &amp; city</Label>
                      <StateCitySelect
                        idPrefix="c-state"
                        state={values.state}
                        city={values.city}
                        onStateChange={(state) => setValues((v) => ({ ...v, state, city: "" }))}
                        onCityChange={(city) => setValues((v) => ({ ...v, city }))}
                      />
                      <p className="mt-1.5 text-xs text-muted">
                        Reviewers only see this campaign if it&apos;s in (or near) their own city.
                      </p>
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
                            One click: AI suggests {reviewsNum || "N"} local-search keywords (e.g. &quot;RO service near me&quot;), then writes a review for each.
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
                          <ul className="mt-3 space-y-1.5">
                            {keywords.map((k, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={k.selected}
                                  onChange={() => toggleKeyword(i)}
                                  className="h-4 w-4 shrink-0 rounded border-default accent-accent"
                                  aria-label={`Use "${k.text}"`}
                                />
                                <input
                                  type="text"
                                  value={k.text}
                                  onChange={(e) => updateKeyword(i, e.target.value)}
                                  maxLength={100}
                                  className={`w-full flex-1 rounded-btn border border-default bg-surface-sunken px-2.5 py-1.5 text-xs outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/50 ${
                                    k.selected ? "text-primary" : "text-muted line-through"
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeKeyword(i)}
                                  aria-label="Remove"
                                  className="shrink-0 rounded-full p-1.5 text-muted transition-all duration-200 hover:bg-danger-subtle hover:text-danger"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              </li>
                            ))}
                          </ul>

                          {/* Only needed after editing which keywords are
                              checked — the first click above already wrote
                              reviews for every keyword it suggested. */}
                          <button
                            type="button"
                            onClick={() => generateReviewsFromKeywords()}
                            disabled={draftsPending || keywords.filter((k) => k.selected).length === 0}
                            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-btn border border-accent bg-accent-subtle px-3 py-2 text-xs font-semibold text-accent transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:text-on-brand disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                          >
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            {draftsPending
                              ? "Writing reviews…"
                              : `Regenerate reviews from selected keywords (${keywords.filter((k) => k.selected).length})`}
                          </button>
                        </>
                      )}
                    </div>

                    {/* Step 2 — one full review per chosen keyword. */}
                    {reviewDrafts.length > 0 && (
                      <div className="rounded-card border border-default bg-surface p-3">
                        <p className="text-sm font-semibold text-primary">Reviews for reviewers to copy</p>
                        <p className="mt-0.5 text-xs text-muted">Each is built around one of your chosen keywords — edit freely.</p>
                        <ul className="mt-3 space-y-2">
                          {reviewDrafts.map((d, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <div className="w-full flex-1">
                                {d.keyword && <p className="mb-1 truncate text-[10px] font-semibold text-muted">Keyword: {d.keyword}</p>}
                                <textarea
                                  rows={2}
                                  value={d.text}
                                  onChange={(e) => updateDraft(i, e.target.value)}
                                  maxLength={1000}
                                  className="w-full resize-none rounded-2xl border border-default bg-surface-sunken px-3 py-2.5 text-xs text-primary outline-none transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/50"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removeDraft(i)}
                                aria-label="Remove"
                                className="shrink-0 rounded-full p-1.5 text-muted transition-all duration-200 hover:bg-danger-subtle hover:text-danger"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

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
                        <span className="block text-sm font-semibold text-primary">Pace out reviews</span>
                        <span className="mt-0.5 block text-xs text-muted">
                          Spread reviews over time instead of all at once — safer for Google&apos;s spam detection.
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={pacingOn}
                        onChange={(e) => setPacingOn(e.target.checked)}
                        className="h-4.5 w-4.5 shrink-0 rounded border-default accent-accent"
                      />
                    </label>

                    <div className={`mt-3 flex flex-wrap items-center gap-2 border-t border-default pt-3 text-sm transition-opacity duration-150 ${pacingOn ? "text-secondary" : "pointer-events-none opacity-40"}`}>
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
