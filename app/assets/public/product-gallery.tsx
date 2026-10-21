import { createMixin, css, on, ref, type Handle } from "remix/component";

import type { ImageData } from "../../data/storefront.ts";
import { Icon } from "../../ui/public/icon.tsx";
import {
  ShopifyImage,
  shopifyImageUrl,
} from "../../ui/public/shopify-image.tsx";

interface ProductGalleryProps {
  /** Renders the mobile arrows and dots, which only work with scripts. */
  controls: boolean;
  images: ImageData[];
  selectedImage?: ImageData | null;
}

/**
 * The selected variant's image first, as a vertical stack on wider screens
 * and a swipeable carousel on phones.
 */
export function ProductGallery(handle: Handle<ProductGalleryProps>) {
  return () => {
    let { controls, images, selectedImage } = handle.props;
    let ordered = orderedImages(images, selectedImage);
    return (
      <div mix={galleryColumnStyle}>
        <DesktopGallery images={ordered} />
        <MobileGallery controls={controls} images={ordered} />
      </div>
    );
  };
}

// Both layouts render and CSS shows one. Eager images load even while hidden,
// so each image also offers an empty source where its layout is hidden.
const WIDE_SCREEN = "(width >= 810px)";
const NARROW_SCREEN = "(width < 810px)";
const LAYOUTS = {
  desktop: { hiddenAt: NARROW_SCREEN, sizes: "(min-width: 1400px) 50vw, 60vw" },
  mobile: { hiddenAt: WIDE_SCREEN, sizes: "100vw" },
};
const NO_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

function DesktopGallery(handle: Handle<{ images: ImageData[] }>) {
  return () => {
    let { images } = handle.props;
    return (
      <div mix={[desktopGalleryStyle, fadeImagesOnScroll()]}>
        {images.length ? (
          images.map((image, index) => (
            <ProductImageFrame
              image={image}
              index={index}
              key={imageKey(image)}
              layout="desktop"
            />
          ))
        ) : (
          <ProductImageFallback />
        )}
      </div>
    );
  };
}

