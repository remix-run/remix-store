import { createMixin, on } from "remix/component";

/**
 * Makes a `<details>` dropdown dismiss like a menu: it closes when the pointer
 * or focus moves outside it or one of its links is followed, and Escape closes
 * it and returns focus to its summary. Without JavaScript it remains a native
 * disclosure.
 */
export const dismissibleDetails = createMixin<HTMLDetailsElement>((handle) => {
  let { signal } = handle;
  let details: HTMLDetailsElement | undefined;

  function close(restoreFocus = false) {
    if (!details?.open) return;
    details.open = false;
    if (restoreFocus) details.querySelector("summary")?.focus();
  }
  function closeWhenOutside(event: Event) {
    let target = event.target instanceof Node ? event.target : null;
    if (!details?.contains(target)) close();
  }
  function closeOnEscape(event: KeyboardEvent) {
    if (event.key === "Escape") close(true);
  }

  handle.addEventListener("insert", (event) => {
    details = event.node;
    document.addEventListener("pointerdown", closeWhenOutside, { signal });
    document.addEventListener("focusin", closeWhenOutside, { signal });
    document.addEventListener("keydown", closeOnEscape, { signal });
  });

  return () => (
    <handle.element
      mix={on("click", (event) => {
        if (event.target instanceof Element && event.target.closest("a[href]"))
          close();
      })}
    />
  );
});
