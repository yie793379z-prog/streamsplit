/**
 * @typedef {{type: string, data: string, lastEventId: string}} SSEEvent
 * @typedef {(chunks: Uint8Array[]) => SSEEvent[] | Promise<SSEEvent[]>} Consumer
 */

/** Small illustrative parser; buffers the complete decoded stream.
 * Not a production EventSource client. No retries, HTTP, timing or dispatch callbacks.
 * @param {string} text
 * @returns {SSEEvent[]}
 */
export function parseText(text) {
  const events = [];
  let data = '', type = '', id = '';
  // Only terminated lines are processed. EOF never implies a blank line.
  const lines = text.split(/\r\n|\r|\n/);
  lines.pop();
  for (const line of lines) {
    if (line === '') {
      if (data !== '') events.push({ type: type || 'message', data: data.slice(0, -1), lastEventId: id });
      data = ''; type = '';
      continue;
    }
    if (line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const name = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (name === 'data') data += value + '\n';
    else if (name === 'event') type = value;
    else if (name === 'id' && !value.includes('\0')) id = value;
    // retry affects reconnection state, outside this event-only adapter.
  }
  return events;
}

/** @type {Consumer} */
export function goodConsumer(chunks) {
  const decoder = new TextDecoder('utf-8');
  let text = '';
  for (const chunk of chunks) text += decoder.decode(chunk, { stream: true });
  text += decoder.decode();
  return parseText(text);
}

/** Deliberately wrong: each chunk is decoded as an independent UTF-8 stream.
 * @type {Consumer}
 */
export function brokenUtf8Consumer(chunks) {
  return parseText(chunks.map(chunk => new TextDecoder().decode(chunk)).join(''));
}
