# Verification

## Historical BOM example: 2026-10-26

Verified locally on **macOS arm64, Node.js v24.14.1, npm 11.11.0**: **93 core + 26 existing adapter + 12 historical BOM tests pass**, with no skipped tests. This increment is based on main `dd79470db07fa066d920e83934012ece254c5793`. It adds an isolated optional comparison of real `eventsource-parser` 4.1.0 and 4.1.2; the current 4.1.2 adapter, root dependencies, CLI, public exports, and version-1 replay format are unchanged. The adapter README's stale 69-core-test count was corrected to 93 in both languages.

| Command | Observed result | Exit |
| --- | --- | --- |
| `node --test` | 93 passed; 0 failed/skipped | 0 |
| `npm test --prefix examples/eventsource-parser` | 26 passed; 0 failed/skipped | 0 |
| `npm test --prefix examples/eventsource-parser-bom-history` | 12 passed; 0 failed/skipped | 0 |
| `node examples/eventsource-parser-bom-history/demo.js` | 12 partitions per version; old 3 failures, fixed 0; `[1,3,5,8,10]` reduces to `[1]` in 9 attempts; both v1 artifacts replay red/green | 0 |
| `node examples/eventsource-parser/demo.js` | 20 fixtures; 1183 partitions; 0 failures; UTF-8 replay passes | 0 |
| `node examples/utf8-demo.js` | Broken and fixed UTF-8 outputs asserted | 0 |
| `node examples/limits-demo.js` | Exact bounds, pre-consumer rejection and v1 compatibility asserted | 0 |
| `node examples/reduce-demo.js` | Original reducer demonstration and budget exhaustion asserted | 0 |
| `node src/cli.js check` | 803 partitions; 0 failures | 0 |

Both optional packages were installed from their lockfiles using `npm ci --ignore-scripts --no-audit --no-fund`. For the historical example, reproduce from the root with:

```sh
npm ci --prefix examples/eventsource-parser-bom-history --ignore-scripts --no-audit --no-fund
npm test --prefix examples/eventsource-parser-bom-history
node examples/eventsource-parser-bom-history/demo.js
```

