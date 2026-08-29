/**
 * Tests for the standalone Palette -> static HTML renderer.
 *
 * Mirrors the recipe renderer tests: security-critical escaping, honest color
 * labelling, the literal-paint / literal-color entries, mixtures and
 * relationships resolving to entry names, self-containment, and rendering the
 * whole comprehensive example.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parsePaletteDocument, type PaletteDocument } from '../palette';
import { renderPaletteHtml } from './palette-html';
import { renderDocumentHtml } from './index';

const comprehensive = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../../examples/palette/v1/comprehensive.valid.json', import.meta.url),
    ),
    'utf8',
  ),
) as unknown;

/** A minimal valid palette, overridable per test. */
function makePalette(overrides: Partial<PaletteDocument> = {}): PaletteDocument {
  return parsePaletteDocument({
    spec: 'palette',
    specVersion: '1.0.0',
    id: 'https://example.org/p/1',
    revision: 'rev-1',
    title: 'Test palette',
    entries: [{ name: 'Base', color: { hex: '#112233' } }],
    ...overrides,
  });
}

describe('renderPaletteHtml', () => {
  it('renders a complete, self-contained HTML document', () => {
    const html = renderPaletteHtml(makePalette());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Test palette</title>');
    expect(html).toContain('<h1>Test palette</h1>');
    expect(html).toContain('Entries'); // section heading
    expect(html).toContain('<style>');
    expect(html).not.toMatch(/<link\b/);
    expect(html).not.toMatch(/<script\b/);
    expect(html).not.toMatch(/src\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/@import/);
    // Footer names the palette spec.
    expect(html).toContain('BrushCodex palette v1.0.0');
  });

  it('escapes HTML in every document-derived string (XSS safety)', () => {
    const html = renderPaletteHtml(
      makePalette({
        title: 'Evil <script>alert(1)</script>',
        description: 'desc "><img src=x onerror=alert(2)>',
        entries: [{ name: '</li><script>alert(3)</script>', color: { hex: '#112233' } }],
        tags: ['<b>tag</b>'],
      }),
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(3)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(2)>');
    expect(html).not.toContain('<b>tag</b>');
    expect(html).toContain('Evil &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toMatch(/<script\b/);
    expect(html).not.toMatch(/<img\b/);
  });

  it('pairs a literal-color entry swatch with its hex + provenance (never color-only)', () => {
    const html = renderPaletteHtml(
      makePalette({
        entries: [
          {
            name: 'Rust',
            color: { hex: '#8A4B2F' },
            provenance: [{ sourceType: 'community_estimate', confidence: 'low' }],
          },
        ],
      }),
    );
    expect(html).toContain('background:#8a4b2f');
    expect(html).toContain('>#8a4b2f<');
    expect(html).toContain('community estimate, low confidence');
    expect(html).toContain('approximate');
  });

  it('renders a literal paint entry with no color and no swatch', () => {
    const html = renderPaletteHtml(
      makePalette({
        entries: [{ name: 'Chip', paint: { manufacturer: 'Some Brand', name: 'Bonewhite' } }],
      }),
    );
    expect(html).toContain('Some Brand - Bonewhite');
    expect(html).not.toContain('class="swatch-box"');
    expect(html).not.toContain('class="swatch"');
  });

  it('shows the paint color swatch when the entry paint carries one', () => {
    const html = renderPaletteHtml(
      makePalette({
        entries: [
          {
            name: 'Steel',
            paint: {
              name: 'Steel',
              color: { hex: '#8a8d90' },
              provenance: [{ sourceType: 'manufacturer_digital_swatch', confidence: 'medium' }],
            },
          },
        ],
      }),
    );
    expect(html).toContain('background:#8a8d90');
    expect(html).toContain('manufacturer digital swatch, medium confidence');
  });

  it('resolves mixture and relationship anchors to entry names', () => {
    const html = renderPaletteHtml(
      makePalette({
        entries: [
          { ref: 'steel', name: 'Base steel', color: { hex: '#8a8d90' } },
          { ref: 'bone', name: 'Chip highlight', paint: { name: 'Bonewhite' } },
          {
            name: 'Chipped edge mix',
            mix: [
              { paint: 'steel', parts: 3 },
              { paint: 'bone', parts: 1 },
            ],
          },
        ],
        relationships: [
          { type: 'shadow_to_highlight', sequence: ['steel', 'bone'], note: 'base to chip' },
        ],
      }),
    );
    // Mix resolves anchors to entry names.
    expect(html).toContain('Base steel');
    expect(html).toContain('Chip highlight');
    expect(html).toContain('Mix:');
    // Relationship label + resolved sequence.
    expect(html).toContain('Shadow to highlight');
    expect(html).toContain('base to chip');
  });

  it('labels an entry role', () => {
    const html = renderPaletteHtml(
      makePalette({ entries: [{ name: 'Base', role: 'basecoat', color: { hex: '#112233' } }] }),
    );
    expect(html).toContain('Basecoat');
  });

  it('renders the whole comprehensive example without throwing', () => {
    const html = renderPaletteHtml(parsePaletteDocument(comprehensive));
    expect(html).toContain('Rusted steel palette');
    expect(html).toContain('Base steel'); // entry name
    expect(html).toContain('Complementary'); // relationship label
    expect(html).not.toMatch(/<script\b/);
  });

  // The comprehensive palette deliberately targets a class and carries no
  // identity, so renderer coverage never walks these leaves. Without this the
  // Painted Subject could reach the page as an opaque id and nothing else.
  it('prints the Painted Subject literals, and not the opaque identifier', () => {
    const html = renderPaletteHtml(
      makePalette({
        target: {
          kind: 'miniature',
          description: 'The banner and heraldry of the Vanguard standard bearer, 32mm plastic',
          identity: {
            authority: 'Example Miniatures',
            designation: 'Vanguard Standard Bearer',
            qualifier: 'original sculpt; banner cast integral to the left arm',
            authorityId: 'VG-SB-01',
            subjectId: 'brushcodex:subject:example-miniatures/vanguard/standard-bearer',
          },
        },
      }),
    );
    expect(html).toContain('Subject');
    expect(html).toContain('Example Miniatures');
    expect(html).toContain('Vanguard Standard Bearer');
    expect(html).toContain('original sculpt; banner cast integral to the left arm');
    expect(html).toContain('VG-SB-01');
    // The stable id is a machine equality key, exempt exactly as catalogueId is.
    expect(html).not.toContain('brushcodex:subject:');
    // Applicability is not displaced by identity.
    expect(html).toContain('The banner and heraldry of the Vanguard standard bearer');
  });

  it('renders a target with no identity unchanged', () => {
    const html = renderPaletteHtml(
      makePalette({ target: { kind: 'miniature', description: '28mm heavy infantry' } }),
    );
    expect(html).toContain('28mm heavy infantry');
    expect(html).not.toContain('Subject');
  });
});

describe('renderDocumentHtml dispatcher', () => {
  it('dispatches a palette document to the palette renderer', () => {
    const html = renderDocumentHtml(makePalette());
    expect(html).toContain('<h1>Test palette</h1>');
    expect(html).toContain('BrushCodex palette v1.0.0');
  });
});
