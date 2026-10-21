import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const demo = fileURLToPath(new URL('../examples/utf8-demo.js', import.meta.url));
const expected = [
  'StreamSplit: same bytes, different chunks',
  'Unsplit / broken decoder: "你好 🌊 café"',
  'Cut at byte 7 / broken decoder: "���好 🌊 café"',
  'Cut at byte 7 / streaming decoder: "你好 🌊 café"',
  'PASS: reproduced the UTF-8 bug and verified the fix.',
  '',
].join('\n');

test('first-run demo reproduces the UTF-8 failure, verifies the fix, and writes no files', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'streamsplit-demo-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [demo], {
    cwd, encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, expected);
  assert.deepEqual(readdirSync(cwd), []);
});

test('English and Chinese quickstarts show the verified demo output exactly', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const blocks = [...readme.matchAll(/<!-- utf8-demo-output -->\n```text\n([\s\S]*?)```/g)];
  assert.equal(blocks.length, 2, 'Both quickstarts should include the demo output');
  for (const [, output] of blocks) assert.equal(output, expected);
});
