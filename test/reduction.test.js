import test from 'node:test';
import assert from 'node:assert/strict';
import { reduceReplay, replay, LIMITS } from '../src/harness.js';
import { fixtures } from '../fixtures/sse.js';
import { goodConsumer, brokenUtf8Consumer } from '../examples/consumers.js';

const event = (data = 'wrong') => ({ type: 'message', data, lastEventId: '' });
const artifact = (changes = {}) => ({
  format: 'streamsplit-replay', version: 1,
  bytesBase64: Buffer.from('abcd').toString('base64'), cuts: [1, 2, 3], expected: [],
  ...changes,
});
const cutsOf = chunks => {
  let offset = 0;
  return chunks.slice(0, -1).map(chunk => offset += chunk.length);
};
const flags = result => [result.matchesExpected, result.chunkInvariant];
const jsonCopy = value => JSON.parse(JSON.stringify(value));

async function rejectsWithoutConsumer(input, options, pattern) {
  let calls = 0;
  await assert.rejects(reduceReplay(() => { calls++; return []; }, input, options), pattern);
  assert.equal(calls, 0, 'invalid input must reject before any consumer invocation');
}

test('reduceReplay is exposed from the package entry point with a fixed attempt cap', async () => {
  assert.equal((await import('streamsplit')).reduceReplay, reduceReplay);
  assert.equal(LIMITS.maxReductionAttempts, 256);
  assert.ok(Object.isFrozen(LIMITS));
});

test('broken UTF-8 reduction is stable, deletes only cuts, and both v1 artifacts replay', async () => {
  const fixture = fixtures.find(candidate => candidate.name === 'utf8');
  const input = artifact({
    fixture: fixture.name, partition: 'bytewise',
    bytesBase64: Buffer.from(fixture.bytes).toString('base64'),
    cuts: Array.from({ length: fixture.bytes.length - 1 }, (_, i) => i + 1),
    expected: structuredClone(fixture.expected),
  });
  const before = structuredClone(input);
  const first = await reduceReplay(brokenUtf8Consumer, input);
  const second = await reduceReplay(brokenUtf8Consumer, input);
  assert.deepEqual(first, second);
  assert.equal(first.status, 'complete');
  assert.equal(first.reduced.cuts.length, 1);
  assert.ok(input.cuts.includes(first.reduced.cuts[0]));
  assert.deepEqual(input, before);
  assert.deepEqual(first.original.cuts, input.cuts);
  assert.deepEqual(flags(first.originalResult), [false, false]);
  assert.deepEqual(flags(first.reducedResult), [false, false]);
  for (const saved of [first.original, first.reduced]) {
    assert.equal(saved.format, 'streamsplit-replay');
    assert.equal(saved.version, 1);
    assert.equal(saved.bytesBase64, input.bytesBase64);
    assert.deepEqual(saved.expected, input.expected);
    assert.deepEqual(flags(await replay(brokenUtf8Consumer, jsonCopy(saved))), [false, false]);
    assert.deepEqual(flags(await replay(goodConsumer, jsonCopy(saved))), [true, true]);
  }
});

test('passing consumer performs no candidate attempts or cut changes', async () => {
  const input = artifact();
  let calls = 0;
  const report = await reduceReplay(() => { calls++; return []; }, input);
  assert.equal(report.status, 'not-failing');
  assert.equal(report.attempts, 0);
  assert.equal(calls, 2);
  assert.deepEqual(report.original.cuts, input.cuts);
  assert.deepEqual(report.reduced.cuts, input.cuts);
  assert.deepEqual(flags(report.originalResult), [true, true]);
  assert.deepEqual(flags(report.reducedResult), [true, true]);
});

test('left-to-right deletion restarts after an accepted cut and proves single-cut minimality', async () => {
  const visited = [];
  const failing = new Set(['1,2,3', '1,3', '3']);
  const consumer = chunks => {
    const key = cutsOf(chunks).join(',');
    visited.push(key);
    return failing.has(key) ? [event()] : [];
  };
  const report = await reduceReplay(consumer, artifact());
  assert.deepEqual(visited.slice(2), ['2,3', '1,3', '3', '']);
  assert.equal(report.attempts, 4);
  assert.equal(report.status, 'complete');
  assert.deepEqual(report.reduced.cuts, [3]);
  assert.deepEqual(flags(report.reducedResult), [false, false]);
  // Removing the sole remaining cut repairs this assertion failure.
  assert.deepEqual(flags(await replay(consumer, { ...report.reduced, cuts: [] })), [true, true]);
});

