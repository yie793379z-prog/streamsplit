import assert from 'node:assert/strict';
import { checkFixture, replay, LIMITS } from '../src/harness.js';
import { goodConsumer } from './consumers.js';
import { fixtures } from '../fixtures/sse.js';

console.log('StreamSplit: bounded inputs before consumer execution');
const fixture = { name: 'limit-demo', bytes: new Uint8Array(LIMITS.maxBytes), expected: [] };
assert.ok((await checkFixture(() => [], fixture, { randomCases: 0 })).passed);
console.log(`PASS: ${LIMITS.maxBytes}-byte input accepted`);

for (const [input, options, message] of [
  [{ ...fixture, bytes: new Uint8Array(LIMITS.maxBytes + 1) }, {}, `bytes exceed ${LIMITS.maxBytes}-byte limit`],
  [{ ...fixture, bytes: new Uint8Array(512) }, { randomCases: 0, singleSplitLimit: 512 },
    `partition candidates exceed ${LIMITS.maxPartitions} limit; lower randomCases or singleSplitLimit`],
]) {
  let calls = 0;
  await assert.rejects(checkFixture(() => { calls++; return []; }, input, options), { name: 'RangeError', message });
  assert.equal(calls, 0);
  console.log(`REJECT: ${message} (consumer calls: ${calls})`);
}

// Version 1 predates these guards. Optional diagnostic metadata is not needed.
const utf8 = fixtures.find(f => f.name === 'utf8');
const result = await replay(goodConsumer, {
  format: 'streamsplit-replay', version: 1,
  bytesBase64: Buffer.from(utf8.bytes).toString('base64'), cuts: [7], expected: utf8.expected,
});
assert.ok(result.matchesExpected && result.chunkInvariant);
console.log('PASS: version-1 replay remains compatible');
