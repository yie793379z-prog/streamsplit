// Original synthetic input and hand-authored oracle; no upstream tests or captures.
export const bomFixture = {
  name: 'historical-split-bom',
  bytes: new TextEncoder().encode('\uFEFFdata:x\n\n'),
  expected: [{ type: 'message', data: 'x', lastEventId: '' }],
};
