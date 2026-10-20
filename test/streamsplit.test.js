import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtures } from '../fixtures/sse.js';
import { goodConsumer, brokenUtf8Consumer } from '../examples/consumers.js';
import { partitions, chunkBytes } from '../src/partitions.js';
import { checkFixture, makeReplay, replay } from '../src/harness.js';

for (const fixture of fixtures) {
  test(`good consumer: ${fixture.name}`, async () => {
    const result = await checkFixture(goodConsumer, fixture, { seed: 20261018 });
    assert.ok(result.passed, JSON.stringify(result.cases.filter(c => !c.matchesExpected || !c.chunkInvariant)));
  });
}
test('partitions deterministic, distinct, exhaustive for single cuts', () => {
  const options = { seed: 123, randomCases: 10 };
  assert.deepEqual(partitions(20, options), partitions(20, options));
  const values = partitions(20, options);
  assert.equal(new Set(values.map(p => p.cuts.join(','))).size, values.length);
  for (let i = 1; i < 20; i++) assert.ok(values.some(p => p.cuts.length === 1 && p.cuts[0] === i));
  assert.notDeepEqual(partitions(20, options), partitions(20, { ...options, seed: 124 }));
});
test('single-split enumeration respects bound', () => {
  assert.equal(partitions(257).some(p => p.label.startsWith('single:')), false);
});
test('all partitions preserve bytes and slices do not alias input', () => {
  const bytes = Uint8Array.from([0, 1, 2, 3, 4]);
  for (const { cuts } of partitions(bytes.length)) {
    const chunks = chunkBytes(bytes, cuts);
    assert.deepEqual(Buffer.concat(chunks), Buffer.from(bytes));
    chunks[0][0] = 255;
    assert.equal(bytes[0], 0);
  }
});
test('invalid partition configuration is rejected', () => {
  for (const cuts of [[0], [3], [2, 1], [1, 1], [1.5]]) assert.throws(() => chunkBytes(new Uint8Array(3), cuts));
  assert.throws(() => partitions(-1));
  assert.throws(() => partitions(3, { seed: -1 }));
  assert.throws(() => partitions(3, { randomCases: 1.2 }));
});
test('broken decoder passes whole buffer but fails split UTF-8', async () => {
  const fixture = fixtures.find(f => f.name === 'utf8');
  const result = await checkFixture(brokenUtf8Consumer, fixture);
  assert.ok(result.cases[0].matchesExpected);
  assert.equal(result.passed, false);
  assert.ok(result.cases.some(c => !c.chunkInvariant && !c.matchesExpected));
});
test('constant wrong output is invariant but fails oracle', async () => {
  const result = await checkFixture(() => [], fixtures[0]);
  assert.equal(result.passed, false);
  assert.ok(result.cases.every(c => c.chunkInvariant && !c.matchesExpected));
});
test('async adapters, throws and malformed outputs are handled', async () => {
  assert.ok((await checkFixture(async c => goodConsumer(c), fixtures[0])).passed);
  for (const consumer of [() => { throw new Error('boom'); }, () => undefined, () => [{}]]) {
    const result = await checkFixture(consumer, fixtures[0]);
    assert.equal(result.passed, false);
    assert.ok(result.cases[0].actual.error);
  }
});
test('JSON replay reproduces failure and verifies fixed consumer', async () => {
  const fixture = fixtures.find(f => f.name === 'utf8');
  const result = await checkFixture(brokenUtf8Consumer, fixture);
  const failed = result.cases.find(c => !c.matchesExpected);
  const artifact = JSON.parse(JSON.stringify(makeReplay(fixture, result, failed)));
  const broken = await replay(brokenUtf8Consumer, artifact);
  assert.deepEqual(broken.actual, failed.actual);
  assert.equal(broken.matchesExpected, false);
  assert.equal(broken.chunkInvariant, false);
  const fixed = await replay(goodConsumer, artifact);
  assert.equal(fixed.matchesExpected, true);
  assert.equal(fixed.chunkInvariant, true);
});
test('replay rejects invalid version, bytes and cuts', async () => {
  const base = { format: 'streamsplit-replay', version: 1, expected: [], bytesBase64: 'YWJj', cuts: [] };
  await assert.rejects(replay(goodConsumer, { ...base, version: 2 }));
  await assert.rejects(replay(goodConsumer, { ...base, bytesBase64: '@@@' }));
  await assert.rejects(replay(goodConsumer, { ...base, cuts: [0] }));
});
test('consumer mutations cannot corrupt fixture or baseline snapshots', async () => {
  const fixture = fixtures[0];
  const original = fixture.bytes.slice();
  await checkFixture(chunks => { chunks[0].fill(0); return []; }, fixture);
  assert.deepEqual(fixture.bytes, original);
});
test('Buffer-backed fixtures and chunk slices are copied', async () => {
  const bytes = Buffer.from('data: hello\n\n');
  const original = Buffer.from(bytes);
  const chunks = chunkBytes(bytes, [1]);
  chunks[0].fill(0);
  chunks[1].fill(0);
  assert.deepEqual(bytes, original);
  await checkFixture(parts => { for (const part of parts) part.fill(0); return []; }, { name: 'buffer', bytes, expected: [] });
  assert.deepEqual(bytes, original);
});
test('invalid partition options fail before executing the consumer', async () => {
  let calls = 0;
  await assert.rejects(checkFixture(() => { calls++; return []; }, fixtures[0], { seed: -1 }));
  assert.equal(calls, 0);
});
test('package entry points expose the documented API', async () => {
  const api = await import('streamsplit');
  assert.equal(api.checkFixture, checkFixture);
  assert.equal(api.replay, replay);
  assert.equal((await import('streamsplit/partitions')).chunkBytes, chunkBytes);
  assert.equal((await import('streamsplit/fixtures')).fixtures, fixtures);
  assert.equal((await import('streamsplit/examples')).goodConsumer, goodConsumer);
});
