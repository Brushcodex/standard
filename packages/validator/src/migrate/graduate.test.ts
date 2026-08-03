/**
 * Extension graduation: documents written before a value moved into the core keep their meaning,
 * and gain it back where every consumer can see it.
 *
 * The rules under test are the ones that make this safe to run on someone else's data: never
 * overwrite what the document already says, never invent a grammar, never leave a fact in two
 * places, and always report what did not move and why.
 */

import { describe, expect, it } from 'vitest';
import { parseRecipeDocument, type RecipeDocument } from '../recipe';
import { graduateRecipeDocument, readClockTimecode } from './graduate';

function makeRecipe(overrides: Partial<RecipeDocument> = {}): RecipeDocument {
  return parseRecipeDocument({
    spec: 'recipe',
    specVersion: '1.0.0',
    id: 'https://example.org/r/1',
    revision: 'rev-1',
    title: 'Test recipe',
    steps: [{ id: 's1', instruction: 'Basecoat.' }, { id: 's2', instruction: 'Wash.' }],
    ...overrides,
  });
}

describe('graduateRecipeDocument — reference-application extensions', () => {
  const legacy = () =>
    makeRecipe({
      extensions: {
        'org.brushcodex.recipe:attribution': 'Based on a club tutorial',
        'org.brushcodex.recipe:sourceUrl': 'https://example.org/videos/tutorial',
        'org.brushcodex.recipe:stepDetails': [
          { order: 0, area: 'panel edges', mixture: '1:1 Caliban + Moot', timecode: '0:45-1:10' },
        ],
      },
    });

  it('recovers credit, the cited work, and per-step prose into core members', () => {
    const { document, moved } = graduateRecipeDocument(legacy(), {
      readTimecode: readClockTimecode,
    });

    expect(document.attribution).toBe('Based on a club tutorial');
    expect(document.media).toEqual([
      { id: 'source', url: 'https://example.org/videos/tutorial', relation: 'source' },
    ]);
    expect(document.steps[0]?.targetArea).toBe('panel edges');
    expect(document.steps[0]?.mixNote).toBe('1:1 Caliban + Moot');
    expect(document.steps[0]?.source).toEqual({ media: 'source', startSeconds: 45, endSeconds: 70 });
    expect(moved.map((change) => change.code).sort()).toEqual([
      'area-to-target-area',
      'attribution-to-envelope',
      'mixture-to-mix-note',
      'source-url-to-media',
      'timecode-to-citation',
    ]);
  });

  it('leaves one fact in one place — the emptied extension is gone', () => {
    const { document } = graduateRecipeDocument(legacy(), { readTimecode: readClockTimecode });
    expect(document.extensions).toBeUndefined();
  });

  it('still produces a conformant document, and is a no-op the second time', () => {
    const first = graduateRecipeDocument(legacy(), { readTimecode: readClockTimecode });
    expect(() => parseRecipeDocument(first.document)).not.toThrow();

    const second = graduateRecipeDocument(first.document, { readTimecode: readClockTimecode });
    expect(second.moved).toEqual([]);
    expect(second.document).toEqual(first.document);
  });

  it('never mutates the input', () => {
    const input = legacy();
    const snapshot = structuredClone(input);
    graduateRecipeDocument(input, { readTimecode: readClockTimecode });
    expect(input).toEqual(snapshot);
  });

  it('refuses to guess a timecode grammar unless one is supplied', () => {
    const { document, unmoved } = graduateRecipeDocument(legacy());
    expect(document.steps[0]?.source).toBeUndefined();
    expect(unmoved[0]?.code).toBe('timecode-needs-reader');
    // Refused, not discarded: the value is still in the extension.
    const details = document.extensions?.['org.brushcodex.recipe:stepDetails'] as Array<
      Record<string, unknown>
    >;
    expect(details[0]?.timecode).toBe('0:45-1:10');
  });

  it('reports a timecode its reader cannot read, and keeps it', () => {
    const doc = makeRecipe({
      extensions: {
        'org.brushcodex.recipe:sourceUrl': 'https://example.org/v',
        'org.brushcodex.recipe:stepDetails': [{ order: 0, timecode: 'somewhere near the end' }],
      },
    });
    const { document, unmoved } = graduateRecipeDocument(doc, { readTimecode: readClockTimecode });
    expect(unmoved.map((change) => change.code)).toContain('timecode-unreadable');
    const details = document.extensions?.['org.brushcodex.recipe:stepDetails'] as Array<
      Record<string, unknown>
    >;
    expect(details[0]?.timecode).toBe('somewhere near the end');
  });

  it('lets the document win over its own history', () => {
    const doc = makeRecipe({
      attribution: 'Credit the document states for itself',
      media: [{ id: 'own', url: 'https://example.org/own', relation: 'source' }],
      extensions: {
        'org.brushcodex.recipe:attribution': 'Stale credit from an extension',
        'org.brushcodex.recipe:sourceUrl': 'https://example.org/stale',
      },
    });
    const { document, moved, unmoved } = graduateRecipeDocument(doc);

    expect(document.attribution).toBe('Credit the document states for itself');
    expect(document.media?.[0]?.url).toBe('https://example.org/own');
    expect(moved).toEqual([]);
    expect(unmoved.map((change) => change.code).sort()).toEqual([
      'attribution-already-core',
      'source-url-already-core',
    ]);
  });

  it('refuses a source URL that could not be a valid media entry', () => {
    const doc = makeRecipe({
      extensions: { 'org.brushcodex.recipe:sourceUrl': 'the DVD that came with the box' },
    });
    const { document, unmoved } = graduateRecipeDocument(doc);
    expect(document.media).toBeUndefined();
    expect(unmoved[0]?.code).toBe('source-url-unusable');
    expect(document.extensions?.['org.brushcodex.recipe:sourceUrl']).toBe(
      'the DVD that came with the box',
    );
  });
});

