import { describe, expect, it } from 'vitest';
import { markdownExcerpt } from './text';
import { renderMarkdown } from './markdown';

describe('markdownExcerpt', () => {
  it('strips markdown syntax', () => {
    expect(markdownExcerpt('## Syfte\n- **Snabba** fötter\n- [Video](https://x)')).toBe('Syfte Snabba fötter Video');
  });

  it('shortens long text', () => {
    expect(markdownExcerpt('a'.repeat(300), 10)).toBe('aaaaaaaaa…');
  });
});

describe('renderMarkdown', () => {
  it('renders headings and lists', () => {
    const html = renderMarkdown('# Rubrik\n1. ett\n2. två');
    expect(html).toContain('<h1>Rubrik</h1>');
    expect(html).toContain('<ol>');
  });

  it('removes scripts and event handlers', () => {
    const html = renderMarkdown('<script>alert(1)</script><a href="javascript:alert(1)" onclick="x()">x</a>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('javascript:');
  });
});
