# First-week roadmap

These are proposed increments, not claims that scheduled work has run. Each day should produce a small reviewable change with passing tests and a concrete demonstration.

1. **Foundation — implemented.** Offline consumer contract, deterministic single/seeded splits, synthetic expected events, two assertions, replay files, good/broken examples, tests, and bilingual introduction. The first-run quickstart now includes clone instructions, a tested before/after UTF-8 demo, exact expected output, and bilingual replay steps.
2. **Boundary hardening — partially implemented.** CLI integration tests now cover the good and deliberately broken commands, artifact creation, broken/fixed replay, invalid usage, and malformed or missing replay files. Still open: injected empty chunks, mixed line endings, additional malformed UTF-8/EOF sequences, stronger fixture/replay validation, and input limits.
3. **First real adapter.** Integrate one established parser through an optional example, keeping the core dependency-free. Pin and document its version; distinguish normalization from parser behavior. Validate availability and licensing before selecting a package.
4. **Smaller failures.** Deterministically reduce cut lists while preserving a failure. Store original and reduced partitions; test that reduction is stable and replayable.
5. **Developer workflow.** Better CLI help, user-supplied fixtures/adapters with explicit trusted-code semantics, readable event diffs, and machine-readable summaries. Decide whether TypeScript declarations add enough value.
6. **Release QA — partially implemented.** All 40 tests pass locally on Node 22.23.3 and 24.19.0; a read-only CI workflow targets Node 22 and 24. The core remains dependency-free, official CI actions are pinned, and their MIT licenses were reviewed. Hosted CI passed the 38-test revision `48d03da` ([run](https://github.com/yie793379z-prog/streamsplit/actions/runs/39562700416)); every new published revision still needs its own hosted verification. Review repository/package metadata, examples, fixture privacy, and ownership again before release.
7. **Weekly v0.1.** Review API stability, run complete checks, publish only after account access and permission are verified, tag the tested revision, and confirm remote files and CI.

## v0.1 release gate

- Reproducible golden fixtures and a real adapter integration
- Failing demo and fixed replay both tested end to end
- Documented bounds, replay compatibility, and failure output
- Verified supported Node versions and passing CI on the exact revision
- Chosen license, correct authorship/ownership, no credentials or private captures
- Repository and release publication independently confirmed

Keep larger ambitions out of v0.1: hosted services, network capture, LLM-provider compatibility claims, full EventSource conformance, and performance guarantees.
