import { type Handle, type SerializableObject } from "remix/ui";

export interface ShopifyImageData extends SerializableObject {
  altText?: string | null;
  height?: number | null;
  id?: string | null;
  url: string;
  width?: number | null;
}

export interface ShopifyImageProps extends SerializableObject {
  alt: string;
  image: ShopifyImageData;
  loading?: "eager" | "lazy";
  objectPosition?: string;
  sizes: string;
}

const RESPONSIVE_WIDTHS = [
  320, 480, 640, 800, 960, 1200, 1600, 2000, 2400, 3000,
];
const SHOPIFY_IMAGE_HOSTS = ["cdn.shopify.com", "mock.shop"];

export function ShopifyImage(handle: Handle<ShopifyImageProps>) {
  return () => {
    let { alt, image, loading = "lazy", objectPosition, sizes } = handle.props;
    let widths = responsiveImageWidths(image.width);
    let isShopifyImage = isShopifyImageSource(image.url);

    return (
      <img
        src={
          isShopifyImage
            ? shopifyImageUrl(image.url, widths.at(-1) ?? image.width ?? 960)
            : image.url
        }
        srcSet={
          isShopifyImage
            ? widths
                .map(
                  (width) => `${shopifyImageUrl(image.url, width)} ${width}w`,
                )
                .join(", ")
            : undefined
        }
        sizes={isShopifyImage ? sizes : undefined}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        alt={alt}
        loading={loading}
        decoding="async"
        style={objectPosition ? { objectPosition } : undefined}
      />
    );
  };
}

export function shopifyImageUrl(source: string, width: number): string {
  try {
    let url = new URL(source);
    if (!isShopifyImageHost(url.hostname)) return source;
    url.searchParams.set("width", String(Math.round(width)));
    return url.toString();
  } catch {
    return source;
  }
}

export function responsiveImageWidths(sourceWidth?: number | null): number[] {
  if (!sourceWidth || sourceWidth <= 0) return RESPONSIVE_WIDTHS;

  let maximumWidth = Math.max(1, Math.round(sourceWidth));
  let widths = RESPONSIVE_WIDTHS.filter((width) => width < maximumWidth);
  widths.push(maximumWidth);
  return [...new Set(widths)];
}

function isShopifyImageSource(source: string): boolean {
  try {
    return isShopifyImageHost(new URL(source).hostname);
  } catch {
    return false;
  }
}

function isShopifyImageHost(hostname: string): boolean {
  return SHOPIFY_IMAGE_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}
