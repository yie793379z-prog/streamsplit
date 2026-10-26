# Historical BOM regression / 历史 BOM 回归示例

Reproduce an **already-fixed** `eventsource-parser` bug with real npm versions **4.1.0** (before) and **4.1.2** (after). The first fix shipped in **4.1.1**, as recorded in [upstream PR #41](https://github.com/rexxars/eventsource-parser/pull/41) and the [4.1.1 changelog entry](https://github.com/rexxars/eventsource-parser/blob/v4.1.2/CHANGELOG.md#411). This demonstrates a historical failure; it is not a claim of a current upstream bug or a newly discovered issue.

Requires **Node ≥22.12** and npm. From the repository root:

```sh
npm ci --prefix examples/eventsource-parser-bom-history --ignore-scripts --no-audit --no-fund
npm test --prefix examples/eventsource-parser-bom-history
node examples/eventsource-parser-bom-history/demo.js
```

Installation needs network access once. Tests and the demo then run offline. **12 tests** must pass; the demo exits **0 only when it reproduces the historical red result and verifies the green result**. Missing dependencies or a changed result fail explicitly. The demo writes no files. Expected output:

<!-- bom-history-output -->
```text
Historical BOM regression: eventsource-parser 4.1.0 -> 4.1.2
First fixed in 4.1.1 (upstream PR #41); 4.1.2 includes the fix.
Fixture: 11 bytes; hex efbbbf646174613a780a0a
Unsplit: both versions emit data "x"
RED 4.1.0: 12 partition checks; 3 failures (single:1, single:2, bytewise)
GREEN 4.1.2: 12 partition checks; 0 failures
Cuts: [1,3,5,8,10] -> [1] (9 attempts; complete)
PASS: unchanged bytes/expected; both v1 artifacts fail on 4.1.0 and pass on 4.1.2
Historical reproduction only; no files written.
```

## What makes this a parser regression

[fixture.js](fixture.js) defines original synthetic bytes `\uFEFFdata:x\n\n` and the hand-authored expected event `[{ type: 'message', data: 'x', lastEventId: '' }]`. No upstream tests, third-party implementation, or captured traffic are copied into this example.

Both versions use the **same adapter function** in [consumers.js](consumers.js); only the imported parser factory changes. It creates fresh state for every invocation, preserves the BOM with `TextDecoder('utf-8', { ignoreBOM: true })`, and feeds every streaming decoder result, including empty strings. With a cut after the first or second BOM byte, decoding initially returns `''`. In 4.1.0, feeding that empty string consumes the parser's first-chunk state. The later BOM becomes part of the field name and the event is lost. The fix keeps first-chunk state until nonempty input arrives. Filtering empty strings in the adapter would hide this historical defect, so the example deliberately leaves them intact.

`checkFixture(consumer, bomFixture, { randomCases: 0 })` generates exactly **12** partitions: unsplit, ten single interior cuts, and bytewise. Both versions emit the expected event unsplit. On 4.1.0, `single:1`, `single:2`, and `bytewise` produce `[]`; **both** `matchesExpected` and `chunkInvariant` are false. All other old-version partitions and all 4.1.2 partitions pass. This is a deterministic sample, not every combination of cuts. A no-BOM control passes on both versions.

The demo passes a version-1 replay with cuts `[1,3,5,8,10]` to `reduceReplay` with a 32-attempt budget. It verifies `[1]` after nine attempts, unchanged bytes/expected events, and JSON round trips of both original and reduced artifacts. Each artifact fails both assertions with 4.1.0 and passes both with 4.1.2. Removing the last cut restores the old parser's passing unsplit result. `complete` means only single-cut local minimality under the existing reducer predicate, not a global minimum or byte minimization.

The 12 tests cover the installed versions/lock, literal fixture oracle, both BOM split points and v1 replay, the full deterministic matrix, no-BOM and empty-chunk controls, invocation isolation, reduction/replay, the fixed parser's `not-failing` result, exact subprocess demo output/no writes, and both language output blocks. No CLI, public package export, or replay format is added. The existing [4.1.2 adapter](../eventsource-parser/README.md) remains unchanged apart from its documentation's core-test count. Root `node --test` still runs 93 dependency-free tests; CI explicitly installs and tests both optional examples.

## Dependencies and sources

This private optional package uses exact npm aliases `eventsource-parser-before: npm:eventsource-parser@4.1.0` and `eventsource-parser-after: npm:eventsource-parser@4.1.2`. Its lockfile records public registry tarball URLs and SHA-512 integrity. The historical package is isolated from the root and the current adapter; it is intended only for this offline reproduction.

Both distributions are MIT licensed ([4.1.0 license](https://github.com/rexxars/eventsource-parser/blob/v4.1.0/LICENSE), [4.1.2 license](https://github.com/rexxars/eventsource-parser/blob/v4.1.2/LICENSE)) and have no runtime dependencies. Their installed license notices remain inside ignored `node_modules`; retain those notices if redistributing the distributions. The new fixture, adapter wrapper, demo, and tests are original StreamSplit code under the repository's MIT license. Upstream development dependencies are not installed, and lifecycle scripts are disabled. This is a scoped manifest/license check, not a comprehensive dependency security audit.

This example tests final event results for a historical BOM case. It makes no HTTP, browser, reconnection, timing, memory, performance, or full SSE-conformance claim. See [verification](../../docs/VERIFICATION.md) for actual runtime coverage; the version comparison alone does not establish which commit fixed it, which is why the historical PR and changelog are cited above.

## 中文

本例使用真实 npm 包 **4.1.0（修复前）** 和 **4.1.2（包含修复）**，复现一个**已经修复**的 BOM 分块缺陷。[上游 PR #41](https://github.com/rexxars/eventsource-parser/pull/41) 和 [changelog](https://github.com/rexxars/eventsource-parser/blob/v4.1.2/CHANGELOG.md#411) 确认首次修复版本是 **4.1.1**。这不是当前上游仍有缺陷、也不是新发现漏洞的声明。

需要 **Node ≥22.12** 与 npm，在仓库根目录运行：

```sh
npm ci --prefix examples/eventsource-parser-bom-history --ignore-scripts --no-audit --no-fund
npm test --prefix examples/eventsource-parser-bom-history
node examples/eventsource-parser-bom-history/demo.js
```

首次安装联网，之后测试和演示离线。预期 **12 项测试通过**。演示只有在旧版红色失败确实复现、新版绿色结果和重放均通过时才退出 **0**；缺依赖或结果变化会明确失败，不会静默跳过。演示不写文件，输出如下：

<!-- bom-history-output -->
```text
Historical BOM regression: eventsource-parser 4.1.0 -> 4.1.2
First fixed in 4.1.1 (upstream PR #41); 4.1.2 includes the fix.
Fixture: 11 bytes; hex efbbbf646174613a780a0a
Unsplit: both versions emit data "x"
RED 4.1.0: 12 partition checks; 3 failures (single:1, single:2, bytewise)
GREEN 4.1.2: 12 partition checks; 0 failures
Cuts: [1,3,5,8,10] -> [1] (9 attempts; complete)
PASS: unchanged bytes/expected; both v1 artifacts fail on 4.1.0 and pass on 4.1.2
Historical reproduction only; no files written.
```

输入是自行编写的 11 字节 `\uFEFFdata:x\n\n`，hex 为 `efbbbf646174613a780a0a`；预期事件手写为 `[{ type: 'message', data: 'x', lastEventId: '' }]`，没有复制上游测试或真实流量。两版共用同一适配函数，每次新建解析器、解码器与 ID 状态，保留 `ignoreBOM:true` 并将解码器返回的空字符串照常喂入解析器。BOM 前一或两字节尚不足以解码时会先产生空字符串；旧版因此提前消耗“首块”状态，后续 BOM 被视为字段名的一部分，事件被丢弃。修复版保留首块状态直到非空输入到达。若在适配层过滤空字符串，会掩盖此历史问题。

`randomCases:0` 产生确定的 12 种分区：整体、10 个单切点、逐字节。两版整体解析都通过；旧版只有切点 1、2 和逐字节分块失败，输出 `[]` 且预期事件、分块不变性两项断言都失败；新版全部通过。不带 BOM 的对照在两版均通过。这不是穷举所有切点组合。

演示使用现有 v1 重放格式，在 32 次候选预算内用 9 次尝试将 `[1,3,5,8,10]` 缩减为 `[1]`。断言字节和预期事件不变，原始与缩减工件经 JSON 往返后都在 4.1.0 上失败、4.1.2 上通过；删除最后一个切点即可恢复旧版整体解析的正确结果。仅保证既有失败保持规则下的单切点局部最小，不保证全局最小，也不缩减字节。

12 项测试覆盖锁定版本、手写 oracle、两个 BOM 切点与 v1 重放、确定分区矩阵、无 BOM/空块对照、调用隔离、缩减重放、新版无需缩减、子进程精确输出与无文件写入、双语输出一致性。根目录仍为 93 项无依赖测试，现有 4.1.2 适配器仍为 26 项；CI 单独安装并运行本例，不扩大 CLI、包导出或协议。

两版依赖仅存在于本例的独立私有包，通过固定 npm 别名及 SHA-512 锁文件隔离，没有降级现有适配器。两版均为 MIT 许可、无运行时传递依赖；安装禁用生命周期脚本。上游源码/许可只保留在忽略提交的安装目录中，未拷入项目；再分发包时须保留其版权和许可通知。本次新增夹具、适配包装、演示和测试采用仓库 MIT 许可。此检查限于清单及许可，不是完整安全审计；只验证历史案例的最终事件，不宣称网络、浏览器、重连、实时性、内存、性能或完整 SSE 合规性。实际测试平台见[验证记录](../../docs/VERIFICATION.md)。
