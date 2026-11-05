import {
  clientEntry,
  css,
  on,
  ref,
  type Handle,
  type SerializableObject,
} from "remix/component";

import type { ImageData } from "../../data/public/types.ts";
import { PillIcon, pillLinkStyle } from "../../ui/public/pill-link.tsx";
import { throttleToAnimationFrame } from "./animation-frame.ts";
import { remixNavigation } from "./remix-navigation.ts";

export interface HomeHeroProps extends SerializableObject {
  assetImages: ImageData[];
  collectionHref: string;
  cta: string;
  heading: string;
}

/**
 * A full-screen hero whose frames advance as the page scrolls. The first
 * frame renders with the page; the rest download at low priority once the
 * page settles, and join the animation as they arrive.
 */
export const HomeHero = clientEntry(
  import.meta.url,
  function HomeHero(handle: Handle<HomeHeroProps>) {
    // Frames 0..loadedFrames-1 have loaded and are rendered.
    let loadedFrames = 1;
    let preload: AbortController | undefined;
    // The URL each later frame was preloaded from, so rendering reuses it.
    let frameUrls: string[] = [];
    let section: HTMLElement | null = null;
    // The URL of the page the hero is on. During a navigation, `location`
    // already shows the destination while this page is still on screen.
    let pageUrl = "";
    let reducedMotion: MediaQueryList | undefined;

    let frameUpdate = throttleToAnimationFrame(() => {
      if (!section || loadedFrames < 2 || reducedMotion?.matches) return;
      let target = scrollFrame(
        section.getBoundingClientRect().top,
        section.offsetHeight,
        handle.props.assetImages.length,
      );
      showFrame(section, Math.min(target, loadedFrames - 1));
    });
    let updateFrame = frameUpdate.request;

    async function preloadFrames() {
      let images = handle.props.assetImages;
      if (preload || images.length < 2 || prefersReducedData()) return;
      preload = new AbortController();
      let signal = AbortSignal.any([handle.signal, preload.signal]);

      // Leaving the page: free the connection for the next page now, rather
      // than when this component unmounts after that page has arrived. If the
      // navigation fails or is cancelled, pick up where the preload left off.
      watchPageExit({
        lifetime: handle.signal,
        pageUrl: () => pageUrl,
        signal,
        onLeave() {
          preload?.abort();
          preload = undefined;
        },
        onSettled(succeeded) {
          // A successful navigation kept the hero, so its page has this URL.
          if (succeeded && section) pageUrl = location.href;
          if (!handle.signal.aborted && section && !reducedMotion?.matches)
            preloadFrames();
        },
      });

      await whenPageIsIdle(signal);
      if (signal.aborted || !section) return;
      // Later frames use whichever crop the browser chose for the first, so
      // rendering them reuses the downloads.
      let chosen = firstFrameSrc(section);
      frameUrls = images.map((image) => matchingCrop(image.url, chosen));
      await downloadFrames(frameUrls, loadedFrames, signal, (playable) => {
        loadedFrames = playable;
        handle.update().then(updateFrame);
      });
    }

    // A rotation or resize can switch the first frame to another crop. The
    // later frames then start over at that crop, from the first frame.
    function onFirstFrameLoad() {
      let second = handle.props.assetImages[1];
      if (!preload || !second || !section || frameUrls.length < 2) return;
      if (matchingCrop(second.url, firstFrameSrc(section)) === frameUrls[1])
        return;
      preload.abort();
      preload = undefined;
      frameUrls = [];
      loadedFrames = 1;
      showFrame(section, 0);
      handle.update();
      if (!reducedMotion?.matches) preloadFrames();
    }

    return () => {
      let images = handle.props.assetImages.slice(0, loadedFrames);

      return (
        <section
          aria-labelledby={`${handle.id}-title`}
          data-home-hero="true"
          mix={[
            heroStyle,
            ref((element, signal) => {
              section = element;
              pageUrl = location.href;
              reducedMotion = watchViewport(signal, {
                onMotionChange(reduced) {
                  if (reduced) {
                    showFrame(element, 0);
                  } else {
                    preloadFrames();
                    updateFrame();
                  }
                },
                onScroll: updateFrame,
              });
              signal.addEventListener("abort", () => {
                section = null;
                frameUpdate.cancel();
              });

              if (!reducedMotion.matches) preloadFrames();
            }),
          ]}
        >
          <div mix={heroStageStyle}>
            <HeroFrames
              frameUrls={frameUrls}
              images={images}
              onFirstFrameLoad={onFirstFrameLoad}
            />
            <div mix={heroContentStyle}>
              <h1 id={`${handle.id}-title`}>{handle.props.heading}</h1>
              <HeroLink
                cta={handle.props.cta}
                href={handle.props.collectionHref}
              />
            </div>
          </div>
        </section>
      );
    };
  },
);

