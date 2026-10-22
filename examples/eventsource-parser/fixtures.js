// Original synthetic integration cases; no captured response data.
const event = (data, lastEventId = '') => ({ type: 'message', data, lastEventId });
const fixture = (name, text, expected) => ({ name, bytes: new TextEncoder().encode(text), expected });

export const adapterFixtures = [
  fixture('id-only-blocks', 'id: retained\n\ndata: first\n\nid: bad\0id\n\ndata: second\n\nid\n\ndata: reset\n\n',
    [event('first', 'retained'), event('second', 'retained'), event('reset')]),
  fixture('multiple-ids', 'id: first\nid: last\ndata: one\n\nid: bad\0id\ndata: two\n\n',
    [event('one', 'last'), event('two', 'last')]),
  fixture('mixed-line-endings', 'data: one\r\ndata: two\r\rdata: three\n\n',
    [event('one\ntwo'), event('three')]),
  fixture('partial-eof-after-event', 'data: done\n\ndata: discard\r', [event('done')]),
  fixture('single-leading-bom-only', '\uFEFF\uFEFFdata: ignored\n\ndata: kept\n\n', [event('kept')]),
];
