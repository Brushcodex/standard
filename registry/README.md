# The BrushCodex paint-identity registry

An openly fetchable answer to one question, and only that question:

> **Which paint does this BrushCodex paint identifier mean?**

```text
https://raw.githubusercontent.com/Brushcodex/standard/main/registry/paint-identity.v1.json
```

No account, no key, no service. It is a static file in a public repository. That URL serves the
repository's default branch, so it goes live when this file first reaches `main`; pin a tag or a
commit in place of `main` if you would rather choose when the contents change under you.

> **Coverage is intentionally incomplete, and today it is zero.** A paint appears here only
> where an explicit decision permits publishing its identity openly, and no manufacturer
> currently carries one. The format, the resolution rules and the gates below are real and
> in force; the population is not yet. **This is not a universal paint registry and is not
> presented as one.** See [Coverage](#coverage) for why, and for what an unresolved
> identifier means.

---

## What a BrushCodex Paint ID is

```text
brushcodex:paint:p0000001
```

An **assigned, opaque** token. It is assigned once, never reused, and it carries no facts:
not the manufacturer, not the range, not the name, not the code. Renaming a paint, moving it
between ranges, or rebranding its manufacturer **does not change it**, because none of those
things is part of it.

**Treat it as opaque and compare it whole.**

- **Do not** read meaning out of the number. It tells you nothing about the manufacturer, the
  range, chronology, catalogue order, or how many paints exist.
- **Do not** treat seven digits as a fixed width. Seven zero-padded digits is the width
  currently issued; it is a **minimum**, and the namespace may grow past it without any
  existing identifier changing. If you must recognise the form at all, accept
  `brushcodex:paint:p` followed by digits.
- **Do not** compare two identifiers by adding or stripping zeros. Every form BrushCodex has
  ever issued is present in this file as either an `id` or an alias, so a plain lookup
  resolves all of them — and padding arithmetic would also "resolve" strings that were never
  issued.

The normative wording is [Common §5.7](../specs/common/v1/README.md#57-resolving-a-paint-reference).

## How to put one in a document

A paint reference carries it in `catalogueId`:

```json
{
  "manufacturer": "Example Paints",
  "range": "Base",
  "name": "Example Red",
  "code": "EX-01",
  "catalogueId": "brushcodex:paint:p0000001"
}
```

**The literals are still mandatory.** `catalogueId` is an optional progressive enhancement;
`manufacturer`, `range`, `name` and `code` are the guaranteed floor, and a conforming reader
must be able to present the reference from those alone, with no catalogue, no network and no
BrushCodex service. A document that carried only an identifier would be unreadable to
everyone who cannot resolve it — including everyone reading it after this registry is gone.

## How to resolve one

The file is a single JSON document. Build an index once, then look identifiers up:

```js
const registry = await (await fetch(REGISTRY_URL)).json();

const byId = new Map();
for (const paint of registry.paints) {
  byId.set(paint.id, paint);
  for (const alias of paint.aliasIds ?? []) byId.set(alias, paint);
  for (const old of paint.supersededIds ?? []) byId.set(old, paint);
}

const paint = byId.get(reference.catalogueId); // undefined when unresolved
```

That handles all four forms in one lookup:

| You hold | Where it is in the file |
|---|---|
| the canonical identifier (`p0000001`) | `paints[].id` |
| a pre-widening five-digit identifier (`p00001`) | `paints[].aliasIds` |
| a historical slugged identifier (`brushcodex:paint:citadel-colour/base/mephiston-red`) | `paints[].aliasIds` |
| an identifier that was merged into another identity | `paints[].supersededIds` of the surviving paint |

**No identifier ever resolves to two paints.** An alias claimed by two records, or a
supersession pointing at an identifier that is itself still live, fails the gate before the
file is published.

## What happens when it cannot be resolved

**Nothing bad.** An unresolved `catalogueId` is **not an error** — read the literal members
and carry on. Do not reject the document, do not guess, and do not fall back to matching on
name.

An identifier may be unresolvable for two reasons this file cannot tell apart, and neither
changes what you should do:

- it is not a BrushCodex identifier, or not one BrushCodex has issued;
- it names a paint BrushCodex holds but is **not permitted to publish** (see below).

## The record

Every entry carries identity and nothing else.

| Field | | |
|---|---|---|
| `id` | required | The canonical assigned identifier. |
| `manufacturer` | required | Display name of the manufacturer. |
| `name` | required | The paint's current name. |
| `ranges` | optional | The range(s) the manufacturer places it in. |
| `otherNames` | optional | Other names it is or was published under. |
| `codes` | optional | The manufacturer's own printed item code(s). |
| `status` | optional | Present only when the paint is `discontinued`. |
| `aliasIds` | optional | Every identifier this paint has previously been published under. |
| `supersededIds` | optional | Identifiers merged into this one. Permanent redirects. |

**Deliberately absent**, and it will stay absent: colour values, measurements, colorimetry,
provenance, source attribution, confidence, authority levels, barcodes, packaging, standards
designations, equivalence or substitution judgements, matching data, and any internal
annotation. This registry answers identity. It is not a colour database and it is not a
catalogue.

## Coverage

A paint is published here only where an explicit, written decision permits publishing its
identity openly. There is no automatic inclusion: a manufacturer with no decision recorded
is withheld, and so is one added to BrushCodex after the last review.

**Today no manufacturer carries such a decision, so this file publishes zero identities.**
Several brands' terms are actively adverse to redistribution; several more have been cleared
for BrushCodex to *read* their data, which is a different permission from BrushCodex
republishing it under its own name; and the rest have not been reviewed at all, which is not
the same as being cleared. Rather than publish an ambiguous "universal" registry, BrushCodex
publishes what it can stand behind and reports the gap.

The consequence for you is the one already stated above: **treat an unresolved identifier as
unresolved.** Because coverage is partial by design, that is the normal case, not an
exception — which is exactly why the literal fields are mandatory.

## Format version

`publicFormatVersion` is **1.0.0**, and it is the version of this published projection —
**not** of any BrushCodex internal format. The two are versioned separately on purpose: what
you read here is a promise to strangers and changes slowly, while BrushCodex's own registry
is a working record and changes as the catalogue learns things.

Within `1.x`: fields may be added, and more paints may appear. Nothing you can already read
will change meaning, an identifier that resolves will keep resolving, and a published
identifier will not disappear. A change that broke any of those would be a new major and a
new file name.

The document is **deterministic**: the same catalogue and the same publication decisions
produce byte-identical output, with no timestamp and no build-order dependence.

## What this is not

- Not a registration authority. BrushCodex assigns these identifiers to paints in its own
  catalogue; there is no third-party issuance, no vendor self-registration, and no registrar.
- Not universal, and not presented as universal.
- Not a colour, matching, substitution or recommendation service.
- Not a live API. It is a file, and it is meant to be cached.

## Gates

`pnpm check:public-registry` (and `pnpm test:gate`) refuse to pass a file that carries an
unknown field, anything on the forbidden-material list, an identifier resolving to two
paints, a redirect onto a live identifier, a duplicate identifier, a non-canonical
identifier, or a count that disagrees with its own contents. Those checks run **here**, in
the public repository, against the file as published — not only beside the private generator
that produced it.
