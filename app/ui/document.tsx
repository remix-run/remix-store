import { css, type Handle, type RemixNode } from "remix/ui";

import { DocumentAssetsProvider } from "./document-assets.tsx";

export interface DocumentProps {
  children?: RemixNode;
  description?: string;
  noIndex?: boolean;
  title: string;
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let {
      children,
      description = "Soft wear for engineers of all kinds",
      noIndex = false,
      title,
    } = handle.props;
    let assets = handle.context.get(DocumentAssetsProvider);

    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="description" content={description} />
          <meta
            name="robots"
            content={noIndex ? "noindex, nofollow" : "index, follow"}
          />
          <meta name="theme-color" content="#000000" />
          <link rel="icon" type="image/svg+xml" href="/remix-favicon.svg" />
          <style innerHTML={globalStyles}></style>
          {assets.css.map((attributes) => (
            <link {...attributes} rel="stylesheet" />
          ))}
          <script src={assets.entry} type="module"></script>
          {assets.js.map((attributes) => (
            <link {...attributes} rel="modulepreload" />
          ))}
          <title>{title}</title>
        </head>
        <body mix={bodyStyle}>{children}</body>
      </html>
    );
  };
}

const bodyStyle = css({
  background: "#000",
  color: "#fff",
  colorScheme: "dark",
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  lineHeight: 1.5,
  margin: 0,
  "& *": { boxSizing: "border-box" },
  "& a": { color: "#fff" },
  "& :focus-visible": { outline: "3px solid #ffdf5f", outlineOffset: "4px" },
});

const globalStyles = `
  @font-face {
    font-family: "Inter";
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url("/font/inter-roman-latin-var.woff2") format("woff2");
  }
  html { background: #000; color-scheme: dark; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
