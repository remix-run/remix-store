import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { MemoryStorefrontCache } from "./storefront-cache.ts";

describe("Storefront query cache", () => {
  it("clones cached values so callers cannot mutate shared entries", () => {
    let cache = new MemoryStorefrontCache();
    cache.set("shop", { name: "Remix" }, { ttl: 10 });

    let first = cache.get("shop");
    assert.deepEqual(first, { name: "Remix" });
    first.name = "Changed";

    assert.deepEqual(cache.get("shop"), { name: "Remix" });
  });

  it("expires entries and evicts the least recently used entry", () => {
    let now = 0;
    let cache = new MemoryStorefrontCache({ maxEntries: 2, now: () => now });
    cache.set("a", { value: 1 }, { ttl: 1 });
    cache.set("b", { value: 2 }, { ttl: 10 });

    assert.deepEqual(cache.get("a"), { value: 1 });
    cache.set("c", { value: 3 }, { ttl: 10 });
    assert.equal(cache.get("b"), undefined);
    assert.equal(cache.size, 2);

    now = 1_001;
    assert.equal(cache.get("a"), undefined);
    assert.equal(cache.size, 1);
  });

  it("rejects invalid bounds and ignores non-positive TTLs", () => {
    assert.throws(() => new MemoryStorefrontCache({ maxEntries: 0 }));

    let cache = new MemoryStorefrontCache();
    cache.set("missing", { value: true }, { ttl: 0 });
    assert.equal(cache.get("missing"), undefined);
  });
});
