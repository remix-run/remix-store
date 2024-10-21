import { parseGradientColors } from "~/lib/metafields";
import { Image, type ImageGradientColors } from "./ui/image";

import useEmblaCarousel from "embla-carousel-react";
import { DotButton, useDotButton } from "~/components/carousel/dot-button";
import {
  NextButton,
  PrevButton,
  usePrevNextButtons,
} from "~/components/carousel/arrow-buttons";
import { cn } from "~/lib/cn";

import type {
  ProductFragment,
  ProductVariantFragment,
} from "storefrontapi.generated";

export default function ProductImages({
  images,
  gradientColors,
}: {
  images: Array<ProductVariantFragment["image"]>;
  gradientColors: ProductFragment["gradientColors"];
}) {
  const gradients = parseGradientColors(gradientColors);

  const processedImages = images.map((image) => ({
    image,
    gradient: gradients.shift() ?? "random",
  }));

  return (
    <>
      {/* Maybe we should do a mobile check here instead of hide/show with Tailwind? */}
      <ImageGrid images={processedImages} />
      <Carousel images={processedImages} />
    </>
  );
}

function ImageGrid({
  images,
}: {
  images: Array<{
    image: ProductVariantFragment["image"];
    gradient: ImageGradientColors;
  }>;
}) {
  return (
    <div className="hidden size-full max-w-[800px] flex-col gap-[18px] md:flex">
      {images.map(({ image, gradient }) => {
        if (!image) return null;

        return (
          <div
            key={image.id}
            className="aspect-square overflow-hidden rounded-3xl"
          >
            <Image
              alt={image.altText || "Product Image"}
              data={image}
              gradient={gradient}
              gradientFade
              sizes="(min-width: 800px) 50vw, 100vw"
              loading="lazy"
            />
          </div>
        );
      })}
    </div>
  );
}

function Carousel({
  images,
}: {
  images: Array<{
    image: ProductVariantFragment["image"];
    gradient: ImageGradientColors;
  }>;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel();

  const { selectedIndex, scrollSnaps, onDotButtonClick } =
    useDotButton(emblaApi);

  const {
    prevBtnDisabled,
    nextBtnDisabled,
    onPrevButtonClick,
    onNextButtonClick,
  } = usePrevNextButtons(emblaApi);

  return (
    <section className="relative -mx-4 mb-[18px] md:hidden">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="pinch-zoom flex touch-pan-y">
          {images.map(({ image, gradient }, index) => {
            if (!image) return null;
            return (
              <div
                className="flex aspect-square w-full shrink-0"
                key={image.id}
              >
                <Image
                  alt={image.altText || "Product Image"}
                  sizes="100vw"
                  data={image}
                  gradient={gradient}
                  gradientFade={true}
                  loading="lazy"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Only show the carousel controls if there's more than one image */}
      {images.length > 1 && (
        <div className="absolute bottom-0 z-10 flex w-full items-center justify-between bg-gradient-to-t from-black/40 p-6 pt-12 text-white">
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
                    "bg-opacity-50": index !== selectedIndex,
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
