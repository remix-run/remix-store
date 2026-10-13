import * as assert from "remix/assert";
import { describe, it } from "remix/test";
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

describe("home hero frames", () => {
  it("preloads later frames at low priority once the page settles", async (t) => {
    let preloads: PendingImage[] = [];
    t.mock.method(globalThis, "Image", function () {
      let image = new PendingImage();
      preloads.push(image);
      return image;
    });

    let { cleanup, container } = render(
      <HomeHero
        assetImages={Array.from({ length: 4 }, (_, index) => ({
          id: `frame-${index}`,
          url: `/frame-${index}.jpg`,
        }))}
        collectionHref="/collections/all"
        cta="Shop now"
        heading="Run through winter"
      />,
    );
    let renderedFrames = () =>
      container.querySelectorAll("[data-home-hero-frame]").length;
    assert.equal(preloads.length, 0);

    await until(() => preloads.length > 0);
    assert.deepEqual(
      preloads.map((image) => [image.src, image.fetchPriority]),
      [
        ["/frame-1.jpg", "low"],
        ["/frame-2.jpg", "low"],
        ["/frame-3.jpg", "low"],
      ],
    );

    // A frame joins the animation once every frame before it has loaded.
    preloads[1]!.dispatchEvent(new Event("load"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(renderedFrames(), 1);
    preloads[0]!.dispatchEvent(new Event("load"));
    await until(() => renderedFrames() === 3);

    cleanup();
    assert.equal(preloads[2]!.src, "");
  });
});
