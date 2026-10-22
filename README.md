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

Installation needs network access once; tests and demo then run offline. Expected: **26 adapter tests pass; 20 fixtures, 1183 partition checks, 0 failures**. The demo also verifies version-1 UTF-8 replay. See the linked bilingual guide for exact output, ID normalization, negative controls, and license details. Root `node --test` still runs the 40 dependency-free core tests; CI runs both suites.

Each partition is checked against two independent expectations:

- **Expected events:** manually specified fixture output, to catch consistently wrong parsers.
- **Chunk invariance:** the same consumer's unsplit output, to isolate chunk-dependent behavior.

Thrown errors and malformed event outputs are captured as failing results. Input slices and baseline outputs are copied to reduce mutation interference. Extra event properties participate in comparison, so normalize your adapter output first.

## What is covered

15 original synthetic fixtures cover UTF-8, a leading BOM, replacement decoding, LF/CRLF/CR line endings, comments, multiline data, field spacing, event names, ID retention/reset, NUL IDs, empty data, and incomplete EOF. Expected values are hand-authored rather than generated by the example parser. Fixture semantics are informed by the [WHATWG SSE parsing and interpretation sections](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream).

The generator includes an unsplit baseline, every single interior cut for streams up to 256 bytes, byte-by-byte chunks, and seeded random partitions. Duplicate partitions are removed. “Every single cut” does **not** mean every combination of cuts. The CLI uses seed `20261018` so results are reproducible; changing the seed through the API explores different samples.

## Replay format

A version-1 JSON artifact stores original bytes as base64, interior byte offsets, expected events, observed output, baseline, fixture name, and partition label. Replay uses the stored bytes and cuts, so it does not depend on the current fixture text or PRNG. It recomputes the baseline using your selected consumer. Artifacts contain data, never executable adapter paths.

Artifacts can contain response contents. Use synthetic or appropriately redacted data before sharing them. Generated artifacts are gitignored. Treat the harness and replay inputs as trusted local test material: this increment has no resource quotas, subprocess isolation, or timeout for a hanging consumer.

## Honest boundaries

- The good example uses streaming UTF-8 decoding but buffers decoded text before parsing. It validates final event results, not delivery timing or bounded-memory streaming.
- Retry fields have no event output; retry state, reconnects, HTTP, cancellation, and backpressure are out of scope.
- Empty input is covered. The optional adapter tests inject empty chunks; the core generator does not yet include them or huge fixtures.
- There is one pinned external parser example; browser validation, shrinking, benchmarks, package publication, and complete standards compliance remain out of scope.
- JavaScript ESM and JSDoc run directly without a TypeScript compiler. See the [verification record](docs/VERIFICATION.md) for tested runtimes and platforms.

## Verification

The core has 40 tests, including 10 end-to-end CLI checks and two first-run demo/documentation checks. The good consumer passes all 803 partition checks; the deliberately broken consumer produces 66 failures across UTF-8/BOM cases. The optional real-parser suite adds 26 tests and checks 1183 partitions across 20 fixtures, including deliberate decoding/ID mistakes and version-1 replay.

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

### 可选：真实第三方解析器

已提供固定版本 **eventsource-parser 4.1.2** 的[双语适配示例](examples/eventsource-parser/README.md)，需要 **Node ≥22.12**。首次安装需要联网，之后运行离线：

```sh
npm ci --prefix examples/eventsource-parser --ignore-scripts --no-audit --no-fund
npm test --prefix examples/eventsource-parser
node examples/eventsource-parser/demo.js
```

预期 26 项集成测试通过、20 个夹具共 1183 次分块检查零失败，并成功重放旧版 UTF-8 失败数据。测试包含 ID 保留/清空、空块、混合换行及两种故意错误的负对照。根目录 `node --test` 仍只运行无需依赖的 40 项核心测试；CI 会分别执行两套测试。依赖采用 MIT 许可，无运行时传递依赖。

## Useful to you?

If this helps you catch a streaming bug, a star makes the project easier to find again. Reproducible bug reports and small synthetic fixtures are welcome too; remove private response data before sharing.

如果它帮你定位了流式解析问题，欢迎点个 Star，方便以后找到。也欢迎提供可复现的问题和小型合成测试用例；分享前请移除私密响应内容。
