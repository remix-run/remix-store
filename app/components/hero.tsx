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
      {/* Does the frame need to be an svg? */}
      <div
        className="h-[240px] w-full rounded-[36px] border-2 border-black p-6 sm:h-[348px]"
        style={{
          background:
            "linear-gradient(90deg, #000 0%, #000002 4.03%, #2F2F2E 22.5%, #5B5D63 40.35%, #696B6E 55.69%, #595A5E 63.06%, #2D2D31 79.31%, #000003 96.74%, #111113 100%)",
          boxShadow:
            "0px -8px 12px 0px rgba(0, 0, 0, 0.25) inset, 0px 17px 16px 0px rgba(0, 0, 0, 0.30) inset, 0px 4px 5px 0px rgba(0, 0, 0, 0.50) inset, 0px -4px 0px 0px rgba(0, 0, 0, 0.15), 0px 4px 0px 0px rgba(255, 255, 255, 0.05)",
        }}
      >
        <div
          className="h-[192px] w-full rounded-3xl sm:h-[300px]"
          // TODO: get from Shopify CDN
          style={{
            background: `url(${ledMiniSkateboard}) no-repeat center center`,
            backgroundSize: "cover",
          }}
        >
          <div className="flex h-full max-w-[484px] flex-col justify-center gap-2 p-6 text-center sm:pl-9 sm:text-left lg:pl-[100px]">
            <p className="font-sometype-mono hero-subtitle text-xs md:text-base">
              Build your very own
            </p>
            <h1 className="font-jersey-10 hero-title text-[64px] md:text-[84px]">
              Remix Mini Skateboard
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
