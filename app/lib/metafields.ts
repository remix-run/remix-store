import type { ProductFragment } from "storefrontapi.generated";
import type { ImageGradientColors } from "~/components/Image";

/**
 * Parse the gradient colors metafield string array and return as an array of gradients
 */
export function parseGradientColors(
  gradientColors: ProductFragment["gradientColors"],
) {
  return (
    gradientColors?.value ? JSON.parse(gradientColors.value) : []
  ) as Array<ImageGradientColors>;
}
