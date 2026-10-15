import * as assert from "remix/assert";
import { describe, it, type TestContext } from "remix/test";

import { startLinkPrefetching } from "./public/link-prefetch.ts";

/** Renders links, starts prefetching, and records the pages it requests. */
function setup(t: TestContext, html: string) {
  let timers = t.useFakeTimers();
  let requested: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    requested.push(new URL(String(input)).pathname);
    return new Response("<p>ok</p>", {
      headers: { "Content-Type": "text/html" },
    });
  });
  let container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  let controller = new AbortController();
  startLinkPrefetching(controller.signal);
  t.after(() => {
    controller.abort();
    container.remove();
  });
  return {
    requested,
    timers,
    get: <E extends Element = HTMLElement>(selector: string) =>
      container.querySelector<E>(selector)!,
  };
}

function pointer(
  type: string,
  target: Element,
  init: PointerEventInit = {},
): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      isPrimary: true,
      pointerType: "mouse",
      ...init,
    }),
  );
}

describe("link prefetching", () => {
  it("prefetches a marked link once the mouse or focus rests on it", (t) => {
    let { get, requested, timers } = setup(
      t,
      `<a id="hover" href="/products/hovered" data-prefetch="intent"><img id="image"></a>
       <a id="focus" href="/products/focused" data-prefetch="intent">Focused</a>`,
    );

    pointer("pointerover", get("#image"));
    timers.advance(99);
    assert.deepEqual(requested, []);
    timers.advance(1);
    get("#focus").focus();
    timers.advance(100);

    assert.deepEqual(requested, ["/products/hovered", "/products/focused"]);
  });

  it("skips links the visitor only passes over or tabs through", (t) => {
    let { get, requested, timers } = setup(
      t,
      `<a id="swept" href="/products/swept" data-prefetch="intent">Swept</a>
       <a id="tabbed" href="/products/tabbed" data-prefetch="intent">Tabbed</a>
       <a id="landed" href="/products/landed" data-prefetch="intent">Landed</a>
       <p id="away">Elsewhere</p>`,
    );

    pointer("pointerover", get("#swept"));
    pointer("pointerout", get("#swept"), { relatedTarget: get("#away") });
    get("#tabbed").focus();
    timers.advance(50);
    get("#landed").focus();
    timers.advance(100);

    assert.deepEqual(requested, ["/products/landed"]);
  });

  it("prefetches at once on a press that navigates in this tab", (t) => {
    let { get, requested } = setup(
      t,
      `<a id="card" href="/products/pressed" data-prefetch="intent">Card</a>`,
    );

    pointer("pointerdown", get("#card"), { button: 2 });
    pointer("pointerdown", get("#card"), { metaKey: true });
    pointer("pointerdown", get("#card"), { pointerType: "touch" });

    assert.deepEqual(requested, ["/products/pressed"]);
  });

  it("skips unmarked links and links Remix would not fetch", (t) => {
    let { get, requested } = setup(
      t,
      `<a id="plain" href="/products/plain">A</a>
       <a id="external" href="https://example.com/products/tee" data-prefetch="intent">B</a>
       <a id="blank" href="/products/blank" target="_blank" data-prefetch="intent">C</a>
       <a id="document" href="/products/document" data-rmx-document data-prefetch="intent">D</a>
       <a id="frame" href="/products/frame" data-rmx-src="/frame" data-prefetch="intent">E</a>
       <a id="current" href="${location.pathname}${location.search}#top" data-prefetch="intent">F</a>`,
    );

    for (let id of ["plain", "external", "blank", "document", "frame"]) {
      pointer("pointerdown", get(`#${id}`));
    }
    pointer("pointerdown", get("#current"));

    assert.deepEqual(requested, []);
  });
});
