import { useEffect, useLayoutEffect as React_useLayoutEffect } from "react";

export const canUseDOM = !!(
  typeof window !== "undefined" &&
  window.document &&
  window.document.createElement
);

export const useLayoutEffect = canUseDOM ? React_useLayoutEffect : useEffect;
