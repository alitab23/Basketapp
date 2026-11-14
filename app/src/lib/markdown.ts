import { marked } from 'marked';
import DOMPurify from 'dompurify';

/** Markdown → sanitised HTML. Loaded lazily together with the block details. */
export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false, breaks: true, gfm: true });
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
