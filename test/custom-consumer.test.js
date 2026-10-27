import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFixture, replay } from '../src/harness.js';
import { createFixture, consumer, brokenConsumer, runRecipe } from '../examples/custom-consumer.js';

const output = 'StreamSplit: test your own consumer\n'
  + 'Custom fixture: 45 bytes; 46 partitions\n'
  + 'PASS: streaming adapter matches the hand-written expected event\n'
  + 'Captured failure: cuts [40]; JSON replay v1\n'
  + 'PASS: serialized replay fails with broken decoder and passes with streaming adapter\n';

test('custom fixture has a literal independent oracle and fresh input on each call', () => {
  const fixture = createFixture();
  assert.equal(new TextDecoder().decode(fixture.bytes), 'event: greeting\nid: demo-1\ndata: hello 🌊\n\n');
  assert.deepEqual(fixture.expected, [{ type: 'greeting', data: 'hello 🌊', lastEventId: 'demo-1' }]);
  fixture.bytes.fill(0);
  fixture.expected[0].data = 'changed';
  assert.equal(createFixture().bytes.length, 45);
  assert.equal(createFixture().expected[0].data, 'hello 🌊');
});

test('recipe captures a deterministic failure and replays the same JSON with both consumers', async () => {
  const first = await runRecipe();
  const second = await runRecipe();
  assert.equal(first.json, second.json);
  assert.equal(first.good.cases.length, 46);
  assert.equal(first.report.passed, false);
  assert.deepEqual(first.artifact.cuts, [40]);
  assert.deepEqual(Buffer.from(first.artifact.bytesBase64, 'base64'), Buffer.from(first.fixture.bytes));
  assert.deepEqual(first.artifact.expected, first.fixture.expected);
  assert.deepEqual(await replay(brokenConsumer, JSON.parse(first.json)), first.broken);
  assert.deepEqual(await replay(consumer, JSON.parse(first.json)), first.fixed);
});

test('custom adapter can be asynchronous and creates fresh decoding state each invocation', async () => {
  const fixture = createFixture();
  const asyncConsumer = async chunks => consumer(chunks);
  const report = await checkFixture(asyncConsumer, fixture, { randomCases: 0 });
  assert.equal(report.passed, true);
  const empty = { name: 'empty', bytes: new Uint8Array(), expected: [] };
  assert.equal((await checkFixture(asyncConsumer, empty)).passed, true);
  assert.equal((await checkFixture(asyncConsumer, fixture)).passed, true);
});

test('custom-consumer recipe exits successfully with exact output and no files', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'streamsplit-custom-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../examples/custom-consumer.js', import.meta.url))], {
    cwd, encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, output);
  assert.deepEqual(readdirSync(cwd), []);
});

test('both custom-consumer guide languages show the exact tested output', () => {
  const guide = readFileSync(new URL('../docs/CUSTOM-CONSUMER.md', import.meta.url), 'utf8');
  const blocks = [...guide.matchAll(/<!-- custom-consumer-output -->\n```text\n([\s\S]*?)```/g)];
  assert.equal(blocks.length, 2);
  for (const [, text] of blocks) assert.equal(text, output);
});
