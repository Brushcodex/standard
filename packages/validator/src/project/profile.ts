/**
 * Project export profiles (spec §7).
 *
 * The "full" profile is the document as authored. The "shared" profile omits every
 * journal entry whose `visibility` is `private` and removes `extensions` and the
 * envelope `integrity`, leaving all other data untouched. The result is itself a
 * valid Project document.
 *
 * Why `extensions` goes (fail closed): an extension is opaque, namespaced data the
 * profile cannot interpret, so it cannot prove an extension carries nothing private —
 * an extension keyed by journal entry would otherwise survive into the export after
 * the private entries were removed. This is a deliberate privacy-reducing export
 * transform, not a read/write round trip, so it does not conflict with Common §6
 * preservation; the full profile still preserves every extension.
 *
 * Why `integrity` goes: it is the author's hash of the full document (Common §5.5), so
 * on the shared output it no longer matches the content, and it lets anyone who guesses
 * the removed private content confirm the guess. It is removed, not recomputed.
 *
 * In Project v1 the only member where Common or Project allows `extensions` is the
 * document envelope: every nested object (subject, stage, checkItem, documentRef,
 * substitution, paintRef, journalEntry, mediaRef, resource, and the Common agent,
 * license, provenance, translation, links and integrity structures) is closed.
 */

import type { ProjectDocument } from './project';

/**
 * Produce the shareable export profile of a project: journal entries marked
 * `private` are removed, and `extensions` and `integrity` are removed; every other
 * field is preserved exactly. Non-mutating.
 */
export function toSharedProject(doc: ProjectDocument): ProjectDocument {
  const shared: ProjectDocument = { ...doc };
  if (doc.journal !== undefined) {
    shared.journal = doc.journal.filter((entry) => entry.visibility !== 'private');
  }
  delete shared.extensions;
  delete shared.integrity;
  return shared;
}

/** Whether a project carries any private journal entries. */
export function hasPrivateJournal(doc: ProjectDocument): boolean {
  return (doc.journal ?? []).some((entry) => entry.visibility === 'private');
}
