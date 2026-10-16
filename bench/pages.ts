/** Pages measured by the benchmark, each rendered from recorded store data. */
export const pages = [
  { name: "home", path: "/" },
  { name: "collection", path: "/collections/all" },
  { name: "product", path: "/products/remix-engineering-hoodie" },
];

export const recordingPath = new URL(
  "./storefront-recording.json",
  import.meta.url,
).pathname;
