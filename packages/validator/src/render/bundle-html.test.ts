/**
 * Tests for the standalone Bundle -> static site renderer.
 *
 * A bundle is built in-memory (writeBundle), read + validated (readBundle), then
 * rendered to a set of self-contained HTML files. These cover the index overview
 * (every document linked and rendered, media listed), the
 * per-document pages, filename derivation, escaping, and self-containment.
 */

import { describe, expect, it } from 'vitest';
import { readBundle, writeBundle, type BundleEntrySpec } from '../bundle';
import { bundleDocFileName, renderBundleSite } from './bundle-html';

const recipe = {
  spec: 'recipe',
  specVersion: '1.0.0',
  id: 'https://example.org/r/1',
  revision: 'rev-1',
  title: 'Red armour',
  steps: [{ instruction: 'Basecoat red.' }],
};

const palette = {
  spec: 'palette',
  specVersion: '1.0.0',
  id: 'https://example.org/p/1',
  revision: 'rev-1',
  title: 'Rust palette',
  entries: [{ name: 'Rust', color: { hex: '#8a4b2f' } }],
};

const technique = {
  spec: 'technique',
  specVersion: '1.0.0',
  id: 'https://example.org/t/1',
  revision: 'rev-1',
  title: 'Edge highlighting',
  purpose: 'Define edges with a fine line.',
};

const inventory = {
  spec: 'inventory',
  specVersion: '1.0.0',
  id: 'urn:uuid:9b8c7d6e-5f40-4132-8a24-b3c4d5e6f708',
  revision: 'rev-1',
  title: 'My paints',
  items: [{ paint: { manufacturer: 'Some Brand', name: 'Steel' }, quantity: 1 }],
};

/** Build + read a bundle with the given documents (and one optional media file). */
function siteFor(
  documents: Array<{ path: string; spec: BundleEntrySpec; document: unknown }>,
  opts: { title?: string; withMedia?: boolean } = {},
): ReturnType<typeof renderBundleSite> {
  const zip = writeBundle({
    id: 'urn:uuid:00000000-0000-4000-8000-0000000000ab',
    title: opts.title ?? 'Sample bundle',
    summary: 'A packaged set of documents.',
    documents,
    media: opts.withMedia
      ? [{ path: 'media/shot.png', mediaType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }]
      : undefined,
  });
  return renderBundleSite(readBundle(zip));
}

/** The index.html file — always first; asserts presence for the type checker. */
function indexFile(files: ReturnType<typeof renderBundleSite>): { name: string; html: string } {
  const index = files[0];
  if (index === undefined) throw new Error('bundle produced no index file');
  return index;
}

