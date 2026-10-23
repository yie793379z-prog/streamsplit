import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const expected = `StreamSplit: bounded inputs before consumer execution
PASS: 16384-byte input accepted
REJECT: bytes exceed 16384-byte limit (consumer calls: 0)
REJECT: partition candidates exceed 512 limit; lower randomCases or singleSplitLimit (consumer calls: 0)
PASS: version-1 replay remains compatible
`;

test('limits demo proves early rejection and replay compatibility without file writes', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'streamsplit-limits-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../examples/limits-demo.js', import.meta.url))], {
    cwd, encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, expected);
  assert.deepEqual(readdirSync(cwd), []);
});

test('both languages document the verified input-limits demo output', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const blocks = [...readme.matchAll(/<!-- limits-demo-output -->\n```text\n([\s\S]*?)```/g)];
  assert.equal(blocks.length, 2);
  for (const [, output] of blocks) assert.equal(output, expected);
});
