import * as assert from "remix/assert";
import { describe, it, type TestContext } from "remix/test";
import { render } from "remix/component/test";

import { HomeHero } from "./public/home-hero.tsx";

/** An image that never loads on its own, so the test decides when it does. */
class PendingImage extends EventTarget {
  fetchPriority = "";
  src = "";
  decode() {
    return Promise.resolve();
  }
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
}

/**
 * Renders flush in microtasks and the hero preloads through promises, so
 * once the next task runs, the hero has finished reacting.
 */
function nextTask() {
  return new Promise((resolve) => setTimeout(resolve));
}

/** Tracks frame preloads and holds idle callbacks until `settle` runs them. */
function mockBrowser(t: TestContext) {
  let preloads: PendingImage[] = [];
  let idle: IdleRequestCallback[] = [];
  t.mock.method(globalThis, "Image", function () {
    let image = new PendingImage();
    preloads.push(image);
    return image;
  });
  t.mock.method(
    window,
    "requestIdleCallback",
    (callback: IdleRequestCallback) => idle.push(callback),
  );
  return {
    preloads,
    settle() {
      for (let callback of idle.splice(0)) {
        callback({ didTimeout: false, timeRemaining: () => 50 });
      }
    },
  };
}

/**
 * Dispatches the event Remix sends when it accepts a navigation, so the test
 * page itself never navigates. The test decides how the navigation ends.
 */
function startNavigation(url: string) {
  let finished = Promise.withResolvers<AbortSignal>();
  void finished.promise.catch(() => {});
  let controller = new AbortController();
  let notify = (to: string) =>
    window.dispatchEvent(
      Object.assign(new Event("rmx:navigation"), {
        to: new URL(to, location.href).href,
        finished: finished.promise,
        signal: controller.signal,
      }),
    );
  notify(url);
  return {
    redirect: notify,
    succeed() {
      finished.resolve(controller.signal);
      return nextTask();
    },
    cancel() {
      controller.abort();
      finished.resolve(controller.signal);
      return nextTask();
    },
    fail() {
      controller.abort();
      finished.reject(new Error("Navigation failed"));
      return nextTask();
    },
  };
}

function renderHero(t: TestContext, frames: number) {
  let view = render(
    <HomeHero
      assetImages={Array.from({ length: frames }, (_, index) => ({
        id: `frame-${index}`,
        url: `${location.origin}/hero/frame-${index}.jpg`,
        width: 1920,
        height: 1084,
      }))}
      collectionHref="/collections/all"
      cta="Shop now"
      heading="Run through winter"
    />,
  );
  t.after(view.cleanup);
  let frames_ = () =>
    view.container.querySelectorAll<HTMLElement>("[data-home-hero-frame]");
  let firstFrame = view.container.querySelector<HTMLImageElement>(
    '[data-home-hero-frame="0"] img',
  )!;
  return { ...view, firstFrame, frames: frames_ };
}

function crop(url: string) {
  let { searchParams } = new URL(url);
  return `${searchParams.get("width")}x${searchParams.get("height")}`;
}

