import { useRouteLoaderData } from "@remix-run/react";
import {
  useEffect,
  useLayoutEffect as React_useLayoutEffect,
  useSyncExternalStore,
} from "react";
import type { loader as rootLoader } from "~/root";

export const canUseDOM = !!(
  typeof window !== "undefined" &&
  window.document &&
  window.document.createElement
);

export const useLayoutEffect = canUseDOM ? React_useLayoutEffect : useEffect;

/**
 * Strips the domain for internal URLs
 */
export function useRelativeUrl(ogUrl: string) {
  const rootData = useRouteLoaderData<typeof rootLoader>("root");

  if (!rootData) {
    throw new Error("Failed to find data for root loader");
  }

  const { header, publicStoreDomain } = rootData;
  const primaryDomainUrl = header.shop.primaryDomain.url;

  const url =
    ogUrl.includes("myshopify.com") ||
    ogUrl.includes(publicStoreDomain) ||
    ogUrl.includes(primaryDomainUrl)
      ? new URL(ogUrl).pathname
      : ogUrl;
  const isExternal = !url.startsWith("/");

  return { url, isExternal };
}

// Taken from https://github.com/sergiodxa/remix-utils/blob/main/src/react/use-hydrated.ts#L25

function subscribe() {
  return () => {};
}

export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
