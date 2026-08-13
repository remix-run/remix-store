import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";

console.log("just testing");

let skipped = [];
for await (let file of glob(["app/**/*.{ts,tsx}", "e2e/**/*.ts"])) {
  let source = await readFile(file, "utf8");
  for (let match of source.matchAll(
    /\b(?:describe|it|test)(?:\.describe)?\.(?:skip|fixme)\s*\(/g,
  )) {
    let line = source.slice(0, match.index).split("\n").length;
    skipped.push(`${file}:${line}`);
  }
}

if (skipped.length) {
  console.error("Skipped tests are not allowed:");
  for (let location of skipped) console.error(`- ${location}`);
  process.exitCode = 1;
}