test('zero budget retains a freshly verified failing original without candidate calls', async () => {
  let calls = 0;
  const report = await reduceReplay(chunks => {
    calls++;
    return chunks.length > 1 ? [event()] : [];
  }, artifact(), { maxAttempts: 0 });
  assert.equal(report.status, 'budget-exhausted');
  assert.equal(report.attempts, 0);
  assert.equal(calls, 2);
  assert.deepEqual(report.reduced.cuts, [1, 2, 3]);
  assert.deepEqual(flags(report.reducedResult), [false, false]);
});

test('budget exhaustion returns the last accepted failure, never an untested proposal', async () => {
  const visited = [];
  const report = await reduceReplay(chunks => {
    const cuts = cutsOf(chunks);
    visited.push(cuts);
    return cuts.length ? [event()] : [];
  }, artifact(), { maxAttempts: 1 });
  assert.equal(report.status, 'budget-exhausted');
  assert.equal(report.attempts, 1);
  assert.equal(visited.length, 3);
  assert.deepEqual(visited.at(-1), [2, 3]);
  assert.deepEqual(report.original.cuts, [1, 2, 3]);
  assert.deepEqual(report.reduced.cuts, [2, 3]);
  assert.deepEqual(flags(report.reducedResult), [false, false]);
});

test('default and maximum attempt budgets bound candidate and total consumer calls', async () => {
  for (const [options, budget, count, status] of [
    [undefined, 128, 200, 'budget-exhausted'],
    [{ maxAttempts: 256 }, 256, 256, 'complete'],
    [{ maxAttempts: 256 }, 256, 257, 'budget-exhausted'],
  ]) {
    let calls = 0;
    const input = artifact({
      bytesBase64: Buffer.alloc(count + 1).toString('base64'),
      cuts: Array.from({ length: count }, (_, i) => i + 1),
    });
    const report = await reduceReplay(chunks => {
      calls++;
      return chunks.length === count + 1 ? [event()] : [];
    }, input, options);
    assert.equal(report.attempts, budget);
    assert.equal(calls, budget + 2);
    assert.equal(report.status, status);
    assert.deepEqual(report.reduced.cuts, input.cuts);
  }
});

test('using the final budget unit to remove the final cut completes rather than exhausts', async () => {
  const report = await reduceReplay(() => [event()], artifact({ cuts: [1, 2] }), { maxAttempts: 2 });
  assert.equal(report.attempts, 2);
  assert.equal(report.status, 'complete');
  assert.deepEqual(report.reduced.cuts, []);
  assert.deepEqual(flags(report.originalResult), [false, true]);
  assert.deepEqual(flags(report.reducedResult), [false, true]);
});

test('empty and one-byte failing replays are already complete at zero budget', async () => {
  for (const bytesBase64 of ['', 'YQ==']) {
    let calls = 0;
    const report = await reduceReplay(() => { calls++; return [event()]; }, artifact({ bytesBase64, cuts: [] }), { maxAttempts: 0 });
    assert.equal(report.status, 'complete');
    assert.equal(report.attempts, 0);
    assert.equal(calls, 2);
    assert.deepEqual(report.reduced.cuts, []);
    assert.deepEqual(flags(report.reducedResult), [false, true]);
  }
});

test('invariance-only failure keeps its successful expected-output assertion', async () => {
  const consumer = chunks => {
    const key = cutsOf(chunks).join(',');
    if (key === '') return [event('baseline')];
    if (key === '2') return [event('different wrong result')];
    return [];
  };
  const report = await reduceReplay(consumer, artifact({ cuts: [1, 2] }));
  assert.equal(report.status, 'complete');
  assert.deepEqual(report.reduced.cuts, [1]);
  assert.deepEqual(flags(report.originalResult), [true, false]);
  assert.deepEqual(flags(report.reducedResult), [true, false]);
});

test('both failed assertions must survive instead of keeping only either failure', async () => {
  const consumer = chunks => {
    const key = cutsOf(chunks).join(',');
    if (key === '1,2') return [event('original')];
    if (key === '1') return [];
    return [event('baseline')];
  };
  const report = await reduceReplay(consumer, artifact({ cuts: [1, 2] }));
  assert.equal(report.status, 'complete');
  assert.equal(report.attempts, 2);
  assert.deepEqual(report.reduced.cuts, [1, 2]);
  assert.deepEqual(flags(report.originalResult), [false, false]);
  assert.deepEqual(flags(report.reducedResult), [false, false]);
});

