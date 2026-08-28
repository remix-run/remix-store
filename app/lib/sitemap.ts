const XML_HEADERS = {
  "Cache-Control": "public, max-age=86400",
  "Content-Type": "application/xml; charset=utf-8",
};

export type SitemapAlternate = {
  href: string;
  hreflang: "en-US" | "en-CA";
};

export type SitemapUrl = {
  alternates?: SitemapAlternate[];
  changeFrequency?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  image?: { caption?: string; location: string };
  lastModified?: string;
  location: string;
};

/**
 * Framework-neutral equivalent of Hydrogen's stable sitemap response helpers.
 * Keep this boundary small so it can be replaced if the preview exports them.
 */
export function sitemapIndexResponse(locations: string[]): Response {
  let entries = locations
    .map((location) => `  <sitemap><loc>${escapeXml(location)}</loc></sitemap>`)
    .join("\n");
  let body = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>`;
  return new Response(body, { headers: XML_HEADERS });
}

export function sitemapResponse(
  urls: SitemapUrl[],
  options: { fallbackLocation: string },
): Response {
  let entries = urls.length
    ? urls
    : [
        {
          changeFrequency: "weekly" as const,
          location: options.fallbackLocation,
        },
      ];
  let hasImages = entries.some((url) => url.image);
  let hasAlternates = entries.some((url) => url.alternates?.length);
  let imageNamespace = hasImages
    ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    : "";
  let xhtmlNamespace = hasAlternates
    ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"'
    : "";
  let body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNamespace}${xhtmlNamespace}>\n${entries.map(renderUrl).join("\n")}\n</urlset>`;
  return new Response(body, { headers: XML_HEADERS });
}

function renderUrl(url: SitemapUrl): string {
  let fields = [`    <loc>${escapeXml(url.location)}</loc>`];
  if (url.lastModified) {
    fields.push(`    <lastmod>${escapeXml(url.lastModified)}</lastmod>`);
  }
  fields.push(
    `    <changefreq>${url.changeFrequency ?? "weekly"}</changefreq>`,
  );
  for (let alternate of url.alternates ?? []) {
    fields.push(
      `    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${escapeXml(alternate.href)}" />`,
    );
  }
  if (url.image) {
    fields.push("    <image:image>");
    fields.push(
      `      <image:loc>${escapeXml(url.image.location)}</image:loc>`,
    );
    if (url.image.caption) {
      fields.push(
        `      <image:caption>${escapeXml(url.image.caption)}</image:caption>`,
      );
    }
    fields.push("    </image:image>");
  }
  return `  <url>\n${fields.join("\n")}\n  </url>`;
}

function escapeXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[character]!,
  );
}
