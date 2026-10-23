import { LIMITS } from './limits.js';

export function validateLength(length) {
  if (!Number.isSafeInteger(length) || length < 0) throw new RangeError('length must be a nonnegative safe integer');
  if (length > LIMITS.maxBytes) throw new RangeError(`bytes exceed ${LIMITS.maxBytes}-byte limit`);
}

export function validateBytes(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('bytes must be a Uint8Array or Buffer');
  validateLength(bytes.length);
}

export function validateCuts(cuts, length) {
  if (!Array.isArray(cuts)) throw new TypeError('cuts must be an array');
  if (cuts.length > Math.max(0, length - 1)) throw new RangeError('cuts exceed the number of interior byte offsets');
  let previous = 0;
  for (const cut of cuts) {
    if (!Number.isSafeInteger(cut) || cut <= previous || cut >= length) throw new RangeError('cuts must be sorted unique interior offsets');
    previous = cut;
  }
}

export function validateExpected(expected) {
  if (!Array.isArray(expected)) throw new TypeError('expected must be an array');
  if (expected.length > LIMITS.maxExpectedEvents) throw new RangeError(`expected exceeds ${LIMITS.maxExpectedEvents}-event limit`);
  let textBytes = 0;
  for (const event of expected) {
    if (!event || typeof event !== 'object' || Array.isArray(event) || Object.keys(event).length !== 3 ||
        !['type', 'data', 'lastEventId'].every(key => Object.hasOwn(event, key) && typeof event[key] === 'string')) {
      throw new TypeError('expected events must contain exactly { type, data, lastEventId } string fields');
    }
    for (const value of [event.type, event.data, event.lastEventId]) {
      textBytes += Buffer.byteLength(value, 'utf8');
      if (textBytes > LIMITS.maxExpectedTextBytes) throw new RangeError(`expected text exceeds ${LIMITS.maxExpectedTextBytes}-byte UTF-8 limit`);
    }
  }
}

export function validateFixture(fixture) {
  if (!fixture || typeof fixture !== 'object') throw new TypeError('fixture must be an object');
  if (typeof fixture.name !== 'string' || fixture.name.length === 0) throw new TypeError('fixture.name must be a nonempty string');
  if (Buffer.byteLength(fixture.name, 'utf8') > LIMITS.maxNameBytes) throw new RangeError(`fixture.name exceeds ${LIMITS.maxNameBytes}-byte UTF-8 limit`);
  validateBytes(fixture.bytes);
  validateExpected(fixture.expected);
}
