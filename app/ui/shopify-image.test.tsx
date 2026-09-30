import * as assert from "remix/assert";
import { describe, it } from "remix/test";
import { renderToString } from "remix/ui/server";

import {
  responsiveImageWidths,
  ShopifyImage,
  shopifyImageUrl,
} from "./public/shopify-image.tsx";

describe("Shopify images", () => {
  it("sizes Shopify CDN and mock.shop images while preserving parameters", () => {
    assert.equal(
      shopifyImageUrl("https://cdn.shopify.com/image.jpg?crop=center", 480),
      "https://cdn.shopify.com/image.jpg?crop=center&width=480",
    );
    assert.equal(
      shopifyImageUrl("https://cdn.mock.shop/image.jpg", 319.6),
      "https://cdn.mock.shop/image.jpg?width=320",
    );
  });

  it("does not rewrite third-party or invalid image URLs", () => {
    assert.equal(
      shopifyImageUrl("https://images.example.com/image.jpg?w=1200", 480),
      "https://images.example.com/image.jpg?w=1200",
    );
    assert.equal(shopifyImageUrl("/local/image.jpg", 480), "/local/image.jpg");
  });

  it("does not request widths larger than the source image", () => {
    assert.deepEqual(responsiveImageWidths(800), [320, 480, 640, 800]);
    assert.deepEqual(responsiveImageWidths(500), [320, 480, 500]);
    assert.deepEqual(responsiveImageWidths(319.6), [320]);
    assert.deepEqual(responsiveImageWidths(200), [200]);
  });

  it("renders intrinsic dimensions, responsive candidates, and focal position", async () => {
    let html = await renderToString(
      <ShopifyImage
        image={{
          height: 600,
          url: "https://cdn.shopify.com/image.jpg",
          width: 800,
        }}
        alt="Blue Remix shirt"
        objectPosition="25% 75%"
        sizes="(min-width: 810px) 50vw, 100vw"
      />,
    );

    assert.match(html, /alt="Blue Remix shirt"/);
    assert.match(html, /width="800" height="600"/);
    assert.match(html, /sizes="\(min-width: 810px\) 50vw, 100vw"/);
    assert.match(html, /width=320 320w/);
    assert.match(html, /width=800 800w/);
    assert.match(html, /object-position: 25% 75%/);
  });

  it("does not advertise fake responsive candidates for third-party images", async () => {
    let html = await renderToString(
      <ShopifyImage
        image={{ url: "https://images.example.com/image.jpg", width: 800 }}
        alt="Third-party image"
        sizes="100vw"
      />,
    );

    assert.match(html, /src="https:\/\/images\.example\.com\/image\.jpg"/);
    assert.doesNotMatch(html, /srcset=/);
    assert.doesNotMatch(html, /sizes=/);
  });
});
