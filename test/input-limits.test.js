import test from 'node:test';
import assert from 'node:assert/strict';
import { checkFixture, makeReplay, replay, LIMITS } from '../src/harness.js';
import { chunkBytes, partitions } from '../src/partitions.js';

const event = (data = '') => ({ type: '', data, lastEventId: '' });
const fixture = (changes = {}) => ({ name: 'bounded', bytes: new Uint8Array(), expected: [], ...changes });
const artifact = (changes = {}) => ({
  format: 'streamsplit-replay', version: 1, bytesBase64: '', cuts: [], expected: [], ...changes,
});

async function rejectsWithoutConsumer(action, error) {
  let calls = 0;
  await assert.rejects(action(() => { calls++; return []; }), error);
  assert.equal(calls, 0, 'invalid input must be rejected before any consumer invocation');
}

test('published limits are immutable and available from the package entry point', async () => {
  assert.equal((await import('streamsplit')).LIMITS, LIMITS);
  assert.ok(Object.isFrozen(LIMITS));
  assert.deepEqual(LIMITS, {
    maxBytes: 16_384, maxRandomCases: 256, maxPartitions: 512,
    maxExpectedEvents: 256, maxExpectedTextBytes: 65_536,
    maxNameBytes: 256, maxReplayFileBytes: 1_048_576,
    maxReductionAttempts: 256,
  });
});

test('byte limit is inclusive for fixtures, partitions, chunks, and replay', async () => {
  const bytes = new Uint8Array(LIMITS.maxBytes);
  const matrix = partitions(bytes.length, { randomCases: 0, singleSplitLimit: 0 });
  assert.equal(matrix.length, 2);
  assert.equal(matrix[1].cuts.length, LIMITS.maxBytes - 1);
  const chunks = chunkBytes(bytes, matrix[1].cuts);
  assert.equal(chunks.length, LIMITS.maxBytes);
  assert.deepEqual(Buffer.concat(chunks), Buffer.from(bytes));
  let calls = 0;
  const consumer = () => { calls++; return []; };
  assert.ok((await checkFixture(consumer, fixture({ bytes }), { randomCases: 0, singleSplitLimit: 0 })).passed);
  assert.equal(calls, 2);
  const report = await replay(consumer, artifact({ bytesBase64: Buffer.from(bytes).toString('base64'), cuts: matrix[1].cuts }));
  assert.ok(report.matchesExpected && report.chunkInvariant);
  assert.equal(calls, 4);
});

test('oversized bytes reject before consumer execution and before partition allocation', async () => {
  for (const size of [LIMITS.maxBytes + 1, LIMITS.maxBytes + 3]) {
    const bytes = new Uint8Array(size);
    await rejectsWithoutConsumer(consumer => checkFixture(consumer, fixture({ bytes })), /bytes exceed 16384-byte limit/);
    await rejectsWithoutConsumer(consumer => replay(consumer, artifact({ bytesBase64: Buffer.from(bytes).toString('base64') })), /bytes exceed 16384-byte limit/);
    assert.throws(() => partitions(size), /bytes exceed 16384-byte limit/);
    assert.throws(() => chunkBytes(bytes, []), /bytes exceed 16384-byte limit/);
  }
  assert.throws(() => partitions(Number.MAX_SAFE_INTEGER), /bytes exceed 16384-byte limit/);
});

test('random candidate limit includes duplicate work on empty inputs', async () => {
  assert.deepEqual(partitions(0, { randomCases: LIMITS.maxRandomCases }), [{ label: 'whole', cuts: [] }]);
  assert.throws(() => partitions(0, { randomCases: LIMITS.maxRandomCases + 1 }), /randomCases exceeds 256 limit/);
  await rejectsWithoutConsumer(consumer => checkFixture(consumer, fixture(), { randomCases: LIMITS.maxRandomCases + 1 }), /randomCases exceeds 256 limit/);
});

