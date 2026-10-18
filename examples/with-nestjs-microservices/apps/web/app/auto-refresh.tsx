"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";

const REFRESH_INTERVAL_MS = 2000;
// About a minute of polling. An order still pending after that is waiting on
// retries (the worker or the orders service is down), and polling on would
// only spend the visitor's rate limit.
const MAX_REFRESHES = 30;

/**
 * Fulfillment happens asynchronously in the worker, so while orders are
 * pending the page re-renders on the server to pick up their new status.
 */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const refreshingRef = useRef(false);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    if (!active) {
      return;
    }
    let refreshes = 0;
    const interval = setInterval(() => {
      // Every refresh costs a gateway request, so hidden tabs skip it and a
      // slow refresh is never overlapped by the next one.
      if (document.visibilityState !== "visible" || refreshingRef.current) {
        return;
      }
      refreshes += 1;
      if (refreshes > MAX_REFRESHES) {
        clearInterval(interval);
        return;
      }
      startTransition(() => router.refresh());
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active, router]);

  return null;
}
