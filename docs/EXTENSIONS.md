# Extension Namespaces & Preservation

BrushCodex documents use a small, stable core plus **namespaced extensions**, so implementations
can experiment without fragmenting the format or requiring an enormous mandatory schema
(strategy §3.5, §5.9).

## 1. Where extensions live

Every document carries an optional top-level `extensions` object. Non-standard data **MUST** go
there — the core envelope rejects unknown **top-level** members (`additionalProperties: false`),
which turns a typo or an incompatible field into a validation error instead of silent data.

```json
{
  "spec": "common",
  "specVersion": "1.0.0",
  "id": "urn:uuid:…",
  "revision": "r1",
  "title": "…",
  "extensions": {
    "com.example.tool:layerMap": { "version": 3, "regions": [] },
    "org.miniac.difficulty": "intermediate"
  }
}
```

## 2. Namespace rules

An extension **key** MUST be namespaced: it MUST contain a `.` or `:` separator and match
`^[A-Za-z0-9][A-Za-z0-9._-]*[.:][A-Za-z0-9][A-Za-z0-9._:-]*$`. Use a globally distinguishable
namespace you control:

- **Reverse-DNS**, optionally with a colon-qualified local name — `com.example.tool:layerMap`.
- **Reverse-DNS dotted** — `org.miniac.difficulty`.

Unnamespaced keys (e.g. `difficulty`) are **invalid** — they risk colliding with a future core
member. There is no central registry requirement; a domain or project identifier you own is
sufficient.

## 3. Semantics

An extension:

- **MUST NOT** change the meaning of any core member.
- **MUST** be optional for baseline conformance — a reader ignorant of it stays conformant.
- **MAY** carry any JSON value (object, array, string, number, boolean, null).
- **MAY** graduate into the core only through a documented proposal + compatibility review
  (future governance process).

## 3a. Graduation — what happens to documents written before it

When a value graduates from an extension into a core member, documents written earlier stay
**valid** (nothing was removed from the format). But their meaning is **stranded**: it sits in an
extension that only the tool which wrote it knows how to read, so a third-party consumer sees a
recipe with, say, no cited work and no step citations even though the document contains both.

Graduation therefore ships with a documented, deterministic upgrade —
`@brushcodex/validator/migrate` (`graduateRecipeDocument`). Its rules are what make it safe to run
on data you did not write:

- it moves a value **only** into the core member that value actually became;
- it **never overwrites** a core member the document already states — the document wins over its
  history;
- it moves only when the result is **valid**, so an unparseable value stays where it is;
- it **removes what it moved** from the extension, so one fact never has two homes;
- it **reports** everything it moved and everything it could not, with a reason;
- it does not mutate its input, and running it twice is a no-op.

It will not invent semantics the format does not define. Text timecodes are the worked example: the
format's `mediaCitation.label` is free text and no timecode grammar is specified, so a text
timecode is only graduated when the caller supplies a reader (`readClockTimecode` implements the
common `[H:]M:SS` form and is offered, never applied automatically). Without one, the value is
reported as unmoved and left untouched — never guessed at, never dropped.

This is **not** a version migration (VERSIONING.md §5), which applies to major transitions and does
not exist yet; it is the compatibility half of an extension graduation.

## 4. Preservation guarantee

An implementation that claims **preservation support** MUST round-trip unknown extensions
**unchanged** through `parse → serialize`.

The BrushCodex reference implementation **claims and tests** this across **every spec**: because
each spec model extends the Common envelope, `extensions` is stored as an opaque map and the
shared canonical serializer never drops or reorders their values. A round-trip test asserts an
unknown namespaced extension survives `parse → serialize → parse` unchanged for **Common, Recipe,
Palette, Inventory, Project, and Technique** (`src/modules/standards/common/envelope.test.ts` plus
the `preserves unknown namespaced extensions unchanged` case in each spec's `*.test.ts`).
Implementations that cannot preserve extensions MUST say so and MUST NOT claim preservation.

## 5. Reserved / conventional namespaces

- `x-` short prefixes are **discouraged** (not globally unique).
- BrushCodex-authored experimental extensions use the `org.brushcodex.*` namespace before any
  core graduation.
- A spike that uses that namespace to *test* a proposal — rather than to carry data a shipping tool
  already writes — lives in [`experiments/`](../experiments/README.md), which is informative,
  outside the conformance corpus, and disposable. Current: the portable Painted Subject identity
  prototype, [`experiments/subject-identity/`](../experiments/subject-identity/README.md)
  (`org.brushcodex.subject:identity`).