test('partition candidate budget accepts the boundary and rejects one more before consumers', async () => {
  // 2 baseline/bytewise + 254 singles + 256 random candidates = 512.
  const options = { randomCases: LIMITS.maxRandomCases, singleSplitLimit: 256 };
  const accepted = partitions(255, options);
  assert.ok(accepted.length <= LIMITS.maxPartitions);
  assert.equal(accepted.filter(partition => partition.label.startsWith('single:')).length, 254);
  // The next byte adds a single-cut candidate; deduplication is not a waiver.
  assert.throws(() => partitions(256, options), /partition candidates exceed 512 limit/);
  await rejectsWithoutConsumer(consumer => checkFixture(consumer, fixture({ bytes: new Uint8Array(256) }), options), /partition candidates exceed 512 limit/);
  assert.doesNotThrow(() => partitions(256, { ...options, singleSplitLimit: 255 }));
});

test('invalid options and lengths fail without calling consumers', async () => {
  for (const options of [null, [], 7, 'options', { randomCases: Infinity }, { randomCases: -1 }, { singleSplitLimit: 1.5 }, { singleSplitLimit: -1 }, { seed: 0x100000000 }]) {
    await rejectsWithoutConsumer(consumer => checkFixture(consumer, fixture(), options), /options|randomCases|singleSplitLimit|seed/);
  }
  for (const length of [-1, NaN, Infinity, 1.5, '1']) {
    assert.throws(() => partitions(length), /length must be a nonnegative safe integer/);
  }
});

test('fixtures require typed bytes rather than silently coercing arrays or strings', async () => {
  for (const bytes of [undefined, null, 'abc', [1, 2], new Uint16Array(2), new ArrayBuffer(2), { length: 2 }]) {
    await rejectsWithoutConsumer(consumer => checkFixture(consumer, fixture({ bytes })), /bytes must be a Uint8Array or Buffer/);
    assert.throws(() => chunkBytes(bytes, []), /bytes must be a Uint8Array or Buffer/);
  }
});

test('fixture names are nonempty strings with an inclusive UTF-8 byte limit', async () => {
  for (const invalid of [null, undefined, 'fixture']) {
    await rejectsWithoutConsumer(consumer => checkFixture(consumer, invalid), /fixture must be an object/);
  }
  for (const name of ['', undefined, 12, new String('name')]) {
    await rejectsWithoutConsumer(consumer => checkFixture(consumer, fixture({ name })), /fixture.name must be a nonempty string/);
  }
  const name = '🌊'.repeat(LIMITS.maxNameBytes / 4);
  assert.equal(Buffer.byteLength(name), LIMITS.maxNameBytes);
  assert.ok((await checkFixture(() => [], fixture({ name }))).passed);
  await rejectsWithoutConsumer(consumer => checkFixture(consumer, fixture({ name: name + 'a' })), /fixture.name exceeds 256-byte UTF-8 limit/);
});

test('expected event count accepts its limit and rejects the next event before consumers', async () => {
  const expected = Array.from({ length: LIMITS.maxExpectedEvents }, () => event());
  assert.ok((await checkFixture(() => expected, fixture({ expected }))).passed);
  assert.ok((await replay(() => expected, artifact({ expected }))).matchesExpected);
  const excessive = [...expected, event()];
  await rejectsWithoutConsumer(consumer => checkFixture(consumer, fixture({ expected: excessive })), /expected exceeds 256-event limit/);
  await rejectsWithoutConsumer(consumer => replay(consumer, artifact({ expected: excessive })), /expected exceeds 256-event limit/);
});

test('expected text limit counts UTF-8 bytes across every event field', async () => {
  const expected = [{ type: 't', data: 'é'.repeat((LIMITS.maxExpectedTextBytes - 2) / 2), lastEventId: 'i' }];
  assert.equal(Object.values(expected[0]).reduce((sum, text) => sum + Buffer.byteLength(text), 0), LIMITS.maxExpectedTextBytes);
  assert.ok((await checkFixture(() => expected, fixture({ expected }))).passed);
  assert.ok((await replay(() => expected, artifact({ expected }))).matchesExpected);
  for (const excessive of [
    [{ ...expected[0], type: 'tt' }],
    [{ ...expected[0], data: expected[0].data + 'a' }],
    [{ ...expected[0], lastEventId: 'ii' }],
    [...expected, event('a')],
  ]) {
    await rejectsWithoutConsumer(consumer => checkFixture(consumer, fixture({ expected: excessive })), /expected text exceeds 65536-byte UTF-8 limit/);
    await rejectsWithoutConsumer(consumer => replay(consumer, artifact({ expected: excessive })), /expected text exceeds 65536-byte UTF-8 limit/);
  }
});

