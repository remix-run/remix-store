import * as assert from "remix/assert";
import { describe, it, type TestContext } from "remix/test";

import { nextTask } from "../testing/browser.ts";
import {
  navigationSettled,
  remixNavigation,
  replaceUrl,
} from "./public/remix-navigation.ts";

describe("remix navigation helpers", () => {
  it("replaces the URL while keeping the entry's navigation state", (t) => {
    let navigation = remixNavigation();
    assert.ok(navigation, "the test browser supports Remix navigations");
    let originalHref = location.href;
    let originalState = navigation.currentEntry?.getState();
    t.after(() => {
      history.replaceState(history.state, "", originalHref);
      navigation.updateCurrentEntry({ state: originalState ?? null });
    });
    navigation.updateCurrentEntry({ state: { remix: "page-state" } });
    let historyLength = history.length;

    replaceUrl("?variant=2");

    assert.equal(new URL(location.href).search, "?variant=2");
    assert.deepEqual(navigation.currentEntry?.getState(), {
      remix: "page-state",
    });
    assert.equal(history.length, historyLength);
  });

  it("waits through chained navigations, including failed ones", async (t) => {
    let navigation = fakeNavigation(t);
    let first = deferred();
    let second = deferred();
    navigation.transition = { finished: first.promise };

    let settled = false;
    let done = navigationSettled().then(() => {
      settled = true;
    });

    // A frame redirect starts a second navigation before the first finishes.
    navigation.transition = { finished: second.promise };
    first.resolve();
    await nextTask();
    assert.equal(settled, false);

    navigation.transition = null;
    second.reject(new Error("aborted"));
    await done;
    assert.equal(settled, true);
  });

  it("resolves immediately when no navigation is in progress", async (t) => {
    fakeNavigation(t);
    await navigationSettled();
  });
});

interface FakeTransition {
  finished: Promise<void>;
}

/** Replaces window.navigation with one whose transition the test controls. */
function fakeNavigation(t: TestContext) {
  let navigation: { transition: FakeTransition | null } = { transition: null };
  let descriptor = Object.getOwnPropertyDescriptor(window, "navigation");
  Object.defineProperty(window, "navigation", {
    configurable: true,
    value: navigation,
  });
  t.after(() => {
    if (descriptor) Object.defineProperty(window, "navigation", descriptor);
    else Reflect.deleteProperty(window, "navigation");
  });
  return navigation;
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  let promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
