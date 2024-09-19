import { Image as HydrogenImage } from "@shopify/hydrogen";
import clx from "clsx";

export type HydrogenImageProps = Parameters<typeof HydrogenImage>[0];

export type ImageGradientColors =
  | "green"
  | "darkBlue"
  | "orange"
  | "aqua"
  | "blue"
  | "pink"
  | "pinkPurple"
  | "random";

export type ImageProps = HydrogenImageProps & {
  /** (optional) Gradient background color/pattern */
  gradient?: ImageGradientColors;
  /** If true, the gradient will fade out to white or dark at the bottom based on color-scheme*/
  gradientFade?: boolean;
  /** If true, the gradient will fade in on hover */
  gradientHover?: boolean;
};

/**
 * Image component with multiple gradient backgrounds options
 */
export function Image(props: ImageProps) {
  const {
    gradient = null,
    gradientFade = false,
    gradientHover = false,
    ...rest
  } = props;
  if (!gradient) return <HydrogenImage {...rest} />;

  const gradients = {
    // https://doodad.dev/gradient-generator?share=radial-90-200-158-31-35-6_21-74dfeaff_100-5a67d8ff__linear-161-50-50-50-50-7_1-8bdabcff_26-73dee9ff_71-67a0e6ff_100-4c51bf00
    aqua: `linear-gradient(161deg, #8bdabc 1%, #89dac1 3.78%, #86dbc5 6.56%, #84dbca 9.33%, #82dccf 12.11%, #7fdcd4 14.89%, #7cddd8 17.67%, #79ddde 20.44%, #73dee9 26%, #70d7e8 31%, #6dd1e6 36%, #6bcae5 41%, #68c4e4 46%, #65bde4 51%, #63b6e4 56%, #60afe6 61%, #67a0e6 71%, rgba(96, 152, 227, 0.89) 74.22%, rgba(90, 143, 224, 0.78) 77.44%, rgba(85, 135, 220, 0.67) 80.67%, rgba(83, 126, 214, 0.56) 83.89%, rgba(80, 118, 210, 0.44) 87.11%, rgba(78, 109, 206, 0.33) 90.33%, rgba(76, 100, 203, 0.22) 93.56%, rgba(76, 81, 191, 0) 100%), radial-gradient(79% 100% at 31% 35%, #74dfea 21%, #6dd1e4 30.88%, #67c3dd 40.75%, #60b6d7 50.63%, #5aa8d2 60.5%, #549acf 70.38%, #4f8bcf 80.25%, #5a67d8 100%)`,
    // https://doodad.dev/gradient-generator?share=linear-90-50-50-50-50-5_0-3182ceff_100-4fd1c5ff__radial-90-200-200-46-0-1_0-a4d099ff_100-bee3f800
    green: `radial-gradient(100% 100% at 46% 0%, #a4d099 0%, rgba(146, 220, 190, 0.67) 33.33%, rgba(190, 227, 248, 0) 100%), linear-gradient(90deg, #3182ce 0%, #348fc5 14.29%, #389ac2 28.57%, #3ca5c1 42.86%, #41b0c2 57.14%, #45bbc3 71.43%, #4fd1c5 100%)`,
    // https://doodad.dev/gradient-generator?share=linear-309-50-50-50-50-7_0-90cdf4ff_54-5376e4ff_97-5376e4ff_100-63b3edff__radial-90-156-122-36-0-10_6-5da4efff_100-bee3f800__radial-90-103-67-7-100-7_0-434190ff_100-667eea00__radial-90-119-58-94-28-2_0-6270dfff_100-7f9cf500
    darkBlue: `radial-gradient(29% 59.5% at 94% 28%, #6270df 0%, rgba(104, 123, 230, 0.75) 25%, rgba(110, 134, 236, 0.5) 50%, rgba(127, 156, 245, 0) 100%), radial-gradient(33.5% 51.5% at 7% 100%, #434190 0%, rgba(70, 70, 159, 0.89) 11.11%, rgba(74, 76, 171, 0.78) 22.22%, rgba(77, 83, 182, 0.67) 33.33%, rgba(81, 89, 193, 0.56) 44.44%, rgba(84, 96, 202, 0.44) 55.56%, rgba(88, 104, 212, 0.33) 66.67%, rgba(92, 111, 220, 0.22) 77.78%, rgba(102, 126, 234, 0) 100%), radial-gradient(61% 78% at 36% 0%, #5da4ef 6%, rgba(99, 170, 240, 0.92) 13.83%, rgba(106, 175, 240, 0.83) 21.67%, rgba(113, 181, 241, 0.75) 29.5%, rgba(120, 186, 242, 0.67) 37.33%, rgba(128, 192, 242, 0.58) 45.17%, rgba(136, 197, 243, 0.5) 53%, rgba(144, 202, 244, 0.42) 60.83%, rgba(153, 207, 244, 0.33) 68.67%, rgba(162, 212, 245, 0.25) 76.5%, rgba(171, 217, 246, 0.17) 84.33%, rgba(190, 227, 248, 0) 100%), linear-gradient(309deg, #90cdf4 0%, #83c4f2 6%, #76bcf1 12%, #6cb3ef 18%, #62a9ee 24%, #5aa0ec 30%, #5596ea 36%, #528ce8 42%, #5376e4 54%, #5376e4 58.78%, #5376e4 63.56%, #5376e4 68.33%, #5376e4 73.11%, #5376e4 77.89%, #5376e4 82.67%, #5376e4 87.44%, #5376e4 97%, #507ee5 97.33%, #4e85e6 97.67%, #4e8ce7 98%, #4e93e8 98.33%, #519ae9 98.67%, #53a0ea 99%, #58a7eb 99.33%, #63b3ed 100%)`,
    // https://doodad.dev/gradient-generator?share=radial-90-200-111-82-32-5_8-ecb041ff_100-c99399ff__linear-83-109-200-0-0-3_0-bf7aa4ff_63-d92e7400
    orange: `linear-gradient(83deg, #bf7aa4 0%, rgba(200, 108, 160, 0.8) 12.6%, rgba(207, 93, 153, 0.6) 25.2%, rgba(212, 79, 143, 0.4) 37.8%, rgba(217, 46, 116, 0) 63%), radial-gradient(55.5% 100% at 82% 32%, #ecb041 8%, #eea951 21.14%, #efa260 34.29%, #e99e76 47.43%, #e29a85 60.57%, #db978e 73.71%, #c99399 100%)`,
    // https://doodad.dev/gradient-generator?share=linear-90-50-50-50-50-5_0-3182ceff_100-4fd1c5ff__radial-90-200-146-63-45-10_11-61e5ffcc_100-667eea00__radial-90-145-200-37-0-0_0-a1dc9aff_100-bee3f800__radial-312-141-161-100-100-0_24-667eeaff_100-81e6d900
    blue: `radial-gradient(80.5% 70.5% at 100% 100%, #667eea 24%, rgba(129, 230, 217, 0) 100%), radial-gradient(100% 72.5% at 37% 0%, #a1dc9a 0%, rgba(190, 227, 248, 0) 100%), radial-gradient(73% 100% at 63% 45%, rgba(97, 229, 255, 0.8) 11%, rgba(82, 222, 254, 0.73) 18.42%, rgba(68, 215, 253, 0.67) 25.83%, rgba(58, 207, 252, 0.6) 33.25%, rgba(51, 199, 251, 0.53) 40.67%, rgba(54, 191, 249, 0.47) 48.08%, rgba(57, 182, 247, 0.4) 55.5%, rgba(60, 174, 246, 0.33) 62.92%, rgba(66, 165, 245, 0.27) 70.33%, rgba(74, 156, 242, 0.2) 77.75%, rgba(84, 146, 240, 0.13) 85.17%, rgba(102, 126, 234, 0) 100%), linear-gradient(90deg, #3182ce 0%, #348fc5 14.29%, #389ac2 28.57%, #3ca5c1 42.86%, #41b0c2 57.14%, #45bbc3 71.43%, #4fd1c5 100%)`,
    // https://doodad.dev/gradient-generator?share=radial-90-200-108-13-65-6_15-be6b85ff_87-b3769bff__linear-127-109-200-0-0-3_0-c64dc2ff_6-c35cb0ff_52-d92e7400
    pink: `radial-gradient(72% 97% at 0% 51%, #a07cab 0%, rgba(167, 110, 165, 0.8) 20%, rgba(171, 97, 153, 0.6) 40%, rgba(174, 83, 138, 0.4) 60%, rgba(177, 56, 94, 0) 100%), linear-gradient(159deg, #7ac8d6 11%, #7abdcd 38%, #528df5 83%)`,
    // https://doodad.dev/gradient-generator?share=linear-159-50-50-50-50-0_11-7ac8d6ff_38-7abdcdff_83-528df5ff__radial-90-194-144-0-51-3_0-a07cabff_100-b1385e00`
    pinkPurple: `linear-gradient(127deg, #c64dc2 0%, #c650be 1.2%, #c553ba 2.4%, #c456b7 3.6%, #c35cb0 6%, rgba(200, 84, 168, 0.8) 15.2%, rgba(205, 75, 158, 0.6) 24.4%, rgba(209, 66, 147, 0.4) 33.6%, rgba(217, 46, 116, 0) 52%), radial-gradient(54% 100% at 13% 65%, #be6b85 15%, #bd6c89 24%, #bb6e8c 33%, #ba6f8f 42%, #b97192 51%, #b77294 60%, #b67397 69%, #b3769b 87%)`,
  };

  // https://doodad.dev/gradient-generator?share=linear-181-50-50-50-50-7_29-ffffff26_96-f7fafcff
  const fadeGradient = `linear-gradient(181deg, rgba(255, 255, 255, 0.15) 29%, rgba(254, 254, 254, 0.24) 36.44%, rgba(254, 254, 254, 0.34) 43.89%, rgba(253, 253, 253, 0.43) 51.33%, rgba(253, 252, 253, 0.53) 58.78%, rgba(252, 252, 253, 0.62) 66.22%, rgba(251, 251, 252, 0.72) 73.67%, rgba(250, 251, 252, 0.81) 81.11%, #f7fafc 96%)`;

  const isRandom = gradient === "random";

  let activeGradient;

  if (isRandom) {
    const randomGradientName = Object.keys(gradients)[
      Math.floor(Math.random() * Object.keys(gradients).length)
    ] as keyof typeof gradients;

    activeGradient = gradients[randomGradientName];
  } else {
    activeGradient = gradients[gradient];
  }

  return (
    <div
      className={clx("relative isolate min-h-full min-w-full overflow-hidden")}
    >
      {/* Color gradient layer */}
      <div
        className={clx(
          "absolute left-0 top-0 z-0 h-full w-full",
          gradientHover &&
            "cursor-pointer opacity-0 transition-opacity duration-300 hover:opacity-100",
        )}
        style={{
          zIndex: -2,
          backgroundImage: activeGradient,
        }}
        suppressHydrationWarning={gradient === "random"}
      />

      {gradientFade && (
        <div
          className="absolute left-0 top-0 z-0 h-full w-full"
          style={{
            zIndex: -1,
            backgroundImage: fadeGradient,
          }}
        />
      )}

      <HydrogenImage
        {...rest}
        className="pointer-events-none min-h-full min-w-full"
      />
    </div>
  );
}