test('an event mismatch cannot be retained by an unrelated throw or malformed output', async () => {
  for (const failure of [() => { throw new Error('unrelated'); }, () => undefined]) {
    const report = await reduceReplay(chunks => {
      const cuts = cutsOf(chunks);
      if (cuts.length === 2) return [event()];
      if (cuts.length === 1) return failure();
      return [];
    }, artifact({ cuts: [1, 2] }));
    assert.equal(report.status, 'complete');
    assert.deepEqual(report.reduced.cuts, [1, 2]);
    assert.deepEqual(report.reducedResult.actual, { events: [event()] });
  }
});

test('exception reduction requires both the original error name and message', async () => {
  const consumer = chunks => {
    const key = cutsOf(chunks).join(',');
    if (key === '') return [];
    if (key === '2,3') throw new Error('marker');
    if (key === '1,3') throw new RangeError('unrelated');
    throw new RangeError('marker');
  };
  const report = await reduceReplay(consumer, artifact());
  assert.equal(report.status, 'complete');
  assert.equal(report.attempts, 5);
  assert.deepEqual(report.reduced.cuts, [2]);
  assert.deepEqual(report.reducedResult.actual, { error: { name: 'RangeError', message: 'marker' } });
  assert.deepEqual(flags(await replay(consumer, jsonCopy(report.reduced))), [false, false]);
});

test('an original exception cannot silently turn into an ordinary event mismatch', async () => {
  const report = await reduceReplay(chunks => {
    if (chunks.length === 3) throw new Error('original');
    return chunks.length === 2 ? [event()] : [];
  }, artifact({ cuts: [1, 2] }));
  assert.deepEqual(report.reduced.cuts, [1, 2]);
  assert.deepEqual(report.reducedResult.actual, { error: { name: 'Error', message: 'original' } });
});

test('saved diagnostics are not trusted and async consumers are supported', async () => {
  const input = artifact({
    observed: { error: { name: 'Forged', message: 'not executed' } },
    baseline: { events: [event('forged')] },
  });
  const report = await reduceReplay(async chunks => chunks.length > 1 ? [event()] : [], input);
  assert.deepEqual(report.originalResult.actual, { events: [event()] });
  assert.deepEqual(report.originalResult.baseline, { events: [] });
  assert.deepEqual(report.original.observed, report.originalResult.actual);
  assert.deepEqual(report.original.baseline, report.originalResult.baseline);
  assert.deepEqual(report.reduced.observed, report.reducedResult.actual);
  assert.deepEqual(report.reduced.baseline, report.reducedResult.baseline);
  assert.deepEqual(report.reduced.cuts, [3]);
});

test('returned original and reduced artifacts do not alias caller inputs or each other', async () => {
  const expected = [event('expected')];
  const input = artifact({ expected });
  const before = structuredClone(input);
  const report = await reduceReplay(() => [event()], input);
  assert.deepEqual(input, before);
  report.reduced.cuts.push(1);
  report.reduced.expected[0].data = 'mutated reduced expected';
  report.reduced.observed.events[0].data = 'mutated reduced observed';
  report.reduced.baseline.events[0].data = 'mutated reduced baseline';
  assert.deepEqual(report.original.cuts, before.cuts);
  assert.deepEqual(report.original.expected, before.expected);
  assert.deepEqual(report.original.observed, { events: [event()] });
  assert.deepEqual(report.original.baseline, { events: [event()] });
  assert.deepEqual(input, before);
  report.original.expected[0].data = 'mutated original expected';
  assert.deepEqual(input, before);
});

test('consumer chunk mutation cannot change original or reduced stored bytes', async () => {
  const input = artifact();
  const before = structuredClone(input);
  const report = await reduceReplay(chunks => {
    assert.deepEqual(Buffer.concat(chunks), Buffer.from('abcd'));
    for (const chunk of chunks) chunk.fill(0);
    return [event()];
  }, input);
  assert.equal(report.original.bytesBase64, before.bytesBase64);
  assert.equal(report.reduced.bytesBase64, before.bytesBase64);
  assert.deepEqual(input, before);
});