describe('graduateRecipeDocument — Creator Assistant extraction', () => {
  const extracted = () =>
    makeRecipe({
      extensions: {
        'org.brushcodex.creator:extraction': {
          toolVersion: 'packet-map-v2',
          source: {
            url: 'https://www.youtube.com/watch?v=QkFOxQdVgJE',
            videoId: 'QkFOxQdVgJE',
            title: 'How to paint a Voidshadow Legionary',
            creator: 'Example Painting Academy',
            authorization: { permissionStatus: 'Not Contacted', publicationApproved: false },
          },
          steps: [
            { stepId: 's1', order: 1, timestampStart: '00:00:54', timestampEnd: '00:01:05' },
            { stepId: 's2', order: 2, startSeconds: 120, endSeconds: 145 },
          ],
        },
      },
    });

  it('recovers the cited work WITH its recorded creator, but never a licence', () => {
    const { document } = graduateRecipeDocument(extracted(), { readTimecode: readClockTimecode });
    expect(document.media).toEqual([
      {
        id: 'source',
        url: 'https://www.youtube.com/watch?v=QkFOxQdVgJE',
        kind: 'video',
        relation: 'source',
        caption: 'How to paint a Voidshadow Legionary',
        creator: { name: 'Example Painting Academy' },
      },
    ]);
    // An authorization record is permission to extract, not a licence grant.
    expect(document.media?.[0]?.license).toBeUndefined();
  });

  it('graduates numeric seconds directly and clock strings through the reader', () => {
    const { document } = graduateRecipeDocument(extracted(), { readTimecode: readClockTimecode });
    expect(document.steps[0]?.source).toEqual({ media: 'source', startSeconds: 54, endSeconds: 65 });
    expect(document.steps[1]?.source).toEqual({
      media: 'source',
      startSeconds: 120,
      endSeconds: 145,
    });
  });

  it('keeps the extraction trace — it records the run, which no core member represents', () => {
    const { document } = graduateRecipeDocument(extracted(), { readTimecode: readClockTimecode });
    const extraction = document.extensions?.['org.brushcodex.creator:extraction'] as Record<
      string,
      unknown
    >;
    expect(extraction).toBeDefined();
    expect((extraction.source as Record<string, unknown>).videoId).toBe('QkFOxQdVgJE');
    expect(extraction.toolVersion).toBe('packet-map-v2');
  });

  it('produces a document the reference validator accepts', () => {
    const { document } = graduateRecipeDocument(extracted(), { readTimecode: readClockTimecode });
    expect(() => parseRecipeDocument(document)).not.toThrow();
  });
});

describe('readClockTimecode', () => {
  it('reads a moment and a range, and refuses anything else', () => {
    expect(readClockTimecode('2:05')).toEqual({ startSeconds: 125 });
    expect(readClockTimecode('1:02:05')).toEqual({ startSeconds: 3725 });
    expect(readClockTimecode('1:00 to 1:35')).toEqual({ startSeconds: 60, endSeconds: 95 });
    // A range that does not run forwards is not a range; the start still stands.
    expect(readClockTimecode('1:35-1:00')).toEqual({ startSeconds: 95 });
    for (const bad of ['', 'near the end', '90', '1:60']) {
      expect(readClockTimecode(bad)).toBeNull();
    }
  });
});