function HeroFrames(
  handle: Handle<{
    frameUrls: string[];
    images: ImageData[];
    onFirstFrameLoad: () => void;
  }>,
) {
  return () => {
    let { frameUrls, images, onFirstFrameLoad } = handle.props;
    return (
      <div aria-hidden="true" mix={heroFramesStyle}>
        {images.map((image, index) =>
          index === 0 ? (
            <FirstFrame
              image={image}
              key={image.id ?? image.url}
              onLoad={onFirstFrameLoad}
            />
          ) : (
            <img
              key={image.id ?? image.url}
              data-home-hero-frame={index}
              src={frameUrls[index]}
              alt=""
              width={image.width ?? undefined}
              height={image.height ?? undefined}
              decoding="async"
              style={{ visibility: "hidden" }}
            />
          ),
        )}
      </div>
    );
  };
}

function HeroLink(handle: Handle<{ cta: string; href: string }>) {
  return () => (
    <a
      href={handle.props.href}
      data-rmx-prefetch="intent"
      mix={[pillLinkStyle, heroLinkStyle]}
    >
      <span aria-hidden="true" data-link-hit-area="true" />
      <PillIcon name="fast-forward" />
      <span>{handle.props.cta}</span>
    </a>
  );
}

// The animation finishes two thirds of the way through the hero's scroll.
const SCROLL_FRAMES_RATE = 1.5;

/** The frame to show once the hero has scrolled `top` pixels off screen. */
function scrollFrame(top: number, height: number, frames: number): number {
  let progress = Math.max(0, Math.min(1, -top / height));
  return Math.min(
    Math.floor(progress * SCROLL_FRAMES_RATE * frames),
    frames - 1,
  );
}

function showFrame(section: HTMLElement, index: number): void {
  section
    .querySelectorAll<HTMLElement>("[data-home-hero-frame]")
    .forEach((frame, frameIndex) => {
      frame.style.visibility = frameIndex === index ? "visible" : "hidden";
    });
}

/** The source the browser picked for the first frame's art-directed image. */
function firstFrameSrc(section: HTMLElement): string | undefined {
  return section.querySelector<HTMLImageElement>(
    '[data-home-hero-frame="0"] img',
  )?.currentSrc;
}

/**
 * Downloads the frames from `loadedFrames` on, in parallel. Each time the run
 * of loaded frames from the start grows, reports how many can now play.
 */
async function downloadFrames(
  urls: string[],
  loadedFrames: number,
  signal: AbortSignal,
  onPlayable: (frames: number) => void,
): Promise<void> {
  // A resumed preload keeps the frames that already loaded.
  let loaded = urls.map((_, index) => index < loadedFrames);
  let playable = loadedFrames;
  await Promise.all(
    urls.map(async (url, index) => {
      if (loaded[index]) return;
      let ok = await preloadImage(url, signal).then(
        () => true,
        () => false,
      );
      if (!ok || signal.aborted) return;
      loaded[index] = true;
      let next = playableFrames(loaded);
      if (next <= playable) return;
      playable = next;
      onPlayable(next);
    }),
  );
}

/**
 * Calls `onScroll` on scroll and resize, and `onMotionChange` when the reduced
 * motion preference changes, until `signal` aborts. Returns that preference.
 */
