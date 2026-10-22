# Verification

Verified locally on 2026-10-22 on macOS arm64 using Node.js v22.12.0 (the optional parser's minimum version) and v24.14.1. Both runtimes pass the 40 core tests and 26 optional integration tests. The Node 22 archive came from the official Node.js distribution and matched its published SHA-256 checksum. Historical core verification also passed on Linux x64 with Node v22.23.3 and v24.19.0.

Core tests and CLI require no installation. The optional example needs one npm install, then its tests and demo run offline with synthetic data, no server or credentials. Reproduce its locked installation with:

```sh
npm ci --prefix examples/eventsource-parser --ignore-scripts --no-audit --no-fund
```

| Command | Result | Expected exit |
| --- | --- | --- |
| `node --test` | 40 tests passed, 0 failed | 0 |
| `npm test --prefix examples/eventsource-parser` | 26 integration tests passed, 0 failed | 0 |
| `node examples/eventsource-parser/demo.js` | 20 fixtures, 1183 partitions, 0 failures; broken UTF-8 replay passes with real parser | 0 |
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

The first-run increment exercised its complete clone/change-directory/demo quickstart and the documented test, check, and replay commands from a fresh checkout. The intentional failures were checked for exit code `1`, not ignored; those CLI and replay checks remain in the core suite.

## Optional real parser integration

The [adapter](../examples/eventsource-parser/consumer.js) uses the actual npm distribution of `eventsource-parser` **4.1.2**, not a substitute parser. Its own package and lockfile leave the root dependency-free. The 26 integration tests run explicitly through the example's npm script; they are intentionally outside the root `node --test` discovery pattern so a fresh clone can still run all core checks without npm installation. CI explicitly runs both suites; missing optional dependencies fail that job, rather than silently skipping tests.

Coverage: all 15 shared fixtures plus five original synthetic cases for ID-only retention/reset/NUL rejection, multiple IDs, mixed line endings, partial EOF after a complete event, and stripping only one leading BOM. At seed `20261018`, these produce **1183** partition checks (803 shared + 380 additional). Empty chunks around every byte are also tested for every fixture. Invocation isolation, exact subprocess demo output, no file writes, and both language versions of the expected output are asserted.

Two negative controls use the real parser: decoding chunks separately must preserve the unsplit baseline but fail UTF-8 split expectations and invariance; normalizing only `event.id` must fail the ID-only oracle despite remaining chunk-invariant. A JSON-round-tripped version-1 artifact reproduces the broken decoding and passes with the adapter. The demo also replays the existing illustrative broken consumer's artifact through the real parser.

Dependency review on 2026-10-22: npm metadata, the installed manifest, and the [upstream MIT license](https://github.com/rexxars/eventsource-parser/blob/v4.1.2/LICENSE) were inspected. The installed package has no runtime dependencies; its upstream development dependencies are not installed. The [lockfile](../examples/eventsource-parser/package-lock.json) pins the public npm tarball and SHA-512 integrity. Lifecycle scripts are disabled. Upstream source and license are present in the ignored npm installation, not copied into the repository. This is a bounded license/manifest check, not a full source security audit or a guarantee against vulnerabilities.

The new fixtures contain only synthetic text. Publication review checks the staged diff for credentials, private captures, local paths, accidental dependencies, and whitespace errors. Existing package exports, CLI exit behavior, and replay format remain unchanged.

## Continuous integration

The [workflow](../.github/workflows/ci.yml) runs `node --test`, installs the optional example with `npm ci --ignore-scripts --no-audit --no-fund`, and runs its 26 integration tests on Node 22 and 24 for pushes to `main`, pull requests, and manual dispatches. Each job has a five-minute timeout. No dependency cache, publishing step, or artifact upload is used. The installation requires access to the public npm registry; test execution itself does not require network access.

The workflow requests only `contents: read`, disables persisted checkout credentials, uses `pull_request` rather than `pull_request_target`, and pins the official actions to verified release commits:

- [actions/checkout v7.0.1](https://github.com/actions/checkout/tree/3d3c42e5aac5ba805825da76410c181273ba90b1), [MIT license](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/LICENSE)
- [actions/setup-node v7.1.0](https://github.com/actions/setup-node/tree/949feb2413d6458794dcd2491c4babbbce0c15c1), [MIT license](https://github.com/actions/setup-node/blob/949feb2413d6458794dcd2491c4babbbce0c15c1/LICENSE)

These actions are CI-tooling dependencies only; root `package.json` still has no runtime or development dependencies. The optional example has one separately locked MIT dependency. The original code remains MIT licensed. This review is not a full audit of the actions' transitive dependencies.

Hosted run [39602457939](https://github.com/yie793379z-prog/streamsplit/actions/runs/39602457939) succeeded for the 40-test baseline [`542abf45e4cc2056879a8ddc451a853954ba1c31`](https://github.com/yie793379z-prog/streamsplit/commit/542abf45e4cc2056879a8ddc451a853954ba1c31) on Node 22 and 24. This was rechecked before the adapter changes; the prior CI gap is resolved. It is not hosted evidence for this new adapter revision. After publication, check [GitHub Actions](https://github.com/yie793379z-prog/streamsplit/actions/workflows/ci.yml) for the exact commit and both jobs before claiming its hosted verification.

Not run locally for this increment: other Node versions or operating systems, browsers, HTTP/reconnection/retry-state/timing checks, external lint/type checking, or package publication. The adapter validates final events; it does not establish full SSE conformance or memory bounds. Hosted CI for this exact revision must be checked after publication.

中文摘要：本次在 macOS arm64 的 Node 22.12.0 和 24.14.1 上验证 40 项核心测试、26 项可选适配测试。第三方解析器固定为 4.1.2，20 个合成夹具的 1183 次分块检查通过，并验证两种负对照及旧版 JSON 重放。核心仍无依赖，只有可选示例首次安装需要联网。MIT 许可、锁文件和无运行时传递依赖已检查；远端 CI 必须按发布后的精确提交另行确认，不能拿旧版本的成功记录代替。
