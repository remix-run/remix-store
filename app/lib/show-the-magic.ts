// Temporary production check for splash page deployment

import type { useRouteLoaderData } from "react-router";
import type { AppLoadContext } from "@shopify/remix-oxygen";
import type { RootLoader } from "~/root";

export function getShowAllTheMagic(context: AppLoadContext) {
  // @ts-expect-error -- this will go away eventually
  const magic = String(context.env.SHOW_ALL_THE_MAGIC);

  return magic === "true";
}

type RootData = ReturnType<typeof useRouteLoaderData<RootLoader>>;

export type MagicHiddenRootData = { hideTheMagic: boolean };
export type FullRootData = Exclude<RootData, MagicHiddenRootData>;
export type RootLoaderData = MagicHiddenRootData | FullRootData;

/**
 * This is a helper function to check if the magic is hidden in the root loader data
 */
export function isMagicHidden(
  rootLoaderData: RootLoaderData,
): rootLoaderData is MagicHiddenRootData {
  return (
    !!rootLoaderData &&
    "hideTheMagic" in rootLoaderData &&
    rootLoaderData.hideTheMagic === true
  );
}
