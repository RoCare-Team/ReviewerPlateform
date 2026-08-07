"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "../../lib/toast";

/**
 * Shows a toast then redirects to /login after a short delay — used when the
 * Google signup flow (config.js signIn callback) blocks sign-in because the
 * email already has an account under the OTHER role.
 */
export default function CrossRoleRedirect({ message, delay = 2500 }) {
  const router = useRouter();

  useEffect(() => {
    toast(message, { icon: "ℹ️", duration: delay });
    const t = setTimeout(() => router.push("/login"), delay);
    return () => clearTimeout(t);
  }, [message, delay, router]);

  return null;
}
