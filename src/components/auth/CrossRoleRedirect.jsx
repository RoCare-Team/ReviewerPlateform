"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Toast from "../shared/Toast";

/**
 * Shows a toast then redirects to /login after a short delay — used when the
 * Google signup flow (config.js signIn callback) blocks sign-in because the
 * email already has an account under the OTHER role.
 */
export default function CrossRoleRedirect({ message, delay = 2500 }) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => router.push("/login"), delay);
    return () => clearTimeout(t);
  }, [router, delay]);

  return <Toast message={visible ? message : ""} tone="info" duration={0} onClose={() => setVisible(false)} />;
}
