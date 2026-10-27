# Real parser adapter / 真实解析器适配示例

This optional example uses **eventsource-parser 4.1.2**, pinned exactly in its own manifest and integrity-locked in `package-lock.json`. Requires **Node.js ≥22.12** and npm. The root package and its 98 tests still need no installation.

From the repository root, install once (network required), then run offline:

```sh
npm ci --prefix examples/eventsource-parser --ignore-scripts --no-audit --no-fund
npm test --prefix examples/eventsource-parser
node examples/eventsource-parser/demo.js
```

The 26 integration tests must pass. The demo asserts all 20 fixtures (15 shared + 5 adapter cases), then replays a broken UTF-8 result through the real parser. It exits `0` only on success, writes no files, and prints:

<!-- adapter-demo-output -->
```text
eventsource-parser 4.1.2 (optional adapter)
20 fixtures; 1183 partition checks; 0 failures
Saved-format replay / broken decoder: "���好 🌊 café"
Saved-format replay / real parser adapter: "你好 🌊 café"
PASS: parser integration and version-1 replay verified; no files written.
```

Use [consumer.js](consumer.js) with the existing harness:

```js
import { checkFixture } from '../../src/harness.js';
import { fixtures } from '../../fixtures/sse.js';
import { eventsourceParserConsumer } from './consumer.js';

const report = await checkFixture(eventsourceParserConsumer, fixtures[1], { seed: 20261018 });
console.log(report.passed); // true
```

Paths above are relative to this example directory. No CLI adapter loading or new package export is introduced.

The adapter feeds each decoded chunk directly to the third-party parser. It creates fresh parser/decoder/ID state per call, uses streaming UTF-8 decoding, maps `event` to `type` (default `message`), and tracks `lastEventId` with the parser's `onId` callback. Copying `event.id` alone loses retained IDs and ID-only blocks. `ignoreBOM: true` preserves the BOM for the parser, avoiding removal of two leading BOMs by two layers. The parser owns line parsing, comments, NUL-ID rejection, and event dispatch; the adapter does not parse SSE fields itself. At EOF it flushes the decoder and resets without consuming an unterminated event or adding a newline. Invalid fields/retry values use the parser's default ignore behavior.

Negative controls deliberately break chunk decoding and ID normalization. Tests require these to fail the expected-event oracle; the ID mistake stays chunk-invariant, illustrating why both checks matter. JSON version-1 replay, empty chunks, independent invocations, mixed line endings, ID-only reset, and incomplete EOF are covered. Tests use synthetic data and no network. They validate final events, not HTTP, reconnection, retry callbacks, delivery timing, browser behavior, or memory limits.

Dependency review: [eventsource-parser 4.1.2](https://github.com/rexxars/eventsource-parser/tree/v4.1.2) is [MIT licensed](https://github.com/rexxars/eventsource-parser/blob/v4.1.2/LICENSE), with no runtime dependencies. Its npm archive includes the license; keep that notice when redistributing it. No third-party source is vendored here. Installation disables lifecycle scripts, audit submission, and funding output. This is a license/manifest review, not a comprehensive security audit.

## 中文

这个可选示例固定使用 **eventsource-parser 4.1.2**，独立的锁文件记录下载地址和完整性摘要。需要 **Node.js ≥22.12** 与 npm。根目录的核心和 98 项测试仍无需安装依赖；此示例的 26 项集成测试单独执行。

在仓库根目录运行（首次安装需要联网，之后测试和演示可离线运行）：

```sh
npm ci --prefix examples/eventsource-parser --ignore-scripts --no-audit --no-fund
npm test --prefix examples/eventsource-parser
node examples/eventsource-parser/demo.js
```

演示会检查 20 个合成夹具的 1183 种分块，再用真实解析器重放 UTF-8 失败数据；全部断言通过才退出 `0`，不写文件。预期输出：

<!-- adapter-demo-output -->
```text
eventsource-parser 4.1.2 (optional adapter)
20 fixtures; 1183 partition checks; 0 failures
Saved-format replay / broken decoder: "���好 🌊 café"
Saved-format replay / real parser adapter: "你好 🌊 café"
PASS: parser integration and version-1 replay verified; no files written.
```

适配器每次调用都建立独立状态，以流式 UTF-8 解码逐块喂给第三方解析器，再转换为 `{ type, data, lastEventId }`。通过 `onId` 保留、清空 ID，包含只有 ID、没有 data 的块；行解析和 NUL ID 过滤由上游解析器完成。解码器保留 BOM，交给解析器只移除开头的一个，避免两层重复处理。EOF 只结束解码并丢弃未完成事件，不补换行。

测试刻意引入逐块独立解码、丢失 ID 状态两种错误，确认它们会被检测；同时覆盖空块、混合换行、调用隔离和旧版 JSON 重放。范围限于最终事件，不验证网络重连、实时性、浏览器或内存上限。依赖采用 MIT 许可且没有运行时传递依赖；安装禁用生命周期脚本，未复制第三方源码。详见[验证记录](../../docs/VERIFICATION.md)。
