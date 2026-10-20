import { isDeepStrictEqual } from 'node:util';
import { chunkBytes, partitions } from './partitions.js';

async function invoke(consumer, chunks) {
  try {
    const events = await consumer(chunks);
    if (!Array.isArray(events) || events.some(e => !e || typeof e.type !== 'string' || typeof e.data !== 'string' || typeof e.lastEventId !== 'string')) {
      throw new TypeError('consumer must return an array of { type, data, lastEventId } string fields');
    }
    return { events: structuredClone(events) };
  } catch (error) {
    return { error: { name: String(error?.name ?? 'Error'), message: String(error?.message ?? error) } };
  }
}

/** Run a fresh consumer state for every invocation; async consumers are supported.
 * Both assertions matter: a consistently wrong consumer is chunk-invariant.
 */
export async function checkFixture(consumer, fixture, options = {}) {
  const matrix = partitions(fixture.bytes.length, options);
  const baseline = await invoke(consumer, [Uint8Array.from(fixture.bytes)]);
  const cases = [];
  for (const partition of matrix) {
    const actual = partition.label === 'whole' ? baseline : await invoke(consumer, chunkBytes(fixture.bytes, partition.cuts));
    cases.push({ ...partition, actual, matchesExpected: isDeepStrictEqual(actual, { events: fixture.expected }), chunkInvariant: isDeepStrictEqual(actual, baseline) });
  }
  return { fixture: fixture.name, baseline, cases, passed: cases.every(c => c.matchesExpected && c.chunkInvariant) };
}

export function makeReplay(fixture, result, failedCase) {
  return {
    format: 'streamsplit-replay', version: 1, fixture: fixture.name,
    bytesBase64: Buffer.from(fixture.bytes).toString('base64'), cuts: failedCase.cuts,
    expected: fixture.expected, observed: failedCase.actual, baseline: result.baseline,
    partition: failedCase.label,
  };
}

/** Artifacts carry data only: they never specify executable modules or code. */
export async function replay(consumer, artifact) {
  if (artifact?.format !== 'streamsplit-replay' || artifact.version !== 1 || !Array.isArray(artifact.cuts) || !Array.isArray(artifact.expected) || typeof artifact.bytesBase64 !== 'string') {
    throw new TypeError('unsupported or malformed replay');
  }
  const bytes = Uint8Array.from(Buffer.from(artifact.bytesBase64, 'base64'));
  if (Buffer.from(bytes).toString('base64') !== artifact.bytesBase64) throw new TypeError('invalid base64');
  const actual = await invoke(consumer, chunkBytes(bytes, artifact.cuts));
  const baseline = await invoke(consumer, [bytes.slice()]);
  return { actual, baseline, matchesExpected: isDeepStrictEqual(actual, { events: artifact.expected }), chunkInvariant: isDeepStrictEqual(actual, baseline) };
}
