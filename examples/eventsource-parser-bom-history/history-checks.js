import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import beforePackage from 'eventsource-parser-before/package.json' with { type: 'json' };
import afterPackage from 'eventsource-parser-after/package.json' with { type: 'json' };
import { checkFixture, makeReplay, reduceReplay, replay } from '../../src/harness.js';
import { chunkBytes } from '../../src/partitions.js';
import { beforeConsumer, afterConsumer } from './consumers.js';
import { bomFixture } from './fixture.js';

const roundTrip = value => JSON.parse(JSON.stringify(value));
const inputReplay = () => ({
  format: 'streamsplit-replay', version: 1, fixture: bomFixture.name,
  bytesBase64: Buffer.from(bomFixture.bytes).toString('base64'),
  expected: structuredClone(bomFixture.expected), cuts: [1, 3, 5, 8, 10],
});

test('installed historical versions match the exact npm aliases and integrity lock', () => {
  const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(readFileSync(new URL('./package-lock.json', import.meta.url), 'utf8'));
  for (const [alias, metadata, version] of [
    ['eventsource-parser-before', beforePackage, '4.1.0'],
    ['eventsource-parser-after', afterPackage, '4.1.2'],
  ]) {
    assert.equal(metadata.name, 'eventsource-parser');
    assert.equal(metadata.version, version);
    assert.equal(manifest.dependencies[alias], `npm:eventsource-parser@${version}`);
    assert.equal(lock.packages[''].dependencies[alias], manifest.dependencies[alias]);
    assert.equal(lock.packages[`node_modules/${alias}`].version, version);
    assert.match(lock.packages[`node_modules/${alias}`].integrity, /^sha512-/);
  }
});

test('original 11-byte synthetic fixture has a hand-authored unsplit oracle for both versions', () => {
  assert.equal(bomFixture.bytes.length, 11);
  assert.equal(Buffer.from(bomFixture.bytes).toString('hex'), 'efbbbf646174613a780a0a');
  assert.deepEqual(bomFixture.expected, [{ type: 'message', data: 'x', lastEventId: '' }]);
  for (const consumer of [beforeConsumer, afterConsumer]) {
    assert.deepEqual(consumer([bomFixture.bytes]), bomFixture.expected);
  }
});

for (const cut of [1, 2]) {
  test(`split BOM at byte ${cut}: v1 replay drops the old event and preserves the fixed event`, async () => {
    const report = await checkFixture(beforeConsumer, bomFixture, { randomCases: 0 });
    const failed = report.cases.find(c => c.label === `single:${cut}`);
    const artifact = roundTrip(makeReplay(bomFixture, report, failed));
    assert.deepEqual(artifact.cuts, [cut]);
    const red = await replay(beforeConsumer, artifact);
    assert.deepEqual(red.baseline, { events: bomFixture.expected });
    assert.deepEqual(red.actual, { events: [] });
    assert.equal(red.matchesExpected, false);
    assert.equal(red.chunkInvariant, false);
    const green = await replay(afterConsumer, artifact);
    assert.deepEqual(green.actual, { events: bomFixture.expected });
    assert.equal(green.matchesExpected, true);
    assert.equal(green.chunkInvariant, true);
  });
}

test('12 deterministic partitions isolate exactly three historical failures and no fixed failures', async () => {
  const before = await checkFixture(beforeConsumer, bomFixture, { randomCases: 0 });
  const after = await checkFixture(afterConsumer, bomFixture, { randomCases: 0 });
  assert.equal(before.cases.length, 12);
  assert.equal(before.passed, false);
  assert.deepEqual(before.cases.filter(c => !c.matchesExpected || !c.chunkInvariant).map(c => c.label),
    ['single:1', 'single:2', 'bytewise']);
  for (const c of before.cases) {
    const failing = ['single:1', 'single:2', 'bytewise'].includes(c.label);
    assert.equal(c.matchesExpected, !failing);
    assert.equal(c.chunkInvariant, !failing);
    assert.deepEqual(c.actual, { events: failing ? [] : bomFixture.expected });
  }
  assert.equal(after.cases.length, 12);
  assert.equal(after.passed, true);
});

