import * as assert from "remix/assert";
import { describe, it, type TestContext } from "remix/test";
import { render } from "remix/ui/test";

import { SnowField } from "./public/snow-field.tsx";

type FrameCallback = (time: number) => void;
type MotionListener = (event: MediaQueryListEvent) => void;

type CanvasHarness = ReturnType<typeof installCanvasHarness>;

describe("seasonal snow browser lifecycle", () => {
  it("keeps the static fallback and schedules no animation for reduced motion", (t) => {
    let harness = installCanvasHarness(t, { reducedMotion: true });
    let view = render(<SnowField />);
    t.after(view.cleanup);

    let overlay = view.$("[data-seasonal-snow]");
    let fallback = view.$("[data-snow-static]");
    assert.ok(overlay instanceof HTMLDivElement);
    assert.ok(fallback instanceof HTMLDivElement);
    assert.equal(overlay.getAttribute("aria-hidden"), "true");
    assert.equal(overlay.hasAttribute("data-snow-canvas-ready"), false);
    assert.equal(overlay.hasAttribute("data-snow-reduced-motion"), true);
    assert.equal(getComputedStyle(fallback).display, "block");
    assert.equal(harness.contextRequests, 0);
    assert.equal(harness.frames.size, 0);
  });

  it("caps DPR at 2, animates, resizes, and releases browser work", (t) => {
    let harness = installCanvasHarness(t);
    let view = render(<SnowField />);
    let canvas = view.$("canvas");
    let overlay = view.$("[data-seasonal-snow]");
    assert.ok(canvas instanceof HTMLCanvasElement);
    assert.ok(overlay instanceof HTMLDivElement);

    assert.equal(canvas.width, 100);
    assert.equal(canvas.height, 50);
    assert.deepEqual(harness.transforms.at(-1), [1, 0, 0, 1, 0, 0]);
    assert.equal(overlay.getAttribute("data-snow-canvas-ready"), "true");
    assert.equal(harness.frames.size, 1);
    assert.ok(harness.arcs > 0);

    let firstFrame = takeFrame(harness);
    firstFrame(16);
    assert.equal(harness.frames.size, 1);

    harness.width = 120;
    harness.height = 60;
    harness.dpr = 3;
    harness.observerCallback?.();
    assert.equal(canvas.width, 240);
    assert.equal(canvas.height, 120);
    assert.deepEqual(harness.transforms.at(-1), [2, 0, 0, 2, 0, 0]);

    let retainedFrame = takeFrame(harness);
    view.cleanup();
    assert.equal(harness.observerDisconnected, true);
    assert.equal(harness.cancelledFrames.length, 1);
    retainedFrame(32);
    harness.observerCallback?.();
    assert.equal(harness.frames.size, 0);
  });

  it("switches from motion to the static fallback immediately", (t) => {
    let harness = installCanvasHarness(t);
    let view = render(<SnowField />);
    t.after(view.cleanup);

    let overlay = view.$("[data-seasonal-snow]");
    let fallback = view.$("[data-snow-static]");
    assert.ok(overlay instanceof HTMLDivElement);
    assert.ok(fallback instanceof HTMLDivElement);
    assert.equal(overlay.getAttribute("data-snow-canvas-ready"), "true");
    assert.equal(getComputedStyle(fallback).display, "none");
    let canvas = view.$("canvas");
    assert.ok(canvas instanceof HTMLCanvasElement);
    assert.equal(getComputedStyle(canvas).display, "block");
    assert.equal(harness.frames.size, 1);

    harness.setReducedMotion(true);

    assert.equal(overlay.hasAttribute("data-snow-canvas-ready"), false);
    assert.equal(overlay.hasAttribute("data-snow-reduced-motion"), true);
    assert.equal(getComputedStyle(fallback).display, "block");
    assert.equal(harness.frames.size, 0);
    assert.equal(harness.cancelledFrames.length, 1);
    assert.equal(harness.observerDisconnected, true);
  });

  it("restarts the canvas when reduced motion is disabled", (t) => {
    let harness = installCanvasHarness(t, { reducedMotion: true });
    let view = render(<SnowField />);
    t.after(view.cleanup);

    let overlay = view.$("[data-seasonal-snow]");
    assert.ok(overlay instanceof HTMLDivElement);
    assert.equal(overlay.hasAttribute("data-snow-canvas-ready"), false);
    assert.equal(harness.contextRequests, 0);

    harness.setReducedMotion(false);

    assert.equal(overlay.getAttribute("data-snow-canvas-ready"), "true");
    assert.equal(harness.contextRequests, 1);
    assert.equal(harness.frames.size, 1);
    assert.ok(harness.arcs > 0);
  });

  it("removes its motion preference listener during cleanup", (t) => {
    let harness = installCanvasHarness(t, { reducedMotion: true });
    let view = render(<SnowField />);
    assert.equal(harness.motionListenerCount, 1);

    view.cleanup();

    assert.equal(harness.motionListenerCount, 0);
    harness.setReducedMotion(false);
    assert.equal(harness.contextRequests, 0);
    assert.equal(harness.frames.size, 0);
  });

  it("leaves the static fallback intact when canvas setup fails", (t) => {
    let harness = installCanvasHarness(t, { missingContext: true });
    let view = render(<SnowField />);
    t.after(view.cleanup);

    let overlay = view.$("[data-seasonal-snow]");
    assert.ok(overlay instanceof HTMLDivElement);
    assert.equal(overlay.hasAttribute("data-snow-canvas-ready"), false);
    assert.equal(harness.contextRequests, 1);
    assert.equal(harness.frames.size, 0);
    assert.equal(harness.observerCallback, null);
  });
});

