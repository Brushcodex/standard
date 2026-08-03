/**
 * Revising an authored document.
 *
 * The envelope spec is explicit: *editing published content **MUST** produce a
 * new `revision`* (common spec §4). That is the rule a hand-rolled producer
 * forgets, because a document that keeps its old revision still validates — the
 * constraint is on the edit, not on the document. `reviseDocument` makes the
 * correct edit the easy one.
 *
 * Two consequences are handled here rather than left to the caller:
 *
 *  - **Identity is preserved.** A revision is a new state of the *same* document,
 *    so `id` and `createdAt` carry over and cannot be changed through this path.
 *  - **A stale `integrity` is dropped.** The declared hash covers the previous
 *    content; keeping it across an edit would make `verifyIntegrity` report
 *    `mismatch`. Re-seal with `stampIntegrity` (async) when you need one.
 */

import type { SpecName } from '../registry';
import { isSpecName } from '../registry';
import { PARSERS, type SpecDocumentMap } from './create';
import { AuthoringError, defaultUuid, newRevision, toIsoInstant, type UuidSource } from './ids';

export interface ReviseOptions {
  /** The new revision token. Defaults to a freshly minted one. */
  revision?: string;
  /** The instant recorded as `updatedAt` and used in the minted token. Defaults to now. */
  now?: Date | string;
  /** UUID source, for reproducible output. Defaults to Web Crypto. */
  uuid?: UuidSource;
}

/** Members that identify the document itself and therefore survive a revision. */
const IDENTITY_MEMBERS = ['spec', 'id', 'createdAt'] as const;

/**
 * Apply `changes` to a document and produce the next revision of it: a new
 * `revision`, a refreshed `updatedAt`, the same identity, and no stale integrity
 * hash. Re-validated before it is returned, so a revision cannot silently become
 * non-conformant.
 */
export function reviseDocument<S extends SpecName>(
  document: SpecDocumentMap[S],
  changes: Partial<SpecDocumentMap[S]> = {},
  options: ReviseOptions = {},
): SpecDocumentMap[S] {
  const current = document as unknown as Record<string, unknown>;
  const spec = current.spec;
  if (!isSpecName(spec)) {
    throw new AuthoringError(
      `Cannot revise a document whose \`spec\` is not a known specification: ${JSON.stringify(spec)}.`,
    );
  }

  const proposed = changes as Record<string, unknown>;
  for (const member of IDENTITY_MEMBERS) {
    if (member in proposed && proposed[member] !== current[member]) {
      throw new AuthoringError(
        `\`${member}\` identifies the document and cannot be changed by a revision. ` +
          'Author a new document instead (and link it with `links.predecessor`).',
      );
    }
  }

  const uuid = options.uuid ?? defaultUuid;
  const instant = toIsoInstant(options.now ?? new Date());
  const revision = options.revision ?? newRevision(instant, uuid);
  if (revision === current.revision) {
    throw new AuthoringError(
      'A revision MUST differ from the revision it replaces (common spec §4); ' +
        `both are ${JSON.stringify(revision)}.`,
    );
  }

  const next: Record<string, unknown> = {
    ...current,
    ...proposed,
    spec,
    id: current.id,
    revision,
    updatedAt: instant,
  };
  if (current.createdAt !== undefined) next.createdAt = current.createdAt;
  // The previous content's hash does not describe the new content.
  delete next.integrity;

  return PARSERS[spec](next) as SpecDocumentMap[S];
}
