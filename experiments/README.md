# Experiments

Time-boxed spikes that test a proposal **before** anything is proposed for the standard.

Everything in this directory is **informative and disposable**. Nothing here is normative, nothing
here ships to a consumer, and nothing here is part of the conformance corpus:

- it is not referenced by `specs/**` or `schemas/**`;
- it is not in `examples/**`, so it is not in `@brushcodex/fixtures` and not counted by
  `pnpm conformance`;
- it can be deleted in one commit with no effect on any published surface.

That is the point. A spike whose conclusion may be *reject* must not first enlarge the corpus that
third parties validate against.

An experiment MAY be exercised by a test in `packages/validator/src/**` — the reference toolkit is
where executable proof lives, and test files are excluded from the build, so an experiment ships
nothing. Such a test is named `*.experiment.test.ts` and states in its header that it tests a
prototype, not a specification.

## Current experiments

| Experiment | Question | Status |
|---|---|---|
| [`subject-identity/`](subject-identity/) | Can a namespaced extension carry portable Painted Subject identity well enough to support deterministic cross-workflow subject equality, offline, with no registry and no Source Product identity? | **Graduated** 2026-08-28 into Common `target.identity`. Kept as the evidence behind the decision |

## What an experiment is not

It is not a staging area for work that has already been decided, and it is not a way to avoid the
gap-validation gate in [GOVERNANCE.md](../GOVERNANCE.md). A capability graduates into the core only
through that gate: a named concrete consumer, sibling-ownership analysis, the smallest viable shape,
complete conformance fixtures, and a maintainer decision.
