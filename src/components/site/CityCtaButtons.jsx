"use client";

import { useState } from "react";
import ContactModal from "../models/ContactModal";
import RoleSignupModal from "../models/RoleSignupModal";

// Shared CTA pair for the city landing page — opens the same role-picker/
// contact modals used site-wide instead of navigating away, so the page
// keeps the visitor rather than dropping them onto /login or /contact
// directly. The role picker itself routes into /login (there's no separate
// signup page — see RoleSignupModal.jsx).
const VARIANTS = {
  hero: {
    wrapper: "mt-8 flex flex-col gap-3 sm:flex-row",
    primary:
      "inline-flex items-center justify-center rounded-btn bg-accent px-6 py-3 text-center text-sm font-bold text-on-brand shadow-md transition-all duration-200 hover:bg-accent-hover hover:shadow-lg active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    secondary:
      "inline-flex items-center justify-center rounded-btn border border-strong bg-surface px-6 py-3 text-center text-sm font-bold text-primary transition-all duration-200 hover:bg-surface-sunken active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-strong",
  },
  aside: {
    wrapper: "mt-6 flex flex-col gap-3",
    primary:
      "rounded-btn bg-accent px-4 py-2.5 text-center text-sm font-bold text-on-brand shadow-md transition-all duration-200 hover:bg-accent-hover hover:shadow-lg active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent",
    secondary:
      "rounded-btn border border-strong bg-surface px-4 py-2.5 text-center text-sm font-bold text-primary transition-all duration-200 hover:bg-surface-sunken active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-strong",
  },
};

export default function CityCtaButtons({ variant = "hero" }) {
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const styles = VARIANTS[variant];

  return (
    <>
      <div className={styles.wrapper}>
        <button type="button" onClick={() => setRoleModalOpen(true)} className={styles.primary}>
          Start Now
        </button>
        <button type="button" onClick={() => setContactModalOpen(true)} className={styles.secondary}>
          Book a demo
        </button>
      </div>

      <RoleSignupModal isOpen={roleModalOpen} onClose={() => setRoleModalOpen(false)} />
      <ContactModal isOpen={contactModalOpen} onClose={() => setContactModalOpen(false)} />
    </>
  );
}
