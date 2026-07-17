"use client";

import { useRef, useState } from "react";

/** 6-digit code entry. Emits the joined string via onChange. */
export default function OtpInput({ value = "", onChange, error }) {
  const refs = useRef([]);
  const [digits, setDigits] = useState(() => value.padEnd(6, "").split("").slice(0, 6));

  function push(next) {
    setDigits(next);
    onChange?.(next.join(""));
  }

  function handleChange(i, raw) {
    const d = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    push(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i, e) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  }

  // Paste the whole code into any box and it fills all six.
  function handlePaste(e) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = text.padEnd(6, "").split("").slice(0, 6);
    push(next);
    refs.current[Math.min(text.length, 5)]?.focus();
  }

  return (
    <div className="flex gap-2" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={digits[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          className={`h-14 w-full rounded-btn border bg-surface text-center font-mono text-xl text-primary outline-none transition focus:ring-2 focus:ring-accent ${
            error ? "border-danger" : "border-default focus:border-accent"
          }`}
        />
      ))}
    </div>
  );
}
