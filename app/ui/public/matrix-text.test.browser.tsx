import * as assert from "remix/assert";
import { describe, it, type TestContext } from "remix/test";
import { render } from "remix/component/test";

import { waitFor } from "../../testing/browser.ts";
import { glitchText, MatrixText, matrixFromPixels } from "./matrix-text.tsx";

type MotionListener = () => void;

describe("matrix text helpers", () => {
  it("maps each pixel's brightness to a hex character, a row per line", () => {
    let white = [255, 255, 255, 255];
    let black = [0, 0, 0, 255];
    let gray = [128, 128, 128, 255];

    assert.deepEqual(
      matrixFromPixels([...white, ...black, ...black, ...gray], 2),
      {
        activeIndices: [0, 4],
        text: "0 \n 4",
      },
    );
  });

  it("steps the chosen active characters and wraps F to 0", () => {
    assert.equal(
      glitchText("0 \n 4", [0, 4], () => 0),
      "1 \n 4",
    );
    assert.equal(
      glitchText("0 \n F", [0, 4], () => 0.99),
      "0 \n 0",
    );
    assert.equal(
      glitchText("", [], () => 0),
      "",
    );
  });
});

describe("MatrixText", () => {
  it("renders the image as hex characters and glitches them", async (t) => {
    let browser = mockBrowser(t);
    let view = render(<MatrixText kind="404" />);
    t.after(view.cleanup);

    await waitFor(() => view.$("[data-matrix-ready]") !== null, view);

    assert.equal(browser.requestedSources[0], "/brand/matrix/error-404.png");
    // White pixels map to "0", black pixels to blanks.
    assert.equal(layer(view.$, "blur"), "0  \n  0");
    assert.equal(layer(view.$, "text"), "0  \n  0");
    assert.equal(browser.intervals.size, 1);

    await view.act(() => browser.tick());
    assert.equal(layer(view.$, "blur"), "0  \n  0");
    assert.match(layer(view.$, "text"), /^(1  \n {2}0|0  \n {2}1)$/);
  });

  it("restores the static art when reduced motion turns on", async (t) => {
    let browser = mockBrowser(t);
    let view = render(<MatrixText kind="empty" />);
    t.after(view.cleanup);
    await waitFor(() => view.$("[data-matrix-ready]") !== null, view);
    await view.act(() => browser.tick());

    await view.act(() => browser.setReducedMotion(true));

    assert.equal(browser.intervals.size, 0);
    assert.equal(layer(view.$, "text"), "0  \n  0");
  });

  it("never schedules the glitch under reduced motion", async (t) => {
    let browser = mockBrowser(t, { reducedMotion: true });
    let view = render(<MatrixText kind="500" />);
    t.after(view.cleanup);

    await waitFor(() => view.$("[data-matrix-ready]") !== null, view);

    assert.equal(layer(view.$, "text"), "0  \n  0");
    assert.equal(browser.intervals.size, 0);
  });

  it("stops the glitch and motion listener on unmount", async (t) => {
    let browser = mockBrowser(t);
    let view = render(<MatrixText kind="404" />);
    await waitFor(() => view.$("[data-matrix-ready]") !== null, view);
    assert.equal(browser.intervals.size, 1);

    view.cleanup();

    assert.equal(browser.intervals.size, 0);
    assert.equal(browser.motionListeners.size, 0);
  });

  it("never starts the glitch when unmounted while the art loads", async (t) => {
    let browser = mockBrowser(t);
    let view = render(<MatrixText kind="404" />);
    view.cleanup();

    await browser.imageDecoded;

    assert.equal(browser.intervals.size, 0);
    assert.equal(browser.motionListeners.size, 0);
  });
});

function layer(
  $: (selector: string) => Element | null,
  name: "blur" | "text",
): string {
  return $(`[data-matrix-layer="${name}"]`)?.textContent ?? "";
}

/**
 * A 3x2 image with white pixels on the diagonal corners, so the rendered text
 * is small enough to assert exactly.
 */
function matrixImageUrl(): string {
  let canvas = document.createElement("canvas");
  canvas.width = 3;
  canvas.height = 2;
  let context = canvas.getContext("2d");
  assert.ok(context);
  context.fillStyle = "#000";
  context.fillRect(0, 0, 3, 2);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, 1, 1);
  context.fillRect(2, 1, 1, 1);
  return canvas.toDataURL();
}

/**
 * Serves every matrix image from a generated data URL, holds glitch intervals
 * until the test ticks them, and lets the test flip the motion preference.
 */
function mockBrowser(t: TestContext, { reducedMotion = false } = {}) {
  let imageUrl = matrixImageUrl();
  let requestedSources: string[] = [];
  let intervals = new Map<number, () => void>();
  let nextInterval = 1;
  let motionListeners = new Set<MotionListener>();
  let decodes: Promise<void>[] = [];

  class MatrixImage extends Image {
    override get src() {
      return super.src;
    }
    override set src(value: string) {
      requestedSources.push(value);
      super.src = imageUrl;
    }
    override decode() {
      let decoded = super.decode();
      decodes.push(decoded);
      return decoded;
    }
  }
  replaceProperty(t, globalThis, "Image", MatrixImage);
  replaceProperty(t, window, "setInterval", ((callback: () => void) => {
    let id = nextInterval++;
    intervals.set(id, callback);
    return id;
  }) as typeof window.setInterval);
  replaceProperty(t, window, "clearInterval", ((id?: number) => {
    if (id !== undefined) intervals.delete(id);
  }) as typeof window.clearInterval);
  replaceProperty(t, window, "matchMedia", () => {
    let motionPreferenceDouble = {
      get matches() {
        return reducedMotion;
      },
      addEventListener(_type: string, listener: MotionListener) {
        motionListeners.add(listener);
      },
      removeEventListener(_type: string, listener: MotionListener) {
        motionListeners.delete(listener);
      },
    };
    // SAFETY: MatrixText only reads `matches` and manages change listeners.
    return motionPreferenceDouble as unknown as MediaQueryList;
  });

  return {
    intervals,
    motionListeners,
    requestedSources,
    /** Settles after every requested image has decoded, and a turn more. */
    get imageDecoded() {
      return Promise.allSettled(decodes).then(
        () => new Promise((resolve) => setTimeout(resolve)),
      );
    },
    tick() {
      for (let callback of intervals.values()) callback();
    },
    setReducedMotion(value: boolean) {
      reducedMotion = value;
      for (let listener of motionListeners) listener();
    },
  };
}

type BrowserPropertyOwner = Window | typeof globalThis;

function replaceProperty<
  Owner extends BrowserPropertyOwner,
  Key extends keyof Owner,
>(t: TestContext, target: Owner, property: Key, value: Owner[Key]) {
  let descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });
  t.after(() => {
    if (descriptor) Object.defineProperty(target, property, descriptor);
    else Reflect.deleteProperty(target, property);
  });
}
