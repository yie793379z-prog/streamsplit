import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));

function workspace(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'streamsplit-cli-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}

function run(cwd, args, expectedStatus) {
  // Use this test's runtime, not whichever node happens to be first on PATH.
  // No shell is involved, and failures cannot hang the test suite indefinitely.
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd, encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024,
  });
  const diagnostics = `${JSON.stringify(args)}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`;
  assert.ifError(result.error);
  assert.equal(result.signal, null, diagnostics);
  assert.equal(result.status, expectedStatus, diagnostics);
  // Node may emit runtime warnings on stderr independently of CLI diagnostics.
  // Check the CLI's exit status and output, without suppressing those warnings.
  return result;
}

for (const args of [[], ['check']]) {
  test(`CLI ${args[0] ?? 'default'} passes all good-consumer fixtures`, t => {
    const cwd = workspace(t);
    const result = run(cwd, args, 0);
    assert.equal(result.stdout.match(/^PASS /gm)?.length, 15);
    assert.doesNotMatch(result.stdout, /^FAIL /m);
    assert.match(result.stdout, /803 partition checks; 0 failures \(good consumer\)\n$/);
    assert.equal(existsSync(join(cwd, 'artifacts')), false);
  });
}

test('CLI broken check exits 1, saves replay data, and passes only with the fixed consumer', t => {
  const cwd = workspace(t);
  const checked = run(cwd, ['check', '--broken'], 1);
  assert.match(checked.stdout, /^FAIL utf8: \d+ partitions, 40 failures$/m);
  assert.match(checked.stdout, /^FAIL bom: \d+ partitions, 26 failures$/m);
  assert.match(checked.stdout, /803 partition checks; 66 failures \(deliberately broken consumer\)\n$/);
  const directory = join(cwd, 'artifacts');
  assert.deepEqual(readdirSync(directory).sort(), ['broken-bom.json', 'broken-utf8.json']);

  for (const name of readdirSync(directory)) {
    // A relative path also verifies that replay resolves against the caller's cwd.
    const path = join('artifacts', name);
    const original = readFileSync(join(cwd, path), 'utf8');
    const artifact = JSON.parse(original);
    assert.equal(artifact.format, 'streamsplit-replay');
    assert.equal(artifact.version, 1);
    assert.ok(artifact.cuts.length > 0);

    const failed = run(cwd, ['replay', path, '--broken'], 1);
    const broken = JSON.parse(failed.stdout);
    assert.equal(broken.matchesExpected, false);
    assert.equal(broken.chunkInvariant, false);
    assert.deepEqual(broken.actual, artifact.observed);
    assert.deepEqual(broken.baseline, artifact.baseline);

    const passed = run(cwd, ['replay', path], 0);
    const fixed = JSON.parse(passed.stdout);
    assert.equal(fixed.matchesExpected, true);
    assert.equal(fixed.chunkInvariant, true);
    assert.deepEqual(fixed.actual, { events: artifact.expected });
    assert.deepEqual(fixed.actual, fixed.baseline);
    assert.equal(readFileSync(join(cwd, path), 'utf8'), original);
  }
});

for (const { args, error } of [
  { args: ['unknown'], error: /^Unknown command: unknown$/m },
  { args: ['check', '--unknown'], error: /^Usage: node src\/cli.js check \[--broken\]$/m },
  { args: ['replay'], error: /^Usage: node src\/cli.js replay <artifact.json> \[--broken\]$/m },
  { args: ['replay', 'one.json', 'two.json'], error: /^Usage: node src\/cli.js replay <artifact.json> \[--broken\]$/m },
]) {
  test(`CLI rejects invalid usage: ${args.join(' ')}`, t => {
    const cwd = workspace(t);
    const result = run(cwd, args, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, error);
    assert.deepEqual(readdirSync(cwd), []);
  });
}

test('CLI missing replay file is an operational error, not a regression', t => {
  const result = run(workspace(t), ['replay', 'missing.json'], 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /ENOENT/);
});

for (const { content, name, error } of [
  { content: '{', name: 'invalid JSON', error: /JSON|property name/i },
  { content: '{}', name: 'invalid replay schema', error: /unsupported or malformed replay/ },
]) {
  test(`CLI rejects ${name} with exit 2`, t => {
    const cwd = workspace(t);
    writeFileSync(join(cwd, 'invalid.json'), content);
    const result = run(cwd, ['replay', 'invalid.json'], 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, error);
  });
}
