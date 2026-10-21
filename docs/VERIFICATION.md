# Verification

Verified locally on 2026-10-21 on Linux x64 using Node.js v22.23.3 and v24.19.0. Both runtimes pass the commands below. No dependency installation or network requests are required by the tests or CLI. Node 22 was downloaded separately from the official Node.js distribution and its archive was checked against the published SHA-256 checksum.

| Command | Result | Expected exit |
| --- | --- | --- |
| `node --test` | 40 tests passed, 0 failed | 0 |
| `node examples/utf8-demo.js` | Reproduces UTF-8 corruption at byte 7, then verifies fixed replay; no files written | 0 |
| `node --test test/cli.test.js` | 10 CLI integration tests passed, 0 failed | 0 |
| `node src/cli.js check` | 803 partitions, 0 failures, 15 fixtures | 0 |
| `node src/cli.js check --broken` | 803 partitions, 66 intentional failures | 1 |
| `node src/cli.js replay artifacts/broken-utf8.json --broken` | Expected-output and invariance checks both fail | 1 |
| `node src/cli.js replay artifacts/broken-utf8.json` | Both checks pass | 0 |

The broken consumer's failures are concentrated in UTF-8 (40) and BOM (26) fixtures. The first saved UTF-8 failure changes `你好 🌊 café` into `���好 🌊 café`, while its unsplit baseline remains correct.

The 28 library tests verify deterministic and unique partitions, byte preservation, bounded single-cut enumeration, invalid cuts/options, consistently wrong but invariant consumers, async adapters, exceptions, malformed outputs, replay JSON round-tripping, malformed replay rejection, protection against input mutation, and package entry points.

The 10 CLI tests run real child processes using the same Node executable as the test runner. They check the default/explicit good command; the deliberately broken command's exact exit code `1`, failure totals, and two JSON artifacts; broken and fixed replay of both artifacts; invalid usage; and missing, invalid JSON, or malformed replay files returning `2`. Each test uses an isolated temporary working directory that is cleaned up afterward. Child processes have a ten-second timeout and one-MiB output limit; these are test safeguards, not limits on the library or CLI itself. Runtime warnings on stderr are allowed; CLI errors are checked explicitly.

The two first-run checks run `examples/utf8-demo.js` as a real child process, assert its exact output and successful exit, confirm that it writes no files, and keep the English and Chinese README output blocks in sync with that verified output. The demo uses the same UTF-8 fixture and replay functions as the CLI and asserts the broken and corrected behavior before reporting success.

The complete clone/change-directory/demo quickstart and the documented test, check, and replay commands were also exercised from a fresh checkout with the first-run changes applied. The intentional failures were checked for exit code `1`, not ignored.

## Continuous integration

The [workflow](../.github/workflows/ci.yml) runs `node --test` on Node 22 and 24 for pushes to `main`, pull requests, and manual dispatches. Each job has a five-minute timeout. No `npm install`, dependency cache, publishing step, or artifact upload is used.

The workflow requests only `contents: read`, disables persisted checkout credentials, uses `pull_request` rather than `pull_request_target`, and pins the official actions to verified release commits:

- [actions/checkout v7.0.1](https://github.com/actions/checkout/tree/3d3c42e5aac5ba805825da76410c181273ba90b1), [MIT license](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/LICENSE)
- [actions/setup-node v7.1.0](https://github.com/actions/setup-node/tree/949feb2413d6458794dcd2491c4babbbce0c15c1), [MIT license](https://github.com/actions/setup-node/blob/949feb2413d6458794dcd2491c4babbbce0c15c1/LICENSE)

These are CI-tooling dependencies only; `package.json` still has no runtime or development dependencies. The original code remains MIT licensed. This review is not a full audit of the actions' transitive dependencies.

Hosted run [39562700416](https://github.com/yie793379z-prog/streamsplit/actions/runs/39562700416) passed for commit [`48d03daffa90ca2f3a30468e83de8598a4c7a335`](https://github.com/yie793379z-prog/streamsplit/commit/48d03daffa90ca2f3a30468e83de8598a4c7a335) on 2026-10-21. Both job logs show all 38 tests present at that revision passing: Node v22.23.3 and Node v24.22.0. This is a historical hosted result; the current first-run changes add two tests, for 40 local passes. Check [GitHub Actions](https://github.com/yie793379z-prog/streamsplit/actions/workflows/ci.yml) for the exact current commit before treating its hosted CI as verified.

Not run locally: other Node patch versions or operating systems, browser tests, third-party parser integrations, lint/type checking with external tools, or package publication. Hosted CI for the new first-run changes must be checked after publication.
