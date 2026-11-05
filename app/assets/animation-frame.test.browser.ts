import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { throttleToAnimationFrame } from "./public/animation-frame.ts";

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

describe("throttleToAnimationFrame", () => {
  it("runs once per frame however often it is requested", async () => {
    let runs = 0;
    let frame = throttleToAnimationFrame(() => runs++);

    frame.request();
    frame.request();
    frame.request();
    assert.equal(runs, 0);

    await nextFrame();
    assert.equal(runs, 1);

    frame.request();
    await nextFrame();
    assert.equal(runs, 2);
  });

  it("drops a pending run when cancelled, and can request again", async () => {
    let runs = 0;
    let frame = throttleToAnimationFrame(() => runs++);

    frame.request();
    frame.cancel();
    await nextFrame();
    assert.equal(runs, 0);

    frame.request();
    await nextFrame();
    assert.equal(runs, 1);
  });
});
