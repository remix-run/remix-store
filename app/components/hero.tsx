import featuredFrame from "~/assets/featured-frame-3.svg?url";
import ledScreen from "~/assets/led-screen.png";
import ledMiniSkateboard from "~/assets/led-screen-mini-skateboard.png";

export function Hero() {
  return (
    <div
      className="relative block bg-neutral-200 px-9 pb-8 dark:bg-neutral-800"
      //   to={`/collections/${collection.handle}`}
    >
      {/* <img
          className="h-[192px] object-cover sm:h-[348px]"
          src={featuredFrame}
          alt=""
        /> */}
      <div className="hero-frame h-[240px] w-full rounded-[36px] border-2 border-black p-6 sm:h-[348px]">
        <div className="hero-led-background relative h-[192px] w-full overflow-hidden rounded-3xl bg-blue-led sm:h-[300px]">
          <div
            className="hero-image absolute h-full w-full opacity-50 sm:opacity-100"
            // TODO: get from Shopify CDN
            style={{
              // @ts-expect-error -- you can use css vars, it's fine
              "--hero-bg-image": `url(${ledMiniSkateboard})`,
            }}
          />
          <div className="absolute flex h-full max-w-[484px] flex-col justify-center gap-2 p-6 text-center sm:pl-9 sm:text-left lg:pl-[100px]">
            <p className="text-shadow-hero font-mono text-xs font-semibold uppercase tracking-[0.48px] text-black text-opacity-80 sm:tracking-[0.64px] md:text-base">
              Build your very own
            </p>
            <h1 className="text-shadow-hero font-header text-[64px] font-normal capitalize leading-[75%] text-black text-opacity-80 md:text-[84px]">
              remix mini skateboard
            </h1>
          </div>
        </div>
      </div>
      {/* {image && (
          <Image
            className="absolute top-1/2 -translate-y-1/2"
            data={image}
            sizes="100vw"
            alt=""
          />
        )} */}
    </div>
  );
}
