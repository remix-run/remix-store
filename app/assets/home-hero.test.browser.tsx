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

async function until(condition: () => boolean) {
  for (let attempt = 0; attempt < 100 && !condition(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(condition(), "condition never became true");
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

/** Stands in for the Navigation API, so the test page itself never navigates. */
function mockNavigation(t: TestContext) {
  let navigation = new EventTarget();
  Object.defineProperty(window, "navigation", {
    configurable: true,
    value: navigation,
  });
  t.after(() => Reflect.deleteProperty(window, "navigation"));
  return {
    navigate(
      url: string,
      { hashChange = false, downloadRequest = null as string | null } = {},
    ) {
      navigation.dispatchEvent(
        Object.assign(new Event("navigate"), {
          destination: { url: new URL(url, location.href).href },
          downloadRequest,
          hashChange,
        }),
      );
    },
    fail() {
      navigation.dispatchEvent(new Event("navigateerror"));
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
    await until(() => firstFrame.currentSrc !== "");
    assert.equal(preloads.length, 0);

    settle();
    await until(() => preloads.length === 3);
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
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(frames().length, 1);
    preloads[0]!.dispatchEvent(new Event("load"));
    await until(() => frames().length === 3);
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
    await until(() => firstFrame.currentSrc !== "");
    settle();
    await until(() => preloads.length === 2);
    preloads[0]!.dispatchEvent(new Event("load"));
    await until(() => frames().length === 2);

    // As after a rotation: the browser picks another crop for the first frame.
    let rotated = new URL(firstFrame.currentSrc);
    rotated.searchParams.set("width", "609");
    rotated.searchParams.set("height", "1083");
    Object.defineProperty(firstFrame, "currentSrc", { value: rotated.href });
    firstFrame.dispatchEvent(new Event("load"));

    await until(() => frames().length === 1);
    assert.equal(preloads[1]!.src, "");
    assert.equal(frames()[0]!.style.visibility, "visible");
    settle();
    await until(() => preloads.length === 4);
    assert.deepEqual(
      preloads.slice(2).map((image) => crop(image.src)),
      ["609x1083", "609x1083"],
    );
    cleanup();
  });

  it("stops preloading when a navigation leaves the page, and resumes if it fails", async (t) => {
    let { preloads, settle } = mockBrowser(t);
    let { navigate, fail } = mockNavigation(t);
    let { cleanup, firstFrame, frames } = renderHero(t, 4);
    await until(() => firstFrame.currentSrc !== "");
    settle();
    await until(() => preloads.length === 3);
    preloads[0]!.dispatchEvent(new Event("load"));
    await until(() => frames().length === 2);

    // The next page shouldn't share the connection with frames this one won't show.
    navigate("/collections/all");
    assert.deepEqual(
      preloads.slice(1).map((image) => image.src),
      ["", ""],
    );

    // Still here: the loaded frame stays, and only the missing ones load again.
    fail();
    settle();
    await until(() => preloads.length === 5);
    assert.deepEqual(
      preloads.slice(3).map((image) => new URL(image.src).pathname),
      ["/hero/frame-2.jpg", "/hero/frame-3.jpg"],
    );
    assert.equal(frames().length, 2);
    cleanup();
  });

  it("keeps preloading through hash changes and downloads", async (t) => {
    let { preloads, settle } = mockBrowser(t);
    let { navigate } = mockNavigation(t);
    let { cleanup, firstFrame } = renderHero(t, 3);
    await until(() => firstFrame.currentSrc !== "");
    settle();
    await until(() => preloads.length === 2);

    navigate("#details", { hashChange: true });
    navigate("/size-guide.pdf", { downloadRequest: "size-guide.pdf" });
    assert.ok(preloads.every((image) => image.src !== ""));
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
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(preloads.length, 0);
  });
});
