import { readFile } from "node:fs/promises";

// pnpm resolves a git dependency that targets a subdirectory, such as
// `github:remix-run/remix#<sha>&path:packages/remix`, in one of two shapes:
//
//   resolution: {gitHosted: true, path: packages/remix, tarball: ...}  correct
//   resolution: {gitHosted: true, integrity: sha512-..., tarball: ...} broken
//
// The second shape drops the subdirectory, so pnpm unpacks the repository root
// instead of the package. For Remix that root is `remix-the-web@undefined`,
// which ships no dist/, and every install, typecheck, test, and build that
// depends on it fails. Which shape you get depends on whether the tarball was
// already in the local pnpm store when the lockfile was written, so a lockfile
// regenerated on a cold store silently reintroduces the failure.
//
// Fix: run `pnpm install` a second time. The warm store rewrites the entries
// into the `path:` shape. Then re-run this check.

let lockfile = "pnpm-lock.yaml";
let source = await readFile(lockfile, "utf8");

let broken = [];
let key = null;

let lines = source.split("\n");
for (let index = 0; index < lines.length; index++) {
  let line = lines[index];

  // Package entries sit at two spaces of indentation and may be quoted.
  let entry = /^ {2}('?)(.+?)\1:$/.exec(line);
  if (entry) {
    key = entry[2];
    continue;
  }

  let resolution = /^ {4}resolution: \{(.+)\}$/.exec(line);
  if (!resolution || !key) continue;

  let fields = resolution[1];
  if (!fields.includes("gitHosted: true")) continue;

  // Only entries that asked for a subdirectory need a `path:` field.
  if (!key.includes("#path:") || fields.includes("path:")) continue;

  broken.push(`${lockfile}:${index + 1}: ${key}`);
}

if (broken.length) {
  console.error(
    `Git dependencies resolved without their subdirectory (${broken.length}):`,
  );
  for (let location of broken) console.error(`- ${location}`);
  console.error(
    "\npnpm unpacked the repository root instead of the package. Run" +
      " `pnpm install` again so the warm store rewrites these entries, then" +
      " re-run this check.",
  );
  process.exitCode = 1;
}
