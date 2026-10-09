import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

export const assets = createAssetResolver(manifest);
