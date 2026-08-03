# Validating a BrushCodex document from another language (Python)

You do **not** need the `@brushcodex/*` packages to validate a document. The normative JSON
Schemas under [`../schemas`](../schemas) are enough: any conforming Draft 2020-12 validator can
check a document against the specification it declares. This page shows the pattern in Python; the
same shape applies to any language with a JSON Schema library.

## The one thing that matters: load all seven schemas

Each schema has an absolute `$id` (`https://brushcodex.com/schemas/<spec>/v1/<spec>.schema.json`)
and the specs reference each other by that absolute `$id` — e.g. `recipe` refers to
`common.schema.json#/$defs/envelopeCore`. So you must register **all seven** schemas before
validating any one of them, or the cross-references will not resolve.

## Python (`jsonschema` ≥ 4.18, which uses `referencing`)

```python
import json, sys
from pathlib import Path
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

SCHEMAS_DIR = Path("schemas")  # the brushcodex-standard/schemas directory

def load_registry():
    """Register all seven schemas so their absolute-$id cross-references resolve."""
    by_id = {}
    for path in SCHEMAS_DIR.glob("*/v1/*.schema.json"):
        schema = json.loads(path.read_text(encoding="utf-8"))
        by_id[schema["$id"]] = schema
    registry = Registry().with_resources(
        (sid, Resource.from_contents(schema)) for sid, schema in by_id.items()
    )
    return by_id, registry

def validate(doc_path):
    """Return a list of validation errors (empty == valid) for one document."""
    doc = json.loads(Path(doc_path).read_text(encoding="utf-8"))
    by_id, registry = load_registry()
    schema_id = f"https://brushcodex.com/schemas/{doc['spec']}/v1/{doc['spec']}.schema.json"
    validator = Draft202012Validator(
        by_id[schema_id],
        registry=registry,
        format_checker=Draft202012Validator.FORMAT_CHECKER,
    )
    return sorted(validator.iter_errors(doc), key=lambda e: list(e.path))

# Usage: python validate.py path/to/document.json
errors = validate(sys.argv[1])
if not errors:
    print("valid")
else:
    for e in errors:
        location = "/" + "/".join(str(p) for p in e.path)
        print(f"invalid at {location}: {e.message} [{e.validator}]")
    sys.exit(1)
```

A document validates against the schema named by its own `spec` member. To check a file the way the
conformance corpus does — where an `invalid/` fixture may deliberately declare the *wrong* `spec` —
select the schema by the file's spec **directory** instead of `doc["spec"]`.

`format_checker` turns on `format` assertions (e.g. `date-time`, `uri`) to match the reference
validator. Some formats need extra packages (e.g. `rfc3339-validator`); without them `jsonschema`
skips those specific formats rather than failing.

## Run it against the corpus

Install the one dependency (`jsonschema` pulls in `referencing`; add `rfc3339-validator` if you
want `date-time` formats asserted), save the snippet above as `validate.py`, and run it **from the
repository root** so the `Path("schemas")` in the script resolves:

```bash
pip install jsonschema           # jsonschema >= 4.18 brings in `referencing`
python validate.py examples/recipe/v1/minimal.valid.json
```

A valid document prints `valid` and exits `0`; an invalid one prints each error and exits `1`:

```text
$ python validate.py examples/recipe/v1/minimal.valid.json
valid

$ python validate.py examples/recipe/v1/invalid/missing-steps.json
invalid at /: 'steps' is a required property [required]
```

The accept/reject outcome matches the reference validator: the whole corpus (92 cases) is what
`pnpm --filter @brushcodex/cli conformance` checks. This page's commands were executed against the
corpus with Python 3.12 and `jsonschema` 4.25.

### Where the schema layer stops

Point the same script at a fixture that is *schema*-valid but breaks a prose rule — here
`updatedAt` precedes `createdAt` — and pure JSON Schema **accepts** it:

```text
$ python validate.py examples/common/v1/invalid/updatedAt-before-createdAt.json
valid
```

The reference validator, which also enforces the semantic rules, **rejects** the same file:

```text
$ pnpm --filter @brushcodex/cli validate /absolute/path/to/updatedAt-before-createdAt.json
FAIL  common  …/updatedAt-before-createdAt.json
        - updatedAt must not precede createdAt

0/1 valid.
```

That is exactly the boundary described next.

## What this does and does not cover

- **Covers the schema layer** — structure, types, required members, closed vocabularies,
  `unevaluatedProperties`. This is the authoritative machine check and is enough to accept/reject on
  structural grounds.
- **Does not cover the semantic layer** — a handful of prose rules the JSON Schema cannot express
  (for example, `updatedAt` must not precede `createdAt`, and the recipe media-citation rules). A
  document can be schema-valid yet violate one of these; pure JSON Schema validation will accept it.
  Full conformance also enforces those rules — see each spec's `README.md` §conformance, and the
  reference implementation in [`../packages/validator`](../packages/validator).

Different validators phrase and aggregate errors differently (a failing subschema can, for instance,
cascade an extra `unevaluatedProperties` error). The **accept/reject outcome** is the conformance
contract — that is what the corpus in [`../conformance`](../conformance) pins — not the exact
wording of any one implementation's messages.
