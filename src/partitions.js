/** Deterministic mulberry32 PRNG. Seed is an unsigned 32-bit integer. */
export function random(seed) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Generate cut offsets, not all possible partitions (which are exponential).
 * Every single interior split is tested only for streams <= singleSplitLimit.
 */
export function partitions(length, { seed = 1, randomCases = 32, singleSplitLimit = 256 } = {}) {
  for (const [name, value] of Object.entries({ length, randomCases, singleSplitLimit })) {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a nonnegative safe integer`);
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('seed must be uint32');
  const result = [{ label: 'whole', cuts: [] }];
  const seen = new Set(['']);
  const add = (label, cuts) => {
    const key = cuts.join(',');
    if (!seen.has(key)) { seen.add(key); result.push({ label, cuts }); }
  };
  if (length <= singleSplitLimit) {
    for (let i = 1; i < length; i++) add(`single:${i}`, [i]);
  }
  add('bytewise', Array.from({ length: Math.max(0, length - 1) }, (_, i) => i + 1));
  const next = random(seed);
  for (let i = 0; i < randomCases; i++) {
    const cuts = [];
    for (let j = 1; j < length; j++) if (next() < 0.25) cuts.push(j);
    add(`seed:${seed}:${i}`, cuts);
  }
  return result;
}

/** Copy each slice so consumers cannot mutate fixture bytes. */
export function chunkBytes(bytes, cuts) {
  let start = 0;
  const chunks = [];
  for (const end of cuts) {
    if (!Number.isSafeInteger(end) || end <= start || end >= bytes.length) throw new RangeError('cuts must be sorted unique interior offsets');
    chunks.push(Uint8Array.from(bytes.subarray(start, end)));
    start = end;
  }
  chunks.push(Uint8Array.from(bytes.subarray(start)));
  return chunks;
}
