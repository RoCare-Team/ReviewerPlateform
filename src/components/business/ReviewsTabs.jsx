"use client";

import { useState } from "react";
import { MapPin, Smartphone } from "lucide-react";

// Icons live here, not in props — a Server Component can't pass a component
// reference (a function) to a Client Component, only plain serializable data.
// Page passes an `icon` KEY string; this map resolves it to the real icon.
const ICONS = { MapPin, Smartphone };

/**
 * Simple client-side tab switcher for the Reviews page — splits Google
 * Business Profile and Play Store reviews into separate tabs instead of one
 * long mixed list. `tabs` is [{ key, label, icon?: keyof ICONS, count?, content }];
 * content is JSX composed server-side (a Server Component may pass JSX as a
 * prop to a Client Component — it's just serialized React elements).
 */
export default function ReviewsTabs({ tabs, defaultTab }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-default">
        {tabs.map((t) => {
          const Icon = ICONS[t.icon];
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? "border-accent text-accent"
                  : "border-transparent text-secondary hover:text-primary"
              }`}
            >
              {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
              {t.label}
              {typeof t.count === "number" && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    isActive ? "bg-accent-subtle text-accent" : "bg-surface-sunken text-muted"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6">{current?.content}</div>
    </div>
  );
}
