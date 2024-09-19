export default function ImageCarousel({
  images,
  gradientColors,
}: {
  images: Array<ProductVariantFragment["image"]>;
  gradientColors: ProductFragment["gradientColors"];
}) {
  const gradients = parseGradientColors(gradientColors);

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
    <section className="embla relative -mx-4 mb-[18px] grid md:hidden [&>*]:[grid-area:1/1]">
      <div className="embla__viewport" ref={emblaRef}>
        <div className="embla__container">
          {images.map((image) => {
            if (!image) return null;
            const gradient = gradients.shift() ?? "random";
            return (
              <div className="embla__slide" key={image.id}>
                <ProductImage image={image} gradient={gradient} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="z-10 place-content-end">
        <div className="flex items-center justify-between p-4">
          <PrevButton onClick={onPrevButtonClick} disabled={prevBtnDisabled} />
          <div className="flex space-x-2">
            {scrollSnaps.map((btnIndex) => (
              <DotButton
                key={btnIndex}
                onClick={() => onDotButtonClick(btnIndex)}
                className={cn("h-2 w-2 rounded-full bg-white", {
                  "bg-opacity-50": btnIndex !== selectedIndex,
                })}
              ></DotButton>
            ))}
          </div>
          <NextButton onClick={onNextButtonClick} disabled={nextBtnDisabled} />
        </div>
      </div>
    </section>
  );
}
