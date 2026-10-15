import { prefetchFrame } from "./frame-resolver.ts";
import { remixNavigation } from "./remix-navigation.ts";

/** Hover or focus this long first, so sweeping or tabbing across a grid stays quiet. */
const INTENT_DELAY_MS = 100;

/**
 * Prefetches links marked `data-prefetch="intent"` when the visitor rests on
 * one with the mouse or keyboard focus, or presses it. The next navigation to
 * that URL reuses the response.
 *
 * Opt-in keeps GET routes with side effects, such as cart permalinks, out of
 * reach. Mark only links whose pages are safe to request speculatively.
 */
export function startLinkPrefetching(signal?: AbortSignal): void {
  // Without it, clicks load whole documents, which can't reuse a prefetch.
  if (!remixNavigation() || prefersReducedData()) return;

  let resting:
    | { anchor: HTMLAnchorElement; timer: ReturnType<typeof setTimeout> }
    | undefined;
  let stopResting = () => {
    clearTimeout(resting?.timer);
    resting = undefined;
  };
  let rest = (anchor: HTMLAnchorElement) => {
    if (resting?.anchor === anchor) return;
    stopResting();
    let timer = setTimeout(() => {
      resting = undefined;
      prefetch(anchor);
    }, INTENT_DELAY_MS);
    resting = { anchor, timer };
  };
  let leave = (event: PointerEvent | FocusEvent) => {
    let next = event.relatedTarget;
    if (!(next instanceof Node && resting?.anchor.contains(next))) {
      stopResting();
    }
  };

  document.addEventListener(
    "pointerover",
    (event) => {
      let anchor = intentAnchor(event.target);
      if (anchor && event.pointerType === "mouse") rest(anchor);
    },
    { signal },
  );
  document.addEventListener(
    "focusin",
    (event) => {
      let anchor = intentAnchor(event.target);
      if (anchor) rest(anchor);
    },
    { signal },
  );
  document.addEventListener("pointerout", leave, { signal });
  document.addEventListener("focusout", leave, { signal });
  document.addEventListener(
    "pointerdown",
    (event) => {
      // Other buttons and modifier keys open new tabs, which can't reuse it.
      let opensHere =
        event.isPrimary &&
        event.button === 0 &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey;
      let anchor = intentAnchor(event.target);
      if (!anchor || !opensHere) return;
      stopResting();
      prefetch(anchor);
    },
    { passive: true, signal },
  );
  signal?.addEventListener("abort", stopResting, { once: true });
}

function intentAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLAnchorElement>('a[href][data-prefetch="intent"]');
}

/** Prefetches only what Remix would fetch for a click on the link. */
function prefetch(anchor: HTMLAnchorElement): void {
  if (
    anchor.hasAttribute("download") ||
    anchor.hasAttribute("data-rmx-document") ||
    anchor.hasAttribute("data-rmx-src") ||
    anchor.hasAttribute("data-rmx-target") ||
    (anchor.target && anchor.target !== "_self")
  ) {
    return;
  }

  let url = new URL(anchor.href, location.href);
  let isCurrentPage =
    url.pathname === location.pathname && url.search === location.search;
  if (url.origin === location.origin && !isCurrentPage) prefetchFrame(url);
}

function prefersReducedData(): boolean {
  let connection = Reflect.get(navigator, "connection") as
    | { effectiveType?: string; saveData?: boolean }
    | undefined;
  return (
    connection?.saveData === true ||
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g"
  );
}
