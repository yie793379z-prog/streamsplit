import assert from 'node:assert/strict';
import { fixtures } from '../fixtures/sse.js';
import { reduceReplay, replay } from '../src/harness.js';
import { brokenUtf8Consumer, goodConsumer } from './consumers.js';

const fixture = fixtures.find(f => f.name === 'utf8');
const input = {
  format: 'streamsplit-replay', version: 1, fixture: fixture.name,
  bytesBase64: Buffer.from(fixture.bytes).toString('base64'), expected: fixture.expected,
  cuts: [1, 6, 7, 12, 23, 24], partition: 'demo',
};
const report = await reduceReplay(brokenUtf8Consumer, input, { maxAttempts: 32 });
assert.equal(report.status, 'complete');
assert.deepEqual(report.original.cuts, [1, 6, 7, 12, 23, 24]);
assert.deepEqual(report.reduced.cuts, [7]);
assert.equal(report.attempts, 9);
for (const saved of [report.original, report.reduced]) {
  assert.equal(saved.bytesBase64, input.bytesBase64);
  assert.deepEqual(saved.expected, input.expected);
  // These remain ordinary v1 artifacts, not a new replay format.
  const artifact = JSON.parse(JSON.stringify(saved));
  const broken = await replay(brokenUtf8Consumer, artifact);
  const fixed = await replay(goodConsumer, artifact);
  assert.equal(broken.matchesExpected, false);
  assert.equal(broken.chunkInvariant, false);
  assert.equal(fixed.matchesExpected, true);
  assert.equal(fixed.chunkInvariant, true);
}
const bounded = await reduceReplay(brokenUtf8Consumer, input, { maxAttempts: 2 });
assert.equal(bounded.status, 'budget-exhausted');
assert.equal(bounded.attempts, 2);
assert.equal(bounded.reduced.cuts.length, 4);
assert.equal(bounded.reducedResult.matchesExpected, false);
assert.equal(bounded.reducedResult.chunkInvariant, false);

console.log('StreamSplit: fewer cuts, same failure');
console.log(`Original cuts: ${JSON.stringify(report.original.cuts)}`);
console.log(`Reduced cuts: ${JSON.stringify(report.reduced.cuts)} (${report.attempts} attempts; ${report.status})`);
console.log(`Unchanged: ${fixture.bytes.length} bytes and expected events`);
console.log('PASS: both version-1 artifacts fail with broken decoder and pass with streaming decoder');
console.log(`Budget 2: ${bounded.reduced.cuts.length} cuts remain; ${bounded.status}; original failure preserved`);
