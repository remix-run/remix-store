import { execFile, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseArgs, promisify } from "node:util";

import { startAppServer, type AppServer } from "./app-server.ts";
import { pages, recordingPath } from "./pages.ts";
import { readRecording, startStorefront } from "./storefront.ts";

// Compares production server throughput across checkouts with recorded store
// data. See bench/README.md.

const execFileAsync = promisify(execFile);
const appPort = 44_120;
const storefrontPort = 44_121;

let { values } = parseArgs({
  options: {
    variant: { type: "string", multiple: true },
    rounds: { type: "string", default: "5" },
    warmup: { type: "string", default: "3" },
    duration: { type: "string", default: "10" },
    threads: { type: "string", default: "2" },
    connections: { type: "string", default: "10" },
    out: { type: "string" },
  },
});

let variants = (values.variant ?? []).map((value) => {
  let [name, dir] = value.split("=");
  if (!name || !dir) throw new Error(`Expected --variant name=dir: ${value}`);
  return { name, dir: path.resolve(dir), version: readRemixVersion(dir) };
});
if (variants.length === 0) {
  throw new Error("Pass at least one --variant name=dir.");
}

let config = {
  rounds: Number(values.rounds),
  warmup: Number(values.warmup),
  duration: Number(values.duration),
  threads: Number(values.threads),
  connections: Number(values.connections),
};

interface Sample {
  round: number;
  variant: string;
  page: string;
  requestsPerSecond: number;
  latencyMs: { p50: number; p75: number; p90: number; p99: number };
  requests: number;
  errors: number;
  rssPeakMiB: number;
  rssEndMiB: number;
  loadAverage: number;
}

let samples: Sample[] = [];
let checks: Record<
  string,
  Record<string, { bytes: number; text: string }>
> = {};
let storefront = await startStorefront({
  port: storefrontPort,
  recording: readRecording(recordingPath),
});

try {
  for (let round = 1; round <= config.rounds; round++) {
    let order = round % 2 === 1 ? variants : [...variants].reverse();
    for (let variant of order) {
      let app = await startAppServer({
        dir: variant.dir,
        port: appPort,
        storefrontPort,
      });
      try {
        checks[variant.name] ??= await checkPages(app);
        for (let page of pages) {
          let url = new URL(page.path, app.origin).href;
          await wrk(url, config.warmup);
          let rss = sampleRss(app.pid);
          let loadAverage = os.loadavg()[0] ?? 0;
          let result = await wrk(url, config.duration);
          let { peak, end } = await rss.stop();
          if (result.errors > 0) {
            throw new Error(
              `${variant.name} ${page.path}: ${result.errors} errors`,
            );
          }
          let sample: Sample = {
            round,
            variant: variant.name,
            page: page.name,
            ...result,
            rssPeakMiB: peak,
            rssEndMiB: end,
            loadAverage,
          };
          samples.push(sample);
          console.log(
            `round ${round} ${variant.name.padEnd(16)} ${page.name.padEnd(10)} ` +
              `${sample.requestsPerSecond.toFixed(1).padStart(8)} req/s  ` +
              `p99 ${sample.latencyMs.p99.toFixed(2)} ms  ` +
              `rss ${peak.toFixed(0)} MiB`,
          );
        }
      } finally {
        await app.stop();
      }
    }
  }
} finally {
  await storefront.close();
}

if (storefront.misses.size > 0) {
  throw new Error(
    `Unrecorded operations: ${[...storefront.misses].join(", ")}`,
  );
}

let results = {
  date: new Date().toISOString(),
  machine: {
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    memoryGiB: Math.round(os.totalmem() / 2 ** 30),
    platform: `${os.platform()} ${os.release()} ${os.arch()}`,
    node: process.version,
    wrk: (
      await execFileAsync("wrk", ["--version"]).catch((error) => error)
    ).stdout
      ?.split("\n")[0]
      ?.trim(),
  },
  config,
  variants,
  pages: Object.fromEntries(
    Object.entries(checks).map(([variant, byPage]) => [
      variant,
      Object.fromEntries(
        Object.entries(byPage).map(([page, check]) => [page, check.bytes]),
      ),
    ]),
  ),
  samples,
};

