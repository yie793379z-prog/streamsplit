const event = (data, type = 'message', lastEventId = '') => ({ type, data, lastEventId });
const fixture = (name, text, expected) => ({ name, bytes: new TextEncoder().encode(text), expected });
// Original synthetic cases derived from WHATWG HTML §9.2.5–9.2.6.
// https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream
export const fixtures = [
  fixture('ascii', 'data: hello\n\n', [event('hello')]),
  fixture('utf8', 'data: 你好 🌊 café\n\n', [event('你好 🌊 café')]),
  fixture('crlf', 'data: one\r\n\r\ndata: two\r\n\r\n', [event('one'), event('two')]),
  fixture('bare-cr', 'data: one\r\r', [event('one')]),
  fixture('multiline', 'data: one\ndata: two\n\n', [event('one\ntwo')]),
  fixture('fields', ': heartbeat\nunknown: ignored\nevent: update\nid: 42\ndata: yes\n\ndata: next\n\n', [event('yes', 'update', '42'), event('next', 'message', '42')]),
  fixture('empty-data', 'event: ignored\n\ndata\n\n', [event('')]),
  fixture('space-rule', 'data:  two\ndata:\tkept\n\n', [event(' two\n\tkept')]),
  fixture('id-reset-and-nul', 'id: kept\ndata: a\n\nid: bad\0id\ndata: b\n\nid\ndata: c\n\n', [event('a', 'message', 'kept'), event('b', 'message', 'kept'), event('c')]),
  fixture('bom', '\uFEFFdata: first\n\ndata: \uFEFFinside\n\n', [event('first'), event('\uFEFFinside')]),
  fixture('incomplete-eof', 'data: discard\n', []),
  fixture('unterminated-eof', 'data: discard', []),
  fixture('comments-and-retry', ': keepalive\nretry: 123\nretry: nope\n\n', []),
  { name: 'invalid-utf8', bytes: Uint8Array.from([100,97,116,97,58,32,0xc3,0x28,10,10]), expected: [event('\uFFFD(')] },
  fixture('empty-stream', '', []),
];
