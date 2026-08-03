/**
 * Tests for the standalone Technique -> static HTML renderer.
 *
 * A technique carries no color values, so these focus on the text sections
 * (purpose, prerequisites, tools, steps, parameters, paint-class suitability,
 * problems, safety, citations, variants), security-critical escaping,
 * self-containment, and rendering the whole comprehensive example.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTechniqueDocument, type TechniqueDocument } from '../technique';
import { renderTechniqueHtml } from './technique-html';
import { renderDocumentHtml } from './index';

const comprehensive = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../../examples/technique/v1/comprehensive.valid.json', import.meta.url),
    ),
    'utf8',
  ),
) as unknown;

/** A minimal valid technique, overridable per test. */
function makeTechnique(overrides: Partial<TechniqueDocument> = {}): TechniqueDocument {
  return parseTechniqueDocument({
    spec: 'technique',
    specVersion: '1.0.0',
    id: 'https://example.org/t/1',
    revision: 'rev-1',
    title: 'Test technique',
    purpose: 'Do a thing well.',
    ...overrides,
  });
}

describe('renderTechniqueHtml', () => {
  it('renders a complete, self-contained HTML document with the purpose', () => {
    const html = renderTechniqueHtml(makeTechnique());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Test technique</title>');
    expect(html).toContain('<h1>Test technique</h1>');
    expect(html).toContain('Do a thing well.'); // purpose
    expect(html).toContain('<style>');
    expect(html).not.toMatch(/<link\b/);
    expect(html).not.toMatch(/<script\b/);
    expect(html).not.toMatch(/src\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/@import/);
    expect(html).toContain('BrushCodex technique v1.0.0'); // footer
    // A technique carries no color, so the footer omits the swatch caveat.
    expect(html).not.toContain('physical measurements');
  });

  it('escapes HTML in every document-derived string (XSS safety)', () => {
    const html = renderTechniqueHtml(
      makeTechnique({
        title: 'Evil <script>alert(1)</script>',
        purpose: 'purpose "><img src=x onerror=alert(2)>',
        safetyNotes: ['</li><script>alert(3)</script>'],
      }),
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(3)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(2)>');
    expect(html).toContain('Evil &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toMatch(/<script\b/);
    expect(html).not.toMatch(/<img\b/);
  });

  it('renders prerequisites, tools, steps, and parameters', () => {
    const html = renderTechniqueHtml(
      makeTechnique({
        prerequisites: ['Brush control'],
        tools: [
          { name: 'Fine brush', kind: 'tool' },
          { name: 'Wet palette', optional: true },
        ],
        steps: [{ instruction: 'Thin the paint.', note: 'Less is more.' }],
        parameters: [{ name: 'Thinning', guidance: 'until it flows', typicalValue: '~1:1' }],
      }),
    );
    expect(html).toContain('Prerequisites');
    expect(html).toContain('Brush control');
    expect(html).toContain('Tools &amp; materials');
    expect(html).toContain('Fine brush');
    expect(html).toContain('optional'); // the optional tool badge
    expect(html).toContain('Thin the paint.');
    expect(html).toContain('Less is more.');
    expect(html).toContain('Thinning');
    expect(html).toContain('~1:1');
  });

  it('labels suitable and unsuitable paint classes by section (not color-only)', () => {
    const html = renderTechniqueHtml(
      makeTechnique({
        suitablePaintClasses: ['acrylic', 'contrast'],
        unsuitablePaintClasses: ['enamel'],
      }),
    );
    expect(html).toContain('Suitable');
    expect(html).toContain('Not suitable');
    expect(html).toContain('Acrylic');
    expect(html).toContain('Contrast');
    expect(html).toContain('Enamel');
  });

  it('renders problems, safety notes, citations, and variants', () => {
    const html = renderTechniqueHtml(
      makeTechnique({
        commonProblems: [{ problem: 'Chalky lines', correction: 'Thin further.' }],
        safetyNotes: ['Wash brushes promptly.'],
        citations: [{ text: 'A guide', url: 'https://example.org/guide' }],
        variants: [{ name: 'Two-tone', summary: 'Two edges.', note: 'More contrast.' }],
      }),
    );
    expect(html).toContain('Chalky lines');
    expect(html).toContain('Fix: Thin further.');
    expect(html).toContain('Wash brushes promptly.');
    // Citation is a labelled link, not embedded content.
    expect(html).toContain('href="https://example.org/guide"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('Two-tone');
    expect(html).toContain('More contrast.');
  });

  it('never turns an unsafe-scheme citation URL into a clickable href', () => {
    const html = renderTechniqueHtml(
      makeTechnique({
        citations: [
          { text: 'malicious', url: 'javascript:alert(1)' },
          { text: 'legit', url: 'https://example.org/guide' },
        ],
      }),
    );
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain('malicious'); // shown as inert text
    expect(html).toContain('href="https://example.org/guide"');
  });

  it('omits sections that are absent', () => {
    const html = renderTechniqueHtml(makeTechnique());
    expect(html).not.toContain('Prerequisites');
    expect(html).not.toContain('Safety notes');
    expect(html).not.toContain('Variants');
  });

  it('renders the whole comprehensive example without throwing', () => {
    const html = renderTechniqueHtml(parseTechniqueDocument(comprehensive));
    expect(html).toContain('Edge highlighting');
    expect(html).toContain('Brush control'); // prerequisite
    expect(html).toContain('Two-tone edge'); // variant name
    expect(html).not.toMatch(/<script\b/);
  });
});

describe('renderDocumentHtml dispatcher', () => {
  it('dispatches a technique document to the technique renderer', () => {
    const html = renderDocumentHtml(makeTechnique());
    expect(html).toContain('<h1>Test technique</h1>');
    expect(html).toContain('BrushCodex technique v1.0.0');
  });
});
