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

/**
 * Resolves once no navigation is in progress. Changing the URL during one
 * cancels it, which would stop Remix before it finishes rendering the page.
 */
export async function navigationSettled(): Promise<void> {
  await remixNavigation()?.transition?.finished.catch(() => {});
}

/**
 * Changes the current entry's URL without a Remix navigation, so the page is
 * not fetched or rendered again. history.replaceState clears the entry's
 * Navigation API state, and Remix only renders entries that carry its state on
 * back and forward, so the state is restored onto the new entry.
 */
export function replaceUrl(href: string): void {
  let navigation = remixNavigation();
  let state = navigation?.currentEntry?.getState();
  history.replaceState(history.state, "", href);
  if (state !== undefined) navigation?.updateCurrentEntry({ state });
}
