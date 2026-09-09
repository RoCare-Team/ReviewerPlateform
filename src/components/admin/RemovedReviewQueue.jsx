"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Inbox, Info, RotateCcw, ShieldCheck, Undo2 } from "lucide-react";
import SearchInput from "./SearchInput";
import { toast } from "../../lib/toast";

/**
 * Reviews the platform paid for that have since disappeared from Google —
 * filled by the review-recheck cron (api/cron/review-recheck), which flags but
 * never reverses anything itself.
 *
 * The Auto-reversed tab is a RECORD, not a queue: those rewards were already
 * taken back by the checker on evidence it could stand behind (see
 * lib/reviewMonitor.js), and the only action left is the undo — "Approve
 * again", the ordinary admin approve on a rejected submission, which re-credits
 * the reviewer and re-takes the campaign slot. It's there because an automatic
 * clawback with no visible way back would be the wrong thing to ship.
 *
 * On the flagged tabs there are two ways out, and the admin picks one per row:
 *   Reverse reward → the existing "unverify" action (lib/verification.js).
 *     Takes the reward back out of the reviewer's wallet, gives the campaign
 *     its slot back, and flips the submission to rejected with the reason
 *     typed here — which the reviewer sees. A reason is required precisely
 *     because they see it.
 *   Looks fine → "dismiss_removal". Changes no money and no status; it just
 *     stops this submission coming back to the queue. For the cases the cron
 *     can't judge: the business changed listings, the review was posted from
 *     an account Google has since made private, and so on.
 *
 * The Dismissed tab is not an archive to ignore — a dismissal is undone
 * automatically if a later check finds the review live again, so a row here
 * genuinely still has no review behind it.
 *
 * Laid out as a table because the decision is comparative: with dozens of rows
 * an admin is scanning down one reviewer's name, or down the ₹ column, and
 * stacked cards make that impossible. Confirming a reversal expands a row
 * underneath the one being acted on, so the reason box never covers the row it
 * belongs to. Mobile falls back to cards, where a 7-column table can't work.
 */
const TABS = [
  { key: "reversed", label: "Auto-reversed" },
  { key: "missing", label: "Needs a decision" },
  { key: "dismissed", label: "Dismissed" },
];

/** "20/8/2026, 7:00:37 am" → ["20/8/2026", "7:00:37 am"] for a two-line cell. */
function splitStamp(v) {
  if (!v) return ["—", ""];
  const [date, ...rest] = String(v).split(", ");
  return [date, rest.join(", ")];
}

