import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { render } from "remix/ui/test";

import { HomeHero } from "./public/home-hero.tsx";

describe("home hero image lifecycle", () => {
  it("cancels pending frame preloads when removed", (t) => {
    let preloads: HTMLImageElement[] = [];
    let NativeImage = globalThis.Image;

    function TrackingImage(width?: number, height?: number) {
      let image = new NativeImage(width, height);
      preloads.push(image);
      return image;
    }

    t.mock.method(globalThis, "Image", TrackingImage);

    let view = render(
      <HomeHero
        assetImages={[
          { id: "frame-0", url: "/frame-0.jpg" },
          { id: "frame-1", url: "/frame-1.jpg" },
          { id: "frame-2", url: "/frame-2.jpg" },
        ]}
        collectionHref="/collections/all"
        cta="Shop now"
        heading="Run through winter"
      />,
    );

    assert.equal(preloads.length, 2);
    assert.deepEqual(
      preloads.map((image) => image.getAttribute("src")),
      ["/frame-1.jpg", "/frame-2.jpg"],
    );

    view.cleanup();

    assert.deepEqual(
      preloads.map((image) => image.getAttribute("src")),
      [null, null],
    );
  });
});
