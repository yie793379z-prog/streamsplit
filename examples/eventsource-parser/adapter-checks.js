import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createParser } from 'eventsource-parser';
import { fixtures } from '../../fixtures/sse.js';
import { checkFixture, makeReplay, replay } from '../../src/harness.js';
import { chunkBytes } from '../../src/partitions.js';
import { eventsourceParserConsumer } from './consumer.js';
import { adapterFixtures } from './fixtures.js';

for (const fixture of [...fixtures, ...adapterFixtures]) {
  test(`real parser adapter: ${fixture.name}`, async () => {
    const report = await checkFixture(eventsourceParserConsumer, fixture, { seed: 20261018 });
    assert.ok(report.passed, JSON.stringify(report.cases.filter(c => !c.matchesExpected || !c.chunkInvariant)));
  });
}

test('empty chunks preserve split BOM, UTF-8 and line-ending state', () => {
  for (const fixture of [...fixtures, ...adapterFixtures]) {
    const cuts = Array.from({ length: Math.max(0, fixture.bytes.length - 1) }, (_, i) => i + 1);
    const chunks = chunkBytes(fixture.bytes, cuts).flatMap(chunk => [new Uint8Array(), chunk, new Uint8Array()]);
    assert.deepEqual(eventsourceParserConsumer(chunks), fixture.expected, fixture.name);
  }
  assert.deepEqual(eventsourceParserConsumer([]), []);
});

test('each invocation starts fresh after retained IDs and incomplete EOF', () => {
  const bytes = text => [new TextEncoder().encode(text)];
  const first = eventsourceParserConsumer(bytes('id: old\ndata: before\n\ndata: incomplete'));
  const snapshot = structuredClone(first);
  assert.deepEqual(eventsourceParserConsumer(bytes('data: after\n\n')), [
    { type: 'message', data: 'after', lastEventId: '' },
  ]);
  assert.deepEqual(eventsourceParserConsumer(bytes('\n\n')), []);
  assert.deepEqual(first, snapshot);
});

test('negative control: per-chunk decoding fails, and JSON replay passes with the real adapter', async () => {
  // Corrupt text before it reaches the real parser, as a faulty network wrapper would.
  const broken = chunks => eventsourceParserConsumer(chunks.map(chunk =>
    new TextEncoder().encode(new TextDecoder().decode(chunk))));
  const fixture = fixtures.find(f => f.name === 'utf8');
  const report = await checkFixture(broken, fixture, { seed: 20261018 });
  assert.equal(report.cases[0].matchesExpected, true);
  assert.equal(report.passed, false);
  const failed = report.cases.find(c => c.cuts.length === 1 && c.cuts[0] === 7);
  assert.equal(failed.matchesExpected, false);
  assert.equal(failed.chunkInvariant, false);
  const artifact = JSON.parse(JSON.stringify(makeReplay(fixture, report, failed)));
  const badReplay = await replay(broken, artifact);
  assert.deepEqual(badReplay.actual, failed.actual);
  assert.equal(badReplay.matchesExpected, false);
  assert.equal(badReplay.chunkInvariant, false);
  const goodReplay = await replay(eventsourceParserConsumer, artifact);
  assert.equal(goodReplay.matchesExpected, true);
  assert.equal(goodReplay.chunkInvariant, true);
});

test('negative control: event.id alone misses ID-only blocks despite chunk invariance', async () => {
  const missingIdState = chunks => {
    const events = [];
    const decoder = new TextDecoder();
    const parser = createParser({ onEvent(event) {
      events.push({ type: event.event || 'message', data: event.data, lastEventId: event.id ?? '' });
    } });
    for (const chunk of chunks) parser.feed(decoder.decode(chunk, { stream: true }));
    parser.feed(decoder.decode());
    parser.reset();
    return events;
  };
  const report = await checkFixture(missingIdState, adapterFixtures[0], { seed: 20261018 });
  assert.equal(report.passed, false);
  assert.ok(report.cases.every(c => c.chunkInvariant && !c.matchesExpected));
});

test('demo verifies real parsing and replay, matches expected output, and writes no files', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'streamsplit-adapter-'));
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

test('both languages document the verified adapter demo output', () => {
  const readme = readFileSync(new URL('./README.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const blocks = [...readme.matchAll(/<!-- adapter-demo-output -->\n```text\n([\s\S]*?)```/g)];
  assert.equal(blocks.length, 2);
  const expected = readFileSync(new URL('./expected-output.txt', import.meta.url), 'utf8');
  for (const [, output] of blocks) assert.equal(output, expected);
});