function MobileGallery(
  handle: Handle<{ controls: boolean; images: ImageData[] }>,
) {
  let index = 0;
  let gallery: HTMLElement | undefined;
  let firstImageKey = firstKey(handle.props.images);

  function scrollToImage(nextIndex: number, behavior?: ScrollBehavior) {
    if (!gallery) return;
    let last = handle.props.images.length - 1;
    gallery.scrollTo({
      behavior:
        behavior ??
        (matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth"),
      left: Math.max(0, Math.min(last, nextIndex)) * gallery.clientWidth,
    });
  }

  return () => {
    let { controls, images } = handle.props;
    // A newly selected variant puts its image first; show it.
    if (firstKey(images) !== firstImageKey) {
      firstImageKey = firstKey(images);
      index = 0;
      handle.queueTask(() => scrollToImage(0, "instant"));
    }

    return (
      <section aria-label="Product images" mix={mobileGalleryShellStyle}>
        <div
          mix={[
            mobileGalleryStyle,
            ref((element, signal) => {
              gallery = element;
              let frame = throttleToAnimationFrame(() => {
                let visible = Math.round(
                  element.scrollLeft / Math.max(1, element.clientWidth),
                );
                if (visible === index) return;
                index = visible;
                handle.update();
              });
              element.addEventListener("scroll", frame.request, {
                passive: true,
                signal,
              });
              signal.addEventListener("abort", () => {
                frame.cancel();
                if (gallery === element) gallery = undefined;
              });
            }),
          ]}
        >
          {images.length ? (
            images.map((image, imageIndex) => (
              <div data-mobile-slide="true" key={imageKey(image)}>
                <ProductImageFrame
                  image={image}
                  index={imageIndex}
                  layout="mobile"
                />
              </div>
            ))
          ) : (
            <div data-mobile-slide="true">
              <ProductImageFallback />
            </div>
          )}
        </div>
        {controls && images.length > 1 ? (
          <div mix={galleryControlsStyle}>
            <button
              type="button"
              aria-label="Previous image"
              disabled={index === 0}
              mix={on("click", () => scrollToImage(index - 1))}
            >
              <Icon name="chevron-left" />
            </button>
            <div>
              {images.map((image, imageIndex) => (
                <button
                  key={imageKey(image)}
                  type="button"
                  aria-label={`Skip to image ${imageIndex + 1}`}
                  aria-current={imageIndex === index ? "true" : undefined}
                  mix={on("click", () => scrollToImage(imageIndex))}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next image"
              disabled={index === images.length - 1}
              mix={on("click", () => scrollToImage(index + 1))}
            >
              <Icon name="chevron-right" />
            </button>
          </div>
        ) : null}
      </section>
    );
  };
}

function ProductImageFrame(
  handle: Handle<{
    image: ImageData;
    index: number;
    layout: keyof typeof LAYOUTS;
  }>,
) {
  return () => {
    let { image, index, layout } = handle.props;
    let blurUp = index === 0;
    return (
      <div
        data-product-image={layout === "desktop" ? imageKey(image) : undefined}
        data-blur-up={blurUp || undefined}
        mix={[productImageFrameStyle, blurUp ? markLoaded() : undefined]}
      >
        {blurUp ? (
          // Blurred low-res preview shown while the full image loads
          <img
            src={shopifyImageUrl(image.url, 32)}
            alt=""
            aria-hidden="true"
            draggable={false}
            data-preview-image="true"
          />
        ) : null}
        <picture>
          <source media={LAYOUTS[layout].hiddenAt} srcSet={NO_IMAGE} />
          <ShopifyImage
            image={image}
            alt={image.altText ?? "Product image"}
            sizes={LAYOUTS[layout].sizes}
            loading={blurUp ? "eager" : "lazy"}
            fetchPriority={blurUp ? "high" : undefined}
          />
        </picture>
      </div>
    );
  };
}

function ProductImageFallback() {
  return () => (
    <div aria-label="Product image unavailable" mix={imageFallbackStyle} />
  );
}

/** Marks a blur-up frame loaded once its full image loads or fails. */
const markLoaded = createMixin<HTMLElement>(
  (handle) => {
    handle.addEventListener("insert", ({ node }) => {
      let image = node.querySelector<HTMLImageElement>(
        "img:not([data-preview-image])",
      );
      let settle = () => {
        node.dataset.loaded = "true";
      };
      if (!image || image.complete) {
        settle();
        return;
      }
      image.addEventListener("load", settle, { signal: handle.signal });
      image.addEventListener("error", settle, { signal: handle.signal });
    });
    return () => <handle.element />;
  },
  { ssr: false },
);

/** Fades images out as they scroll away from just below the header. */
const fadeImagesOnScroll = createMixin<HTMLElement>(
  (handle) => {
    handle.addEventListener("insert", ({ node }) => {
      let { signal } = handle;
      let reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
      let update = () => fadeByDistance(node, reducedMotion.matches);
      let frame = throttleToAnimationFrame(update);

      update();
      window.addEventListener("scroll", frame.request, {
        passive: true,
        signal,
      });
      window.addEventListener("resize", frame.request, { signal });
      reducedMotion.addEventListener("change", frame.request, { signal });
      signal.addEventListener("abort", frame.cancel);
    });
    return () => <handle.element />;
  },
  { ssr: false },
);

function fadeByDistance(gallery: HTMLElement, reducedMotion: boolean) {
  let frames = gallery.querySelectorAll<HTMLElement>("[data-product-image]");
  if (reducedMotion) {
    frames.forEach((frame) => (frame.style.opacity = "1"));
    return;
  }

  let anchor =
    cssPixels(document.documentElement, "--header-height", 136) +
    cssPixels(document.body, "--store-wide-sale-height", 0);
  let fadeRange = window.innerHeight * 0.4;
  frames.forEach((frame) => {
    let distance = Math.abs(frame.getBoundingClientRect().top - anchor);
    let normalized = Math.min(1, distance / fadeRange);
    frame.style.opacity = String(Math.max(0.2, 1 - normalized * normalized));
  });
}

function cssPixels(element: Element, property: string, fallback: number) {
  return (
    Number.parseInt(getComputedStyle(element).getPropertyValue(property)) ||
    fallback
  );
}

function throttleToAnimationFrame(callback: () => void) {
  let frame = 0;
  return {
    request: () => {
      frame ||= requestAnimationFrame(() => {
        frame = 0;
        callback();
      });
    },
    cancel: () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}

function orderedImages(
  images: ImageData[],
  selected: ImageData | null | undefined,
): ImageData[] {
  if (!selected) return images;
  return [
    selected,
    ...images.filter((image) =>
      selected.id ? image.id !== selected.id : image.url !== selected.url,
    ),
  ];
}

function imageKey(image: ImageData): string {
  return image.id || image.url;
}

function firstKey(images: ImageData[]): string | undefined {
  return images[0] ? imageKey(images[0]) : undefined;
}

const galleryColumnStyle = css({
  minWidth: 0,
  "@media (min-width: 810px)": { maxWidth: "1200px", width: "100%" },
});
const desktopGalleryStyle = css({
  display: "none",
  flexDirection: "column",
  gap: "18px",
  marginInline: "auto",
  maxWidth: "1200px",
  width: "100%",
  "@media (scripting: enabled)": {
    "& > [data-product-image] + [data-product-image]": { opacity: 0.2 },
  },
  [`@media ${WIDE_SCREEN}`]: { display: "flex" },
  "@media (prefers-reduced-motion: reduce)": {
    "& > [data-product-image]": { opacity: 1 },
  },
});
const imageFallbackStyle = css({
  aspectRatio: "1",
  background: "var(--color-gray-900)",
  width: "100%",
  "@media (min-width: 810px)": { borderRadius: "24px" },
});
const productImageFrameStyle = css({
  aspectRatio: "1",
  backgroundColor: "var(--color-black)",
  overflow: "hidden",
  position: "relative",
  transition: "opacity 180ms ease",
  "& [data-preview-image]": { display: "none" },
  "& img:not([data-preview-image])": {
    height: "100%",
    objectFit: "contain",
    position: "relative",
    width: "100%",
  },
  "@media (scripting: enabled)": {
    "& [data-preview-image]": {
      display: "block",
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      filter: "blur(20px)",
      // Scale up so the blur does not reveal transparent edges.
      transform: "scale(1.1)",
      opacity: 1,
      transition: "opacity 750ms ease",
    },
    "&[data-blur-up] img:not([data-preview-image])": {
      filter: "blur(20px)",
      transition: "filter 750ms ease",
    },
    "&[data-loaded] [data-preview-image]": { opacity: 0 },
    "&[data-loaded] img:not([data-preview-image])": { filter: "blur(0)" },
  },
  "@media (min-width: 810px)": { borderRadius: "24px" },
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
    "& [data-preview-image]": { transition: "none" },
    "& img:not([data-preview-image])": { transition: "none" },
  },
});
const mobileGalleryShellStyle = css({
  marginInline: "-16px",
  position: "relative",
  [`@media ${WIDE_SCREEN}`]: { display: "none" },
});
const mobileGalleryStyle = css({
  display: "flex",
  overflowX: "auto",
  overscrollBehaviorX: "contain",
  scrollSnapType: "x mandatory",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },
  "& > div": { flex: "0 0 100%", scrollSnapAlign: "start", width: "100%" },
});
const galleryControlsStyle = css({
  alignItems: "center",
  background: "linear-gradient(0deg, rgba(0,0,0,.45), transparent)",
  bottom: 0,
  display: "flex",
  justifyContent: "space-between",
  left: 0,
  padding: "48px 16px 18px",
  pointerEvents: "none",
  position: "absolute",
  right: 0,
  "& button": {
    background: "transparent",
    border: 0,
    color: "white",
    padding: 0,
    pointerEvents: "auto",
  },
  "& button:disabled": { opacity: 0.25 },
  "& svg": { height: "24px", width: "24px" },
  "& div": { display: "flex", gap: "16px" },
  "& div button": {
    background: "rgba(255,255,255,.5)",
    borderRadius: "999px",
    height: "8px",
    width: "8px",
  },
  "& div button[aria-current]": { background: "white" },
});