function installCanvasHarness(
  t: TestContext,
  options: { missingContext?: boolean; reducedMotion?: boolean } = {},
) {
  let width = 100;
  let height = 50;
  let dpr = 1;
  let contextRequests = 0;
  let arcs = 0;
  let transforms: number[][] = [];
  let frames = new Map<number, FrameCallback>();
  let nextFrame = 1;
  let cancelledFrames: number[] = [];
  let observerCallback: (() => void) | null = null;
  let observerDisconnected = false;
  let reducedMotion = options.reducedMotion ?? false;
  let motionListeners = new Set<MotionListener>();

  let contextDouble: Partial<CanvasRenderingContext2D> = {
    beginPath() {},
    clearRect() {},
    fill() {},
    fillStyle: "",
    globalAlpha: 1,
    arc() {
      arcs++;
    },
  };
  Object.defineProperty(contextDouble, "setTransform", {
    value: (...values: number[]) => transforms.push(values),
  });
  // SAFETY: SnowField only calls the canvas methods and writable properties
  // implemented by this focused browser test double.
  let context = contextDouble as CanvasRenderingContext2D;

  t.mock.method(HTMLCanvasElement.prototype, "getContext", function () {
    contextRequests++;
    return options.missingContext ? null : context;
  });
  mockGetter(t, HTMLElement.prototype, "clientWidth", () => width);
  mockGetter(t, HTMLElement.prototype, "clientHeight", () => height);
  mockGetter(t, window, "devicePixelRatio", () => dpr);
  replaceProperty(
    t,
    window,
    "requestAnimationFrame",
    (callback: FrameCallback) => {
      let id = nextFrame++;
      frames.set(id, callback);
      return id;
    },
  );
  replaceProperty(t, window, "cancelAnimationFrame", (id: number) => {
    cancelledFrames.push(id);
    frames.delete(id);
  });
  replaceProperty(t, window, "matchMedia", () => {
    let mediaQueryListDouble = {
      get matches() {
        return reducedMotion;
      },
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener(_type: string, listener: MotionListener) {
        motionListeners.add(listener);
      },
      removeEventListener(_type: string, listener: MotionListener) {
        motionListeners.delete(listener);
      },
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return true;
      },
    };
    // SAFETY: SnowField only uses the motion state and change-listener methods
    // implemented by this focused MediaQueryList test double.
    return mediaQueryListDouble as MediaQueryList;
  });
  class CanvasResizeObserver implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      observerCallback = () => callback([], this);
    }
    observe(_target: Element, _options?: ResizeObserverOptions) {}
    unobserve(_target: Element) {}
    disconnect() {
      observerDisconnected = true;
    }
  }
  replaceProperty(t, globalThis, "ResizeObserver", CanvasResizeObserver);

  return {
    get arcs() {
      return arcs;
    },
    get cancelledFrames() {
      return cancelledFrames;
    },
    get contextRequests() {
      return contextRequests;
    },
    get dpr() {
      return dpr;
    },
    set dpr(value: number) {
      dpr = value;
    },
    frames,
    get height() {
      return height;
    },
    set height(value: number) {
      height = value;
    },
    get observerCallback() {
      return observerCallback;
    },
    get observerDisconnected() {
      return observerDisconnected;
    },
    get motionListenerCount() {
      return motionListeners.size;
    },
    setReducedMotion(value: boolean) {
      reducedMotion = value;
      let event = new MediaQueryListEvent("change", {
        matches: reducedMotion,
        media: "(prefers-reduced-motion: reduce)",
      });
      for (let listener of motionListeners) listener(event);
    },
    transforms,
    get width() {
      return width;
    },
    set width(value: number) {
      width = value;
    },
  };
}

function takeFrame(harness: CanvasHarness): FrameCallback {
  let entry = harness.frames.entries().next().value;
  assert.ok(entry);
  let [id, callback] = entry;
  harness.frames.delete(id);
  return callback;
}

type GetterOwner = HTMLElement | Window;

function mockGetter<Owner extends GetterOwner, Key extends keyof Owner>(
  t: TestContext,
  target: Owner,
  property: Key,
  getter: () => Owner[Key],
) {
  let descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, get: getter });
  t.after(() => {
    if (descriptor) Object.defineProperty(target, property, descriptor);
    else Reflect.deleteProperty(target, property);
  });
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
