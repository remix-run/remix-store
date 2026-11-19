import * as assert from "remix/assert";
import { describe, it, type TestContext } from "remix/test";

import { prefetchImages } from "./public/prefetch-images.ts";

/** An image that never loads on its own, so the test decides when it does. */
class PendingImage extends EventTarget {
  attributes = new Map<string, string>();
  fetchPriority = "";
  sizes = "";
  sizesWhenSourceSet: string | undefined;
  src = "";
  srcset = "";

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string) {
    if (name === "src") this.src = "";
    if (name === "srcset") this.srcset = "";
  }
}

function mockImages(t: TestContext, wideScreen = true): PendingImage[] {
  let images: PendingImage[] = [];
  t.mock.method(globalThis, "Image", function () {
    let image = new PendingImage();
    let srcset = "";
    Object.defineProperty(image, "srcset", {
      get: () => srcset,
      set(value: string) {
        image.sizesWhenSourceSet = image.sizes;
        srcset = value;
      },
    });
    images.push(image);
    return image;
  });
  t.mock.method(window, "matchMedia", (query: string) => ({
    matches: query === "(width >= 810px)" ? wideScreen : !wideScreen,
  }));
  return images;
}

/** Parses page HTML the way Remix does, without loading its images. */
function inertFragment(html: string): DocumentFragment {
  let template = document.createElement("template");
  template.innerHTML = html;
  return template.content;
}

const GALLERY = `
  <picture>
    <source media="(width < 810px)" srcset="data:image/gif;base64,R0lGOD" />
    <img data-prefetch="true" src="https://cdn.shopify.com/a.jpg?width=2000"
      srcset="https://cdn.shopify.com/a.jpg?width=800 800w, https://cdn.shopify.com/a.jpg?width=2000 2000w"
      sizes="60vw" />
  </picture>
  <picture>
    <source media="(width >= 810px)" srcset="data:image/gif;base64,R0lGOD" />
    <img data-prefetch="true" src="https://cdn.shopify.com/a.jpg?width=2000"
      srcset="https://cdn.shopify.com/a.jpg?width=800 800w" sizes="100vw" />
  </picture>
  <img src="https://cdn.shopify.com/b.jpg" loading="lazy" />
`;

describe("prefetchImages", () => {
  it("loads each marked image the visible layout shows, at low priority", (t) => {
    let images = mockImages(t);

    void prefetchImages(inertFragment(GALLERY), new AbortController().signal);

    assert.equal(images.length, 1);
    let [image] = images;
    assert.equal(image!.fetchPriority, "low");
    assert.equal(image!.sizesWhenSourceSet, "60vw");
    assert.match(image!.srcset, /a\.jpg\?width=800 800w, .* 2000w$/);
    assert.equal(image!.src, "https://cdn.shopify.com/a.jpg?width=2000");
  });

  it("follows the picture source that matches the viewport", (t) => {
    let images = mockImages(t, false);
    let fragment = inertFragment(`
      <picture>
        <source media="(width < 810px)" srcset="/narrow.jpg 400w" sizes="100vw" />
        <img data-prefetch="true" src="/wide.jpg" crossorigin="anonymous" />
      </picture>
    `);

    void prefetchImages(fragment, new AbortController().signal);

    assert.equal(images.length, 1);
    assert.equal(images[0]!.srcset, "/narrow.jpg 400w");
    assert.equal(images[0]!.sizesWhenSourceSet, "100vw");
    assert.equal(images[0]!.src, "");
    assert.equal(images[0]!.attributes.get("crossorigin"), "anonymous");
  });

  it("settles when images load or fail, and cancels pending images", async (t) => {
    let images = mockImages(t);
    let fragment = inertFragment(`
      <img data-prefetch="true" src="/one.jpg" />
      <img data-prefetch="true" src="/two.jpg" />
      <img data-prefetch="true" src="/three.jpg" />
    `);
    let controller = new AbortController();
    let settled = false;

    let prefetched = prefetchImages(fragment, controller.signal).then(() => {
      settled = true;
    });
    images[0]!.dispatchEvent(new Event("load"));
    images[1]!.dispatchEvent(new Event("error"));
    await Promise.resolve();
    assert.equal(settled, false);

    controller.abort();
    await prefetched;
    assert.equal(images[2]!.src, "");
  });

  it("starts nothing once the prefetch is cancelled", (t) => {
    let images = mockImages(t);

    void prefetchImages(inertFragment(GALLERY), AbortSignal.abort());

    assert.equal(images.length, 0);
  });
});
