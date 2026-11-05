import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { isUtcDecember } from "./seasonal.ts";

describe("seasonal UTC gate", () => {
  it("includes exactly the December UTC interval", () => {
    assert.equal(isUtcDecember(new Date("2026-11-30T23:59:59.999Z")), false);
    assert.equal(isUtcDecember(new Date("2026-12-01T00:00:00.000Z")), true);
    assert.equal(isUtcDecember(new Date("2026-12-31T23:59:59.999Z")), true);
    assert.equal(isUtcDecember(new Date("2027-01-01T00:00:00.000Z")), false);
  });

  it("uses UTC when the source offset falls in a different local month", () => {
    assert.equal(isUtcDecember(new Date("2026-11-30T23:30:00-05:00")), true);
    assert.equal(isUtcDecember(new Date("2027-01-01T00:30:00+05:00")), true);
  });
});
