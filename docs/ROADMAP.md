# First-week roadmap

These are proposed increments, not claims that scheduled work has run. Each day should produce a small reviewable change with passing tests and a concrete demonstration.

1. **Foundation — implemented.** Offline consumer contract, deterministic single/seeded splits, synthetic expected events, two assertions, replay files, good/broken examples, tests, and bilingual introduction. The first-run quickstart now includes clone instructions, a tested before/after UTF-8 demo, exact expected output, and bilingual replay steps.
2. **Boundary hardening — partially implemented.** Fixture/replay validation and fixed input/work limits are implemented: 16-KiB bytes, 256 random/512 total candidate partitions, bounded expected records/text, and a 1-MiB bounded CLI replay read. Invalid requests fail before consumer execution. Exact-limit/+1 tests, 21 CLI checks, legacy version-1 compatibility, and a bilingual self-checking demo cover the change. Still open: core-generator injected empty chunks, mixed line endings, and additional malformed UTF-8/EOF sequences. Consumer execution/output remain trusted and unbounded, not sandboxed.
3. **First real adapter — implemented.** Optional `eventsource-parser` 4.1.2 package with integrity lock, streaming UTF-8/ID normalization, 26 regression tests, two negative controls, version-1 replay, and a bilingual reproducible demo. The 20-fixture matrix passes 1183 partitions. Upstream MIT license and absence of runtime dependencies were checked; the core remains dependency-free. Requires Node ≥22.12. Empty chunks and mixed line endings are covered in this integration; general generator hardening remains open.
4. **Smaller failures — implemented.** Opt-in `reduceReplay` deletes cuts in fixed left-to-right order, with 128 default/256 maximum candidate attempts plus two setup calls. It preserves both assertion booleans and the output/error category (errors must retain name/message), never bytes or expected events. Independent original/reduced v1 artifacts remain replayable. 22 API tests and a tested bilingual demo cover stability, budget exhaustion, local single-cut minimality, snapshots, and good/broken replay. Reducer-only JSON-normalized expected-event validation rejects prototype/extra-property semantics before consumer execution; existing replay acceptance is unchanged. No global-minimum, byte-minimization, timeout, or nondeterministic-consumer guarantee is made.
5. **Developer workflow.** Better CLI help, user-supplied fixtures/adapters with explicit trusted-code semantics, readable event diffs, and machine-readable summaries. Decide whether TypeScript declarations add enough value.
6. **Release QA — partially implemented.** The read-only Node 22/24 CI runs the 93 core tests and 26 optional adapter tests, installing the locked example with lifecycle scripts disabled. Official CI actions remain pinned. Hosted CI passed the 40-test baseline `542abf4` ([run](https://github.com/yie793379z-prog/streamsplit/actions/runs/39602457939)); every new published revision still needs its own hosted verification. See [verification](VERIFICATION.md) for local runtimes and review limits. Review repository/package metadata, examples, fixture privacy, and ownership again before release.
7. **Weekly v0.1.** Review API stability, run complete checks, publish only after account access and permission are verified, tag the tested revision, and confirm remote files and CI.

## v0.1 release gate

- Reproducible golden fixtures and a real adapter integration
- Failing demo and fixed replay both tested end to end
- Documented bounds, replay compatibility, and failure output
- Verified supported Node versions and passing CI on the exact revision
- Chosen license, correct authorship/ownership, no credentials or private captures
- Repository and release publication independently confirmed

Keep larger ambitions out of v0.1: hosted services, network capture, LLM-provider compatibility claims, full EventSource conformance, and performance guarantees.
