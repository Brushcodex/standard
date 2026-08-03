/**
 * Renderer coverage: every value in a document reaches the reader.
 *
 * The reference renderers are how the project demonstrates that a BrushCodex
 * document is usable with no application present. A renderer that quietly omits
 * a defined member weakens exactly that claim — and it happened: `resources`,
 * `techniqueRefs`, `target.scale`/`substrate`, `paintRef.chemistry` and a
 * provenance `note` were all absent from the recipe page while the page looked
 * complete.
 *
 * So this walks each spec's comprehensive fixture and asserts that every leaf
 * value appears in the rendered HTML, escaped or humanised. Anything that must
 * NOT appear is listed below **with a reason** — the list is the point of the
 * test: adding to it is a deliberate act, and forgetting to render something is
 * not.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseRecipeDocument } from '../recipe';
import { parsePaletteDocument } from '../palette';
import { parseTechniqueDocument } from '../technique';
import { parseInventoryDocument } from '../inventory';
import { parseProjectDocument } from '../project';
import {
  renderInventoryHtml,
  renderPaletteHtml,
  renderProjectHtml,
  renderRecipeHtml,
  renderTechniqueHtml,
} from './index';

function readExample(relative: string): unknown {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../../../examples/${relative}`, import.meta.url)), 'utf8'),
  );
}

function escapeForCompare(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Values a renderer legitimately does not print verbatim. Each entry is a
 * JSON-Pointer-ish suffix or exact path, with the reason it is exempt.
 */
const EXEMPT: Array<{ match: RegExp; why: string }> = [
  { match: /^\/(spec|specVersion|id|revision|\$schema)$/, why: 'envelope plumbing, not content' },
  { match: /\/createdAt$/, why: 'only updatedAt is surfaced, to keep the meta list short' },
  { match: /^\/integrity\//, why: 'a content hash is machinery, not something to read' },
  { match: /^\/extensions\//, why: 'unknown extension payloads are preserved, never rendered' },
  { match: /^\/links\//, why: 'lineage URIs are identifiers; the media section carries the human link' },
  { match: /\/catalogueId$/, why: 'an external database id is not reader-facing' },
  { match: /\/ref$/, why: 'document-local anchors are resolved to labels' },
  { match: /\/paintRefs\/\d+$/, why: 'anchors are resolved to the paint label' },
  { match: /\/mix\/\d+\/paint$/, why: 'anchors are resolved to the paint label' },
  { match: /\/alternatives\/\d+\/paint$/, why: 'anchors are resolved to the paint label' },
  { match: /\/sequence\/\d+$/, why: 'palette relationship anchors are resolved to entry labels' },
  { match: /\/(role|type|sourceType|kind|substrate|method|status|condition)$/, why: 'closed vocabularies are printed as human labels' },
  { match: /\/visibility$/, why: 'only a private item or entry is badged; shareable is the default and badging it would be noise' },
  { match: /\/source\/label$/, why: 'a citation renders from its authoritative seconds, not the label' },
  { match: /\/source\/(startSeconds|endSeconds)$/, why: 'seconds are printed as a human timecode (6:12), which is the same fact' },
  { match: /\/license\/url$/, why: 'the licence is named; its URL is not a separate claim' },
  { match: /\/creator\/url$/, why: 'the creator is credited by name' },
  { match: /^\/language$/, why: 'the language becomes the lang attribute' },
];

function exemptionFor(path: string): string | undefined {
  return EXEMPT.find((rule) => rule.match.test(path))?.why;
}

/** Leaf values in the document, as [path, text] pairs worth checking. */
function leaves(node: unknown, path = ''): Array<[string, string]> {
  if (node === null || node === undefined) return [];
  if (Array.isArray(node)) return node.flatMap((item, i) => leaves(item, `${path}/${i}`));
  if (typeof node === 'object') {
    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
      leaves(value, `${path}/${key}`),
    );
  }
  if (typeof node === 'boolean') return [];
  const text = String(node);
  // Very short values (a number of parts, a one-letter code) match too loosely to
  // assert on; the members that carry them are covered by their own tests.
  return text.length >= 3 ? [[path, text]] : [];
}

const CASES = [
  {
    spec: 'recipe',
    document: parseRecipeDocument(readExample('recipe/v1/comprehensive.valid.json')),
    render: renderRecipeHtml as (doc: unknown) => string,
  },
  {
    spec: 'palette',
    document: parsePaletteDocument(readExample('palette/v1/comprehensive.valid.json')),
    render: renderPaletteHtml as (doc: unknown) => string,
  },
  {
    spec: 'technique',
    document: parseTechniqueDocument(readExample('technique/v1/comprehensive.valid.json')),
    render: renderTechniqueHtml as (doc: unknown) => string,
  },
  {
    spec: 'inventory',
    document: parseInventoryDocument(readExample('inventory/v1/comprehensive.valid.json')),
    render: renderInventoryHtml as (doc: unknown) => string,
  },
  {
    spec: 'project',
    document: parseProjectDocument(readExample('project/v1/comprehensive.valid.json')),
    render: renderProjectHtml as (doc: unknown) => string,
  },
];

describe('renderer coverage — nothing in a document is silently omitted', () => {
  for (const { spec, document, render } of CASES) {
    it(`${spec}: every value reaches the rendered page`, () => {
      const html = render(document);
      const lowered = html.toLowerCase();
      const missing = leaves(document)
        .filter(([path]) => exemptionFor(path) === undefined)
        .filter(([, text]) => {
          return (
            !lowered.includes(text.toLowerCase()) &&
            !lowered.includes(escapeForCompare(text).toLowerCase())
          );
        })
        .map(([path, text]) => `${path} = ${JSON.stringify(text.slice(0, 60))}`);

      expect(missing).toEqual([]);
    });
  }

  it('every exemption states why the value is not printed', () => {
    for (const rule of EXEMPT) {
      expect(rule.why.length).toBeGreaterThan(10);
    }
  });
});
