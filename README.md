# StreamSplit

[![CI](https://github.com/yie793379z-prog/streamsplit/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/yie793379z-prog/streamsplit/actions/workflows/ci.yml)
[English](#run-in-a-minute) · [中文快速开始](#中文快速开始)

**Same bytes. Different chunks. Same events?**

Catch SSE bugs that only appear when a UTF-8 character or line ending crosses a chunk boundary. StreamSplit replays the same bytes through your consumer with different cuts, checks the resulting events, and saves failing cases for exact replay.

For JavaScript developers writing or wrapping Server-Sent Events (SSE) consumers: turn an intermittent garbled-text bug into a small, offline regression test. The core has no dependencies and needs no API key or live server.

Status: early prototype, version 0.0.1. This is a small test harness, not a production SSE client or a complete conformance suite. Released under the [MIT license](LICENSE).

## Run in a minute

Requires Git and **Node.js 22 or later**. Clone once; the demo and tests then run offline, with no dependency installation or account needed.

```sh
git clone https://github.com/yie793379z-prog/streamsplit.git
cd streamsplit
node examples/utf8-demo.js
```

Expected output, generated from the included UTF-8 fixture and verified by tests:

<!-- utf8-demo-output -->
```text
StreamSplit: same bytes, different chunks
Unsplit / broken decoder: "你好 🌊 café"
Cut at byte 7 / broken decoder: "���好 🌊 café"
Cut at byte 7 / streaming decoder: "你好 🌊 café"
PASS: reproduced the UTF-8 bug and verified the fix.
```

The cut is inside `你`. A new decoder for each chunk corrupts the text; one streaming decoder preserves it. This demo exits `0` only after asserting that the bug reproduces and the fixed consumer passes. It writes no files. See the [demo](examples/utf8-demo.js) and the [two consumers](examples/consumers.js).

### Run the core checks and replay a failure

From the same directory:

```sh
node --test
node src/cli.js check
```

The good consumer finishes with:

```text
803 partition checks; 0 failures (good consumer)
```

Now try the deliberately broken decoder:

```sh
node src/cli.js check --broken
```

This command is **supposed to exit `1`**. Its last line is:

```text
803 partition checks; 66 failures (deliberately broken consumer)
```

It writes the first failing partition for each fixture to `artifacts/`. Run these commands separately to replay exactly those bytes and cuts:

```sh
node src/cli.js replay artifacts/broken-utf8.json --broken
```

Expected: exit `1`; `actual.events[0].data` is `"���好 🌊 café"`, and both `matchesExpected` and `chunkInvariant` are `false`.

```sh
node src/cli.js replay artifacts/broken-utf8.json
```

Expected: exit `0`; the data is `"你好 🌊 café"`, and both checks are `true`. The saved bytes and cuts stay unchanged.

CLI exit codes: `0` all assertions pass; `1` a regression is detected; `2` invalid usage or an operational error. Shortcuts: `npm test`, `npm run demo:utf8`, `npm run demo`, and `npm run demo:broken`.

`node --test` includes CLI regression tests: they assert the broken command's exit code is exactly `1`, then replay its artifacts with both consumers. Artifacts created by these tests live in temporary directories and are cleaned up automatically. Run just the CLI checks with `node --test test/cli.test.js`.

## Test your consumer

The library API accepts a function that receives `Uint8Array[]` and returns an event array, synchronously or asynchronously. Normalize each event to exactly `{ type, data, lastEventId }`, with string values. Instantiate fresh parser state inside every adapter invocation. Your adapter owns finishing or closing its parser.

```js
import { checkFixture } from './src/harness.js';
import { fixtures } from './fixtures/sse.js';
import { goodConsumer } from './examples/consumers.js';

// Replace goodConsumer with your adapter.
const report = await checkFixture(goodConsumer, fixtures[1], {
  seed: 123,
  randomCases: 32,
  singleSplitLimit: 256,
});
console.log(report.passed);
console.log(report.cases.filter(c => !c.matchesExpected || !c.chunkInvariant));
```

When used as a local package dependency, the exports are `streamsplit` (harness), `streamsplit/partitions`, `streamsplit/fixtures`, and `streamsplit/examples`. This repository is not published to npm.

### Try a real third-party parser

The optional [eventsource-parser adapter](examples/eventsource-parser/README.md) pins **4.1.2** (MIT, no runtime dependencies) in a separate package. It requires **Node ≥22.12**. From the repository root:

```sh
npm ci --prefix examples/eventsource-parser --ignore-scripts --no-audit --no-fund
npm test --prefix examples/eventsource-parser
node examples/eventsource-parser/demo.js
```

Installation needs network access once; tests and demo then run offline. Expected: **26 adapter tests pass; 20 fixtures, 1183 partition checks, 0 failures**. The demo also verifies version-1 UTF-8 replay. See the linked bilingual guide for exact output, ID normalization, negative controls, and license details. Root `node --test` runs the 93 dependency-free core tests; CI runs the core and both optional suites.

### Replay an already-fixed upstream bug

The optional [historical BOM example](examples/eventsource-parser-bom-history/README.md) compares real, separately locked **eventsource-parser 4.1.0 and 4.1.2** using the same adapter. An original 11-byte fixture produces **3 failures in 12 partitions** on 4.1.0 and **0** on 4.1.2; cut reduction changes `[1,3,5,8,10]` to `[1]`, and both v1 artifacts replay red/green. The first fix was **4.1.1** ([upstream PR #41](https://github.com/rexxars/eventsource-parser/pull/41)); this is a historical demonstration, not a current upstream bug claim. The existing 4.1.2 adapter stays pinned.

```sh
npm ci --prefix examples/eventsource-parser-bom-history --ignore-scripts --no-audit --no-fund
npm test --prefix examples/eventsource-parser-bom-history
node examples/eventsource-parser-bom-history/demo.js
```

Requires Node ≥22.12. Expected: **12 additional tests pass**; the self-checking demo exits `0` only when the historical failure and fixed result are both verified, and writes no files. See the linked bilingual guide for exact output, source attribution, and dependency/license details. Core tests still need no installation.

Each partition is checked against two independent expectations:

- **Expected events:** manually specified fixture output, to catch consistently wrong parsers.
- **Chunk invariance:** the same consumer's unsplit output, to isolate chunk-dependent behavior.

Thrown errors and malformed event outputs are captured as failing results. Input slices and baseline outputs are copied to reduce mutation interference. Extra event properties participate in comparison, so normalize your adapter output first.

## What is covered

15 original synthetic fixtures cover UTF-8, a leading BOM, replacement decoding, LF/CRLF/CR line endings, comments, multiline data, field spacing, event names, ID retention/reset, NUL IDs, empty data, and incomplete EOF. Expected values are hand-authored rather than generated by the example parser. Fixture semantics are informed by the [WHATWG SSE parsing and interpretation sections](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream).

The generator includes an unsplit baseline, every single interior cut for streams up to 256 bytes, byte-by-byte chunks, and seeded random partitions. Duplicate partitions are removed. “Every single cut” does **not** mean every combination of cuts. The CLI uses seed `20261018` so results are reproducible; changing the seed through the API explores different samples.

## Replay format

A version-1 JSON artifact stores original bytes as base64, interior byte offsets, expected events, observed output, baseline, fixture name, and partition label. Replay uses the stored bytes and cuts, so it does not depend on the current fixture text or PRNG. It recomputes the baseline using your selected consumer. Artifacts contain data, never executable adapter paths.

Artifacts can contain response contents. Use synthetic or appropriately redacted data before sharing them. Generated artifacts are gitignored. Version 1 remains unchanged: existing normalized artifacts within the limits below still replay, and optional diagnostic metadata (`fixture`, `partition`, `observed`, `baseline`) is not required or executed. Replay recomputes both results rather than trusting saved observations.

## Input limits and validation

The harness is for small, trusted local regression fixtures, not large captures. Fixed limits are exported as the frozen `LIMITS` object from `streamsplit` (or `./src/harness.js`); they are not configurable overrides.

| Input or work budget | Maximum |
| --- | --- |
| Fixture or decoded replay bytes; direct `partitions`/`chunkBytes` input | 16,384 bytes (16 KiB) |
| `randomCases` | 256 |
| Partition candidates, **before deduplication** | 512 |
| Expected events | 256 |
| Combined UTF-8 bytes in expected `type`, `data`, `lastEventId` strings | 65,536 bytes (64 KiB) |
| Fixture name, nonempty string | 256 UTF-8 bytes |
| Replay JSON file read by the CLI, including whitespace/diagnostics | 1,048,576 bytes (1 MiB) |
| Cut-reduction candidate attempts (`maxAttempts`, default 128) | 256 (+2 setup consumer calls) |

Fixtures must supply a `Uint8Array` (including `Buffer`) and an expected array of records containing **exactly** the three own string fields `{ type, data, lastEventId }`. Sparse arrays, coercible byte arrays/strings, malformed records, noncanonical base64, and unsorted, repeated, fractional, or non-interior cuts are rejected. Empty bytes and empty expected arrays remain valid. Replay offsets must be an array of sorted unique interior byte positions; their count cannot exceed `max(0, byteLength - 1)`.

The candidate budget is `2 + singleCuts + randomCases`: one whole candidate, one bytewise candidate, and `singleCuts = max(0, byteLength - 1)` only when `byteLength <= singleSplitLimit` (otherwise zero). Duplicates count toward this budget, even for empty inputs. Lower `randomCases` or `singleSplitLimit` if a request exceeds it. Default fixtures, seeds, partition labels, and the 803/1183 check totals are unchanged.

Validation rejects invalid inputs with `TypeError` or `RangeError` **before any consumer call**. This differs from consumer exceptions/malformed output, which remain captured regression results. The CLI reports invalid input on stderr, writes no replay result to stdout, and exits `2`; oversized files are rejected before JSON parsing, and reading remains bounded even if a file grows after the size check. Only regular files (including symlinks to regular files) are accepted.

These are **input/work bounds, not a security sandbox or total-memory guarantee**. Consumer execution, returned output, JavaScript getters/proxies, and caller-owned objects remain trusted: there is no timeout, subprocess isolation, or output quota. Large or sensitive captures should be reduced/redacted first. Generated diagnostics also count toward the CLI file limit: a `makeReplay` artifact larger than 1 MiB cannot be replayed through the CLI.

Run the self-checking, no-file-write demonstration with `node examples/limits-demo.js` (or `npm run demo:limits`):

<!-- limits-demo-output -->
```text
StreamSplit: bounded inputs before consumer execution
PASS: 16384-byte input accepted
REJECT: bytes exceed 16384-byte limit (consumer calls: 0)
REJECT: partition candidates exceed 512 limit; lower randomCases or singleSplitLimit (consumer calls: 0)
PASS: version-1 replay remains compatible
```

## Reduce a failing cut list

`reduceReplay(consumer, artifact, { maxAttempts: 128 })` accepts an existing version-1 replay and returns **separate `original` and `reduced` version-1 artifacts**, plus `originalResult`, `reducedResult`, `attempts`, and `status`. The result objects have the same assertion fields as `replay`. Save the two artifacts separately with `JSON.stringify`; either can be passed to the existing `replay` API or CLI. This is an opt-in library API; `check` and `replay` CLI behavior is unchanged.

```js
import { reduceReplay } from './src/harness.js';

// consumer is your fresh-state adapter; artifact is an existing v1 replay.
const reduction = await reduceReplay(consumer, artifact, { maxAttempts: 128 });
console.log(reduction.original.cuts, reduction.reduced.cuts);
console.log(reduction.status, reduction.attempts);
```

The reducer tries deleting one cut at a time, left to right, restarting from the left after each accepted deletion. It never edits bytes or expected events, and only accepts a candidate with **the same two assertion booleans** as the original. An event mismatch cannot turn into an exception; an original exception must retain its normalized error name and message. This preserves the failure category, not necessarily the precise wrong event text or the underlying root cause. Saved observations are ignored: original output and its unsplit baseline are recomputed once, then every candidate is compared with that fixed baseline.

- `complete`: no remaining single-cut deletion preserves this failure (or no cuts remain). This is **local single-cut minimality**, not a globally smallest cut set or byte minimization.
- `budget-exhausted`: the budget stopped the search; `reduced` is the last verified failure, possibly unchanged. No minimality claim is made.
- `not-failing`: both original checks pass, so no candidate is tried and the cuts are unchanged.

`maxAttempts` must be a nonnegative safe integer, defaults to 128, and cannot exceed `LIMITS.maxReductionAttempts` (256). `attempts` counts candidate calls only; two additional calls verify the original and baseline, even with a zero budget. Invalid options/replays reject before any consumer call. For identical inputs and deterministic, fresh-state consumers, results and attempt order are repeatable. Nondeterministic/stateful consumers, arbitrary consumer runtime/output, and getters/proxies remain outside these guarantees; a call budget is not a timeout or sandbox.

Reducer inputs must have JSON-normalized expected events: a plain array of plain three-string-field records, with no extra enumerable properties (including symbol keys) or custom/null prototypes. Inputs that would change under normalization reject before any consumer call, rather than silently changing the original failure. This reducer-only requirement does not change what the existing `replay` API accepts.

Returned artifacts and results are independent snapshots. Only the original bytes, cuts, expected events, optional string `fixture`/`partition` labels, and freshly computed diagnostics are retained; the reduced partition label is `reduced`. Arbitrary extra metadata is not copied. All existing replay limits and privacy cautions still apply. A consistently wrong but chunk-invariant consumer can legitimately reduce to zero cuts while still failing the expected-event assertion.

Run `node examples/reduce-demo.js` (or `npm run demo:reduce`). This self-checking demo writes no files and verifies both JSON-round-tripped artifacts with the broken and fixed consumers:

<!-- reduce-demo-output -->
```text
StreamSplit: fewer cuts, same failure
Original cuts: [1,6,7,12,23,24]
Reduced cuts: [7] (9 attempts; complete)
Unchanged: 25 bytes and expected events
PASS: both version-1 artifacts fail with broken decoder and pass with streaming decoder
Budget 2: 4 cuts remain; budget-exhausted; original failure preserved
```

## Honest boundaries

- The good example uses streaming UTF-8 decoding but buffers decoded text before parsing. It validates final event results, not delivery timing or bounded-memory streaming.
- Retry fields have no event output; retry state, reconnects, HTTP, cancellation, and backpressure are out of scope.
- Empty input is covered. The optional adapter tests inject empty chunks; the core generator does not yet include them or huge fixtures.
- There is one current pinned external parser adapter and a separate historical version comparison; browser validation, byte/content shrinking, globally minimal failures, benchmarks, package publication, and complete standards compliance remain out of scope.
- JavaScript ESM and JSDoc run directly without a TypeScript compiler. See the [verification record](docs/VERIFICATION.md) for tested runtimes and platforms.

## Verification

The core has 93 tests, including 21 end-to-end CLI checks, 16 input-boundary checks, 22 cut-reduction checks, and six demo/documentation checks. The good consumer passes all 803 partition checks; the deliberately broken consumer produces 66 failures across UTF-8/BOM cases. The optional real-parser suite adds 26 tests and checks 1183 partitions across 20 fixtures, including deliberate decoding/ID mistakes and version-1 replay. The separate historical BOM comparison adds 12 tests and verifies the expected 12/3 (4.1.0) versus 12/0 (4.1.2) partition results; those historical failures are required for its tests to pass.

Hosted CI passed the 40-test baseline [`542abf4`](https://github.com/yie793379z-prog/streamsplit/commit/542abf45e4cc2056879a8ddc451a853954ba1c31) on Node 22 and 24 ([run](https://github.com/yie793379z-prog/streamsplit/actions/runs/39602457939)). The [CI workflow](.github/workflows/ci.yml) now runs core and optional adapter suites for pushes to `main` and pull requests; check the badge or [GitHub Actions](https://github.com/yie793379z-prog/streamsplit/actions/workflows/ci.yml) for the current revision. See [verification details](docs/VERIFICATION.md) and the [daily roadmap](docs/ROADMAP.md).

## 中文快速开始

StreamSplit 面向编写或封装 SSE 消费端的 JavaScript 开发者：将同一段字节按不同位置切开，检查事件内容是否仍然正确，并保存失败用例供精确重放。适合把偶发的 UTF-8 跨块乱码变成可复现的回归测试。

需要 Git 和 **Node.js 22 或更新版本**。首次克隆需要联网；之后运行示例和测试无需安装依赖、联网、API Key 或账号。

```sh
git clone https://github.com/yie793379z-prog/streamsplit.git
cd streamsplit
node examples/utf8-demo.js
```

实际输出如下，英文和中文示例中的输出都由自动化测试校验：

<!-- utf8-demo-output -->
```text
StreamSplit: same bytes, different chunks
Unsplit / broken decoder: "你好 🌊 café"
Cut at byte 7 / broken decoder: "���好 🌊 café"
Cut at byte 7 / streaming decoder: "你好 🌊 café"
PASS: reproduced the UTF-8 bug and verified the fix.
```

第 7 个字节处的切分落在 `你` 的 UTF-8 编码内部。每块各建一个解码器会产生乱码；复用同一个流式解码器即可保留完整字符。这个演示确认“错误可复现、修复后通过”后以 `0` 退出，不生成文件。

继续在仓库目录运行：

```sh
node --test
node src/cli.js check
```

正确消费者的最后一行是 `803 partition checks; 0 failures (good consumer)`。

下面的命令用于故意触发失败，**预期退出码为 `1`**，会生成 `artifacts/broken-utf8.json` 和 `artifacts/broken-bom.json`：

```sh
node src/cli.js check --broken
```

输出为 803 个分块检查、66 个预期失败。分别运行下面两个重放命令：

```sh
node src/cli.js replay artifacts/broken-utf8.json --broken
```

预期退出 `1`，文本为 `���好 🌊 café`，`matchesExpected` 和 `chunkInvariant` 均为 `false`。

```sh
node src/cli.js replay artifacts/broken-utf8.json
```

预期退出 `0`，文本恢复为 `你好 🌊 café`，两项检查均为 `true`。接入自己的消费者请参阅 [Test your consumer](#test-your-consumer)。

当前版本只验证最终事件内容，不验证实时派发、网络重连或性能；采用 [MIT 开源许可证](LICENSE)。

### 输入边界与验证

固定上限：夹具/重放字节 **16 KiB**，随机候选 **256** 个，去重前总候选 **512** 个，预期事件 **256** 个，预期事件三个字符串字段的 UTF-8 总量 **64 KiB**，非空夹具名称 **256 UTF-8 字节**；CLI 重放 JSON 文件（含空白和诊断内容）最多 **1 MiB**，只读取普通文件。可从主 API 导入只读 `LIMITS`，不能通过参数放宽上限。

夹具字节须为 `Uint8Array` 或 `Buffer`；预期事件必须仅包含自有字符串字段 `{ type, data, lastEventId }`。候选预算为 `2 + 单切分数 + randomCases`，即使随后会被去重，也先计入预算；超限时降低 `randomCases` 或 `singleSplitLimit`。非法形状、非规范 base64、错误切分位置和超限输入均在执行消费者前拒绝；CLI 输出明确错误并退出 `2`。空输入和符合约定、未超限的旧版 v1 重放数据仍然有效，803/1183 次检查结果不变。

运行 `node examples/limits-demo.js`（或 `npm run demo:limits`），演示会断言边界可接受、超限时消费者调用次数为零、旧版重放可用；不写文件：

<!-- limits-demo-output -->
```text
StreamSplit: bounded inputs before consumer execution
PASS: 16384-byte input accepted
REJECT: bytes exceed 16384-byte limit (consumer calls: 0)
REJECT: partition candidates exceed 512 limit; lower randomCases or singleSplitLimit (consumer calls: 0)
PASS: version-1 replay remains compatible
```

这些是输入/工作量边界，不是安全沙箱或总内存保证；消费者代码及输出、JavaScript getter/proxy 等仍须可信，不提供超时、子进程隔离或输出配额。完整规则见 [Input limits and validation](#input-limits-and-validation)。

### 可选：真实第三方解析器

已提供固定版本 **eventsource-parser 4.1.2** 的[双语适配示例](examples/eventsource-parser/README.md)，需要 **Node ≥22.12**。首次安装需要联网，之后运行离线：

```sh
npm ci --prefix examples/eventsource-parser --ignore-scripts --no-audit --no-fund
npm test --prefix examples/eventsource-parser
node examples/eventsource-parser/demo.js
```

预期 26 项集成测试通过、20 个夹具共 1183 次分块检查零失败，并成功重放旧版 UTF-8 失败数据。测试包含 ID 保留/清空、空块、混合换行及两种故意错误的负对照。根目录 `node --test` 运行无需依赖的 93 项核心测试；CI 分别执行核心及两个可选示例的测试。依赖采用 MIT 许可，无运行时传递依赖。

### 复现已修复的上游历史缺陷

独立可选的[历史 BOM 示例](examples/eventsource-parser-bom-history/README.md)通过相同适配逻辑，对比真实且分别锁定的 **eventsource-parser 4.1.0 / 4.1.2**。自写 11 字节夹具在 12 种确定分区中，旧版 3 次失败、新版 0 次失败；`[1,3,5,8,10]` 经缩减得到 `[1]`，原始与缩减 v1 数据均验证红绿重放。首次修复版本是 **4.1.1**（[PR #41](https://github.com/rexxars/eventsource-parser/pull/41)），不是宣称当前上游仍有缺陷，也没有降级现有 4.1.2 适配器。

```sh
npm ci --prefix examples/eventsource-parser-bom-history --ignore-scripts --no-audit --no-fund
npm test --prefix examples/eventsource-parser-bom-history
node examples/eventsource-parser-bom-history/demo.js
```

需要 Node ≥22.12，预期新增的 **12 项独立测试通过**。演示仅在旧版失败和新版通过均被断言后退出 `0`，不写文件；首次安装联网，之后离线。精确输出、历史来源及许可说明见链接中的双语指南。根目录 93 项核心测试仍无需安装依赖。

### 缩减失败切分

新增可选库 API `reduceReplay(consumer, artifact, { maxAttempts: 128 })`：固定从左到右尝试删除单个 cut，成功后从左重扫；**不修改字节或预期事件**，保留原来的两项断言布尔值。事件不匹配不能被无关异常替代；原本为异常时必须保留错误名称和消息。它保留失败类别，不保证错误文本或根因完全一致。

返回独立的 `original`、`reduced` **v1 重放数据**，以及 `originalResult`、`reducedResult`、`attempts`、`status`。两个工件均可分别 JSON 序列化，再用原有 API/CLI 重放；不会覆盖输入。忽略旧观察结果并重算原始结果/基线，保留可选字符串标签，不复制任意额外元数据。CLI 默认流程不变。

缩减器仅接受 JSON 规范化的预期事件：普通数组和仅含三字符串字段的普通对象，不含额外可枚举属性（含符号键）或自定义/null 原型。若复制规范化会改变原有比较语义，则在消费者调用前明确拒绝；原有 `replay` 接受规则不变。

候选预算默认 128、硬上限 256，另有两次原始/基线调用；零预算合法，非法输入在消费者调用前拒绝。`complete` 仅表示不能再删除单个 cut，**不保证全局最小**；`budget-exhausted` 返回已验证的最后失败，不声称最小；`not-failing` 表示原始两项检查通过，未尝试缩减。确定性依赖每次重新创建状态的确定性消费者；调用预算不是超时或沙箱。

运行 `node examples/reduce-demo.js`（或 `npm run demo:reduce`），无文件写入，自动断言双工件的好/坏消费者重放及预算耗尽：

<!-- reduce-demo-output -->
```text
StreamSplit: fewer cuts, same failure
Original cuts: [1,6,7,12,23,24]
Reduced cuts: [7] (9 attempts; complete)
Unchanged: 25 bytes and expected events
PASS: both version-1 artifacts fail with broken decoder and pass with streaming decoder
Budget 2: 4 cuts remain; budget-exhausted; original failure preserved
```

## Useful to you?

If this helps you catch a streaming bug, a star makes the project easier to find again. Reproducible bug reports and small synthetic fixtures are welcome too; remove private response data before sharing.

如果它帮你定位了流式解析问题，欢迎点个 Star，方便以后找到。也欢迎提供可复现的问题和小型合成测试用例；分享前请移除私密响应内容。
