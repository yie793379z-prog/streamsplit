import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const expected = `StreamSplit: fewer cuts, same failure
Original cuts: [1,6,7,12,23,24]
Reduced cuts: [7] (9 attempts; complete)
Unchanged: 25 bytes and expected events
PASS: both version-1 artifacts fail with broken decoder and pass with streaming decoder
Budget 2: 4 cuts remain; budget-exhausted; original failure preserved
`;

test('reduction demo proves smaller replayable failure and budget exhaustion without file writes', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'streamsplit-reduce-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../examples/reduce-demo.js', import.meta.url))], {
    cwd, encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, expected);
  assert.deepEqual(readdirSync(cwd), []);
});

test('both languages document the verified reduction demo output', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const blocks = [...readme.matchAll(/<!-- reduce-demo-output -->\n```text\n([\s\S]*?)```/g)];
  assert.equal(blocks.length, 2);
  for (const [, output] of blocks) assert.equal(output, expected);
});
