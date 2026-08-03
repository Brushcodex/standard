/**
 * Tests for the authoring helpers.
 *
 * The claim these make is narrow and worth pinning: a document produced by
 * `create*` has already passed the same two-layer check conformance applies, so
 * it cannot be born invalid; and a document produced by `reviseDocument` obeys
 * the envelope rule that editing MUST produce a new revision (common spec §4).
 *
 * Every source of non-determinism is injected, so the authored output is
 * byte-reproducible and the assertions below are exact rather than shape-only.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SPEC_NAMES, validateAnyDocument, type SpecName } from '../registry';
import { stampIntegrity, toCanonicalJson, verifyIntegrity } from '../common';
import {
  AuthoringError,
  DEFAULT_SPEC_VERSION,
  createDocument,
  createRecipe,
  newDocumentId,
  newRevision,
  reviseDocument,
} from './index';

/**
 * A fixed UUID source: deterministic, and distinct per call so tokens differ.
 * The counter varies the *leading* digits, because that is the part a revision
 * token's suffix is taken from — a double that varies only trailing digits
 * would mint colliding revisions that a real random UUID never would.
 */
function uuidSource(seed = 0): () => string {
  let n = seed;
  return () => {
    const hex = (n++).toString(16).padStart(4, '0');
    return `${hex}0000-0000-4000-8000-000000000000`;
  };
}

const NOW = '2026-07-15T14:00:00.000Z';

function readExample(relative: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`../../../../examples/${relative}`, import.meta.url)), 'utf8'),
  );
}

/** The corpus's minimal fixture for a spec, stripped back to an authorable draft. */
function minimalDraft(spec: SpecName): Record<string, unknown> {
  const { spec: _s, specVersion: _v, id: _i, revision: _r, ...draft } = readExample(
    `${spec}/v1/minimal.valid.json`,
  );
  return draft;
}

describe('minting', () => {
  it('mints a registry-free absolute URI as the document id', () => {
    expect(newDocumentId(uuidSource())).toBe('urn:uuid:00000000-0000-4000-8000-000000000000');
  });

  it('mints an opaque, second-precision revision token', () => {
    expect(newRevision(NOW, uuidSource())).toBe('rev-2026-07-15T14-00-00Z-000000');
  });

  it('mints distinct revisions within the same second', () => {
    const uuid = uuidSource();
    expect(newRevision(NOW, uuid)).not.toBe(newRevision(NOW, uuid));
  });

  it('rejects an unparseable timestamp rather than emitting a bad envelope', () => {
    expect(() => newRevision('not-a-date', uuidSource())).toThrow(AuthoringError);
  });
});

