import { Renderer } from "remix/middleware/render";
import type { RemixNode } from "remix/component";
import type { RequestContext } from "remix/router";

/**
 * The page renderer installed by the app's render middleware, which runs
 * before every middleware and handler that renders a page.
 */
export function getPageRenderer(context: RequestContext): Renderer<RemixNode> {
  let renderPage = context.get(Renderer);
  if (!renderPage) {
    throw new Error("The render middleware must run before rendering a page.");
  }
  // SAFETY: render() installs a RemixNode renderer; Remix's generic Renderer
  // key erases that input type.
  return renderPage as Renderer<RemixNode>;
}
