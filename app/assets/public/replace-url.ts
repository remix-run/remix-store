/**
 * Resolves once no navigation is in progress. Changing the URL during one
 * cancels it, which would stop Remix before it finishes rendering the page.
 */
export async function navigationSettled(): Promise<void> {
  if (!("navigation" in window)) return;
  await window.navigation.transition?.finished.catch(() => {});
}

/**
 * Changes the current entry's URL without a Remix navigation, so the page is
 * not fetched or rendered again. history.replaceState clears the entry's
 * Navigation API state, and Remix only renders entries that carry its state on
 * back and forward, so the state is restored onto the new entry.
 */
export function replaceUrl(href: string): void {
  let navigation = "navigation" in window ? window.navigation : undefined;
  let state = navigation?.currentEntry?.getState();
  history.replaceState(history.state, "", href);
  if (state !== undefined) navigation?.updateCurrentEntry({ state });
}
