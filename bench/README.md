# Server benchmark

Measures production Node server throughput for the home, collection, and
product pages. It runs real store data without contacting Shopify, so changes to
Remix or the app can be compared on the same machine.

## Run it

Compare two checkouts, each with its own `pnpm install`:

```sh
git worktree add ../remix-store-main main
pnpm --dir ../remix-store-main install --frozen-lockfile

node bench/run.ts \
  --variant main=../remix-store-main \
  --variant branch=.
```

The first variant is the baseline. Results are written to `bench/results/` and
summarized as a Markdown table.

| Option          | Default | Meaning                                     |
| --------------- | ------: | ------------------------------------------- |
| `--rounds`      |       5 | Fresh server per variant per round          |
| `--warmup`      |       3 | Seconds of unmeasured load before each page |
| `--duration`    |      10 | Measured seconds per page                   |
| `--threads`     |       2 | `wrk` threads                               |
| `--connections` |      10 | `wrk` keep-alive connections                |

It needs Node 24 and [`wrk`](https://github.com/wg/wrk) (`brew install wrk`).
Close other busy apps first; the load generator shares the machine.

## What it does

- Starts a local Storefront API that replays `storefront-recording.json`. The
  app's Storefront cache behaves as in production: catalog reads are cached
  after the first request.
- Starts each checkout's `server.node.ts` the way the Dockerfile does
  (`NODE_ENV=production`, fingerprinted assets, `--import remix/node-tsx`),
  with an environment built from scratch so `.env` cannot leak in.
- Renders each page once and fails if its visible text differs between
  variants or any request is not a 200.
- For each page, runs `wrk` for the warmup, then the measured window, sampling
  the server's RSS once per second.
- Alternates variant order every round.

HTML is uncompressed because `wrk` sends no `Accept-Encoding`.

Peak RSS grows with throughput. Hydrogen's Storefront client creates a
30-second `AbortSignal.timeout()` for every query, including cache hits, so a
faster server holds more live timers during a saturated run. The heap returns to
its starting size once the server has been idle for 30 seconds.

## Refresh the recorded data

```sh
node bench/record.ts
```

This renders each page against the live store with the credentials in `.env`
and saves the Storefront responses. Only queries are forwarded; mutations are
rejected. Pages are listed in `pages.ts`.
