'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Dismiss a floating element the way users actually expect.
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * The user menu in TopBar used to be dismissed by a `<div className="fixed
 * inset-0" onClick={close} />` scrim. That does not work: the header carries
 * `backdrop-filter`, and per CSS an ancestor with `backdrop-filter` becomes the
 * containing block for `position: fixed` descendants. The "full screen" scrim
 * was therefore only as tall as the header (~56px), so tapping anywhere below
 * it never reached the scrim and the menu stayed open until you tapped the
 * avatar again.
 *
 * A document-level listener has no such positioning dependency.
 *
 * Closes on:
 *   - pointerdown outside the referenced element
 *   - Escape
 *   - route change (so navigating never leaves a stale menu open)
 *   - scroll / resize (a menu anchored to a scrolling page would otherwise
 *     detach from its trigger)
 *
 * @param open    whether the element is currently shown
 * @param onClose called to dismiss it
 * @param ref     ref attached to the element's outermost container
 */
export function useDismissable<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
  ref: React.RefObject<T | null>,
) {
  const pathname = usePathname();
  // Keep the latest callback without re-subscribing on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const el = ref.current;
      // If the node is gone, nothing sensible to compare against.
      if (!el) return;
      const target = event.target;
      if (target instanceof Node && !el.contains(target)) {
        onCloseRef.current();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };

    const handleScrollOrResize = () => onCloseRef.current();

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    // `true` = capture, so we also catch scrolling inside inner containers.
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [open, ref]);

  // Route change: close without waiting for a second interaction.
  useEffect(() => {
    if (open) onCloseRef.current();
    // Intentionally keyed on pathname only -- re-running on every `open`
    // change would close the menu the instant it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}