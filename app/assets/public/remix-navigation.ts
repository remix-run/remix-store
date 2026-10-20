/**
 * The Navigation API, when the Remix runtime uses it for client navigations.
 * This matches the runtime's own check; without it, links and forms load whole
 * documents and Remix never adds its state to history entries.
 */
export function remixNavigation(): Navigation | undefined {
  if (
    "navigation" in window &&
    typeof NavigateEvent !== "undefined" &&
    "sourceElement" in NavigateEvent.prototype
  ) {
    return window.navigation;
  }
  return undefined;
}
