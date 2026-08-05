'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Mobile touch gestures:
 * - Pull-to-refresh: touch-start within 80px of the top, drag DOWN, release
 *   past the threshold. Calls router.refresh() to re-fetch server data.
 * - Swipe-back: touch-start within 24px of the LEFT edge, drag RIGHT past
 *   the threshold. Calls router.back() (falls back to /dashboard if no
 *   history). Renders an arrow preview while dragging.
 *
 * iOS Safari already has built-in pull-to-refresh and swipe-back; this
 * component activates primarily in PWA standalone mode and on Android
 * Chrome where native gestures are disabled.
 */
export function MobileGestures() {
  const router = useRouter();
  const [pull, setPull] = useState(0); // 0..1 progress
  const [refreshing, setRefreshing] = useState(false);
  const [swipeBack, setSwipeBack] = useState(0); // px

  const pullStateRef = useRef<{ y: number; startY: number; startX: number } | null>(null);
  const swipeStateRef = useRef<{ x: number; startX: number; startY: number; startTime: number } | null>(null);

  // Tunables
  const PULL_THRESHOLD = 80;       // px to drag before it commits
  const PULL_MAX = 140;             // visual cap
  const PULL_TOP_ZONE = 80;         // touch must start within this many px of top
  const SWIPE_THRESHOLD = 80;       // px to drag right before back commits
  const SWIPE_MAX = 200;
  const SWIPE_EDGE = 32;            // touch must start within this many px of LEFT edge
  const SWIPE_VERTICAL_TOLERANCE = 60; // cancel if user moves more vertical than this

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const startX = t.clientX;
      const startY = t.clientY;
      const scrollTop = window.scrollY;

      // Pull-to-refresh: only when scrolled to top
      if (startY <= PULL_TOP_ZONE && scrollTop <= 1) {
        pullStateRef.current = { y: startY, startY, startX };
      }
      // Swipe-back: only when touch starts near the left edge
      else if (startX <= SWIPE_EDGE) {
        swipeStateRef.current = { x: startX, startX, startY, startTime: Date.now() };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      // Pull-to-refresh
      if (pullStateRef.current && !swipeStateRef.current) {
        const dy = t.clientY - pullStateRef.current.y;
        const dx = Math.abs(t.clientX - pullStateRef.current.startX);
        // Require mostly-vertical drag
        if (dx > 60) {
          pullStateRef.current = null;
          setPull(0);
          return;
        }
        if (dy <= 0) return;
        // Elastic resistance: x -> 1 - 1/(1+x/k)
        const k = 220;
        const p = Math.max(0, Math.min(1, 1 - 1 / (1 + dy / k)));
        setPull(p);
        // Prevent default scroll while pulling
        if (dy > 8) e.preventDefault();
        return;
      }
      // Swipe-back
      if (swipeStateRef.current && !pullStateRef.current) {
        const dx = t.clientX - swipeStateRef.current.x;
        const dy = Math.abs(t.clientY - swipeStateRef.current.startY);
        if (dy > SWIPE_VERTICAL_TOLERANCE) {
          // User is scrolling vertically, not swiping back
          swipeStateRef.current = null;
          setSwipeBack(0);
          return;
        }
        if (dx <= 0) {
          setSwipeBack(0);
          return;
        }
        const eased = Math.min(SWIPE_MAX, dx * 1.2);
        setSwipeBack(eased);
        if (dx > 8) e.preventDefault();
      }
    };

    const triggerRefresh = () => {
      setRefreshing(true);
      // Small delay so the spinner is visible
      setTimeout(() => {
        router.refresh();
        // Clear the spinner after the refresh settles
        setTimeout(() => {
          setRefreshing(false);
          setPull(0);
        }, 600);
      }, 250);
    };

    const triggerBack = () => {
      // Prefer back, but fall back to dashboard if no history
      if (window.history.length > 1) {
        router.back();
      } else {
        router.push('/dashboard');
      }
    };

    const onTouchEnd = () => {
      if (pullStateRef.current) {
        const p = pull;
        pullStateRef.current = null;
        if (p >= 0.5) {
          triggerRefresh();
        } else {
          setPull(0);
        }
      }
      if (swipeStateRef.current) {
        const dx = swipeBack;
        swipeStateRef.current = null;
        if (dx >= SWIPE_THRESHOLD) {
          triggerBack();
        }
        setSwipeBack(0);
      }
    };

    const onTouchCancel = () => {
      pullStateRef.current = null;
      swipeStateRef.current = null;
      setPull(0);
      setSwipeBack(0);
    };

    // Use passive: false so we can call e.preventDefault() while pulling
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart as any);
      document.removeEventListener('touchmove', onTouchMove as any);
      document.removeEventListener('touchend', onTouchEnd as any);
      document.removeEventListener('touchcancel', onTouchCancel as any);
    };
  }, [pull, swipeBack, router]);

  // Visual pull-to-refresh indicator (rendered above all content)
  const pullOffset = Math.min(PULL_MAX, pull * PULL_MAX);
  const pullRot = pull * 360;
  const showPullIndicator = pull > 0.02 || refreshing;

  // Visual swipe-back indicator
  const swipeProgress = Math.min(1, swipeBack / SWIPE_THRESHOLD);
  const showSwipeIndicator = swipeBack > 4;

  return (
    <>
      {/* Pull-to-refresh indicator */}
      {showPullIndicator && (
        <div
          className="md:hidden fixed left-1/2 -translate-x-1/2 z-40 pointer-events-none"
          style={{ top: `calc(env(safe-area-inset-top, 0px) + 8px + ${pullOffset}px)` }}
        >
          <div
            className={cn(
              'flex items-center justify-center h-10 w-10 rounded-full bg-card border shadow-md transition-transform',
              refreshing && 'animate-spin-slow',
            )}
            style={{ transform: `rotate(${pullRot}deg)` }}
            aria-hidden
          >
            <RefreshCw className="h-5 w-5 text-muted-foreground" />
          </div>
          {refreshing && (
            <p className="absolute left-1/2 -translate-x-1/2 top-full mt-1 text-[10px] text-muted-foreground whitespace-nowrap">
              Refreshing…
            </p>
          )}
        </div>
      )}

      {/* Swipe-back indicator */}
      {showSwipeIndicator && (
        <div
          className="md:hidden fixed top-0 bottom-0 left-0 z-40 pointer-events-none flex items-center pl-2 pt-safe"
          aria-hidden
        >
          <div
            className="flex items-center gap-1 px-3 py-2 rounded-full bg-card border shadow-md"
            style={{
              opacity: swipeProgress,
              transform: `translateX(${-10 + swipeBack * 0.3}px)`,
            }}
          >
            <ChevronRight
              className="h-4 w-4 text-muted-foreground"
              style={{ transform: `rotate(180deg)` }}
            />
            <span className="text-xs font-medium">Back</span>
          </div>
        </div>
      )}
    </>
  );
}