function watchViewport(
  signal: AbortSignal,
  handlers: {
    onMotionChange: (reduced: boolean) => void;
    onScroll: () => void;
  },
): MediaQueryList {
  let motion = matchMedia("(prefers-reduced-motion: reduce)");
  window.addEventListener("scroll", handlers.onScroll, {
    passive: true,
    signal,
  });
  window.addEventListener("resize", handlers.onScroll, { signal });
  motion.addEventListener(
    "change",
    () => handlers.onMotionChange(motion.matches),
    { signal },
  );
  return motion;
}

/** How many frames can play: those before the first one still missing. */
function playableFrames(loaded: boolean[]): number {
  let missing = loaded.indexOf(false);
  return missing === -1 ? loaded.length : missing;
}

/**
 * Calls `onLeave` when a navigation starts that will replace the page, then
 * `onSettled` once that navigation succeeds (keeping this page mounted) or
 * fails or is cancelled.
 */
function watchPageExit(options: {
  lifetime: AbortSignal;
  pageUrl: () => string;
  signal: AbortSignal;
  onLeave: () => void;
  onSettled: (succeeded: boolean) => void;
}): void {
  let navigation = remixNavigation();
  if (!navigation) return;
  let { lifetime, onLeave, onSettled } = options;
  navigation.addEventListener(
    "navigate",
    (event) => {
      if (!leavesPage(event, options.pageUrl())) return;
      onLeave();
      navigation.addEventListener("navigatesuccess", () => onSettled(true), {
        once: true,
        signal: lifetime,
      });
      navigation.addEventListener("navigateerror", () => onSettled(false), {
        once: true,
        signal: lifetime,
      });
    },
    { signal: options.signal },
  );
}

// Frames cover the screen, so each orientation gets a crop of its shape,
// and `sizes` asks for whichever side the cover fit is limited by. Landscape
// stops at 1600px, which is what every screen used to receive.
const LANDSCAPE = { aspect: 16 / 9, widths: [960, 1280, 1600] };
const PORTRAIT = { aspect: 9 / 16, widths: [360, 540, 720] };
const LANDSCAPE_SIZES = "max(100vw, 177.78vh)";
const PORTRAIT_SIZES = "max(100vw, 56.25vh)";

/**
 * Art-directed so the browser picks a crop for the screen. Later frames
 * copy its choice, so they need no art direction of their own.
 */
function FirstFrame(handle: Handle<{ image: ImageData; onLoad: () => void }>) {
  return () => {
    let { image } = handle.props;
    let landscape = centerCrops(image, LANDSCAPE);
    return (
      <picture data-home-hero-frame={0} style={{ visibility: "visible" }}>
        <source
          media="(orientation: portrait)"
          srcSet={srcSet(centerCrops(image, PORTRAIT))}
          sizes={PORTRAIT_SIZES}
        />
        <img
          src={landscape.at(-1)?.url ?? image.url}
          srcSet={srcSet(landscape)}
          sizes={LANDSCAPE_SIZES}
          alt=""
          width={image.width ?? undefined}
          height={image.height ?? undefined}
          loading="eager"
          fetchPriority="high"
          decoding="sync"
          mix={on("load", () => handle.props.onLoad())}
        />
      </picture>
    );
  };
}

/** Center crops of a shape, up to the largest the source can provide. */
function centerCrops(
  image: ImageData,
  crop: { aspect: number; widths: number[] },
): Array<{ url: string; width: number }> {
  let largest = Math.floor(
    Math.min(image.width ?? Infinity, (image.height ?? Infinity) * crop.aspect),
  );
  let widths = crop.widths.filter((width) => width <= largest);
  if (
    !widths.includes(largest) &&
    crop.widths.some((width) => width > largest)
  ) {
    widths.push(largest);
  }
  return widths.map((width) => ({
    url: cropUrl(image.url, width, Math.round(width / crop.aspect)),
    width,
  }));
}

function srcSet(candidates: Array<{ url: string; width: number }>): string {
  return candidates.map(({ url, width }) => `${url} ${width}w`).join(", ");
}

function cropUrl(source: string, width: number, height: number): string {
  try {
    let url = new URL(source);
    url.searchParams.set("width", String(width));
    url.searchParams.set("height", String(height));
    url.searchParams.set("crop", "center");
    return url.toString();
  } catch {
    return source;
  }
}

