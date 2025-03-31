import useEmblaCarousel from "embla-carousel-react";
import { DotButton, useDotButton } from "~/components/carousel/dot-button";
import {
  NextButton,
  PrevButton,
  usePrevNextButtons,
} from "~/components/carousel/arrow-buttons";
import { Image as HydrogenImage } from "@shopify/hydrogen";
import { cn } from "~/lib/cn";
import { useRef, useState } from "react";
import { useLayoutEffect, usePrefersReducedMotion } from "~/lib/hooks";

import type { ProductVariantFragment } from "storefrontapi.generated";

export function ProductImages({
  images,
}: {
  images: Array<ProductVariantFragment["image"]>;
}) {
  return (
    <>
      <ImageColumn images={images} />
      <ImageCarousel images={images} />
    </>
  );
}

function ImageColumn({
  images,
}: {
  images: ProductVariantFragment["image"][];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const opacities = useImageOpacities(containerRef);

  return (
    <div
      ref={containerRef}
      className="hidden size-full max-w-[1200px] flex-col gap-[18px] md:flex"
    >
      {images.map((image, index) => {
        if (!image || !image.id) return null;

        let defaultOpacity = index === 0 ? 1 : 0;

        return (
          <div
            key={image.id}
            data-image-id={image.id}
            className="aspect-square overflow-hidden rounded-3xl"
            style={{ opacity: opacities.get(image.id) ?? defaultOpacity }}
          >
            <HydrogenImage
              className="pointer-events-none size-auto select-none"
              alt={image.altText || "Product Image"}
              data={image}
              sizes="(min-width: 800px) 50vw, 100vw"
              loading="lazy"
            />
          </div>
        );
      })}
    </div>
  );
}

function ImageCarousel({
  images,
}: {
  images: ProductVariantFragment["image"][];
}) {
  let [emblaRef, emblaApi] = useEmblaCarousel();

  let { selectedIndex, scrollSnaps, onDotButtonClick } = useDotButton(emblaApi);

  let {
    prevBtnDisabled,
    nextBtnDisabled,
    onPrevButtonClick,
    onNextButtonClick,
  } = usePrevNextButtons(emblaApi);

  return (
    <section className="relative -mx-4 md:hidden">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="pinch-zoom flex touch-pan-y">
          {images.map((image) => {
            if (!image) return null;

            return (
              <div
                className="flex aspect-square w-full shrink-0"
                key={image.id}
              >
                <HydrogenImage
                  className="pointer-events-none size-auto select-none"
                  alt={image.altText || "Product Image"}
                  sizes="100vw"
                  data={image}
                  loading="lazy"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Only show the carousel controls if there's more than one image */}
      {images.length > 1 && (
        <div className="absolute bottom-0 z-10 flex w-full items-center justify-between bg-linear-to-t from-black/40 p-6 pt-12 text-white">
          <PrevButton
            onClick={onPrevButtonClick}
            disabled={prevBtnDisabled}
            className="h-6 w-6"
            aria-label="Previous image"
          >
            <svg viewBox="0 0 10 10" className="mx-auto">
              <use href="/sprite.svg#chevron-left"></use>
            </svg>
          </PrevButton>
          <div className="flex space-x-4">
            {scrollSnaps.map((btnIndex, index) => {
              return (
                <DotButton
                  key={btnIndex}
                  onClick={() => onDotButtonClick(index)}
                  className={cn("h-2 w-2 rounded-full bg-white", {
                    "bg-white/50": index !== selectedIndex,
                  })}
                  aria-label={`Skip to image ${index + 1}`}
                />
              );
            })}
          </div>
          <NextButton
            onClick={onNextButtonClick}
            disabled={nextBtnDisabled}
            className="h-6 w-6"
            aria-label="Next image"
          >
            <svg viewBox="0 0 10 10" className="mx-auto">
              <use href="/sprite.svg#chevron-right"></use>
            </svg>
          </NextButton>
        </div>
      )}
    </section>
  );
}

function useImageOpacities(containerRef: React.RefObject<HTMLElement>) {
  const [opacities, setOpacities] = useState<Map<string, number>>(new Map());
  let prefersReducedMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    let rafId: number;

    const calculateVisibilities = () => {
      // Early return if container is not available
      if (!containerRef.current) return;

      // If user prefers reduced motion, set all opacities to 1
      if (prefersReducedMotion) {
        const newOpacities = new Map<string, number>();
        const imageContainers =
          containerRef.current.querySelectorAll("[data-image-id]");

        imageContainers.forEach((element) => {
          const id = element.getAttribute("data-image-id")!;
          newOpacities.set(id, 1);
        });

        setOpacities(newOpacities);
        return;
      }

      rafId = requestAnimationFrame(() => {
        if (!containerRef.current) return;

        const newOpacities = new Map<string, number>();
        const windowHeight = window.innerHeight;

        // Get the header height from CSS variable
        const headerHeight =
          parseInt(
            getComputedStyle(document.documentElement)
              .getPropertyValue("--header-height")
              .trim(),
          ) || windowHeight * 0.15;

        // Create a fade range of about 40% of the viewport height
        const fadeRange = windowHeight * 0.4;

        // Get all image containers
        const imageContainers =
          containerRef.current.querySelectorAll("[data-image-id]");

        imageContainers.forEach((element) => {
          const id = element.getAttribute("data-image-id")!;
          const rect = element.getBoundingClientRect();
          const elementTop = rect.top;
          const distanceFromTarget = Math.abs(elementTop - headerHeight);

          // Calculate normalized distance (0 to 1)
          const normalizedDistance = Math.min(
            1,
            distanceFromTarget / fadeRange,
          );

          // Use a quadratic curve for sharper falloff and apply minimum opacity
          const opacity = Math.max(
            0.2,
            1 - normalizedDistance * normalizedDistance,
          );
          newOpacities.set(id, opacity);
        });

        setOpacities(newOpacities);
      });
    };

    // Calculate initial visibilities
    calculateVisibilities();

    // Set up scroll listener
    window.addEventListener("scroll", calculateVisibilities, { passive: true });
    window.addEventListener("resize", calculateVisibilities);

    return () => {
      window.removeEventListener("scroll", calculateVisibilities);
      window.removeEventListener("resize", calculateVisibilities);
      cancelAnimationFrame(rafId);
    };
  }, [containerRef, prefersReducedMotion]);

  return opacities;
}
