import assert from 'node:assert/strict';
import parserPackage from 'eventsource-parser/package.json' with { type: 'json' };
import { fixtures } from '../../fixtures/sse.js';
import { checkFixture, makeReplay, replay } from '../../src/harness.js';
import { brokenUtf8Consumer } from '../consumers.js';
import { eventsourceParserConsumer } from './consumer.js';
import { adapterFixtures } from './fixtures.js';

const { version } = parserPackage;
const allFixtures = [...fixtures, ...adapterFixtures];
let checks = 0;
for (const fixture of allFixtures) {
  const report = await checkFixture(eventsourceParserConsumer, fixture, { seed: 20261018 });
  assert.ok(report.passed, `${fixture.name}: ${JSON.stringify(report.cases.filter(c => !c.matchesExpected || !c.chunkInvariant))}`);
  checks += report.cases.length;
}

const utf8 = fixtures.find(f => f.name === 'utf8');
const broken = await checkFixture(brokenUtf8Consumer, utf8, { seed: 20261018 });
const failed = broken.cases.find(c => c.cuts.length === 1 && c.cuts[0] === 7);
assert.equal(failed.matchesExpected, false);
assert.equal(failed.chunkInvariant, false);
const artifact = JSON.parse(JSON.stringify(makeReplay(utf8, broken, failed)));
const fixed = await replay(eventsourceParserConsumer, artifact);
assert.equal(fixed.matchesExpected, true);
assert.equal(fixed.chunkInvariant, true);

console.log(`eventsource-parser ${version} (optional adapter)`);
console.log(`${allFixtures.length} fixtures; ${checks} partition checks; 0 failures`);
console.log(`Saved-format replay / broken decoder: ${JSON.stringify(failed.actual.events[0].data)}`);
console.log(`Saved-format replay / real parser adapter: ${JSON.stringify(fixed.actual.events[0].data)}`);
console.log('PASS: parser integration and version-1 replay verified; no files written.');
