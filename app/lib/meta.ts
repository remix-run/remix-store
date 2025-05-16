import type { MetaDescriptor } from "react-router";
import ogImageSrc from "~/assets/images/social-main.jpg";

type MetaOptions = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
  siteName?: string;
};

/**
 * Generate standardized meta tags for SEO and social sharing
 * @param options Optional values to customize meta tags
 * @returns Array of meta tag objects for Remix meta function
 */
export function generateMeta(options: MetaOptions = {}): MetaDescriptor[] {
  const {
    title,
    description = "Soft wear for engineers of all kinds",
    image = ogImageSrc,
    url,
    type = "website",
    siteName = "The Remix Store",
  } = options;

  // Make image URL absolute if it's not already
  const imageUrl = image.startsWith("http")
    ? image
    : url
      ? image.startsWith("/")
        ? `${url}${image}`
        : `${url}/${image}`
      : image;

  return [
    { title: title ? `${title} | ${siteName}` : siteName },
    { name: "description", content: description },
    // Open Graph tags
    { property: "og:type", content: type },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: imageUrl },
    ...(url ? [{ property: "og:url", content: url }] : []),
    { property: "og:site_name", content: siteName },
    // Twitter Card tags
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: imageUrl },
  ];
}
