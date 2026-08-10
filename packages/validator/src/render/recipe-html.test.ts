/**
 * Tests for the standalone Recipe -> static HTML renderer.
 *
 * The renderer is an independent consumer of the portable format: it takes a
 * validated Recipe document and returns a self-contained HTML page. These tests
 * cover the security-critical escaping, honest color labelling, the literal-paint
 * fallback, classified alternatives, and self-containment, and prove the whole
 * comprehensive example renders.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseRecipeDocument, type RecipeDocument } from '../recipe';
import { escapeHtml, renderRecipeHtml } from './recipe-html';

const comprehensive = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL('../../../../examples/recipe/v1/comprehensive.valid.json', import.meta.url),
    ),
    'utf8',
  ),
) as unknown;

/** A minimal valid recipe, overridable per test. */
function makeRecipe(overrides: Partial<RecipeDocument> = {}): RecipeDocument {
  return parseRecipeDocument({
    spec: 'recipe',
    specVersion: '1.0.0',
    id: 'https://example.org/r/1',
    revision: 'rev-1',
    title: 'Test recipe',
    steps: [{ instruction: 'Basecoat the model.' }],
    ...overrides,
  });
}

describe('renderRecipeHtml', () => {
  it('renders a complete, self-contained HTML document', () => {
    const html = renderRecipeHtml(makeRecipe());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>Test recipe</title>');
    expect(html).toContain('<h1>Test recipe</h1>');
    expect(html).toContain('Basecoat the model.');
    // Self-contained: inline styles, and no external resource references at all.
    expect(html).toContain('<style>');
    expect(html).not.toMatch(/<link\b/);
    expect(html).not.toMatch(/<script\b/);
    expect(html).not.toMatch(/src\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/@import/);
    // A recipe can carry color, so the swatch caveat belongs in the footer.
    expect(html).toContain('not physical measurements');
  });

  it('escapes HTML in every document-derived string (XSS safety)', () => {
    const html = renderRecipeHtml(
      makeRecipe({
        title: 'Evil <script>alert(1)</script>',
        description: 'desc "><img src=x onerror=alert(2)>',
        steps: [{ instruction: 'Paint </p><script>alert(3)</script> it' }],
        tags: ['<b>tag</b>'],
      }),
    );
    // No raw injected markup survives.
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(3)</script>');
    expect(html).not.toContain('<img src=x onerror=alert(2)>');
    expect(html).not.toContain('<b>tag</b>');
    // The text is present in escaped form.
    expect(html).toContain('Evil &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;tag&lt;/b&gt;');
    // The only <script>/<img> tokens that remain are escaped, not real tags.
    expect(html).not.toMatch(/<script\b/);
    expect(html).not.toMatch(/<img\b/);
  });

  it('escapes a hostile media caption and never embeds remote content', () => {
    // A media URL in a valid document is a schema-checked absolute URI (so it
    // cannot carry quotes/angle-brackets); the free-text caption is the real XSS
    // vector, and media is rendered as a labelled link, never an embedded <img>.
    const html = renderRecipeHtml(
      makeRecipe({
        steps: [
          {
            instruction: 'See reference.',
            media: [
              {
                url: 'https://example.org/base.jpg',
                kind: 'image',
                caption: '"><script>alert(1)</script>',
              },
            ],
          },
        ],
      }),
    );
    expect(html).not.toMatch(/<img\b/);
    expect(html).not.toContain('"><script>');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('href="https://example.org/base.jpg"');
  });

  it('never turns an unsafe-scheme media URL into a clickable href (renders inert text)', () => {
    const html = renderRecipeHtml(
      makeRecipe({
        steps: [
          {
            instruction: 'See references.',
            media: [
              { url: 'javascript:alert(document.domain)', caption: 'do not click' },
              { url: 'https://example.org/ok.jpg', caption: 'safe link' },
            ],
          },
        ],
      }),
    );
    // The javascript: URL is a schema-valid absolute URI but must never become an href.
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain('do not click'); // shown as inert text
    // A safe URL still links.
    expect(html).toContain('href="https://example.org/ok.jpg"');
  });

  it('renders a literal paint with no catalogue id or color, and no swatch', () => {
    const html = renderRecipeHtml(
      makeRecipe({
        paints: [{ ref: 'p1', manufacturer: 'Some Brand', name: 'Bonewhite' }],
        steps: [{ instruction: 'Basecoat.', paintRefs: ['p1'] }],
      }),
    );
    expect(html).toContain('Some Brand - Bonewhite');
    // No color -> no swatch element rendered (the class only appears in CSS).
    expect(html).not.toContain('class="swatch-box"');
    expect(html).not.toContain('class="swatch"');
  });

  it('pairs a color swatch with its hex text and provenance label (never color-only)', () => {
    const html = renderRecipeHtml(
      makeRecipe({
        paints: [
          {
            ref: 'steel',
            name: 'Steel',
            color: { hex: '#8A8D90' },
            provenance: [{ sourceType: 'manufacturer_digital_swatch', confidence: 'medium' }],
          },
        ],
        steps: [{ instruction: 'Basecoat.', paintRefs: ['steel'] }],
      }),
    );
    expect(html).toContain('background:#8a8d90'); // swatch fill (lowercased)
    expect(html).toContain('>#8a8d90<'); // paired hex text
    expect(html).toContain('manufacturer digital swatch, medium confidence'); // honest label
    expect(html).toContain('approximate'); // never presented as a measurement
  });

  it('draws no colour swatch for a non-paint kind, even when color is present', () => {
    // Common §5.6 / paintRef.kind: a renderer SHOULD NOT draw a colour swatch for a
    // component that does not determine the resulting colour. Before this rule was
    // implemented an `additive` carrying color.hex rendered a full swatch chip, so a
    // household diluent (or orange juice) read as a paint the colour engine would use.
    const html = renderRecipeHtml(
      makeRecipe({
        paints: [
          { ref: 'water', name: 'Tap water', kind: 'additive', color: { hex: '#FFA500' } },
          { ref: 'steel', name: 'Steel', kind: 'paint', color: { hex: '#8A8D90' } },
        ],
        steps: [{ instruction: 'Thin and apply.', paintRefs: ['water', 'steel'] }],
      }),
    );
    // The additive is still named and still badged — only its swatch is suppressed.
    expect(html).toContain('Tap water');
    expect(html).toContain('>additive<');
    expect(html).not.toContain('background:#ffa500');
    expect(html).not.toContain('>#ffa500<');
    // The paint beside it is unaffected.
    expect(html).toContain('background:#8a8d90');
  });

  it('resolves step paint anchors and mixtures to their declared paint labels', () => {
    const html = renderRecipeHtml(
      makeRecipe({
        paints: [
          { ref: 'steel', name: 'Steel' },
          { ref: 'bone', name: 'Bonewhite' },
        ],
        steps: [
          {
            instruction: 'Edge highlight.',
            mix: [
              { paint: 'steel', parts: 3 },
              { paint: 'bone', parts: 1 },
            ],
          },
        ],
      }),
    );
    expect(html).toContain('Steel');
    expect(html).toContain('Bonewhite');
    expect(html).toContain('3 part(s)');
  });

  it('labels each alternative with its classified type, kept distinct', () => {
    const html = renderRecipeHtml(
      makeRecipe({
        paints: [
          { ref: 'rust', name: 'Rust' },
          { ref: 'bone', name: 'Bone' },
        ],
        steps: [
          {
            instruction: 'Wash.',
            paintRefs: ['rust'],
            alternatives: [
              { type: 'mathematical', paint: 'bone', note: 'nearest by CIEDE2000' },
              {
                type: 'verified_practical',
                paintRef: { manufacturer: 'Some Brand', name: 'Corrosion' },
              },
            ],
          },
        ],
      }),
    );
    expect(html).toContain('mathematical (color distance)');
    expect(html).toContain('verified practical');
    expect(html).toContain('nearest by CIEDE2000');
    expect(html).toContain('Some Brand - Corrosion');
  });

  it('surfaces envelope metadata (license, authors, difficulty, revision)', () => {
    const html = renderRecipeHtml(
      makeRecipe({
        difficulty: 'intermediate',
        authors: [{ name: 'A. Painter', role: 'author' }],
        license: { spdxId: 'CC-BY-4.0' },
      }),
    );
    expect(html).toContain('intermediate');
    expect(html).toContain('A. Painter');
    expect(html).toContain('CC-BY-4.0');
    expect(html).toContain('rev-1'); // revision is always shown
  });

  it('credits the cited work separately from the recipe, and never embeds it', () => {
    const html = renderRecipeHtml(
      makeRecipe({
        license: { spdxId: 'CC-BY-4.0' },
        media: [
          {
            id: 'tutorial',
            url: 'https://example.org/videos/tutorial',
            kind: 'video',
            relation: 'source',
            caption: 'The tutorial these steps came from',
            creator: { name: 'Example Painting Academy' },
            license: { spdxId: 'NOASSERTION' },
            rightsNote: 'Linked with permission.',
          },
        ],
      }),
    );
    expect(html).toContain('Source &amp; media');
    expect(html).toContain('By Example Painting Academy');
    expect(html).toContain('NOASSERTION'); // the linked work's licence, shown as its own
    expect(html).toContain('Linked with permission.');
    expect(html).toContain('href="https://example.org/videos/tutorial"');
    // A link, never an embed: rendering the page loads nothing remote.
    expect(html).not.toMatch(/<iframe\b/);
    expect(html).not.toMatch(/<video\b/);
  });

  it('renders a step citation from its seconds, not the author-written label', () => {
    const html = renderRecipeHtml(
      makeRecipe({
        media: [
          {
            id: 'tutorial',
            url: 'https://example.org/videos/tutorial',
            relation: 'source',
            caption: 'Tutorial',
          },
        ],
        steps: [
          {
            instruction: 'Basecoat the model.',
            // A label that disagrees with the seconds must not win.
            source: {
              media: 'tutorial',
              startSeconds: 3725,
              endSeconds: 3750,
              label: 'about an hour in',
            },
          },
          { instruction: 'Wash the recesses.', source: { startSeconds: 62.5 } },
        ],
      }),
    );
    expect(html).toContain('1:02:05–1:02:30 of'); // past an hour: H:MM:SS
    expect(html).toContain('1:02.5'); // fractional seconds survive the format
    expect(html).not.toContain('about an hour in');
    // Deep-linking to the moment needs provider-specific syntax, so the portable
    // renderer links the work itself and states the offset.
    expect(html).not.toContain('?t=');
  });

  it('renders an unresolvable citation as a bare offset rather than guessing a work', () => {
    // Deliberately NOT parsed: the reference validator rejects this document
    // (`media-citation-resolves`). The renderer must still degrade safely for a
    // consumer that renders first and validates elsewhere.
    const unvalidated: RecipeDocument = {
      spec: 'recipe',
      specVersion: '1.0.0',
      id: 'https://example.org/r/1',
      revision: 'rev-1',
      title: 'Test recipe',
      media: [
        { id: 'a', url: 'https://example.org/a', relation: 'reference' },
        { id: 'b', url: 'https://example.org/b', relation: 'reference' },
      ],
      steps: [{ instruction: 'Basecoat the model.', source: { startSeconds: 90 } }],
    };
    const html = renderRecipeHtml(unvalidated);
    expect(html).toContain('<strong>Source:</strong> 1:30</p>');
    // The offset is shown, but no work is attributed to it by guesswork.
    expect(html).not.toContain('1:30 of');
  });

  it('shows credit prose and a prose mixture without turning either into structure', () => {
    const html = renderRecipeHtml(
      makeRecipe({
        attribution: 'Based on a club tutorial; posted with permission.',
        authors: [{ name: 'A. Painter' }],
        license: { spdxId: 'CC-BY-4.0' },
        paints: [{ ref: 'a', name: 'Alpha' }, { ref: 'b', name: 'Beta' }],
        steps: [
          {
            instruction: 'Glaze the recess.',
            mixNote: 'One part Alpha to four parts water.',
          },
          {
            instruction: 'Edge highlight.',
            mix: [
              { paint: 'a', parts: 3 },
              { paint: 'b', parts: 1 },
            ],
            mixNote: '3:1 Alpha to Beta, thinned.',
          },
        ],
      }),
    );
    // Credit appears next to authors and licence, all three distinct.
    expect(html).toContain('Attribution');
    expect(html).toContain('Based on a club tutorial; posted with permission.');
    expect(html).toContain('A. Painter');
    expect(html).toContain('CC-BY-4.0');
    // A prose-only mixture still reaches the reader...
    expect(html).toContain('One part Alpha to four parts water.');
    // ...and where both exist, the structured ratios are shown as well, not replaced.
    expect(html).toContain('3 part(s)');
    expect(html).toContain('3:1 Alpha to Beta, thinned.');
  });

  it('renders the whole comprehensive example without throwing', () => {
    const html = renderRecipeHtml(parseRecipeDocument(comprehensive));
    expect(html).toContain('Rusty power armour');
    expect(html).toContain('Base metal'); // step title
    expect(html).toContain('Edge highlight'); // step role label
    expect(html).toContain('After the steel basecoat'); // media caption
    // The extension's inner content is not rendered as executable markup.
    expect(html).not.toMatch(/<script\b/);
  });
});

describe('escapeHtml', () => {
  it('escapes the five significant HTML characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('is idempotent-safe on already-plain text', () => {
    expect(escapeHtml('plain text 123')).toBe('plain text 123');
  });
});
