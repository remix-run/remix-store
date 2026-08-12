import { css, type Handle, type RemixNode } from "remix/ui";

interface RichTextProps {
  variant?: "product-description";
  value: string;
}

type RichTextNode = {
  bold?: boolean;
  children?: RichTextNode[];
  italic?: boolean;
  level?: number;
  listType?: string;
  type?: string;
  underline?: boolean;
  url?: string;
  value?: string;
};

export function RichText(handle: Handle<RichTextProps>) {
  let root = parseRichText(handle.props.value);
  return () => (
    <div
      data-rich-text="true"
      mix={[
        richTextStyle,
        handle.props.variant === "product-description"
          ? productDescriptionStyle
          : undefined,
      ]}
    >
      {renderNodes(root.children ?? [])}
    </div>
  );
}

function parseRichText(value: string): RichTextNode {
  try {
    let parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? (parsed as RichTextNode) : { children: [] };
  } catch {
    return {
      children: [{ type: "paragraph", children: [{ type: "text", value }] }],
    };
  }
}

function renderNodes(nodes: RichTextNode[]): RemixNode[] {
  return nodes.map((node, index) => renderNode(node, index));
}

function renderNode(node: RichTextNode, key: number): RemixNode {
  let children = renderNodes(node.children ?? []);
  switch (node.type) {
    case "text": {
      let content: RemixNode = node.value ?? "";
      if (node.bold) content = <strong>{content}</strong>;
      if (node.italic) content = <em>{content}</em>;
      if (node.underline) content = <u>{content}</u>;
      return <span key={key}>{content}</span>;
    }
    case "paragraph":
      return <p key={key}>{children.length ? children : <br />}</p>;
    case "heading":
      return node.level === 3 ? (
        <h3 key={key}>{children}</h3>
      ) : (
        <h2 key={key}>{children}</h2>
      );
    case "list":
    case "unordered-list":
      return <ul key={key}>{children}</ul>;
    case "ordered-list":
      return <ol key={key}>{children}</ol>;
    case "list-item":
      return <li key={key}>{children}</li>;
    case "link": {
      let href = safeHref(node.url);
      return href ? (
        <a
          key={key}
          href={href}
          rel={href.startsWith("http") ? "noreferrer" : undefined}
        >
          {children}
        </a>
      ) : (
        <span key={key}>{children}</span>
      );
    }
    default:
      return <span key={key}>{children}</span>;
  }
}

function safeHref(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("/") || value.startsWith("#")) return value;
  try {
    let url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

const richTextStyle = css({
  fontSize: "1rem",
  lineHeight: 1.5,
  "& h2, & h3, & ol, & p, & ul": { margin: "0 0 12px" },
  "& ul li": {
    lineHeight: "1.6em",
    paddingLeft: "1em",
    position: "relative",
  },
  "& ul li::before": { content: '"•"', left: 0, position: "absolute" },
  "& a": { color: "var(--color-blue-brand)" },
});

const productDescriptionStyle = css({
  fontSize: ".75rem",
  lineHeight: "16px",
  "@media (min-width: 1400px)": { fontSize: "1rem", lineHeight: 1.4 },
});
