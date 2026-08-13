import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { FixedWindowRateLimiter } from "./rate-limit.ts";

describe("fixed-window rate limiter", () => {
  it("limits a multi-key reservation until its window expires", async () => {
    let now = 0;
    let limiter = new FixedWindowRateLimiter({
      limit: 2,
      maxEntries: 4,
      now: () => now,
      windowMs: 10_000,
    });
    assert.equal((await limiter.consumeMany(["ip", "email"])).allowed, true);
    now = 1;
    assert.equal((await limiter.consumeMany(["ip", "email"])).allowed, true);
    now = 2;
    assert.deepEqual(await limiter.consumeMany(["ip", "email"]), {
      allowed: false,
      retryAfterSeconds: 10,
    });
    now = 10_000;
    assert.equal((await limiter.consumeMany(["ip", "email"])).allowed, true);
  });

  it("rejects all keys without debiting an otherwise available key", async () => {
    let limiter = new FixedWindowRateLimiter({
      limit: 1,
      maxEntries: 4,
      now: () => 0,
      windowMs: 10_000,
    });

    assert.equal((await limiter.consumeMany(["limited"])).allowed, true);
    assert.equal(
      (await limiter.consumeMany(["limited", "available"])).allowed,
      false,
    );
    assert.equal((await limiter.consumeMany(["available"])).allowed, true);
  });

  it("serializes concurrent overlapping reservations atomically", async () => {
    let limiter = new FixedWindowRateLimiter({
      limit: 1,
      maxEntries: 4,
      now: () => 0,
      windowMs: 10_000,
    });

    let results = await Promise.all([
      limiter.consumeMany(["same-ip", "first-email"]),
      limiter.consumeMany(["same-ip", "second-email"]),
    ]);
    assert.deepEqual(results.map((result) => result.allowed).sort(), [
      false,
      true,
    ]);
  });

  it("stays bounded while accepting new key batches", async () => {
    let limiter = new FixedWindowRateLimiter({
      limit: 1,
      maxEntries: 2,
      now: () => 0,
      windowMs: 10_000,
    });
    await limiter.consumeMany(["one"]);
    await limiter.consumeMany(["two"]);
    await limiter.consumeMany(["three"]);
    assert.equal((await limiter.consumeMany(["one"])).allowed, true);
  });
});
