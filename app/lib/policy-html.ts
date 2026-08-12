import sanitizeHtml from "sanitize-html";

/**
 * Shopify policy and page bodies are merchant-authored HTML. Preserve the
 * formatting needed for legal/contact content while removing executable or
 * layout-owning markup before it reaches the document.
 */
export function sanitizePolicyHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "a",
      "blockquote",
      "br",
      "caption",
      "code",
      "div",
      "em",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "li",
      "ol",
      "p",
      "pre",
      "s",
      "small",
      "span",
      "strong",
      "sub",
      "sup",
      "table",
      "tbody",
      "td",
      "tfoot",
      "th",
      "thead",
      "tr",
      "u",
      "ul",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target", "title"],
      ol: ["start"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      a(tagName, attributes) {
        if (attributes.target === "_blank") {
          attributes.rel = "noopener noreferrer";
        }
        return { tagName, attribs: attributes };
      },
    },
  });
}