test('control without a BOM passes all partitions on both parser versions', async () => {
  const fixture = { ...bomFixture, name: 'no-bom-control', bytes: bomFixture.bytes.slice(3) };
  for (const consumer of [beforeConsumer, afterConsumer]) {
    const report = await checkFixture(consumer, fixture, { randomCases: 0 });
    assert.equal(report.passed, true);
  }
});

test('explicit empty byte chunks retain the same red/green distinction', () => {
  const chunks = chunkBytes(bomFixture.bytes, [1, 2, 3]).flatMap(chunk => [new Uint8Array(), chunk]);
  assert.deepEqual(beforeConsumer(chunks), []);
  assert.deepEqual(afterConsumer(chunks), bomFixture.expected);
});

test('historical and fixed consumers create fresh state for every invocation', () => {
  for (const consumer of [beforeConsumer, afterConsumer]) {
    consumer([new TextEncoder().encode('id: previous\ndata: pending')]);
    consumer(chunkBytes(bomFixture.bytes, [1]));
    assert.deepEqual(consumer([bomFixture.bytes]), bomFixture.expected);
    assert.deepEqual(consumer([]), []);
  }
});

test('reduction preserves bytes, oracle and both v1 replays while removing four cuts', async () => {
  const input = inputReplay();
  const snapshot = roundTrip(input);
  const result = await reduceReplay(beforeConsumer, input, { maxAttempts: 32 });
  assert.deepEqual(input, snapshot);
  assert.equal(result.status, 'complete');
  assert.equal(result.attempts, 9);
  assert.deepEqual(result.original.cuts, [1, 3, 5, 8, 10]);
  assert.deepEqual(result.reduced.cuts, [1]);
  for (const saved of [result.original, result.reduced]) {
    assert.equal(saved.version, 1);
    assert.equal(saved.bytesBase64, snapshot.bytesBase64);
    assert.deepEqual(saved.expected, snapshot.expected);
    const red = await replay(beforeConsumer, roundTrip(saved));
    const green = await replay(afterConsumer, roundTrip(saved));
    assert.deepEqual(red.actual, { events: [] });
    assert.equal(red.matchesExpected, false);
    assert.equal(red.chunkInvariant, false);
    assert.deepEqual(green.actual, { events: bomFixture.expected });
    assert.equal(green.matchesExpected, true);
    assert.equal(green.chunkInvariant, true);
  }
  const withoutLastCut = await replay(beforeConsumer, { ...result.reduced, cuts: [] });
  assert.equal(withoutLastCut.matchesExpected, true);
  assert.equal(withoutLastCut.chunkInvariant, true);
});

test('the fixed parser has no failure to reduce for the original cut list', async () => {
  const result = await reduceReplay(afterConsumer, inputReplay());
  assert.equal(result.status, 'not-failing');
  assert.equal(result.attempts, 0);
  assert.deepEqual(result.reduced.cuts, [1, 3, 5, 8, 10]);
});

test('standalone demo proves red/green and replay with exact output and no file writes', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'streamsplit-bom-history-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./demo.js', import.meta.url))], {
    cwd, encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, readFileSync(new URL('./expected-output.txt', import.meta.url), 'utf8'));
  assert.deepEqual(readdirSync(cwd), []);
});

test('English and Chinese guides match the executable demo output', () => {
  const readme = readFileSync(new URL('./README.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const blocks = [...readme.matchAll(/<!-- bom-history-output -->\n```text\n([\s\S]*?)```/g)];
  assert.equal(blocks.length, 2);
  const expected = readFileSync(new URL('./expected-output.txt', import.meta.url), 'utf8');
  for (const [, output] of blocks) assert.equal(output, expected);
});
