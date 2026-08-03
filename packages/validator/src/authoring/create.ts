/**
 * Document authoring — build a document that is valid **by construction**.
 *
 * The validator could always read, check, render, and round-trip documents; these
 * helpers close the write half. They mint the envelope members a producer would
 * otherwise hand-roll (`spec`, `specVersion`, `id`, `revision`, and the
 * timestamps) and then run the document through the same reference parser an
 * outside consumer would use, so an authored document cannot be born invalid.
 *
 * Nothing here is normative: this is a convenience over `specs/` + `schemas/`,
 * not a second definition of them. The envelope rules it encodes are stated in
 * `specs/common/v1/README.md` §4.
 */

import { parseCommonDocument, type CommonDocument } from '../common';
import { parseRecipeDocument, type RecipeDocument } from '../recipe';
import { parsePaletteDocument, type PaletteDocument } from '../palette';
import { parseInventoryDocument, type InventoryDocument } from '../inventory';
import { parseProjectDocument, type ProjectDocument } from '../project';
import { parseTechniqueDocument, type TechniqueDocument } from '../technique';
import { parseBundleManifest, type BundleManifest } from '../bundle';
import type { SpecName } from '../registry';
import {
  AuthoringError,
  defaultUuid,
  newDocumentId,
  newRevision,
  toIsoInstant,
  type UuidSource,
} from './ids';

/**
 * The specification version the helpers stamp when a draft does not choose one.
 * Every specification in this repository is Draft v1 and the whole example corpus
 * declares `1.0.0`.
 */
export const DEFAULT_SPEC_VERSION = '1.0.0';

/** Envelope members the helpers mint when a draft omits them. */
export type MintedMember = 'spec' | 'specVersion' | 'id' | 'revision';

/**
 * A document draft: everything the spec defines, with the envelope members the
 * helpers can mint made optional. Supplying one yourself always wins.
 */
export type Draft<T> = Omit<T, MintedMember> & Partial<Pick<T, MintedMember & keyof T>>;

export interface AuthoringOptions {
  /** Document `id`. Defaults to a fresh registry-free `urn:uuid:` URI. */
  id?: string;
  /** Opaque `revision` token. Defaults to a fresh timestamped token. */
  revision?: string;
  /** Specification version to stamp. Defaults to {@link DEFAULT_SPEC_VERSION}. */
  specVersion?: string;
  /** The instant used for `createdAt`/`updatedAt` and the revision token. Defaults to now. */
  now?: Date | string;
  /** UUID source, for reproducible output. Defaults to Web Crypto. */
  uuid?: UuidSource;
  /**
   * Stamp `createdAt`/`updatedAt` when the draft omits them. Default `true`.
   * Set `false` to author a document that deliberately carries no timestamps.
   */
  timestamps?: boolean;
}

/** Precedence: an explicit draft value, then an option, then the minted default. */
function choose<T>(draftValue: T | undefined, optionValue: T | undefined, mint: () => T): T {
  if (draftValue !== undefined) return draftValue;
  if (optionValue !== undefined) return optionValue;
  return mint();
}

/**
 * Assemble the envelope around a draft. Exported for callers that want the raw
 * object to inspect or mutate before validating it themselves; prefer the typed
 * `create*` helpers, which also validate.
 */
export function buildDocument(
  spec: SpecName,
  draft: Record<string, unknown>,
  options: AuthoringOptions = {},
): Record<string, unknown> {
  const declaredSpec = draft.spec;
  if (declaredSpec !== undefined && declaredSpec !== spec) {
    throw new AuthoringError(
      `Draft declares spec ${JSON.stringify(declaredSpec)} but is being authored as ` +
        `${JSON.stringify(spec)}. Remove the \`spec\` member or author it as its own spec.`,
    );
  }

  const uuid = options.uuid ?? defaultUuid;
  const instant = toIsoInstant(options.now ?? new Date());
  const stampTimestamps = options.timestamps ?? true;

  const document: Record<string, unknown> = {
    ...draft,
    spec,
    specVersion: choose(
      draft.specVersion as string | undefined,
      options.specVersion,
      () => DEFAULT_SPEC_VERSION,
    ),
    id: choose(draft.id as string | undefined, options.id, () => newDocumentId(uuid)),
    revision: choose(draft.revision as string | undefined, options.revision, () =>
      newRevision(instant, uuid),
    ),
  };

  if (stampTimestamps) {
    if (document.createdAt === undefined) document.createdAt = instant;
    if (document.updatedAt === undefined) document.updatedAt = instant;
  }

  return document;
}

/** Every specification name mapped to its parsed document type. */
export interface SpecDocumentMap {
  common: CommonDocument;
  recipe: RecipeDocument;
  palette: PaletteDocument;
  inventory: InventoryDocument;
  project: ProjectDocument;
  technique: TechniqueDocument;
  bundle: BundleManifest;
}

type Parsers = { [K in SpecName]: (input: unknown) => SpecDocumentMap[K] };

/** Spec dispatch to the reference parsers, mirroring `registry.ts`. */
export const PARSERS: Parsers = {
  common: parseCommonDocument,
  recipe: parseRecipeDocument,
  palette: parsePaletteDocument,
  inventory: parseInventoryDocument,
  project: parseProjectDocument,
  technique: parseTechniqueDocument,
  bundle: parseBundleManifest,
};

/**
 * Author a document of any specification. Throws that specification's validation
 * error (carrying `issues`) if the assembled document is not conformant, so a
 * returned document has already passed the same checks conformance applies.
 */
export function createDocument<S extends SpecName>(
  spec: S,
  draft: Draft<SpecDocumentMap[S]>,
  options: AuthoringOptions = {},
): SpecDocumentMap[S] {
  return PARSERS[spec](buildDocument(spec, draft as Record<string, unknown>, options));
}

export const createCommonDocument = (
  draft: Draft<CommonDocument>,
  options?: AuthoringOptions,
): CommonDocument => createDocument('common', draft, options);

export const createRecipe = (
  draft: Draft<RecipeDocument>,
  options?: AuthoringOptions,
): RecipeDocument => createDocument('recipe', draft, options);

export const createPalette = (
  draft: Draft<PaletteDocument>,
  options?: AuthoringOptions,
): PaletteDocument => createDocument('palette', draft, options);

export const createInventory = (
  draft: Draft<InventoryDocument>,
  options?: AuthoringOptions,
): InventoryDocument => createDocument('inventory', draft, options);

export const createProject = (
  draft: Draft<ProjectDocument>,
  options?: AuthoringOptions,
): ProjectDocument => createDocument('project', draft, options);

export const createTechnique = (
  draft: Draft<TechniqueDocument>,
  options?: AuthoringOptions,
): TechniqueDocument => createDocument('technique', draft, options);

export const createBundleManifest = (
  draft: Draft<BundleManifest>,
  options?: AuthoringOptions,
): BundleManifest => createDocument('bundle', draft, options);