test('malformed expected records and sparse arrays fail before consumers', async () => {
  const inherited = Object.assign(Object.create({ type: '' }), { data: '', lastEventId: '', extra: '' });
  for (const expected of [undefined, null, {}, 'events', new Array(1), [undefined], [null], [[]], [{}],
    [{ type: '', data: '' }], [{ type: '', data: 1, lastEventId: '' }], [{ ...event(), extra: 'not normalized' }], [inherited]]) {
    await rejectsWithoutConsumer(consumer => checkFixture(consumer, fixture({ expected })), /expected/);
    await rejectsWithoutConsumer(consumer => replay(consumer, artifact({ expected })), /expected|unsupported or malformed replay/);
  }
});

test('noncanonical base64 rejects before either replay consumer invocation', async () => {
  for (const bytesBase64 of ['YQ', 'YQ===', 'YQ==\n', 'YR==', '_w==', '@@@']) {
    await rejectsWithoutConsumer(consumer => replay(consumer, artifact({ bytesBase64 })), /invalid base64/);
  }
  for (const changed of [{ format: 'other' }, { version: 2 }, { bytesBase64: null }]) {
    await rejectsWithoutConsumer(consumer => replay(consumer, artifact(changed)), /unsupported or malformed replay/);
  }
});

test('invalid cut type, count, order, and offsets reject before consumer invocation', async () => {
  const bytes = Uint8Array.from([1, 2, 3]);
  for (const cuts of [null, {}, new Uint8Array([1]), [0], [3], [-1], [1, 1], [2, 1], [1.5], [NaN], [Infinity], new Array(1), [1, 2, 3]]) {
    assert.throws(() => chunkBytes(bytes, cuts), /cuts/);
    await rejectsWithoutConsumer(consumer => replay(consumer, artifact({ bytesBase64: Buffer.from(bytes).toString('base64'), cuts })), /cuts|unsupported or malformed replay/);
  }
});

test('empty and Buffer fixtures remain valid and emitted replays round-trip', async () => {
  for (const bytes of [new Uint8Array(), Buffer.alloc(0), Buffer.from('abc')]) {
    const input = fixture({ bytes });
    const report = await checkFixture(() => [], input, { randomCases: 0 });
    assert.ok(report.passed);
    const saved = JSON.parse(JSON.stringify(makeReplay(input, report, report.cases.at(-1))));
    const restored = await replay(() => [], saved);
    assert.ok(restored.matchesExpected && restored.chunkInvariant);
  }
});

test('minimal historical version-1 artifacts need no diagnostic metadata', async () => {
  const input = artifact({ bytesBase64: 'YWJj', cuts: [1, 2] });
  let calls = 0;
  const result = await replay(chunks => {
    calls++;
    assert.deepEqual(Buffer.concat(chunks), Buffer.from('abc'));
    assert.equal(chunks.length, calls === 1 ? 3 : 1);
    // Mutating replay chunks must not change bytes used by its later baseline.
    for (const chunk of chunks) chunk.fill(0);
    return [];
  }, input);
  assert.equal(calls, 2);
  assert.ok(result.matchesExpected && result.chunkInvariant);
  assert.deepEqual(input, artifact({ bytesBase64: 'YWJj', cuts: [1, 2] }));
  const ignoredMetadata = artifact({ fixture: null, partition: 12, observed: { error: 'old diagnostic' }, baseline: null });
  assert.ok((await replay(() => [], ignoredMetadata)).matchesExpected);
});

test('makeReplay rejects invalid source fixtures and cuts instead of emitting bad replay input', () => {
  const result = { baseline: { events: [] } };
  const failedCase = { label: 'whole', cuts: [], actual: { events: [] } };
  assert.throws(() => makeReplay(fixture({ bytes: [1] }), result, failedCase), /bytes must be a Uint8Array or Buffer/);
  assert.throws(() => makeReplay(fixture(), result, { ...failedCase, cuts: [0] }), /cuts/);
  assert.throws(() => makeReplay(fixture({ expected: [{}] }), result, failedCase), /expected events/);
});
