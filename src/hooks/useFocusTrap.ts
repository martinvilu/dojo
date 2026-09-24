"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Focusable, visible descendants of `container`, in DOM order. */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("inert") && el.getClientRects().length > 0
  );
}

interface FocusTrapOptions {
  /** Called when Escape is pressed while the trap is active. */
  onEscape?: () => void;
  /** Element to focus first; defaults to the first focusable descendant. */
  initialFocus?: () => HTMLElement | null;
}

/**
 * Keeps keyboard focus inside a dialog while `active` (WCAG 2.1.2 / 2.4.3):
 *   - moves focus into the container when it opens,
 *   - wraps Tab / Shift+Tab between the first and last focusable elements,
 *   - closes on Escape through `onEscape`,
 *   - restores focus to the element that opened the dialog on close.
 *
 * Only the most recently activated trap reacts, so nested dialogs (e.g. a
 * confirmation on top of a form modal) behave as expected.
 *
 *   const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, { onEscape: onClose });
 *   <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1}>…</div>
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  active: boolean,
  { onEscape, initialFocus }: FocusTrapOptions = {}
) {
  const containerRef = useRef<T | null>(null);
  const onEscapeRef = useRef(onEscape);
  const initialFocusRef = useRef(initialFocus);

  useEffect(() => {
    onEscapeRef.current = onEscape;
    initialFocusRef.current = initialFocus;
  });

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    trapStack.push(container);

    const target = initialFocusRef.current?.() ?? getFocusableElements(container)[0] ?? container;
    if (target === container && !container.hasAttribute("tabindex")) {
      container.setAttribute("tabindex", "-1");
    }
    target.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (trapStack[trapStack.length - 1] !== container) return;

      if (event.key === "Escape" && onEscapeRef.current) {
        event.stopPropagation();
        onEscapeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      const outside = !container.contains(current);

      if (event.shiftKey && (current === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      const index = trapStack.lastIndexOf(container);
      if (index !== -1) trapStack.splice(index, 1);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active]);

  return containerRef;
}

const trapStack: HTMLElement[] = [];