describe('createDocument', () => {
  it('authors a valid document for every specification', () => {
    for (const spec of SPEC_NAMES) {
      const document = createDocument(spec, minimalDraft(spec) as never, {
        now: NOW,
        uuid: uuidSource(),
      });
      const check = validateAnyDocument(document);
      expect(check.spec, `${spec} declared spec`).toBe(spec);
      expect(check.result.issues, `${spec} issues`).toEqual([]);
      expect(check.result.valid, `${spec} valid`).toBe(true);
    }
  });

  it('fills the envelope a producer would otherwise hand-roll', () => {
    const recipe = createRecipe(
      { title: 'Quick black basecoat', steps: [{ instruction: 'Prime black.' }] },
      { now: NOW, uuid: uuidSource() },
    );
    expect(recipe.spec).toBe('recipe');
    expect(recipe.specVersion).toBe(DEFAULT_SPEC_VERSION);
    expect(recipe.id).toBe('urn:uuid:00000000-0000-4000-8000-000000000000');
    expect(recipe.revision).toBe('rev-2026-07-15T14-00-00Z-000100');
    expect(recipe.createdAt).toBe(NOW);
    expect(recipe.updatedAt).toBe(NOW);
  });

  it('is byte-reproducible when the clock and uuid source are injected', () => {
    const draft = { title: 'Repeatable', steps: [{ instruction: 'Basecoat.' }] };
    const first = createRecipe(draft, { now: NOW, uuid: uuidSource() });
    const second = createRecipe(draft, { now: NOW, uuid: uuidSource() });
    expect(toCanonicalJson(first)).toBe(toCanonicalJson(second));
  });

  it('prefers an explicit draft member over an option and over minting', () => {
    const recipe = createRecipe(
      {
        title: 'Explicit',
        steps: [{ instruction: 'Basecoat.' }],
        id: 'https://example.org/brushcodex/recipes/explicit',
        revision: 'rev-hand-written',
      },
      { id: 'urn:uuid:ignored', revision: 'rev-ignored', now: NOW, uuid: uuidSource() },
    );
    expect(recipe.id).toBe('https://example.org/brushcodex/recipes/explicit');
    expect(recipe.revision).toBe('rev-hand-written');
  });

  it('uses an option when the draft is silent', () => {
    const recipe = createRecipe(
      { title: 'From options', steps: [{ instruction: 'Basecoat.' }] },
      { id: 'https://example.org/brushcodex/recipes/opt', specVersion: '1.0.0', now: NOW, uuid: uuidSource() },
    );
    expect(recipe.id).toBe('https://example.org/brushcodex/recipes/opt');
  });

  it('omits timestamps when asked', () => {
    const recipe = createRecipe(
      { title: 'Undated', steps: [{ instruction: 'Basecoat.' }] },
      { timestamps: false, now: NOW, uuid: uuidSource() },
    );
    expect(recipe.createdAt).toBeUndefined();
    expect(recipe.updatedAt).toBeUndefined();
  });

  it('refuses to author a draft that declares a different spec', () => {
    expect(() =>
      createRecipe({ spec: 'palette', title: 'Wrong', steps: [] } as never, {
        now: NOW,
        uuid: uuidSource(),
      }),
    ).toThrow(AuthoringError);
  });

  it('throws the spec validation error, carrying issues, for an invalid draft', () => {
    // `title` is required and non-empty; a minted envelope cannot rescue it.
    expect(() => createRecipe({ steps: [{ instruction: 'Basecoat.' }] } as never, {
      now: NOW,
      uuid: uuidSource(),
    })).toThrow(/Invalid BrushCodex Recipe document/);

    try {
      createRecipe({ steps: [{ instruction: 'Basecoat.' }] } as never, { now: NOW, uuid: uuidSource() });
      expect.unreachable('expected the invalid draft to throw');
    } catch (error) {
      expect((error as { issues?: unknown[] }).issues?.length).toBeGreaterThan(0);
    }
  });
});

describe('reviseDocument', () => {
  const base = () =>
    createRecipe(
      { title: 'Original', steps: [{ instruction: 'Basecoat red.' }] },
      { now: NOW, uuid: uuidSource() },
    );

  it('produces a new revision and refreshes updatedAt', () => {
    const before = base();
    const after = reviseDocument<'recipe'>(
      before,
      { title: 'Edited' },
      { now: '2026-07-16T09:30:00.000Z', uuid: uuidSource(50) },
    );
    expect(after.title).toBe('Edited');
    expect(after.revision).not.toBe(before.revision);
    expect(after.updatedAt).toBe('2026-07-16T09:30:00.000Z');
  });

  it('preserves the document identity across a revision', () => {
    const before = base();
    const after = reviseDocument<'recipe'>(before, { title: 'Edited' }, { now: NOW, uuid: uuidSource(50) });
    expect(after.id).toBe(before.id);
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.spec).toBe('recipe');
  });

  it('rejects a revision that reuses the revision it replaces', () => {
    const before = base();
    expect(() =>
      reviseDocument<'recipe'>(before, { title: 'Edited' }, { revision: before.revision }),
    ).toThrow(/MUST differ/);
  });

  it('refuses to change an identifying member', () => {
    const before = base();
    expect(() =>
      reviseDocument<'recipe'>(before, { id: 'urn:uuid:00000000-0000-4000-8000-0000000000ff' }),
    ).toThrow(AuthoringError);
  });

  it('re-validates, so a revision cannot silently become non-conformant', () => {
    const before = base();
    expect(() => reviseDocument<'recipe'>(before, { title: '' } as never)).toThrow(
      /Invalid BrushCodex Recipe document/,
    );
  });

  it('drops a now-stale integrity hash instead of carrying a false one', async () => {
    const sealed = await stampIntegrity(base() as unknown as Record<string, unknown>);
    expect(await verifyIntegrity(sealed)).toMatchObject({ status: 'valid' });

    const revised = reviseDocument<'recipe'>(
      sealed as never,
      { title: 'Edited' },
      { now: NOW, uuid: uuidSource(50) },
    );
    expect(revised.integrity).toBeUndefined();
    expect(await verifyIntegrity(revised)).toMatchObject({ status: 'absent' });

    const resealed = await stampIntegrity(revised as unknown as Record<string, unknown>);
    expect(await verifyIntegrity(resealed)).toMatchObject({ status: 'valid' });
  });
});