describe('renderBundleSite', () => {
  it('emits an index page plus one page per renderable document', () => {
    const files = siteFor([
      { path: 'recipes/red.brushrecipe.json', spec: 'recipe', document: recipe },
      { path: 'palettes/rust.brushpalette.json', spec: 'palette', document: palette },
      { path: 'techniques/edge.brushtechnique.json', spec: 'technique', document: technique },
    ]);
    const names = files.map((f) => f.name);
    expect(names[0]).toBe('index.html');
    expect(names).toContain('recipes_red.brushrecipe.html');
    expect(names).toContain('palettes_rust.brushpalette.html');
    expect(names).toContain('techniques_edge.brushtechnique.html');
    expect(files).toHaveLength(4); // index + 3 pages

    // Each page is a full self-contained document rendered from its spec.
    const recipePage = files.find((f) => f.name === 'recipes_red.brushrecipe.html');
    expect(recipePage?.html.startsWith('<!doctype html>')).toBe(true);
    expect(recipePage?.html).toContain('<h1>Red armour</h1>');
  });

  it('links renderable documents from the index and self-contains it', () => {
    const index = indexFile(
      siteFor([{ path: 'recipes/red.brushrecipe.json', spec: 'recipe', document: recipe }]),
    );
    expect(index.name).toBe('index.html');
    expect(index.html).toContain('<h1>Sample bundle</h1>');
    expect(index.html).toContain('A packaged set of documents.'); // summary
    expect(index.html).toContain('href="recipes_red.brushrecipe.html"');
    expect(index.html).toContain('Painting workflow');
    expect(index.html).toContain('Red armour'); // the linked title
    // Self-contained.
    expect(index.html).not.toMatch(/<link\b/);
    expect(index.html).not.toMatch(/<script\b/);
    expect(index.html).not.toMatch(/src\s*=\s*["']https?:/i);
  });

  it('renders a page for every document spec, inventory included', () => {
    // Inventory and Project used to be listed but not rendered, which left two of
    // the format's document types unreadable without an application.
    const files = siteFor([
      { path: 'recipes/red.brushrecipe.json', spec: 'recipe', document: recipe },
      { path: 'inventory/mine.brushinventory.json', spec: 'inventory', document: inventory },
    ]);
    const index = indexFile(files);
    expect(index.html).toContain('My paints');
    expect(index.html).toContain('href="inventory_mine.brushinventory.html"');
    expect(files.map((f) => f.name)).toContain('inventory_mine.brushinventory.html');
    expect(index.html).not.toContain('No renderer for this spec');

    // The rendered page is a real inventory page, not a placeholder.
    const page = files.find((f) => f.name === 'inventory_mine.brushinventory.html');
    expect(page?.html).toContain('Paints owned');
  });

  it('lists packaged media on the index', () => {
    const index = indexFile(
      siteFor([{ path: 'recipes/red.brushrecipe.json', spec: 'recipe', document: recipe }], {
        withMedia: true,
      }),
    );
    expect(index.html).toContain('Media');
    expect(index.html).toContain('media/shot.png');
    expect(index.html).toContain('image/png');
  });

  it('escapes a hostile bundle title on the index (XSS safety)', () => {
    const index = indexFile(
      siteFor([{ path: 'recipes/red.brushrecipe.json', spec: 'recipe', document: recipe }], {
        title: 'Evil <script>alert(1)</script>',
      }),
    );
    expect(index.html).not.toContain('<script>alert(1)</script>');
    expect(index.html).toContain('Evil &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(index.html).not.toMatch(/<script\b/);
  });

  it('disambiguates two entry paths that flatten to the same filename', () => {
    // `recipes/red…` and `recipes_red…` both flatten to `recipes_red.brushrecipe.html`.
    const files = siteFor([
      { path: 'recipes/red.brushrecipe.json', spec: 'recipe', document: recipe },
      { path: 'recipes_red.brushrecipe.json', spec: 'recipe', document: recipe },
    ]);
    const pageNames = files.filter((f) => f.name !== 'index.html').map((f) => f.name);
    // Two distinct pages are written (no silent overwrite).
    expect(new Set(pageNames).size).toBe(2);
    expect(pageNames).toContain('recipes_red.brushrecipe.html');
    expect(pageNames).toContain('recipes_red.brushrecipe-2.html');
    // The index links each to its own file.
    const [index] = files;
    expect(index?.html).toContain('href="recipes_red.brushrecipe.html"');
    expect(index?.html).toContain('href="recipes_red.brushrecipe-2.html"');
  });

  it('never lets a document overwrite the overview index.html', () => {
    // A document at path `index.json` flattens to `index.html` — the overview name.
    const files = siteFor([{ path: 'index.json', spec: 'recipe', document: recipe }]);
    const indexFiles = files.filter((f) => f.name === 'index.html');
    expect(indexFiles).toHaveLength(1); // exactly one index.html — the overview
    const [overview] = indexFiles;
    expect(overview?.html).toContain('<h1>Sample bundle</h1>'); // it is the overview, not the recipe
    // The document page got a disambiguated name and is still present.
    expect(files.map((f) => f.name)).toContain('index-2.html');
  });
});

describe('bundleDocFileName', () => {
  it('flattens a nested entry path to a safe .html filename', () => {
    expect(bundleDocFileName('recipes/red.brushrecipe.json')).toBe('recipes_red.brushrecipe.html');
    expect(bundleDocFileName('a/b/c.json')).toBe('a_b_c.html');
    expect(bundleDocFileName('top.brushpalette.json')).toBe('top.brushpalette.html');
  });

  it('never yields a path separator (no sub-directories, no traversal)', () => {
    const name = bundleDocFileName('deep/nested/path/doc.json');
    expect(name).not.toContain('/');
    expect(name).not.toContain('\\');
    expect(name).not.toContain('..');
  });
});