let out =
  values.out ??
  path.join(
    import.meta.dirname,
    "results",
    `${results.date.replaceAll(":", "-")}.json`,
  );
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(results, null, 2)}\n`);
console.log(`\nWrote ${out}\n`);
console.log(summarize(results));

/** Renders each page once and checks that every variant shows the same text. */
async function checkPages(app: AppServer) {
  let result: Record<string, { bytes: number; text: string }> = {};
  for (let page of pages) {
    let response = await fetch(new URL(page.path, app.origin));
    let html = await response.text();
    if (response.status !== 200) {
      throw new Error(`${page.path} returned ${response.status}.`);
    }
    result[page.name] = {
      bytes: Buffer.byteLength(html),
      text: visibleText(html),
    };
  }

  let [first] = Object.values(checks);
  if (first) {
    for (let page of pages) {
      if (first[page.name]?.text !== result[page.name]?.text) {
        throw new Error(`${page.path} renders different text across variants.`);
      }
    }
  }
  return result;
}

function visibleText(html: string) {
  return html
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function wrk(url: string, seconds: number) {
  let { stdout } = await execFileAsync("wrk", [
    `-t${config.threads}`,
    `-c${config.connections}`,
    `-d${seconds}s`,
    "--timeout",
    "10s",
    "--latency",
    url,
  ]);
  return parseWrk(stdout);
}

function parseWrk(output: string) {
  let number = (pattern: RegExp) => Number(output.match(pattern)?.[1] ?? NaN);
  let latency = (percentile: number) => {
    let match = output.match(
      new RegExp(`^\\s+${percentile}%\\s+([\\d.]+)(us|ms|s)\\s*$`, "m"),
    );
    if (!match) throw new Error(`Missing p${percentile} in wrk output.`);
    let scale = { us: 0.001, ms: 1, s: 1000 }[match[2] as "us" | "ms" | "s"];
    return Number(match[1]) * scale;
  };
  let socketErrors = output.match(
    /Socket errors: connect (\d+), read (\d+), write (\d+), timeout (\d+)/,
  );
  let errors =
    (socketErrors
      ? socketErrors.slice(1).reduce((a, b) => a + Number(b), 0)
      : 0) +
    (Number(output.match(/Non-2xx or 3xx responses: (\d+)/)?.[1]) || 0);

  return {
    requestsPerSecond: number(/Requests\/sec:\s+([\d.]+)/),
    latencyMs: {
      p50: latency(50),
      p75: latency(75),
      p90: latency(90),
      p99: latency(99),
    },
    requests: number(/(\d+) requests in/),
    errors,
  };
}

/** Samples a process's resident memory once per second. */
function sampleRss(pid: number) {
  let values: number[] = [];
  let read = () => {
    let ps = spawn("ps", ["-o", "rss=", "-p", String(pid)]);
    let output = "";
    ps.stdout.on("data", (chunk: Buffer) => (output += chunk));
    return new Promise<void>((resolve) => {
      ps.on("close", () => {
        let kib = Number(output.trim());
        if (kib > 0) values.push(kib / 1024);
        resolve();
      });
    });
  };
  let interval = setInterval(read, 1000);
  return {
    async stop() {
      clearInterval(interval);
      await read();
      return { peak: Math.max(...values), end: values.at(-1) ?? NaN };
    },
  };
}

function readRemixVersion(dir: string) {
  let manifest = JSON.parse(
    fs.readFileSync(path.join(dir, "node_modules/remix/package.json"), "utf8"),
  ) as { version: string };
  let lock = fs.readFileSync(path.join(dir, "pnpm-lock.yaml"), "utf8");
  let commit = lock.match(
    /codeload\.github\.com\/remix-run\/remix\/tar\.gz\/([0-9a-f]{40})/,
  )?.[1];
  return commit
    ? `${manifest.version} (${commit.slice(0, 10)})`
    : manifest.version;
}

function median(numbers: number[]) {
  let sorted = [...numbers].sort((a, b) => a - b);
  let middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? NaN)
    : ((sorted[middle - 1] ?? NaN) + (sorted[middle] ?? NaN)) / 2;
}

function summarize(data: typeof results) {
  let [baseline] = data.variants;
  let lines = [
    `| Page | Variant | Median req/s | Change | p50 | p99 | Peak RSS |`,
    `| --- | --- | ---: | ---: | ---: | ---: | ---: |`,
  ];
  for (let page of pages) {
    let base = median(
      data.samples
        .filter((s) => s.page === page.name && s.variant === baseline?.name)
        .map((s) => s.requestsPerSecond),
    );
    for (let variant of data.variants) {
      let rows = data.samples.filter(
        (s) => s.page === page.name && s.variant === variant.name,
      );
      let rps = median(rows.map((s) => s.requestsPerSecond));
      let percent = ((rps - base) / base) * 100;
      let change =
        variant === baseline
          ? ""
          : `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`;
      lines.push(
        `| ${page.name} | ${variant.name} | ${rps.toFixed(0)} | ${change} | ` +
          `${median(rows.map((s) => s.latencyMs.p50)).toFixed(2)} ms | ` +
          `${median(rows.map((s) => s.latencyMs.p99)).toFixed(2)} ms | ` +
          `${median(rows.map((s) => s.rssPeakMiB)).toFixed(0)} MiB |`,
      );
    }
  }
  return lines.join("\n");
}
