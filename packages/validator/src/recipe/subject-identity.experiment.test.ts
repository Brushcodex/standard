/**
 * EXPERIMENT — portable Painted Subject identity as a namespaced extension.
 *
 * This is a spike, not a specification. It tests a prototype extension that lives entirely under
 * `extensions` (docs/EXTENSIONS.md), against the documents in `experiments/subject-identity/`. It
 * touches no schema, defines no core member, and asserts nothing about a future core shape. See
 * `experiments/subject-identity/README.md` for the semantics, the stability policy, and the
 * boundaries the experiment deliberately does not cross.
 *
 * The claim under test is narrow and falsifiable:
 *
 *   a stable Subject ID plus a literal identity floor supports deterministic, offline subject
 *   equality across independently authored Painting Workflows — which `target.description` alone
 *   cannot do — while unknown precision stays honest and no Source Product identity is required.
 *
 * Every comparator below is written twice on purpose: once as a baseline a consumer has today
 * (human description, designation string, source-product SKU) and once over the Subject ID. The
 * tests assert where the baselines are wrong and the ID is right, and — just as importantly —
 * where the ID declines to answer rather than guessing.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { RecipeDocument } from './recipe';
import {
  loadRecipeSchema,
  parseRecipeDocument,
  roundTripRecipeDocument,
  validateRecipeDocument,
} from './validate';

const EXPERIMENT_DIR = new URL('../../../../experiments/subject-identity/', import.meta.url);

/** The prototype identity extension. Namespaced per docs/EXTENSIONS.md §5. */
const SUBJECT_IDENTITY = 'org.brushcodex.subject:identity';
/** Source-product context — a DIFFERENT key, so "identity never reads product" is structural. */
const SOURCE_PRODUCT = 'org.brushcodex.product:sourceContext';

interface SubjectIdentity {
  /** Opaque equality key. OPTIONAL: absent when the evidence does not support one. */
  subjectId?: string;
  authority: string;
  designation: string;
  qualifier?: string;
  authorityId?: string;
  references?: ReadonlyArray<{ url: string; note?: string }>;
}

interface SourceProductContext {
  productName: string;
  sku: string;
  note?: string;
}

function readDocument(fileName: string): RecipeDocument {
  const raw: unknown = JSON.parse(
    readFileSync(fileURLToPath(new URL(fileName, EXPERIMENT_DIR)), 'utf8'),
  );
  return parseRecipeDocument(raw);
}

const blister = readDocument('standard-bearer-blister.json');
const reissue = readDocument('standard-bearer-reissue.json');
const sergeant = readDocument('squad-sergeant.json');
const trooper = readDocument('squad-trooper-generic.json');
const remaster = readDocument('standard-bearer-remaster.json');

const ALL: ReadonlyArray<readonly [string, RecipeDocument]> = [
  ['blister', blister],
  ['reissue', reissue],
  ['sergeant', sergeant],
  ['trooper', trooper],
  ['remaster', remaster],
];

// --- The whole consumer implementation. No network, no registry, no catalogue. ---

function identityOf(document: RecipeDocument): SubjectIdentity | undefined {
  return document.extensions?.[SUBJECT_IDENTITY] as SubjectIdentity | undefined;
}

function productOf(document: RecipeDocument): SourceProductContext | undefined {
  return document.extensions?.[SOURCE_PRODUCT] as SourceProductContext | undefined;
}

/** `undetermined` is a first-class answer: an absent Subject ID never yields a match. */
type SubjectVerdict = 'same' | 'distinct' | 'undetermined';

function compareSubjects(a: RecipeDocument, b: RecipeDocument): SubjectVerdict {
  const left = identityOf(a)?.subjectId;
  const right = identityOf(b)?.subjectId;
  if (left === undefined || right === undefined) return 'undetermined';
  return left === right ? 'same' : 'distinct';
}

/** The literal floor, rendered with no resolution of any kind. */
function describeOffline(identity: SubjectIdentity): string {
  const parts = [identity.authority, identity.designation];
  if (identity.qualifier !== undefined) parts.push(identity.qualifier);
  return parts.join(' — ');
}

// --- The baselines a consumer has today, for comparison. ---

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** What `target.description` supports: string matching, and nothing better. */
function descriptionsMatch(a: RecipeDocument, b: RecipeDocument): boolean {
  return normalize(a.target?.description ?? '') === normalize(b.target?.description ?? '');
}

/** Literal-name matching — the best a reader can do from the identity floor alone. */
function designationsMatch(a: RecipeDocument, b: RecipeDocument): boolean {
  const left = identityOf(a)?.designation;
  return left !== undefined && left === identityOf(b)?.designation;
}

