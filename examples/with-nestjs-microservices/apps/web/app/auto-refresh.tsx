"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 1500;

/**
 * Fulfillment happens asynchronously in the worker, so while orders are
 * pending the page re-renders on the server to pick up their new status.
 */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) {
      return;
    }
    const interval = setInterval(() => {
      // Every refresh costs a gateway request against the tenant's rate
      // limit, so tabs in the background skip it.
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active, router]);

  return null;
}
