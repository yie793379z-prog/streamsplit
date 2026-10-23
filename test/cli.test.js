import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIMITS } from '../src/harness.js';

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

const minimalReplay = { format: 'streamsplit-replay', version: 1, bytesBase64: '', cuts: [], expected: [] };

test('CLI accepts a replay file exactly at the byte cap, including JSON whitespace', t => {
  const cwd = workspace(t);
  const json = JSON.stringify(minimalReplay);
  const content = json + ' '.repeat(LIMITS.maxReplayFileBytes - Buffer.byteLength(json));
  writeFileSync(join(cwd, 'boundary.json'), content);
  const result = run(cwd, ['replay', 'boundary.json'], 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.matchesExpected, true);
  assert.equal(report.chunkInvariant, true);
  assert.equal(readFileSync(join(cwd, 'boundary.json'), 'utf8'), content);
});

test('CLI rejects a replay file one byte over its cap before parsing, including whitespace', t => {
  const cwd = workspace(t);
  const json = JSON.stringify(minimalReplay);
  writeFileSync(join(cwd, 'oversized.json'), json + ' '.repeat(LIMITS.maxReplayFileBytes + 1 - Buffer.byteLength(json)));
  const result = run(cwd, ['replay', 'oversized.json'], 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /replay file exceeds 1048576-byte limit/);
  assert.deepEqual(readdirSync(cwd), ['oversized.json']);
});

test('CLI rejects a directory rather than treating it as replay data', t => {
  const cwd = workspace(t);
  const result = run(cwd, ['replay', '.'], 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /replay input must be a regular file|EISDIR/);
  assert.deepEqual(readdirSync(cwd), []);
});

test('CLI accepts symlinks to regular replay files', { skip: process.platform === 'win32' }, t => {
  const cwd = workspace(t);
  writeFileSync(join(cwd, 'source.json'), JSON.stringify(minimalReplay));
  symlinkSync('source.json', join(cwd, 'linked.json'));
  const result = run(cwd, ['replay', 'linked.json'], 0);
  assert.equal(JSON.parse(result.stdout).matchesExpected, true);
  assert.deepEqual(readdirSync(cwd).sort(), ['linked.json', 'source.json']);
});

test('CLI rejects a POSIX FIFO without waiting for a writer', { skip: process.platform === 'win32' }, t => {
  const cwd = workspace(t);
  const created = spawnSync('mkfifo', [join(cwd, 'input.fifo')], { encoding: 'utf8', timeout: 10_000 });
  if (created.error?.code === 'ENOENT') return t.skip('mkfifo is unavailable on this platform');
  assert.ifError(created.error);
  assert.equal(created.status, 0, created.stderr);
  // run() has a subprocess deadline: a blocking open becomes a failed test,
  // rather than hanging the suite. No writer is opened and no timing race is used.
  const result = run(cwd, ['replay', 'input.fifo'], 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /replay input must be a regular file/);
});

for (const { changes, name, error } of [
  { changes: { expected: [{ type: 'message', data: 1, lastEventId: '' }] }, name: 'invalid expected event fields', error: /expected events must contain exactly/ },
  { changes: { expected: Array.from({ length: LIMITS.maxExpectedEvents + 1 }, () => ({ type: '', data: '', lastEventId: '' })) }, name: 'excess expected events', error: /expected exceeds 256-event limit/ },
  { changes: { expected: [{ type: '', data: 'a'.repeat(LIMITS.maxExpectedTextBytes + 1), lastEventId: '' }] }, name: 'excess expected text', error: /expected text exceeds 65536-byte UTF-8 limit/ },
  { changes: { bytesBase64: Buffer.alloc(LIMITS.maxBytes + 1).toString('base64') }, name: 'oversized decoded bytes', error: /bytes exceed 16384-byte limit/ },
  { changes: { bytesBase64: 'YWJj', cuts: [2, 1] }, name: 'invalid cut order', error: /cuts must be sorted unique interior offsets/ },
  { changes: { bytesBase64: 'YQ==\n' }, name: 'noncanonical base64', error: /invalid base64/ },
]) {
  test(`CLI rejects ${name} with a clear error and no regression output`, t => {
    const cwd = workspace(t);
    writeFileSync(join(cwd, 'invalid.json'), JSON.stringify({ ...minimalReplay, ...changes }));
    const result = run(cwd, ['replay', 'invalid.json'], 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, error);
    assert.deepEqual(readdirSync(cwd), ['invalid.json']);
  });
}
