/**
 * Project export profiles (spec §7).
 *
 * The "full" profile is the document as authored. The "shared" profile omits every
 * journal entry whose `visibility` is `private`, leaving all other data untouched.
 * The result is itself a valid Project document.
 */

import type { ProjectDocument } from './project';

/**
 * Produce the shareable export profile of a project: journal entries marked
 * `private` are removed; every other field is preserved exactly. Non-mutating.
 */
export function toSharedProject(doc: ProjectDocument): ProjectDocument {
  if (doc.journal === undefined) {
    return { ...doc };
  }
  return {
    ...doc,
    journal: doc.journal.filter((entry) => entry.visibility !== 'private'),
  };
}

/** Whether a project carries any private journal entries. */
export function hasPrivateJournal(doc: ProjectDocument): boolean {
  return (doc.journal ?? []).some((entry) => entry.visibility === 'private');
}
