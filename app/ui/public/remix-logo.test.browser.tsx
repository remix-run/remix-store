import * as assert from "remix/assert";
import { describe, it, type TestContext } from "remix/test";
import { render } from "remix/component/test";

import { RemixLogo } from "./remix-logo.tsx";

describe("RemixLogo", () => {
  it("expands past the scroll threshold and collapses back at the top", async (t) => {
    let scroll = mockScroll(t, 0);
    let { $, act, cleanup } = render(<RemixLogo />);
    t.after(cleanup);
    let logo = () => $("svg");

    assert.equal(logo()?.hasAttribute("data-expanded"), false);

    await act(() => scroll.to(200));
    assert.equal(logo()?.hasAttribute("data-expanded"), true);

    await act(() => scroll.to(0));
    assert.equal(logo()?.hasAttribute("data-expanded"), false);
  });

  it("starts expanded when the page is already scrolled", (t) => {
    mockScroll(t, 400);
    let { $, cleanup } = render(<RemixLogo />);
    t.after(cleanup);

    assert.equal($("svg")?.hasAttribute("data-expanded"), true);
  });

  it("stops listening for scroll when unmounted", async (t) => {
    let scroll = mockScroll(t, 0);
    let { cleanup } = render(<RemixLogo />);
    cleanup();

    window.dispatchEvent(new Event("scroll"));
    assert.equal(scroll.pendingFrames(), 0);
  });
});

/** Controls window.scrollY and runs animation frames synchronously on demand. */
function mockScroll(t: TestContext, initial: number) {
  let scrollY = initial;
  let frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  let original = Object.getOwnPropertyDescriptor(window, "scrollY");
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    get: () => scrollY,
  });
  t.after(() => {
    if (original) Object.defineProperty(window, "scrollY", original);
    else Reflect.deleteProperty(window, "scrollY");
  });
  t.mock.method(
    window,
    "requestAnimationFrame",
    (callback: FrameRequestCallback) => {
      frames.set(nextFrame, callback);
      return nextFrame++;
    },
  );
  t.mock.method(window, "cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
  return {
    to(value: number) {
      scrollY = value;
      window.dispatchEvent(new Event("scroll"));
      let pending = [...frames.values()];
      frames.clear();
      for (let frame of pending) frame(performance.now());
    },
    pendingFrames: () => frames.size,
  };
}
