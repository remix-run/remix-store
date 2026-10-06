import manifest from "./asset-manifest.ts";
import { createAssetResolver } from "./asset-resolver.ts";

export const assets = createAssetResolver(manifest);
