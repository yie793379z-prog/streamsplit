import assert from 'node:assert/strict';
import beforePackage from 'eventsource-parser-before/package.json' with { type: 'json' };
import afterPackage from 'eventsource-parser-after/package.json' with { type: 'json' };
import { checkFixture, reduceReplay, replay } from '../../src/harness.js';
import { beforeConsumer, afterConsumer } from './consumers.js';
import { bomFixture } from './fixture.js';

assert.equal(beforePackage.version, '4.1.0');
assert.equal(afterPackage.version, '4.1.2');
assert.equal(Buffer.from(bomFixture.bytes).toString('hex'), 'efbbbf646174613a780a0a');
const before = await checkFixture(beforeConsumer, bomFixture, { randomCases: 0 });
const after = await checkFixture(afterConsumer, bomFixture, { randomCases: 0 });
const failures = report => report.cases.filter(c => !c.matchesExpected || !c.chunkInvariant);
assert.equal(before.cases.length, 12);
assert.equal(after.cases.length, 12);
assert.deepEqual(before.baseline, { events: bomFixture.expected });
assert.deepEqual(failures(before).map(c => c.label), ['single:1', 'single:2', 'bytewise']);
assert.equal(after.passed, true);
for (const c of failures(before)) {
  assert.deepEqual(c.actual, { events: [] });
  assert.equal(c.matchesExpected, false);
  assert.equal(c.chunkInvariant, false);
}

const input = {
  format: 'streamsplit-replay', version: 1, fixture: bomFixture.name,
  bytesBase64: Buffer.from(bomFixture.bytes).toString('base64'),
  expected: bomFixture.expected, cuts: [1, 3, 5, 8, 10], partition: 'historical-multicut',
};
const reduction = await reduceReplay(beforeConsumer, input, { maxAttempts: 32 });
assert.equal(reduction.status, 'complete');
assert.equal(reduction.attempts, 9);
assert.deepEqual(reduction.original.cuts, [1, 3, 5, 8, 10]);
assert.deepEqual(reduction.reduced.cuts, [1]);
for (const saved of [reduction.original, reduction.reduced]) {
  assert.equal(saved.bytesBase64, input.bytesBase64);
  assert.deepEqual(saved.expected, input.expected);
  const artifact = JSON.parse(JSON.stringify(saved));
  const red = await replay(beforeConsumer, artifact);
  const green = await replay(afterConsumer, artifact);
  assert.deepEqual(red.actual, { events: [] });
  assert.equal(red.matchesExpected, false);
  assert.equal(red.chunkInvariant, false);
  assert.deepEqual(green.actual, { events: bomFixture.expected });
  assert.equal(green.matchesExpected, true);
  assert.equal(green.chunkInvariant, true);
}

console.log('Historical BOM regression: eventsource-parser 4.1.0 -> 4.1.2');
console.log('First fixed in 4.1.1 (upstream PR #41); 4.1.2 includes the fix.');
console.log(`Fixture: ${bomFixture.bytes.length} bytes; hex ${Buffer.from(bomFixture.bytes).toString('hex')}`);
console.log('Unsplit: both versions emit data "x"');
console.log('RED 4.1.0: 12 partition checks; 3 failures (single:1, single:2, bytewise)');
console.log(`GREEN 4.1.2: ${after.cases.length} partition checks; ${failures(after).length} failures`);
console.log(`Cuts: ${JSON.stringify(reduction.original.cuts)} -> ${JSON.stringify(reduction.reduced.cuts)} (${reduction.attempts} attempts; ${reduction.status})`);
console.log('PASS: unchanged bytes/expected; both v1 artifacts fail on 4.1.0 and pass on 4.1.2');
console.log('Historical reproduction only; no files written.');
