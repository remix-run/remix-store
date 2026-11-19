/**
 * Fetches the images a prefetched page marks with `data-prefetch`, so they
 * are in the HTTP cache when the page renders. Remix's prefetching discovers
 * scripts, stylesheets, and nonresponsive image preloads, but not `srcset`
 * images. Each image loads the candidate the browser would choose for the
 * current viewport, following `<picture>` sources whose media matches.
 *
 * Attribute URLs resolve against the current document. Prefetched pages are
 * same-origin and declare no `<base>`, so that matches the rendered page.
 */
export async function prefetchImages(
  fragment: DocumentFragment,
  signal: AbortSignal,
): Promise<void> {
  let images =
    fragment.querySelectorAll<HTMLImageElement>("img[data-prefetch]");
  await Promise.all(
    Array.from(images, (image) => prefetchImage(image, signal)),
  );
}

interface ImageCandidates {
  sizes: string | null;
  src: string | null;
  srcset: string | null;
}

function prefetchImage(
  declaration: HTMLImageElement,
  signal: AbortSignal,
): Promise<void> {
  let candidates = selectedCandidates(declaration);
  let first = (candidates.srcset ?? candidates.src)?.trim();
  if (!first || first.startsWith("data:") || signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let image = new Image();
    let finish = () => {
      signal.removeEventListener("abort", cancel);
      resolve();
    };
    let cancel = () => {
      image.removeAttribute("srcset");
      image.removeAttribute("src");
      finish();
    };
    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
    signal.addEventListener("abort", cancel, { once: true });

    image.fetchPriority = "low";
    for (let name of ["crossorigin", "referrerpolicy"]) {
      let value = declaration.getAttribute(name);
      if (value !== null) image.setAttribute(name, value);
    }
    // Sizes must be set before the source set it applies to.
    if (candidates.sizes) image.sizes = candidates.sizes;
    if (candidates.srcset) image.srcset = candidates.srcset;
    if (candidates.src) image.src = candidates.src;
  });
}

/** The first `<picture>` source whose media matches, or the image itself. */
function selectedCandidates(image: HTMLImageElement): ImageCandidates {
  let picture = image.parentElement;
  if (picture?.localName === "picture") {
    for (let source of picture.querySelectorAll(":scope > source")) {
      let media = source.getAttribute("media");
      if (media && !matchMedia(media).matches) continue;
      return {
        sizes: source.getAttribute("sizes"),
        src: null,
        srcset: source.getAttribute("srcset"),
      };
    }
  }
  return {
    sizes: image.getAttribute("sizes"),
    src: image.getAttribute("src"),
    srcset: image.getAttribute("srcset"),
  };
}