export default function RemovedReviewQueue({ rows, autoReverseOn = true }) {
  const router = useRouter();
  // Open on whichever tab actually has something on it: with automatic
  // reversal on, "needs a decision" is the exception, not the norm.
  const [tab, setTab] = useState(() =>
    rows.some((r) => r.bucket === "missing") ? "missing" : rows.some((r) => r.bucket === "reversed") ? "reversed" : "missing"
  );
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(null);
  const [reversing, setReversing] = useState(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const counts = {
    reversed: rows.filter((r) => r.bucket === "reversed").length,
    missing: rows.filter((r) => r.bucket === "missing").length,
    dismissed: rows.filter((r) => r.bucket === "dismissed").length,
  };

  const visible = useMemo(() => {
    const base = rows.filter((r) => r.bucket === tab);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((r) =>
      [r.reviewerName, r.reviewerEmail, r.campaignName, r.businessName].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [rows, tab, query]);

  const shownTotal = visible.reduce((sum, r) => sum + r.rewardAmount, 0);

  function startReverse(row) {
    setReversing(row.id);
    setReason("The review this was paid for is no longer on the business's Google listing.");
    setReasonError("");
  }

  function cancelReverse() {
    setReversing(null);
    setReason("");
    setReasonError("");
  }

  async function act(id, action, reasonText = "") {
    if (action === "unverify" && !reasonText.trim()) {
      setReasonError("Say why — the reviewer is shown this.");
      return;
    }
    setBusy(id);
    const res = await fetch(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: reasonText }),
    });
    setBusy(null);
    cancelReverse();

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't update this submission.");
      router.refresh();
      return;
    }
    // The reward can be reversed even when the reviewer has already withdrawn
    // it — the wallet goes negative so the shortfall stays visible instead of
    // being quietly written off. The API says so; don't hide it behind a
    // plain success toast.
    if (data.warning) toast.error(data.warning);
    else if (action === "approve") toast.success("Approved again — the reward has been credited back.");
    else if (action === "unverify") toast.success("Reward reversed.");
    else toast.success("Marked as fine — removed from the queue.");
    router.refresh();
  }

  /**
   * The reason box, shared by the expanded table row and the mobile card.
   *
   * A plain function CALLED into the tree, not a component rendered as
   * <ReverseConfirm/>: a component declared inside this one is a brand-new
   * type on every render, so React would unmount and remount the input on
   * every keystroke and the field would lose focus after each character.
   */
  function reverseConfirm(row) {
    return (
      <div className="rounded-btn border border-danger/40 bg-danger-subtle p-3">
        <label htmlFor={`reason-${row.id}`} className="block text-xs font-semibold text-primary">
          Why is this being reversed? The reviewer sees this.
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id={`reason-${row.id}`}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError("");
            }}
            maxLength={300}
            className={`min-w-0 flex-1 rounded-btn border bg-surface px-3 py-2 text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-accent/50 ${
              reasonError ? "border-danger" : "border-default focus:border-accent"
            }`}
          />
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => act(row.id, "unverify", reason)}
              disabled={busy === row.id || !reason.trim()}
              className="rounded-btn bg-danger px-3 py-2 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
            >
              {busy === row.id ? "Reversing…" : `Confirm ₹${row.rewardAmount}`}
            </button>
            <button
              type="button"
              onClick={cancelReverse}
              className="rounded-btn border border-default bg-surface px-3 py-2 text-sm font-semibold text-secondary transition-colors duration-200 hover:text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
        {reasonError && <p className="mt-1.5 text-xs text-danger">{reasonError}</p>}
      </div>
    );
  }

  return (
    <div>
      <div role="tablist" aria-label="Filter by decision" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setTab(t.key);
                cancelReverse();
              }}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                isActive
                  ? "border-transparent bg-accent text-on-brand shadow-sm"
                  : "border-default bg-surface text-secondary hover:-translate-y-0.5 hover:border-accent/40 hover:text-primary"
              }`}
            >
              {t.label}
              <span className={`nums rounded-full px-1.5 py-0.5 text-xs transition-colors duration-200 ${isActive ? "bg-white/20" : "bg-surface-sunken"}`}>
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Reviewer, campaign or business…"
        resultLabel={`${visible.length} shown · ₹${shownTotal.toLocaleString("en-IN")}`}
      />

      {/* What the buttons do. Two actions that both make a row vanish but do
          opposite things to someone's money earn a permanent legend. */}
      {visible.length > 0 && (
        <div className="mt-6 rounded-card border border-default bg-surface-sunken p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            What the two actions do
          </p>
          {tab === "reversed" ? (
            <div className="mt-3 rounded-btn border border-default bg-surface p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                <Undo2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Approve again
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-secondary">
                The reward on these rows was already taken back automatically — the reviewer&apos;s wallet is short by
                that amount and the submission now reads as rejected to them. Use this only if the review really is on
                the listing after all: it credits the reward back and re-takes the campaign slot.
              </p>
            </div>
          ) : (
            <dl className="mt-3 grid items-stretch gap-3 sm:grid-cols-2">
              <div className="rounded-btn border border-danger/30 bg-surface p-3">
                <dt className="flex items-center gap-1.5 text-sm font-semibold text-danger">
                  <RotateCcw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Reverse
                </dt>
                <dd className="mt-1.5 text-xs leading-relaxed text-secondary">
                  Takes the reward back out of the reviewer&apos;s wallet, returns the campaign slot so it can be filled
                  again, and rejects the submission with the reason you type — which the reviewer sees. If they already
                  withdrew the money their balance goes negative, so the shortfall stays visible.
                </dd>
              </div>
              <div className="rounded-btn border border-default bg-surface p-3">
                <dt className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Looks fine
                </dt>
                <dd className="mt-1.5 text-xs leading-relaxed text-secondary">
                  Changes no money and no status — the reviewer keeps the reward and is never told. It only takes the
                  row out of this queue. If a later check finds the review live again, the dismissal undoes itself.
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="mt-6 rounded-card border border-dashed border-default bg-surface-raised p-10 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-primary">
            {tab === "reversed" ? "Nothing reversed yet" : tab === "missing" ? "Nothing to decide" : "Nothing dismissed"}
          </p>
          <p className="mt-1 text-sm text-secondary">
            {tab === "reversed"
              ? autoReverseOn
                ? "No paid review has been confirmed gone since automatic reversal was turned on."
                : "Automatic reversal is off — reversals you make by hand aren't listed here."
              : tab === "missing"
                ? "Every paid review the checker could see is still live on Google."
                : "Reviews you mark as fine will be listed here."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden overflow-x-auto rounded-card border border-default bg-surface-raised shadow-sm lg:block">
            <table className="w-full min-w-[64rem] text-sm">
              <thead className="border-b border-default bg-surface-sunken text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">Reviewer</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Campaign</th>
                  <th scope="col" className="px-5 py-3 font-semibold">Approved</th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    {tab === "reversed" ? "Reversed" : "Missing since"}
                  </th>
                  <th scope="col" className="px-5 py-3 text-center font-semibold">Fails</th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">
                    {tab === "reversed" ? "Taken back" : "Paid"}
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {visible.map((s) => {
                  const [approvedDate, approvedTime] = splitStamp(s.reviewedDate || s.date);
                  const [missingDate, missingTime] = splitStamp(tab === "reversed" ? s.reversedAt : s.missingSince);
                  const isOpen = reversing === s.id;
                  return (
                    <Fragment key={s.id}>
                    <tr
                      className={`align-top transition-colors ${isOpen ? "bg-danger-subtle/40" : "hover:bg-surface-sunken/50"}`}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-primary">{s.reviewerName || "—"}</p>
                        <p className="truncate text-xs text-muted">{s.reviewerEmail}</p>
                      </td>
                      <td className="max-w-[16rem] px-5 py-3.5">
                        <div className="flex items-start gap-1.5">
                          <div className="min-w-0">
                            <p className="truncate text-secondary" title={s.campaignName}>{s.campaignName}</p>
                            <p className="truncate text-xs text-muted" title={s.checkNote}>{s.businessName || "—"}</p>
                          </div>
                          {s.targetUrl && (
                            <a
                              href={s.targetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open the Google listing"
                              aria-label={`Open the Google listing for ${s.campaignName}`}
                              className="mt-0.5 shrink-0 rounded p-0.5 text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            >
                              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <p className="nums text-secondary">{approvedDate}</p>
                        <p className="nums text-xs text-muted">{approvedTime}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <p className="nums text-secondary">{missingDate}</p>
                        <p className="nums text-xs text-muted">{missingTime}</p>
                      </td>
                      <td className="nums px-5 py-3.5 text-center text-secondary">{s.missingStreak}</td>
                      <td
                        className={`nums whitespace-nowrap px-5 py-3.5 text-right font-bold ${
                          s.bucket === "reversed" ? "text-danger" : "text-primary"
                        }`}
                      >
                        {s.bucket === "reversed" ? `−₹${s.rewardAmount}` : `₹${s.rewardAmount}`}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        {s.bucket === "reversed" ? (
                          <button
                            type="button"
                            onClick={() => act(s.id, "approve", "")}
                            disabled={busy === s.id}
                            className="inline-flex items-center gap-1.5 rounded-btn border border-verified/40 bg-surface px-3 py-1.5 text-xs font-semibold text-verified transition-colors duration-200 hover:bg-verified-subtle disabled:opacity-50"
                          >
                            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                            {busy === s.id ? "Approving…" : "Approve again"}
                          </button>
                        ) : s.bucket === "missing" ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => act(s.id, "dismiss_removal", "")}
                              disabled={busy === s.id || isOpen}
                              className="inline-flex items-center gap-1.5 rounded-btn border border-default bg-surface px-3 py-1.5 text-xs font-semibold text-secondary transition-colors duration-200 hover:border-verified/40 hover:text-primary disabled:opacity-50"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                              Looks fine
                            </button>
                            <button
                              type="button"
                              onClick={() => startReverse(s)}
                              disabled={busy === s.id || isOpen}
                              className="inline-flex items-center gap-1.5 rounded-btn bg-danger px-3 py-1.5 text-xs font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                              Reverse
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startReverse(s)}
                            disabled={busy === s.id || isOpen}
                            className="inline-flex items-center gap-1.5 rounded-btn border border-danger/40 bg-surface px-3 py-1.5 text-xs font-semibold text-danger transition-colors duration-200 hover:bg-danger-subtle disabled:opacity-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                            Reverse anyway
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-danger-subtle/40">
                        <td colSpan={7} className="px-5 pb-4">
                          {reverseConfirm(s)}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile / tablet cards — a seven-column table can't work here. */}
          <ul className="mt-6 space-y-3 lg:hidden">
            {visible.map((s) => (
              <li key={s.id} className="rounded-card border border-default bg-surface-raised p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-primary">{s.reviewerName || s.reviewerEmail}</p>
                    <p className="mt-0.5 truncate text-sm text-secondary">
                      {s.campaignName}
                      {s.businessName ? ` · ${s.businessName}` : ""}
                    </p>
                  </div>
                  <span className="nums shrink-0 font-bold text-primary">₹{s.rewardAmount}</span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Approved</dt>
                    <dd className="nums text-secondary">{splitStamp(s.reviewedDate || s.date)[0]}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">{s.bucket === "reversed" ? "Reversed" : "Missing since"}</dt>
                    <dd className="nums text-secondary">
                      {splitStamp(s.bucket === "reversed" ? s.reversedAt : s.missingSince)[0]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Failed checks</dt>
                    <dd className="nums text-secondary">{s.missingStreak}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Last checked</dt>
                    <dd className="nums text-secondary">{splitStamp(s.checkedDate)[0]}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {s.targetUrl && (
                    <a
                      href={s.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-btn border border-default px-3 py-2 text-sm font-semibold text-secondary transition-colors duration-200 hover:border-accent/40 hover:text-primary"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Listing
                    </a>
                  )}
                  {s.bucket === "reversed" && (
                    <button
                      type="button"
                      onClick={() => act(s.id, "approve", "")}
                      disabled={busy === s.id}
                      className="inline-flex items-center gap-1.5 rounded-btn border border-verified/40 px-3 py-2 text-sm font-semibold text-verified transition-colors duration-200 hover:bg-verified-subtle disabled:opacity-50"
                    >
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Approve again
                    </button>
                  )}
                  {s.bucket === "missing" && (
                    <button
                      type="button"
                      onClick={() => act(s.id, "dismiss_removal", "")}
                      disabled={busy === s.id || reversing === s.id}
                      className="inline-flex items-center gap-1.5 rounded-btn border border-default px-3 py-2 text-sm font-semibold text-secondary transition-colors duration-200 hover:border-verified/40 hover:text-primary disabled:opacity-50"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Looks fine
                    </button>
                  )}
                  {s.bucket !== "reversed" && reversing !== s.id && (
                    <button
                      type="button"
                      onClick={() => startReverse(s)}
                      disabled={busy === s.id}
                      className="inline-flex items-center gap-1.5 rounded-btn bg-danger px-3 py-2 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Reverse ₹{s.rewardAmount}
                    </button>
                  )}
                </div>

                {reversing === s.id && (
                  <div className="mt-3">
                    {reverseConfirm(s)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