describe("home hero frames", () => {
  it("preloads later frames at low priority, at the first frame's crop, once the page settles", async (t) => {
    let { preloads, settle } = mockBrowser(t);
    let { cleanup, firstFrame, frames } = renderHero(t, 4);
    await t.waitFor(() => assert.notEqual(firstFrame.currentSrc, ""), {
      interval: 0,
    });
    assert.equal(preloads.length, 0);

    settle();
    await t.waitFor(() => assert.equal(preloads.length, 3), { interval: 0 });
    let firstCrop = crop(firstFrame.currentSrc);
    assert.deepEqual(
      preloads.map((image) => [
        new URL(image.src).pathname,
        crop(image.src),
        image.fetchPriority,
      ]),
      [1, 2, 3].map((index) => [`/hero/frame-${index}.jpg`, firstCrop, "low"]),
    );

    // A frame joins the animation once every frame before it has loaded,
    // rendered from the URL it was preloaded from.
    preloads[1]!.dispatchEvent(new Event("load"));
    await nextTask();
    assert.equal(frames().length, 1);
    preloads[0]!.dispatchEvent(new Event("load"));
    await t.waitFor(() => assert.equal(frames().length, 3), { interval: 0 });
    assert.deepEqual(
      [...frames()].slice(1).map((frame) => frame.getAttribute("src")),
      [preloads[0]!.src, preloads[1]!.src],
    );

    cleanup();
    assert.equal(preloads[2]!.src, "");
  });

  it("starts the later frames over when the first frame changes crop", async (t) => {
    let { preloads, settle } = mockBrowser(t);
    let { cleanup, firstFrame, frames } = renderHero(t, 3);
    await t.waitFor(() => assert.notEqual(firstFrame.currentSrc, ""), {
      interval: 0,
    });
    settle();
    await t.waitFor(() => assert.equal(preloads.length, 2), { interval: 0 });
    preloads[0]!.dispatchEvent(new Event("load"));
    await t.waitFor(() => assert.equal(frames().length, 2), { interval: 0 });

    // As after a rotation: the browser picks another crop for the first frame.
    let rotated = new URL(firstFrame.currentSrc);
    rotated.searchParams.set("width", "609");
    rotated.searchParams.set("height", "1083");
    Object.defineProperty(firstFrame, "currentSrc", { value: rotated.href });
    firstFrame.dispatchEvent(new Event("load"));

    await t.waitFor(() => assert.equal(frames().length, 1), { interval: 0 });
    assert.equal(preloads[1]!.src, "");
    assert.equal(frames()[0]!.style.visibility, "visible");
    settle();
    await t.waitFor(() => assert.equal(preloads.length, 4), { interval: 0 });
    assert.deepEqual(
      preloads.slice(2).map((image) => crop(image.src)),
      ["609x1083", "609x1083"],
    );
    cleanup();
  });

  it("stops preloading when a navigation leaves the page, and resumes if it fails", async (t) => {
    let { preloads, settle } = mockBrowser(t);
    let { cleanup, firstFrame, frames } = renderHero(t, 4);
    await t.waitFor(() => assert.notEqual(firstFrame.currentSrc, ""), {
      interval: 0,
    });
    settle();
    await t.waitFor(() => assert.equal(preloads.length, 3), { interval: 0 });
    preloads[0]!.dispatchEvent(new Event("load"));
    await t.waitFor(() => assert.equal(frames().length, 2), { interval: 0 });

    // The next page shouldn't share the connection with frames this one won't show.
    let navigation = startNavigation("/collections/all");
    assert.deepEqual(
      preloads.slice(1).map((image) => image.src),
      ["", ""],
    );

    // Still here: the loaded frame stays, and only the missing ones load again.
    await navigation.fail();
    settle();
    await t.waitFor(() => assert.equal(preloads.length, 5), { interval: 0 });
    assert.deepEqual(
      preloads.slice(3).map((image) => new URL(image.src).pathname),
      ["/hero/frame-2.jpg", "/hero/frame-3.jpg"],
    );
    assert.equal(frames().length, 2);
    cleanup();
  });

  it("stays stopped when the visitor clicks the same link again while it loads", async (t) => {
    let { preloads, settle } = mockBrowser(t);
    let { firstFrame } = renderHero(t, 3);
    await t.waitFor(() => assert.notEqual(firstFrame.currentSrc, ""), {
      interval: 0,
    });
    settle();
    await t.waitFor(() => assert.equal(preloads.length, 2), { interval: 0 });

    let original = location.href;
    t.after(() => history.replaceState(history.state, "", original));
    let destination = `${location.pathname}?page=next`;
    let first = startNavigation(destination);
    // As in a Remix navigation, the URL changes before the next page renders.
    history.replaceState(history.state, "", destination);

    // The second click replaces the first navigation, which cancels it.
    startNavigation(destination);
    await first.cancel();
    settle();
    await nextTask();
    assert.equal(preloads.length, 2);
    assert.ok(preloads.every((image) => image.src === ""));
  });

  it("keeps preloading through navigations that stay on the page", async (t) => {
    let { preloads, settle } = mockBrowser(t);
    let { cleanup, firstFrame } = renderHero(t, 3);
    await t.waitFor(() => assert.notEqual(firstFrame.currentSrc, ""), {
      interval: 0,
    });
    settle();
    await t.waitFor(() => assert.equal(preloads.length, 2), { interval: 0 });

    startNavigation("#details");
    assert.ok(preloads.every((image) => image.src !== ""));
    cleanup();
  });

  it("resumes once, from the final URL, when a redirected navigation keeps the hero", async (t) => {
    let { preloads, settle } = mockBrowser(t);
    let { cleanup, firstFrame } = renderHero(t, 3);
    await t.waitFor(() => assert.notEqual(firstFrame.currentSrc, ""), {
      interval: 0,
    });
    settle();
    await t.waitFor(() => assert.equal(preloads.length, 2), { interval: 0 });

    let original = location.href;
    t.after(() => history.replaceState(history.state, "", original));
    let navigation = startNavigation(`${location.pathname}?page=2`);
    navigation.redirect(`${location.pathname}?page=3`);
    history.replaceState(history.state, "", `${location.pathname}?page=3`);
    await navigation.succeed();
    settle();
    await t.waitFor(() => assert.equal(preloads.length, 4), { interval: 0 });

    // The hero's page is now the redirected URL, so going there again stays.
    startNavigation(location.href);
    settle();
    await nextTask();
    assert.equal(preloads.length, 4);
    assert.ok(preloads.slice(2).every((image) => image.src !== ""));
    cleanup();
  });

  it("skips preloading when the visitor saves data", async (t) => {
    let { preloads, settle } = mockBrowser(t);
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });
    t.after(() => {
      delete (navigator as Navigator & { connection?: unknown }).connection;
    });
    renderHero(t, 3);
    settle();
    await nextTask();
    assert.equal(preloads.length, 0);
  });
});