/** The tempting shortcut this experiment exists to falsify. */
function skusMatch(a: RecipeDocument, b: RecipeDocument): boolean {
  const left = productOf(a)?.sku;
  return left !== undefined && left === productOf(b)?.sku;
}

function withoutSourceProduct(document: RecipeDocument): RecipeDocument {
  const extensions: Record<string, unknown> = { ...(document.extensions ?? {}) };
  delete extensions[SOURCE_PRODUCT];
  return { ...document, extensions };
}

describe('EXPERIMENT: portable Painted Subject identity', () => {
  describe('premise — the prototype required no change to the standard', () => {
    it.each(ALL)('%s validates against the unchanged Recipe v1 validator', (_name, document) => {
      expect(validateRecipeDocument(document)).toEqual({ valid: true, issues: [] });
    });

    it('the Recipe v1 schema defines no subject-identity member', () => {
      const serialized = JSON.stringify(loadRecipeSchema());
      expect(serialized).not.toContain('subjectId');
      expect(serialized).not.toContain('"subject"');
      expect(serialized).not.toContain(SUBJECT_IDENTITY);
    });

    it('both experimental extensions survive a canonical round trip unchanged', () => {
      for (const [name, document] of ALL) {
        const { document: tripped } = roundTripRecipeDocument(document);
        expect(tripped.extensions?.[SUBJECT_IDENTITY], name).toEqual(
          document.extensions?.[SUBJECT_IDENTITY],
        );
        expect(tripped.extensions?.[SOURCE_PRODUCT], name).toEqual(
          document.extensions?.[SOURCE_PRODUCT],
        );
      }
    });

    it('leaves target.description intact and load-bearing on every document', () => {
      for (const [name, document] of ALL) {
        expect(document.target?.description, name).toBeTruthy();
      }
      // Identity did not replace prose: all five descriptions are still distinct from one another.
      expect(new Set(ALL.map(([, d]) => d.target?.description)).size).toBe(ALL.length);
    });
  });

  describe('case 1 — exact subject, two independently authored workflows', () => {
    it('concludes SAME by Subject ID where description matching fails', () => {
      expect(compareSubjects(blister, reissue)).toBe('same');
      expect(descriptionsMatch(blister, reissue)).toBe(false);
      expect(blister.authors?.[0]?.name).not.toBe(reissue.authors?.[0]?.name);
    });

    it('does not depend on the literal members agreeing', () => {
      // One author knows the manufacturer's sculpt code; the other does not, and each wrote a
      // different qualifier. Equality is unaffected — that is what makes the ID an equality key.
      expect(identityOf(blister)?.authorityId).toBe('VG-SB-01');
      expect(identityOf(reissue)?.authorityId).toBeUndefined();
      expect(identityOf(blister)?.qualifier).not.toBe(identityOf(reissue)?.qualifier);
      expect(compareSubjects(blister, reissue)).toBe('same');
    });
  });

  describe('case 2 — multi-model box: the Sergeant, not the product', () => {
    it('the identity denotes the Sergeant while the product denotes ten models', () => {
      expect(identityOf(sergeant)?.designation).toContain('Sergeant');
      expect(productOf(sergeant)?.productName).toContain('10 models');
      expect(identityOf(sergeant)?.subjectId).not.toBe(productOf(sergeant)?.sku);
    });

    it('falsifies the box SKU as a subject equality key', () => {
      // Same box, same SKU, two different painted subjects.
      expect(skusMatch(sergeant, trooper)).toBe(true); // the SKU claims "same subject" — wrong.
      expect(compareSubjects(sergeant, trooper)).toBe('undetermined');
    });

    it('reaches every verdict again with the source-product extension deleted', () => {
      const stripped = [blister, reissue, sergeant, trooper, remaster].map(withoutSourceProduct);
      const [b, r, s, t, m] = stripped as [
        RecipeDocument,
        RecipeDocument,
        RecipeDocument,
        RecipeDocument,
        RecipeDocument,
      ];
      expect(compareSubjects(b, r)).toBe('same');
      expect(compareSubjects(b, m)).toBe('distinct');
      expect(compareSubjects(s, t)).toBe('undetermined');
      expect(compareSubjects(s, b)).toBe('distinct');
      // With the product gone the SKU comparator has nothing left to be wrong with.
      expect(skusMatch(s, t)).toBe(false);
    });
  });

  describe('case 3 — rebox and reissue', () => {
    it('keeps one Subject ID across two different source products', () => {
      expect(productOf(blister)?.sku).not.toBe(productOf(reissue)?.sku);
      expect(productOf(blister)?.productName).not.toBe(productOf(reissue)?.productName);
      expect(compareSubjects(blister, reissue)).toBe('same');
    });

    it('stores no product history, availability, or matching intelligence in the identity', () => {
      const forbidden = [
        'sku',
        'productName',
        'bundle',
        'price',
        'stock',
        'availability',
        'retailer',
        'aliases',
        'confidence',
      ];
      for (const [name, document] of ALL) {
        const identity = identityOf(document);
        if (identity === undefined) continue;
        for (const key of Object.keys(identity)) {
          expect(forbidden, `${name}.${key}`).not.toContain(key);
        }
      }
    });
  });

  describe('case 4 — resculpt', () => {
    it('separates the remaster from the original, though the designation is identical', () => {
      expect(designationsMatch(blister, remaster)).toBe(true); // literal names claim "same" — wrong.
      expect(compareSubjects(blister, remaster)).toBe('distinct');
    });

    it('the qualifier states the paint-relevant reason the identity is distinct', () => {
      expect(identityOf(remaster)?.qualifier).toMatch(/separate component|recut/);
    });
  });

  describe('case 5 — broad subject with no exact identity', () => {
    it('is fully valid carrying literal identity and no Subject ID', () => {
      expect(validateRecipeDocument(trooper).valid).toBe(true);
      const identity = identityOf(trooper);
      expect(identity?.subjectId).toBeUndefined();
      expect(identity?.authorityId).toBeUndefined();
      expect(identity?.authority).toBe('Example Miniatures');
      expect(identity?.designation).toBeTruthy();
    });

    it('nothing in the pipeline fabricates an identifier', () => {
      const { document: tripped } = roundTripRecipeDocument(trooper);
      const identity = tripped.extensions?.[SUBJECT_IDENTITY] as SubjectIdentity;
      expect(identity.subjectId).toBeUndefined();
    });

    it('an absent Subject ID never yields a match — not even against itself', () => {
      expect(compareSubjects(trooper, trooper)).toBe('undetermined');
      expect(compareSubjects(trooper, blister)).toBe('undetermined');
    });
  });

  describe('case 6 — registry unavailable', () => {
    const registry = {
      resolve(): never {
        throw new Error('subject registry unreachable');
      },
    };

    it('reads a complete subject from the document alone when resolution throws', () => {
      expect(() => registry.resolve()).toThrow('subject registry unreachable');
      for (const [name, document] of ALL) {
        const identity = identityOf(document);
        expect(identity, name).toBeDefined();
        const resolved = identity as SubjectIdentity;
        const text = describeOffline(resolved);
        expect(text, name).toContain(resolved.authority);
        expect(text, name).toContain(resolved.designation);
      }
    });

    it('still decides equality with the registry dead and the official URL gone', () => {
      // The blister carries an official reference; the reissue carries none. Neither is consulted.
      expect(identityOf(blister)?.references).toHaveLength(1);
      expect(identityOf(reissue)?.references).toBeUndefined();
      expect(compareSubjects(blister, reissue)).toBe('same');
      expect(compareSubjects(blister, remaster)).toBe('distinct');
    });

    it('validation never needed a resolver in the first place', () => {
      for (const [name, document] of ALL) {
        expect(validateRecipeDocument(document).valid, name).toBe(true);
      }
    });
  });

  describe('boundary — what this experiment deliberately does not do', () => {
    it('performs no alias resolution and no same-sculpt inference', () => {
      // Same authority, same designation, different ID: the comparator reports two identities and
      // draws no conclusion about the sculpts. Deciding they are "really" one subject is registry
      // identity policy, and is out of scope here.
      expect(identityOf(blister)?.authority).toBe(identityOf(remaster)?.authority);
      expect(designationsMatch(blister, remaster)).toBe(true);
      expect(compareSubjects(blister, remaster)).toBe('distinct');
    });

    it('treats the Subject ID as opaque — equality is a whole-string comparison', () => {
      const id = identityOf(blister)?.subjectId as string;
      expect(id).toBe(identityOf(reissue)?.subjectId);
      // The readable segments are a debugging courtesy; no consumer here parses them.
      expect(id.startsWith('brushcodex:subject:')).toBe(true);
    });

    it('carries no Source Product identifier anywhere', () => {
      for (const [name, document] of ALL) {
        const product = productOf(document);
        if (product === undefined) continue;
        expect(Object.keys(product), name).not.toContain('productId');
        expect(JSON.stringify(product), name).not.toContain('brushcodex:product:');
      }
    });
  });
});
