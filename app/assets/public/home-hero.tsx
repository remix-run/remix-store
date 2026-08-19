import {
  clientEntry,
  css,
  ref,
  type Handle,
  type SerializableObject,
} from "remix/ui";

import type { ImageData } from "../../data/storefront.ts";
import { PillIcon, pillLinkStyle } from "../../ui/public/pill-link.tsx";

export interface HomeHeroProps extends SerializableObject {
  assetImages: ImageData[];
  collectionHref: string;
  cta: string;
  heading: string;
}

type LoadingState = "idle" | "loading" | "loaded" | "error";

export const HomeHero = clientEntry(
  import.meta.url,
  function HomeHero(handle: Handle<HomeHeroProps>) {
    let loadingState: LoadingState = "idle";
    let section: HTMLElement | null = null;
    let animationFrame = 0;

    function showFrame(index: number) {
      if (!section) return;
      let frames = section.querySelectorAll<HTMLImageElement>(
        "[data-home-hero-frame]",
      );
      frames.forEach((frame, frameIndex) => {
        frame.style.visibility = frameIndex === index ? "visible" : "hidden";
      });
    }

    function updateFrame() {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        if (!section || loadingState !== "loaded") return;

        let images = handle.props.assetImages;
        if (images.length < 2) return;
        let rect = section.getBoundingClientRect();
        let elementTop = window.scrollY + rect.top;
        let progress = Math.max(
          0,
          Math.min(1, (window.scrollY - elementTop) / section.offsetHeight),
        );
        let frameIndex = Math.min(
          Math.floor(progress * 1.5 * images.length),
          images.length - 1,
        );
        showFrame(frameIndex);
      });
    }

    async function preloadFrames(reducedMotion: boolean) {
      if (
        reducedMotion ||
        loadingState !== "idle" ||
        handle.props.assetImages.length < 2
      )
        return;
      loadingState = "loading";

      try {
        // Preload only frames after index zero (frame zero already loaded via SSR)
        await Promise.all(handle.props.assetImages.slice(1).map(preloadImage));
        if (handle.signal.aborted) return;
        loadingState = "loaded";
        await handle.update();
        updateFrame();
      } catch {
        if (handle.signal.aborted) return;
        loadingState = "error";
        showFrame(0);
      }
    }

    return () => {
      let images = handle.props.assetImages;
      // Avoid rendering all frames until successfully loaded
      let renderedImages =
        loadingState === "loaded" ? images : images.slice(0, 1);

      return (
        <section
          aria-labelledby={`${handle.id}-title`}
          data-home-hero="true"
          mix={[
            heroStyle,
            ref((element, signal) => {
              if (!globalThis.window) return;
              section = element;
              let reducedMotion = window.matchMedia(
                "(prefers-reduced-motion: reduce)",
              );

              let onMotionChange = () => {
                if (signal.aborted) return;
                if (reducedMotion.matches) {
                  showFrame(0);
                } else {
                  preloadFrames(false);
                  updateFrame();
                }
              };

              let onScroll = () => {
                if (signal.aborted) return;
                updateFrame();
              };

              window.addEventListener("scroll", onScroll, { passive: true });
              window.addEventListener("resize", onScroll);
              reducedMotion.addEventListener("change", onMotionChange);
              signal.addEventListener("abort", () => {
                section = null;
                cancelAnimationFrame(animationFrame);
                window.removeEventListener("scroll", onScroll);
                window.removeEventListener("resize", onScroll);
                reducedMotion.removeEventListener("change", onMotionChange);
              });

              preloadFrames(reducedMotion.matches);
            }),
          ]}
        >
          <div mix={heroStageStyle}>
            <div aria-hidden="true" mix={heroFramesStyle}>
              {renderedImages.map((image, index) => (
                <img
                  key={image.id ?? image.url}
                  data-home-hero-frame={index}
                  src={image.url}
                  alt=""
                  width={image.width ?? undefined}
                  height={image.height ?? undefined}
                  loading={index === 0 ? "eager" : undefined}
                  fetchPriority={index === 0 ? "high" : undefined}
                  decoding={index === 0 ? "sync" : "async"}
                  style={{ visibility: index === 0 ? "visible" : "hidden" }}
                />
              ))}
            </div>
            <div mix={heroContentStyle}>
              <h1 id={`${handle.id}-title`}>{handle.props.heading}</h1>
              <a
                href={handle.props.collectionHref}
                mix={[pillLinkStyle, heroLinkStyle]}
              >
                <span aria-hidden="true" data-link-hit-area="true" />
                <PillIcon name="fast-forward" />
                <span>{handle.props.cta}</span>
              </a>
            </div>
          </div>
        </section>
      );
    };
  },
);

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

function preloadImage(image: ImageData): Promise<void> {
  return new Promise((resolve, reject) => {
    let preload = new Image();
    preload.addEventListener(
      "load",
      async () => {
        try {
          await preload.decode();
        } catch {
          // A completed load is still usable when decode() is unavailable or rejects.
        }
        resolve();
      },
      { once: true },
    );
    preload.addEventListener(
      "error",
      () => reject(new Error(`Unable to load ${image.url}`)),
      {
        once: true,
      },
    );
    preload.src = image.url;
  });
}
