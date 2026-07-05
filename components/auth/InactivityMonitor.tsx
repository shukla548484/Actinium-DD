"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SESSION_IDLE_TIMEOUT_SEC } from "@/lib/auth/constants";

const IDLE_MS = SESSION_IDLE_TIMEOUT_SEC * 1000;
const TOUCH_DEBOUNCE_MS = 45_000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "click"] as const;

async function touchSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/touch", { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

async function logoutAndRedirect(reason: string) {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  window.location.href = `/login?reason=${reason}`;
}

/**
 * Signs the user out after SESSION_IDLE_TIMEOUT_SEC without pointer/keyboard activity.
 * Debounced server touches keep the httpOnly session aligned with local activity.
 */
export function InactivityMonitor() {
  const router = useRouter();
  const pathname = usePathname();
  const lastActivityRef = useRef(Date.now());
  const lastTouchRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    const now = Date.now();
    if (now - lastTouchRef.current < TOUCH_DEBOUNCE_MS) return;
    lastTouchRef.current = now;
    void touchSession();
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/login")) return;

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    timerRef.current = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= IDLE_MS) {
        void logoutAndRedirect("timeout");
        return;
      }
      void touchSession().then((ok) => {
        if (!ok) {
          router.replace("/login?reason=timeout");
        }
      });
    }, 60_000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [onActivity, pathname, router]);

  return null;
}
