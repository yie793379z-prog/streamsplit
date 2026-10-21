import assert from 'node:assert/strict';
import { fixtures } from '../fixtures/sse.js';
import { checkFixture, makeReplay, replay } from '../src/harness.js';
import { brokenUtf8Consumer, goodConsumer } from './consumers.js';

// Use the same fixture and replay path as the CLI, without writing any files.
const fixture = fixtures.find(f => f.name === 'utf8');
const report = await checkFixture(brokenUtf8Consumer, fixture, { seed: 20261018 });
assert.deepEqual(report.baseline.events, fixture.expected);
const failure = report.cases.find(c => !c.matchesExpected && !c.chunkInvariant);
assert.ok(failure, 'The deliberately broken decoder must fail on split UTF-8');

const artifact = makeReplay(fixture, report, failure);
const broken = await replay(brokenUtf8Consumer, artifact);
const fixed = await replay(goodConsumer, artifact);
assert.equal(broken.matchesExpected, false);
assert.equal(broken.chunkInvariant, false);
assert.equal(fixed.matchesExpected, true);
assert.equal(fixed.chunkInvariant, true);

const data = result => JSON.stringify(result.events[0].data);
const cut = failure.cuts.join(', ');
console.log('StreamSplit: same bytes, different chunks');
console.log(`Unsplit / broken decoder: ${data(report.baseline)}`);
console.log(`Cut at byte ${cut} / broken decoder: ${data(broken.actual)}`);
console.log(`Cut at byte ${cut} / streaming decoder: ${data(fixed.actual)}`);
console.log('PASS: reproduced the UTF-8 bug and verified the fix.');
