import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fixtures } from '../fixtures/sse.js';
import { goodConsumer, brokenUtf8Consumer } from '../examples/consumers.js';
import { checkFixture, makeReplay, replay } from './harness.js';
import { readReplayFile } from './replay-file.js';

const [command = 'check', ...args] = process.argv.slice(2);
const broken = args.includes('--broken');
const consumer = broken ? brokenUtf8Consumer : goodConsumer;
try {
  if (command === 'check') {
    if (args.some(a => a !== '--broken')) throw new Error('Usage: node src/cli.js check [--broken]');
    let total = 0, failures = 0;
    for (const fixture of fixtures) {
      const result = await checkFixture(consumer, fixture, { seed: 20261018 });
      total += result.cases.length;
      const failed = result.cases.filter(c => !c.matchesExpected || !c.chunkInvariant);
      failures += failed.length;
      console.log(`${result.passed ? 'PASS' : 'FAIL'} ${fixture.name}: ${result.cases.length} partitions, ${failed.length} failures`);
      if (failed.length) {
        await mkdir('artifacts', { recursive: true });
        const path = resolve('artifacts', `${broken ? 'broken' : 'good'}-${fixture.name}.json`);
        await writeFile(path, JSON.stringify(makeReplay(fixture, result, failed[0]), null, 2) + '\n');
        console.log(`  replay: ${path}`);
      }
    }
    console.log(`${total} partition checks; ${failures} failures (${broken ? 'deliberately broken' : 'good'} consumer)`);
    process.exitCode = failures ? 1 : 0;
  } else if (command === 'replay') {
    const paths = args.filter(a => a !== '--broken');
    if (paths.length !== 1) throw new Error('Usage: node src/cli.js replay <artifact.json> [--broken]');
    const result = await replay(consumer, await readReplayFile(paths[0]));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.matchesExpected && result.chunkInvariant ? 0 : 1;
  } else throw new Error(`Unknown command: ${command}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
