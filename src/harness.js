import { isDeepStrictEqual } from 'node:util';
import { chunkBytes, partitions } from './partitions.js';
import { LIMITS } from './limits.js';
import { validateBytes, validateCuts, validateExpected, validateFixture } from './validation.js';

export { LIMITS } from './limits.js';

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
  validateFixture(fixture);
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
  validateFixture(fixture);
  validateCuts(failedCase.cuts, fixture.bytes.length);
  return {
    format: 'streamsplit-replay', version: 1, fixture: fixture.name,
    bytesBase64: Buffer.from(fixture.bytes).toString('base64'), cuts: failedCase.cuts,
    expected: fixture.expected, observed: failedCase.actual, baseline: result.baseline,
    partition: failedCase.label,
  };
}

function replayBytes(artifact) {
  if (artifact?.format !== 'streamsplit-replay' || artifact.version !== 1 || !Array.isArray(artifact.cuts) || !Array.isArray(artifact.expected) || typeof artifact.bytesBase64 !== 'string') {
    throw new TypeError('unsupported or malformed replay');
  }
  // Reject before decoding: Buffer.from(base64) otherwise accepts arbitrarily
  // large strings, including noncanonical whitespace and invalid characters.
  if (artifact.bytesBase64.length > Math.ceil(LIMITS.maxBytes / 3) * 4) throw new RangeError(`bytes exceed ${LIMITS.maxBytes}-byte limit`);
  const bytes = Uint8Array.from(Buffer.from(artifact.bytesBase64, 'base64'));
  if (Buffer.from(bytes).toString('base64') !== artifact.bytesBase64) throw new TypeError('invalid base64');
  validateBytes(bytes);
  validateCuts(artifact.cuts, bytes.length);
  validateExpected(artifact.expected);
  return bytes;
}

function assertions(actual, baseline, expected) {
  return { actual, baseline, matchesExpected: isDeepStrictEqual(actual, { events: expected }), chunkInvariant: isDeepStrictEqual(actual, baseline) };
}

/** Artifacts carry data only: they never specify executable modules or code. */
export async function replay(consumer, artifact) {
  const bytes = replayBytes(artifact);
  const actual = await invoke(consumer, chunkBytes(bytes, artifact.cuts));
  const baseline = await invoke(consumer, [bytes.slice()]);
  return assertions(actual, baseline, artifact.expected);
}

/** Delete cuts, never bytes or expected events, with a bounded deterministic search.
 * maxAttempts counts candidate invocations; original + baseline cost two more.
 * A complete search is only single-cut minimal for the preserved failure, not
 * globally minimal. Consumers must be deterministic and create fresh state.
 */
export async function reduceReplay(consumer, artifact, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('reduction options must be an object');
  const { maxAttempts = 128 } = options;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 0) throw new RangeError('maxAttempts must be a nonnegative safe integer');
  if (maxAttempts > LIMITS.maxReductionAttempts) throw new RangeError(`maxAttempts exceeds ${LIMITS.maxReductionAttempts} limit`);
  const bytes = replayBytes(artifact);
  // Snapshot validated data before awaiting any consumer. Optional diagnostics
  // are not trusted, executed, or used to decide what failure to preserve.
  // A JSON round-trip must not change assertion semantics. In particular,
  // structuredClone alone normalizes null/custom prototypes, which could turn
  // an existing expected-output failure into a pass before reduction begins.
  const expected = [];
  for (const event of artifact.expected) expected.push({ type: event.type, data: event.data, lastEventId: event.lastEventId });
  if (!isDeepStrictEqual(expected, artifact.expected)) throw new TypeError('reduction expected events must be JSON-normalized plain records');
  const input = {
    format: 'streamsplit-replay', version: 1, bytesBase64: artifact.bytesBase64,
    cuts: [...artifact.cuts], expected,
  };
  for (const key of ['fixture', 'partition']) if (typeof artifact[key] === 'string') input[key] = artifact[key];
  const actual = await invoke(consumer, chunkBytes(bytes, input.cuts));
  const baseline = await invoke(consumer, [bytes.slice()]);
  const originalResult = assertions(actual, baseline, input.expected);
  let cuts = [...input.cuts], reducedResult = originalResult, attempts = 0;
  let status = originalResult.matchesExpected && originalResult.chunkInvariant ? 'not-failing' : 'complete';

  const preservesFailure = candidate =>
    candidate.matchesExpected === originalResult.matchesExpected &&
    candidate.chunkInvariant === originalResult.chunkInvariant &&
    // A new exception must not masquerade as the original event mismatch.
    // For an original exception require its normalized name AND message.
    isDeepStrictEqual(candidate.actual.error, originalResult.actual.error);

  if (status !== 'not-failing') {
    let index = 0;
    while (index < cuts.length) {
      if (attempts === maxAttempts) { status = 'budget-exhausted'; break; }
      const candidateCuts = cuts.filter((_, i) => i !== index);
      attempts++;
      const candidate = assertions(await invoke(consumer, chunkBytes(bytes, candidateCuts)), baseline, input.expected);
      if (preservesFailure(candidate)) {
        cuts = candidateCuts;
        reducedResult = candidate;
        // A previously necessary cut may become removable after a later deletion.
        index = 0;
      } else index++;
    }
  }

  const snapshot = (offsets, result, partition) => structuredClone({
    ...input, cuts: offsets, ...(partition === undefined ? {} : { partition }),
    observed: result.actual, baseline: result.baseline,
  });
  return {
    original: snapshot(input.cuts, originalResult),
    reduced: snapshot(cuts, reducedResult, 'reduced'),
    originalResult: structuredClone(originalResult), reducedResult: structuredClone(reducedResult),
    attempts, status,
  };
}
