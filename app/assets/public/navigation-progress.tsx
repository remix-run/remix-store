import { clientEntry, css, navigation, type Handle } from "remix/component";

/** Quick navigations finish before this, so the bar doesn't flash. */
const SHOW_DELAY_MS = 150;

/**
 * A thin bar along the top of the page while a page navigation loads.
 * Navigations that only load a named frame, such as "Load more", have their
 * own loading state, so they don't show it.
 */
export const NavigationProgress = clientEntry(
  import.meta.url,
  function NavigationProgress(handle: Handle) {
    let visible = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function show(next: boolean) {
      if (visible === next) return;
      visible = next;
      handle.update();
    }

    function update() {
      clearTimeout(timer);
      let pending = navigation.current;
      if (!pending || pending.target !== undefined) return show(false);
      if (!visible) timer = setTimeout(() => show(true), SHOW_DELAY_MS);
    }

    handle.queueTask(() => {
      navigation.addEventListener("change", update, { signal: handle.signal });
      handle.signal.addEventListener("abort", () => clearTimeout(timer));
      update();
    });

    return () => (
      <div
        aria-hidden="true"
        data-navigation-progress
        data-visible={visible || undefined}
        mix={progressStyle}
      >
        <div />
      </div>
    );
  },
);

const progressStyle = css({
  height: "3px",
  insetInline: 0,
  opacity: 0,
  overflow: "hidden",
  pointerEvents: "none",
  position: "fixed",
  top: 0,
  transition: "opacity 200ms",
  zIndex: 1000,
  "&[data-visible]": { opacity: 1 },
  "& > div": {
    background: "var(--color-blue-brand)",
    height: "100%",
    width: "100%",
  },
  "&[data-visible] > div": {
    animation: "navigation-progress 1.2s ease-in-out infinite",
  },
  "@media (prefers-reduced-motion: reduce)": {
    "&[data-visible] > div": { animation: "none" },
  },
});
