import type { AssetsManifest } from "./asset-resolver.ts";

// A real module for typecheck/tests. The Vite plugin supplies dev/build data.
const manifest: AssetsManifest = { mode: "unavailable" };
export default manifest;
