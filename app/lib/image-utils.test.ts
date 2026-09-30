import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { focalPointPosition, getFocalPoint } from "./image-utils.ts";

describe("Shopify image focal points", () => {
  it("extracts numeric coordinates and converts them to object-position", () => {
    let focalPoint = getFocalPoint({ focalPoint: { x: "0.25", y: 0.75 } });

    assert.deepEqual(focalPoint, { x: 0.25, y: 0.75 });
    assert.equal(focalPointPosition(focalPoint), "25% 75%");
  });

  it("rejects missing and non-numeric focal points", () => {
    assert.equal(getFocalPoint(null), undefined);
    assert.equal(getFocalPoint({ focalPoint: { x: 0.5 } }), undefined);
    assert.equal(
      getFocalPoint({ focalPoint: { x: "left", y: "top" } }),
      undefined,
    );
    assert.equal(getFocalPoint({ focalPoint: { x: -1, y: 2 } }), undefined);
    assert.equal(focalPointPosition(undefined), undefined);
  });
});