The [historical guide](../examples/eventsource-parser-bom-history/README.md) documents exact output in English and Chinese. Its 11-byte fixture (`efbbbf646174613a780a0a`) and expected event are original synthetic data. Both versions use one shared adapter, preserving the BOM and feeding empty decoded strings. Unsplit succeeds on both; only `single:1`, `single:2`, and `bytewise` fail on 4.1.0. These failures are asserted as the expected historical red result, so a fully verified demo exits 0. It is not a report of a current upstream defect: [PR #41](https://github.com/rexxars/eventsource-parser/pull/41) and the [changelog](https://github.com/rexxars/eventsource-parser/blob/v4.1.2/CHANGELOG.md#411) place the first fix in **4.1.1**, with 4.1.2 containing it.

The 12 tests verify installed versions and lock entries, the literal fixture/oracle, each split BOM byte through JSON v1 replay, all 12 deterministic partitions, no-BOM and explicit empty-chunk controls, fresh invocation state, cut reduction with unchanged bytes/expected events, both versions on both returned artifacts, the last cut's necessity, the fixed parser's `not-failing` result, subprocess exit/exact output/no writes, and both language blocks. Random partitions are disabled for this tiny matrix; it is not exhaustive over cut combinations. Reduction retains the existing local single-cut guarantee, not global or byte minimality. Existing CLI tests still verify intentional failure exit 1 and invalid-input exit 2.

Dependency/license review: exact npm aliases isolate 4.1.0 and 4.1.2 in this private example, with public registry URLs and SHA-512 integrity in its lockfile. Installed manifests and license files confirm both are MIT licensed and have no runtime dependencies. No upstream tests/source or personal/private captures were copied into tracked files; distribution source/license files remain in ignored installations. Retain upstream notices if redistributing those packages. This is a scoped license/manifest and changed-file review, not a full security audit.

CI now explicitly installs and runs the historical suite in the existing Node 22/24 matrix. Action pins, read-only workflow permissions, and disabled checkout credential persistence are unchanged. The **baseline** `dd79470` has a successful [hosted run on both Node versions](https://github.com/yie793379z-prog/streamsplit/actions/runs/40076076634); that is not hosted verification of this new increment. **Node 22, Linux, browsers, and hosted CI were not run for this increment.** No new Node runtime was installed locally. Verify the final exact published revision in CI before claiming Node 22 support was exercised for this change.

中文：2026-10-26 在 macOS arm64、Node 24.14.1 / npm 11.11.0 上实测 93 项核心、26 项原适配器、12 项历史 BOM 测试，全通过且无跳过。新增独立锁定的 4.1.0 / 4.1.2 比较，共用适配器、自写 11 字节夹具和预期事件，确定矩阵旧版 12/3、新版 12/0；9 次尝试将 5 个切点缩为 `[1]`，原始与缩减 v1 数据均完成红绿重放。首次修复是 4.1.1，不声称当前上游仍有缺陷。两版安装包的 MIT 许可、无运行时传递依赖及完整性锁已核验。核心、现有适配器实现、CLI 和协议未变；修正旧适配器双语 README 的 69→93 计数。所有演示及既有 803/0、1183/0 检查通过。此次未运行 Node 22、Linux 或新提交的远端 CI；既有基线 CI 成功不能替代新提交验证。

## Earlier verification records

Verified locally on 2026-10-24 on Linux x64 using Node.js v22.23.3 and v24.22.1: **93 core tests and 26 optional integration tests pass on each runtime**, with no skipped tests. That cut-reduction increment was based on main `791b60119cafc66c5b0e49116db55531b59fbfed`. The Node 22 Linux archive came from the official distribution and matched its published SHA-256 checksum.

Historical input-bounds verification on 2026-10-23 passed the then-current 69 core and 26 optional tests on Linux x64 with Node v22.23.3 and v24.19.0. Those results are not a rerun of this cut-reduction revision.

Historical adapter verification on 2026-10-22 passed the then-current 40 core tests and 26 adapter tests on macOS arm64 with Node v22.12.0 (the optional parser's minimum) and v24.14.1. That Node 22 archive came from the official distribution and matched its published SHA-256 checksum. Those macOS results are not a rerun of this input-bounds revision.

Core tests and CLI require no installation. The optional example needs one npm install, then its tests and demo run offline with synthetic data, no server or credentials. Reproduce its locked installation with:

```sh
npm ci --prefix examples/eventsource-parser --ignore-scripts --no-audit --no-fund
```

| Command | Result | Expected exit |
| --- | --- | --- |
| `node --test` | 93 tests passed, 0 failed | 0 |
| `npm test --prefix examples/eventsource-parser` | 26 integration tests passed, 0 failed | 0 |
| `node examples/eventsource-parser/demo.js` | 20 fixtures, 1183 partitions, 0 failures; broken UTF-8 replay passes with real parser | 0 |
| `node examples/utf8-demo.js` | Reproduces UTF-8 corruption at byte 7, then verifies fixed replay; no files written | 0 |
| `node examples/limits-demo.js` | Exact byte limit accepted, oversized bytes/excess partitions rejected before consumers; v1 replay passes; no files written | 0 |
| `node examples/reduce-demo.js` | 6 cuts reduce to 1 in 9 attempts with identical bytes/expected; both v1 artifacts replay; budget exhaustion retains failure; no files written | 0 |
| `node --test test/reduction.test.js` | 22 cut-reduction tests passed, 0 failed | 0 |
| `node --test test/cli.test.js` | 21 CLI integration tests passed, 0 failed | 0 |
| `node src/cli.js check` | 803 partitions, 0 failures, 15 fixtures | 0 |
| `node src/cli.js check --broken` | 803 partitions, 66 intentional failures | 1 |
| `node src/cli.js replay artifacts/broken-utf8.json --broken` | Expected-output and invariance checks both fail | 1 |
| `node src/cli.js replay artifacts/broken-utf8.json` | Both checks pass | 0 |

The broken consumer's failures are concentrated in UTF-8 (40) and BOM (26) fixtures. The first saved UTF-8 failure changes `你好 🌊 café` into `���好 🌊 café`, while its unsplit baseline remains correct.

The original 28 library tests verify deterministic and unique partitions, byte preservation, bounded single-cut enumeration, invalid cuts/options, consistently wrong but invariant consumers, async adapters, exceptions, malformed outputs, replay JSON round-tripping, malformed replay rejection, protection against input mutation, and package entry points.

The 21 CLI tests run real child processes using the same Node executable as the test runner. They check the default/explicit good command; the deliberately broken command's exact exit code `1`, failure totals, and two JSON artifacts; broken and fixed replay of both artifacts; invalid usage; and missing, invalid JSON, or malformed replay files returning `2`. New checks cover a replay file exactly at 1 MiB and one byte above (including whitespace), directories, regular-file symlinks, a POSIX FIFO without a writer, and clear rejection of oversized bytes/events/text, bad base64, or invalid cuts. Each test uses an isolated temporary working directory that is cleaned up afterward. Child processes have a ten-second timeout and one-MiB output limit; these are test safeguards, separate from the CLI input-file cap. Runtime warnings on stderr are allowed; CLI errors are checked explicitly. Symlink/FIFO tests are skipped on Windows, which was not tested locally.

The two first-run checks run `examples/utf8-demo.js` as a real child process, assert its exact output and successful exit, confirm that it writes no files, and keep the English and Chinese README output blocks in sync with that verified output. The demo uses the same UTF-8 fixture and replay functions as the CLI and asserts the broken and corrected behavior before reporting success.

The first-run increment exercised its complete clone/change-directory/demo quickstart and the documented test, check, and replay commands from a fresh checkout. The intentional failures were checked for exit code `1`, not ignored; those CLI and replay checks remain in the core suite.

## Deterministic bounded cut reduction

The opt-in `reduceReplay` API is covered by 22 new tests. Fixed left-to-right single-cut deletion restarts after every accepted deletion. Tests assert the exact candidate order, repeatable reports for deterministic adapters, the necessity of restarting, and a deliberately nonmonotonic example that is single-cut minimal but not globally minimal. The existing CLI commands remain unchanged.

Budget tests cover default 128 and hard cap 256 candidate invocations, the exact cap and one above, zero budget, invalid options before any consumer execution, exhaustion after a successful reduction, and completion on the final budget unit. Two setup calls verify original output and baseline; every candidate attempt, accepted or rejected, consumes one unit. Empty/one-byte inputs with no cuts are complete without candidate attempts. Good consumers return `not-failing` without candidate calls; consistently wrong but invariant consumers may reduce to zero cuts.

The preservation predicate keeps both original assertion booleans, including an originally successful assertion. Event-output failures cannot be replaced by exceptions/malformed output; exceptions must preserve normalized name and message. Tests cover two failed assertions, either individual assertion, unrelated errors, error-to-event changes, and async consumers. The predicate does not prove an identical root cause or exact wrong event text, and assumes deterministic fresh-state adapters.

Both returned artifacts remain independently JSON-round-trippable version-1 data; they reproduce the broken UTF-8 failure and pass with the good consumer. Tests verify byte/expected equality, copied cuts, ignored forged diagnostics, independent snapshots, consumer chunk mutations, and caller mutations before an async consumer resolves. Existing replay validation and bounds also run before reduction setup calls. A reducer-only normalized expected-event snapshot check rejects custom/null-prototype records, record symbols, custom array prototypes, and named array properties before any consumer invocation. Without this check, snapshot/JSON normalization could silently change an expected-event failure into a pass; regression tests demonstrate the prior replay semantics and explicit caller-side JSON normalization. Existing `replay` acceptance is unchanged. No new replay version, executable adapter paths, dependencies, workflow permissions, or automatic CLI reduction were introduced.

Two new demo/documentation checks run `examples/reduce-demo.js` in an isolated temporary directory, assert exact output and no writes, and keep both README language blocks synchronized. The demo reduces `[1,6,7,12,23,24]` to `[7]` in nine attempts, preserves all 25 bytes and expected events, replays both artifacts through broken/fixed consumers, and verifies that a two-attempt budget returns a still-failing four-cut artifact with `budget-exhausted`. The 66 API/library, 21 CLI, and six demo/documentation checks total **93 core tests**. Original good/broken and real-adapter totals remain **803/0**, **803/66**, and **1183/0**.

This is a bounded search, not a timeout, sandbox, byte minimizer, or globally optimal reducer. Consumer work/output, getters/proxies, and nondeterministic/stateful adapters remain trusted/out of scope. `complete` asserts only that no single remaining cut can be deleted while preserving this predicate; `budget-exhausted` makes no minimality claim and returns the last verified candidate.

## Input bounds and version-1 compatibility

The 16 input-boundary API tests cover the fixed byte/random/partition/event/text/name budgets at their exact boundaries and one step above, with a zero-call consumer spy for invalid requests. They also cover malformed options/fixtures/expected records (including sparse arrays), canonical base64, invalid cut types/counts/order/offsets, immutable exported limits, empty/Buffer-backed inputs, and `makeReplay` validation. The library count at that milestone was 44; cut reduction adds 22 more. Candidate counts are checked before deduplication and cut allocation; duplicate output partitions do not exempt work from the budget.

Two input-bounds demonstration/documentation tests execute `examples/limits-demo.js`, verify exact output, assert no file writes, and keep its English/Chinese README blocks synchronized. The four demo checks plus 44 API/library and 21 CLI checks made 69 core tests before cut reduction. Original good/broken totals remain **803/0** and **803/66**; the real adapter remains **1183/0**.

Version 1 is unchanged. Old normalized artifacts within the new limits still pass with the fixed consumer and reproduce the known broken decoder. Minimal artifacts without `fixture`, `partition`, `observed`, or `baseline` are explicitly accepted; saved diagnostics are ignored and baseline is recomputed. Previously accepted non-normalized expected records and oversized inputs now reject intentionally. This is not a guarantee that every formerly accepted arbitrary JavaScript object will remain accepted.

The CLI opens files nonblocking on POSIX, requires a regular file, checks initial size, then reads at most the cap plus one sentinel byte before JSON parsing. This guards allocation even if size changes after `stat`; the size-boundary and FIFO behavior are tested without a race-dependent growth test. No input or expected-output quota is a total-memory guarantee: consumer output/execution, JavaScript getters/proxies, and caller-owned objects remain trusted. No consumer timeout, sandbox, streaming-performance or full-conformance claim is made.

No new third-party dependencies or workflow permissions were added. The existing locked `eventsource-parser` 4.1.2 was installed from the official npm registry with lifecycle scripts disabled; its installed MIT license, manifest version, and absence of runtime dependencies were rechecked. The original code remains MIT licensed. A scoped publication review checks the changed source/tests/docs for credentials, private captures, local paths, accidental dependencies, and whitespace errors; this is not a full security or license audit.

## Optional real parser integration

The [adapter](../examples/eventsource-parser/consumer.js) uses the actual npm distribution of `eventsource-parser` **4.1.2**, not a substitute parser. Its own package and lockfile leave the root dependency-free. The 26 integration tests run explicitly through the example's npm script; they are intentionally outside the root `node --test` discovery pattern so a fresh clone can still run all core checks without npm installation. CI explicitly runs the core and both optional suites; missing optional dependencies fail that job, rather than silently skipping tests.

Coverage: all 15 shared fixtures plus five original synthetic cases for ID-only retention/reset/NUL rejection, multiple IDs, mixed line endings, partial EOF after a complete event, and stripping only one leading BOM. At seed `20261018`, these produce **1183** partition checks (803 shared + 380 additional). Empty chunks around every byte are also tested for every fixture. Invocation isolation, exact subprocess demo output, no file writes, and both language versions of the expected output are asserted.

Two negative controls use the real parser: decoding chunks separately must preserve the unsplit baseline but fail UTF-8 split expectations and invariance; normalizing only `event.id` must fail the ID-only oracle despite remaining chunk-invariant. A JSON-round-tripped version-1 artifact reproduces the broken decoding and passes with the adapter. The demo also replays the existing illustrative broken consumer's artifact through the real parser.

Dependency review on 2026-10-22: npm metadata, the installed manifest, and the [upstream MIT license](https://github.com/rexxars/eventsource-parser/blob/v4.1.2/LICENSE) were inspected. The installed package has no runtime dependencies; its upstream development dependencies are not installed. The [lockfile](../examples/eventsource-parser/package-lock.json) pins the public npm tarball and SHA-512 integrity. Lifecycle scripts are disabled. Upstream source and license are present in the ignored npm installation, not copied into the repository. This is a bounded license/manifest check, not a full source security audit or a guarantee against vulnerabilities.

The new fixtures contain only synthetic text. Publication review checks the staged diff for credentials, private captures, local paths, accidental dependencies, and whitespace errors. Existing package exports, CLI exit behavior, and replay format remain unchanged.

## Continuous integration

The [workflow](../.github/workflows/ci.yml) runs `node --test`, installs each optional example with `npm ci --ignore-scripts --no-audit --no-fund`, and separately runs the 26 adapter tests and 12 historical BOM tests on Node 22 and 24 for pushes to `main`, pull requests, and manual dispatches. Each job has a five-minute timeout. No dependency cache, publishing step, or artifact upload is used. The installation requires access to the public npm registry; test execution itself does not require network access.

The workflow requests only `contents: read`, disables persisted checkout credentials, uses `pull_request` rather than `pull_request_target`, and pins the official actions to verified release commits:

- [actions/checkout v7.0.1](https://github.com/actions/checkout/tree/3d3c42e5aac5ba805825da76410c181273ba90b1), [MIT license](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/LICENSE)
- [actions/setup-node v7.1.0](https://github.com/actions/setup-node/tree/949feb2413d6458794dcd2491c4babbbce0c15c1), [MIT license](https://github.com/actions/setup-node/blob/949feb2413d6458794dcd2491c4babbbce0c15c1/LICENSE)

These actions are CI-tooling dependencies only; root `package.json` still has no runtime or development dependencies. The current adapter has one separately locked MIT dependency; the historical example separately locks two aliases of the same MIT package. The original code remains MIT licensed. This review is not a full audit of the actions' transitive dependencies.

Hosted run [39602457939](https://github.com/yie793379z-prog/streamsplit/actions/runs/39602457939) succeeded for the 40-test baseline [`542abf45e4cc2056879a8ddc451a853954ba1c31`](https://github.com/yie793379z-prog/streamsplit/commit/542abf45e4cc2056879a8ddc451a853954ba1c31) on Node 22 and 24. This was rechecked before the adapter changes; the prior CI gap is resolved. It is not hosted evidence for the current cut-reduction revision. After publication, check [GitHub Actions](https://github.com/yie793379z-prog/streamsplit/actions/workflows/ci.yml) for the exact commit and both jobs before claiming its hosted verification.

Not run locally for the 2026-10-24 increment: other Node versions or operating systems, browsers, HTTP/reconnection/retry-state/timing checks, external lint/type checking, or package publication. The adapter validates final events; it does not establish full SSE conformance or memory bounds. See the current verification section above for the new increment's runtime and hosted-CI limits.

历史中文摘要（2026-10-24）：当时在 Linux x64 的 Node 22.23.3 和 24.22.1 上验证 93 项核心测试、26 项可选适配测试，均无跳过。新增有上限的确定性 cut 缩减 API、22 项边界/失败保持测试及双语自检演示；不修改 bytes/expected，不将无关异常当作保留，原始与缩减数据均保持 v1 重放兼容。只保证单 cut 局部最小，不保证全局最小或超时。此前的输入边界和 803/1183 次检查结果不变。第三方解析器固定为 4.1.2，20 个合成夹具的 1183 次分块检查通过，并验证两种负对照及旧版 JSON 重放。核心仍无依赖，只有可选示例首次安装需要联网。MIT 许可、锁文件和无运行时传递依赖已检查。新迭代的本机及远端验证状态以本文开头为准。