test('invalid attempt budgets and option shapes reject before setup consumer calls', async () => {
  for (const options of [null, [], 1, 'options']) {
    await rejectsWithoutConsumer(artifact(), options, /options/);
  }
  for (const maxAttempts of [-1, 1.5, NaN, Infinity, '1', 1n, 257, Number.MAX_SAFE_INTEGER]) {
    await rejectsWithoutConsumer(artifact(), { maxAttempts }, /maxAttempts|attempt/);
  }
});

test('invalid v1 input shapes and bounds reject before any reduction consumer calls', async () => {
  for (const changes of [
    { version: 2 }, { format: 'other' }, { bytesBase64: null },
    { bytesBase64: 'YQ' }, { bytesBase64: 'YR==' },
    { bytesBase64: Buffer.alloc(LIMITS.maxBytes + 1).toString('base64'), cuts: [] },
    { cuts: [0] }, { cuts: [4] }, { cuts: [2, 1] }, { cuts: [1, 1] },
    { cuts: new Array(1) }, { cuts: [1.5] }, { cuts: new Uint8Array([1]) },
    { expected: new Array(1) }, { expected: [{}] },
    { expected: Array.from({ length: LIMITS.maxExpectedEvents + 1 }, () => event()) },
    { expected: [event('a'.repeat(LIMITS.maxExpectedTextBytes + 1))] },
  ]) {
    await rejectsWithoutConsumer(artifact(changes), {}, /replay|base64|bytes|cuts|expected/);
  }
});

test('validated cuts, bytes, and expected events are snapshotted before consumer awaits', async () => {
  const input = artifact({ expected: [event('expected')] });
  const before = structuredClone(input);
  let calls = 0;
  const report = await reduceReplay(async chunks => {
    assert.deepEqual(Buffer.concat(chunks), Buffer.from('abcd'));
    if (calls++ === 0) {
      input.cuts.length = 0;
      input.bytesBase64 = '';
      input.expected[0].data = 'changed by caller';
    }
    return [];
  }, input);
  assert.deepEqual(report.original.cuts, before.cuts);
  for (const saved of [report.original, report.reduced]) {
    assert.equal(saved.bytesBase64, before.bytesBase64);
    assert.deepEqual(saved.expected, before.expected);
  }
  assert.deepEqual(flags(report.originalResult), [false, true]);
  assert.deepEqual(flags(report.reducedResult), [false, true]);
});

test('reduction rejects non-JSON expected semantics before consumers instead of changing the failure', async () => {
  const plain = event('expected');
  const nullPrototype = Object.assign(Object.create(null), plain);
  const input = artifact({ expected: [nullPrototype] });
  // The existing replay API still accepts this record and compares prototypes.
  assert.deepEqual(flags(await replay(() => [plain], input)), [false, true]);
  await rejectsWithoutConsumer(input, {}, /JSON-normalized plain records/);

  class CustomEvent { constructor() { Object.assign(this, plain); } }
  class CustomArray extends Array {}
  const symbolEvent = { ...plain, [Symbol('extra')]: 'not serialized' };
  const namedArray = Object.assign([plain], { extra: 'not serialized' });
  for (const expected of [[new CustomEvent()], [symbolEvent], namedArray, new CustomArray(plain)]) {
    await rejectsWithoutConsumer(artifact({ expected }), {}, /JSON-normalized plain records/);
  }
  // An intentional caller-side JSON normalization has explicit replay semantics.
  const normalized = jsonCopy(input);
  const report = await reduceReplay(() => [plain], normalized);
  assert.equal(report.status, 'not-failing');
  assert.deepEqual(flags(report.originalResult), flags(await replay(() => [plain], normalized)));
});

test('complete promises only single-cut minimality, not a globally minimum cut list', async () => {
  const consumer = chunks => chunks.length === 2 ? [] : [event()];
  const report = await reduceReplay(consumer, artifact({ cuts: [1, 2] }));
  assert.equal(report.status, 'complete');
  assert.equal(report.attempts, 2);
  assert.deepEqual(report.reduced.cuts, [1, 2]);
  assert.deepEqual(flags(report.reducedResult), [false, true]);
  // Neither single deletion preserves the failure, although deleting both would.
  assert.deepEqual(flags(await replay(consumer, { ...report.reduced, cuts: [] })), [false, true]);
});