/** The frame at the same crop as `chosen`, the first frame's picked source. */
function matchingCrop(source: string, chosen: string | undefined): string {
  try {
    let picked = new URL(chosen ?? "");
    let width = Number(picked.searchParams.get("width"));
    let height = Number(picked.searchParams.get("height"));
    return width && height ? cropUrl(source, width, height) : source;
  } catch {
    return source;
  }
}

/** Whether a navigation will replace this page, not just its hash or a download. */
function leavesPage(event: NavigateEvent, pageUrl: string): boolean {
  if (event.hashChange || event.downloadRequest !== null) return false;
  let destination = new URL(event.destination.url);
  let page = new URL(pageUrl || location.href);
  return (
    destination.pathname !== page.pathname || destination.search !== page.search
  );
}

function prefersReducedData(): boolean {
  let connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  return connection?.saveData === true;
}

/** Resolves once the page has loaded and the browser has a quiet moment. */
function whenPageIsIdle(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    // An abort settles the promise so the caller's post-await guard runs.
    if (signal.aborted) return resolve();
    signal.addEventListener("abort", () => resolve(), { once: true });
    let afterLoad = () => {
      if (signal.aborted) return;
      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => resolve(), { timeout: 2000 });
      } else {
        setTimeout(resolve, 200);
      }
    };
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true, signal });
  });
}

const heroStyle = css({
  background: "var(--color-black)",
  height: "200vh",
  position: "relative",
});

const heroStageStyle = css({
  height: "100vh",
  overflow: "hidden",
  position: "sticky",
  top: 0,
});

const heroFramesStyle = css({
  background:
    "radial-gradient(circle at 65% 42%, rgba(32,170,255,.2), transparent 38%), var(--color-black)",
  inset: 0,
  position: "absolute",
  userSelect: "none",
  "& img": {
    height: "100%",
    inset: 0,
    objectFit: "cover",
    objectPosition: "center",
    position: "absolute",
    width: "100%",
  },
});

const heroContentStyle = css({
  alignItems: "flex-start",
  bottom: "32px",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  left: "20px",
  maxWidth: "min(720px, calc(100vw - 40px))",
  position: "absolute",
  zIndex: 2,
  "& h1": {
    fontFamily: "var(--font-sans)",
    fontSize: "2.25rem",
    fontWeight: 700,
    letterSpacing: "-.03em",
    lineHeight: 1,
    margin: 0,
    paddingRight: ".03em",
  },
  "@media (min-width: 810px)": {
    bottom: "48px",
    gap: "28px",
    left: "36px",
    "& h1": { fontSize: "4rem" },
  },
  "@media (min-width: 1400px)": {
    bottom: "64px",
    "& h1": { fontSize: "4.5rem" },
  },
});

const heroLinkStyle = css({
  '& [data-link-hit-area="true"]': {
    bottom: "-32px",
    height: "100vh",
    left: "-20px",
    position: "absolute",
    width: "100vw",
  },
  "@media (min-width: 810px)": {
    '& [data-link-hit-area="true"]': { bottom: "-48px", left: "-36px" },
  },
  "@media (min-width: 1400px)": {
    '& [data-link-hit-area="true"]': { bottom: "-64px" },
  },
});

function preloadImage(url: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let preload = new Image();
    preload.fetchPriority = "low";
    let settled = false;

    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      preload.removeEventListener("load", onLoad);
      preload.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    }

    async function onLoad() {
      try {
        await preload.decode();
      } catch {
        // A completed load is still usable when decode() is unavailable or rejects.
      }
      finish();
    }

    function onError() {
      finish(new Error(`Unable to load ${url}`));
    }

    function onAbort() {
      finish(new DOMException("Image preload aborted", "AbortError"));
      // Removing src asks the browser to abort the image request instead of
      // continuing the download after this component leaves the page.
      preload.removeAttribute("src");
    }

    if (signal.aborted) {
      onAbort();
      return;
    }

    preload.addEventListener("load", onLoad, { once: true });
    preload.addEventListener("error", onError, { once: true });
    signal.addEventListener("abort", onAbort, { once: true });
    preload.src = url;
  });
}
