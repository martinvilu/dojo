import { Marked, type Tokens } from "marked";

/**
 * Markdown renderer for user-authored content (announcements, class
 * descriptions, synced Moodle summaries) injected with
 * dangerouslySetInnerHTML.
 *
 * `marked` passes raw HTML and any link scheme through untouched, so a
 * `<img onerror>` or `[x](javascript:...)` in a description ran in every
 * reader's session. This instance:
 *   - renders raw HTML blocks and inline tags as escaped text,
 *   - only emits links to http(s), mailto, in-page anchors and relative
 *     paths (anything else is rendered as plain text),
 *   - only emits images served over http(s).
 * It is dependency-free, so it behaves the same during SSR and in the
 * browser.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Decodes numeric and common named entities so schemes can't hide behind them. */
function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&colon;?/gi, ":")
    .replace(/&tab;?|&newline;?/gi, "");
}

const ALLOWED_LINK_SCHEMES = new Set(["http:", "https:", "mailto:"]);
const ALLOWED_IMAGE_SCHEMES = new Set(["http:", "https:"]);

/** Returns true when `href` is relative or uses one of the allowed schemes. */
export function isSafeHref(href: string, allowed: Set<string> = ALLOWED_LINK_SCHEMES): boolean {
  // Browsers ignore control characters and whitespace inside schemes.
  const normalized = decodeEntities(String(href ?? "")).replace(/[\u0000-\u0020\u007f]/g, "");
  if (!normalized) return false;
  const scheme = normalized.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!scheme) return true; // relative path, anchor or protocol-relative URL
  return allowed.has(scheme[1].toLowerCase() + ":");
}

const safeMarked = new Marked({
  gfm: true,
  async: false,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    link(this: any, { href, title, tokens }: Tokens.Link) {
      const label = this.parser.parseInline(tokens);
      if (!isSafeHref(href)) return label;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a href="${escapeHtml(href)}"${titleAttr} target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
    },
    image({ href, title, text }: Tokens.Image) {
      if (!isSafeHref(href, ALLOWED_IMAGE_SCHEMES) || !/^https?:/i.test(href.trim())) {
        return escapeHtml(text);
      }
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttr} loading="lazy" referrerpolicy="no-referrer">`;
    },
  },
});

/** Renders untrusted Markdown to HTML that is safe to inject. */
export function renderMarkdown(source: string | null | undefined): string {
  return safeMarked.parse(String(source ?? ""), { async: false }) as string;
}
