# Test your own SSE consumer

[English](#one-complete-offline-recipe) · [中文](#完整离线示例)

## One complete offline recipe

From a clone of this repository, with Node.js 22 or later:

```sh
node examples/custom-consumer.js
```

No installation, account, API key, live server, or file writes. The [complete executable example](../examples/custom-consumer.js) connects the whole API workflow: **hand-written fixture → consumer adapter → checkFixture → first failing case → makeReplay → JSON string → replay**.

<!-- custom-consumer-output -->
```text
StreamSplit: test your own consumer
Custom fixture: 45 bytes; 46 partitions
PASS: streaming adapter matches the hand-written expected event
Captured failure: cuts [40]; JSON replay v1
PASS: serialized replay fails with broken decoder and passes with streaming adapter
```

The 45-byte input includes an event name, ID, and a multibyte emoji. The expected event is written by hand, not obtained from the parser being tested. With random partitions disabled, 46 distinct partitions check the whole input, each interior single cut, and byte-by-byte chunks. The negative control's first failure cuts inside the emoji at byte 40. This is not an exhaustive search of cut combinations.

### Adapt it to your code

1. Change `createFixture()` to return your **synthetic or redacted** input as `Uint8Array` and a manually specified `expected` event array. Do not compute expected output using your adapter. Keep inputs within the [documented limits](../README.md#input-limits-and-validation).
2. Replace `consumer(chunks)` with your own parser adapter. Create parser/decoder/event state **inside every call**, feed every byte chunk in order, finish/flush as your parser requires, then return an array containing **exactly** `{ type, data, lastEventId }` string fields. Promises are supported. Normalize extra fields and missing IDs deliberately. The included adapter uses the existing illustrative buffered `parseText`, not a production parser; the [optional real-parser adapter](../examples/eventsource-parser/README.md) is a separate example.
3. Call `checkFixture(yourConsumer, fixture, options)`. Check **both** `matchesExpected` and `chunkInvariant`: consistently wrong output can still be invariant. If `report.passed` is true, there is no failing case to save. The recipe deliberately uses `brokenConsumer` to exercise the failure path; replace that negative control when diagnosing your own code.
4. Find a case where either assertion is false. Only then call `makeReplay(fixture, report, failedCase)` and immediately `JSON.stringify` it. The example round-trips this string in memory and performs no writes. If you choose to save it, write the JSON yourself and parse it later; `makeReplay` does not persist a file. Avoid mutating fixture/report objects before serialization.
5. Pass the parsed artifact and your adapter to `replay`. The example asserts that the **same serialized bytes, cuts, and expected events** fail with the deliberately broken decoder and pass with the fixed adapter. The artifact does not load executable code. The current CLI's built-in consumers are not your adapter: use the library API for custom adapters.

The demo exits `0` only after checking the expected negative-control failure and fixed result. It is not a general command that exits `1` for your own regressions; in your test runner, assert `report.passed` or both replay booleans. The harness compares final events, not streaming timing, HTTP/reconnect behavior, or resource isolation. Consumer code must be trusted. Serialized artifacts contain response bytes and may contain private data; inspect/redact before sharing.

## 完整离线示例

在仓库克隆目录中，使用 Node.js 22 或更新版本运行：

```sh
node examples/custom-consumer.js
```

无需安装依赖、账号、API Key 或在线服务，也不写文件。[完整可执行代码](../examples/custom-consumer.js)贯通：**手写夹具 → 消费端适配器 → checkFixture → 选择失败分区 → makeReplay → JSON 字符串 → replay**。

<!-- custom-consumer-output -->
```text
StreamSplit: test your own consumer
Custom fixture: 45 bytes; 46 partitions
PASS: streaming adapter matches the hand-written expected event
Captured failure: cuts [40]; JSON replay v1
PASS: serialized replay fails with broken decoder and passes with streaming adapter
```

45 字节的合成输入包含事件名、ID 和多字节 emoji；预期事件由人手写，不由被测解析器生成。关闭随机分区后，共验证整块、每个单切点和逐字节分块组成的 46 种去重分区。负对照首次失败位于 emoji 内的第 40 字节。并非穷举全部切点组合。

### 换成你的代码

1. 修改 `createFixture()`：输入为**合成或脱敏**的 `Uint8Array`，`expected` 为手工指定的事件数组，不能用被测适配器生成预期值。遵守[输入限制](../README.md#input-limits-and-validation)。
2. 替换 `consumer(chunks)`：每次调用**内部新建**解析器、解码器和事件状态；按序喂入字节块，按你的解析器要求结束/flush，返回严格只有 `{ type, data, lastEventId }` 三个字符串字段的事件数组，也支持 Promise。明确处理额外字段和缺失 ID。示例复用缓冲全文的演示解析器 `parseText`，不是生产解析器；[真实第三方适配器](../examples/eventsource-parser/README.md)另有独立示例。
3. 调用 `checkFixture(你的适配器, fixture, options)`，同时检查 `matchesExpected` 与 `chunkInvariant`：始终输出错误内容也可能满足分块不变性。`report.passed` 为真时没有失败案例可保存。本演示故意使用 `brokenConsumer` 走失败路径，诊断自己的代码时应替换它。
4. 选择任一断言为假的案例，确认存在后再调用 `makeReplay(fixture, report, failedCase)` 并立即 `JSON.stringify`。示例只在内存中往返；如需保存，自行写入 JSON 文件，之后再解析。`makeReplay` 本身不落盘，序列化前不要修改夹具或报告。
5. 将解析后的数据和适配器交给 `replay`。演示确认**同一份序列化字节、切点和预期事件**在错误解码器下失败、修复适配器下通过。工件不加载可执行代码。当前 CLI 只使用内置消费者，并不会运行你的适配器；自定义适配器使用库 API。

演示仅在故意制造的失败和修复结果都符合预期时退出 `0`，不是一个遇到你自己的回归就退出 `1` 的通用命令。接入测试框架时，断言 `report.passed` 或重放的两项布尔值。工具只比较最终事件，不保证流式时序、HTTP/重连或资源隔离；消费者代码须可信。序列化工件保留响应字节，分享前检查并脱敏。
