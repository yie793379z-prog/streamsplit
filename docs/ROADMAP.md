# First-week roadmap

These are proposed increments, not claims that scheduled work has run. Each day should produce a small reviewable change with passing tests and a concrete demonstration.

1. **Foundation — implemented.** Offline consumer contract, deterministic single/seeded splits, synthetic expected events, two assertions, replay files, good/broken examples, tests, and bilingual introduction.
2. **Boundary hardening.** Inject empty chunks, mixed line endings, additional malformed UTF-8/EOF sequences; improve fixture and replay validation; add CLI integration tests and input limits.
3. **First real adapter.** Integrate one established parser through an optional example, keeping the core dependency-free. Pin and document its version; distinguish normalization from parser behavior. Validate availability and licensing before selecting a package.
4. **Smaller failures.** Deterministically reduce cut lists while preserving a failure. Store original and reduced partitions; test that reduction is stable and replayable.
5. **Developer workflow.** Better CLI help, user-supplied fixtures/adapters with explicit trusted-code semantics, readable event diffs, and machine-readable summaries. Decide whether TypeScript declarations add enough value.
6. **Release QA.** Test Node 22 and 24, add CI configuration, verify repository/package metadata and examples, inspect fixtures for secrets, review MIT license and ownership, and document limits.
7. **Weekly v0.1.** Review API stability, run complete checks, publish only after account access and permission are verified, tag the tested revision, and confirm remote files and CI.

## v0.1 release gate

- Reproducible golden fixtures and a real adapter integration
- Failing demo and fixed replay both tested end to end
- Documented bounds, replay compatibility, and failure output
- Verified supported Node versions and passing CI on the exact revision
- Chosen license, correct authorship/ownership, no credentials or private captures
- Repository and release publication independently confirmed

Keep larger ambitions out of v0.1: hosted services, network capture, LLM-provider compatibility claims, full EventSource conformance, and performance guarantees.
