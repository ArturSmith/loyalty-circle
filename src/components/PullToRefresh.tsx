import { useEffect, useRef, useState } from "react";
import { ArrowDown, RefreshCw } from "lucide-react";
import { hapticTap, isNativeApp } from "@/lib/native";

const TRIGGER_DISTANCE = 72;
const MAX_PULL = 104;

function scrollableParent(target: EventTarget | null, root: HTMLElement) {
  let element = target instanceof HTMLElement ? target : null;
  while (element && element !== root) {
    const style = window.getComputedStyle(element);
    if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1) {
      return element;
    }
    element = element.parentElement;
  }
  return root;
}

/** One pull-to-refresh gesture for the entire native app scroll shell. */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<void> | void }) {
  const [enabled, setEnabled] = useState(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!isNativeApp()) return;
    setEnabled(true);
    const root = document.getElementById("app-scroll");
    if (!root) return;

    let tracking = false;
    let startX = 0;
    let startY = 0;
    let gestureScroller: HTMLElement = root;
    let thresholdTapped = false;

    const reset = () => {
      tracking = false;
      thresholdTapped = false;
      pullRef.current = 0;
      setPull(0);
    };

    const start = (event: TouchEvent) => {
      if (refreshingRef.current || event.touches.length !== 1 || root.scrollTop > 0) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target?.closest("input, textarea, select, [contenteditable], [data-pull-refresh='off']")
      ) {
        return;
      }

      gestureScroller = scrollableParent(event.target, root);
      if (gestureScroller.scrollTop > 0) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      tracking = true;
    };

    const move = (event: TouchEvent) => {
      if (!tracking || event.touches.length !== 1) return;
      const deltaX = event.touches[0].clientX - startX;
      const deltaY = event.touches[0].clientY - startY;

      if (deltaY <= 0 || Math.abs(deltaX) > Math.abs(deltaY)) {
        reset();
        return;
      }
      if (root.scrollTop > 0 || gestureScroller.scrollTop > 0) {
        reset();
        return;
      }

      // Once the gesture is known to be a downward pull, keep the WebView from
      // rubber-banding. Resistance makes the interaction feel native.
      event.preventDefault();
      const distance = Math.min(MAX_PULL, deltaY * 0.45);
      pullRef.current = distance;
      setPull(distance);

      if (distance >= TRIGGER_DISTANCE && !thresholdTapped) {
        thresholdTapped = true;
        void hapticTap();
      } else if (distance < TRIGGER_DISTANCE) {
        thresholdTapped = false;
      }
    };

    const finish = () => {
      if (!tracking) return;
      tracking = false;
      if (pullRef.current < TRIGGER_DISTANCE) {
        reset();
        return;
      }

      refreshingRef.current = true;
      setRefreshing(true);
      setPull(56);
      void Promise.all([
        Promise.resolve(onRefreshRef.current()),
        new Promise((resolve) => window.setTimeout(resolve, 400)),
      ]).finally(() => {
        refreshingRef.current = false;
        setRefreshing(false);
        reset();
      });
    };

    root.addEventListener("touchstart", start, { passive: true });
    root.addEventListener("touchmove", move, { passive: false });
    root.addEventListener("touchend", finish, { passive: true });
    root.addEventListener("touchcancel", reset, { passive: true });
    return () => {
      root.removeEventListener("touchstart", start);
      root.removeEventListener("touchmove", move);
      root.removeEventListener("touchend", finish);
      root.removeEventListener("touchcancel", reset);
    };
  }, []);

  // Native detection happens after hydration so the server-rendered web page
  // and the first client render always have identical markup.
  if (!enabled) return null;
  const ready = pull >= TRIGGER_DISTANCE;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[100] flex justify-center transition-opacity duration-150"
      style={{
        top: "calc(env(safe-area-inset-top) - 44px)",
        transform: `translateY(${pull}px)`,
        opacity: pull > 4 || refreshing ? 1 : 0,
      }}
      role="status"
      aria-live="polite"
      aria-label={refreshing ? "Refreshing" : ready ? "Release to refresh" : "Pull to refresh"}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-primary shadow-lg">
        {refreshing ? (
          <RefreshCw className="h-5 w-5 motion-safe:animate-spin" />
        ) : (
          <ArrowDown
            className="h-5 w-5 transition-transform"
            style={{ transform: ready ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        )}
      </div>
    </div>
  );
}
