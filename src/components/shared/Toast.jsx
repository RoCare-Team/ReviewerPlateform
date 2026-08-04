"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

const TONE = {
  info: { icon: AlertCircle, className: "border-pending bg-pending-subtle text-primary" },
  error: { icon: AlertCircle, className: "border-danger bg-danger-subtle text-danger" },
  success: { icon: CheckCircle2, className: "border-verified bg-verified-subtle text-verified" },
};

/**
 * A single toast, fixed to the top-center of the viewport. Auto-dismisses
 * after `duration` ms (pass 0 to disable). Purely presentational — the
 * caller owns the message/visibility state and passes `onClose`.
 */
export default function Toast({ message, tone = "info", onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message || !duration) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [message, duration, onClose]);

  if (!message) return null;

  const { icon: Icon, className } = TONE[tone] ?? TONE.info;

  return (
    <div
      role="alert"
      className={`animate-fade-up fixed top-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-start gap-2.5 rounded-btn border px-4 py-3 text-sm shadow-lg ${className}`}
      style={{ animationDuration: "250ms" }}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 leading-relaxed">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 transition-colors duration-150 hover:bg-black/10"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
