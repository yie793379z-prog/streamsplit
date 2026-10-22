import { createParser } from 'eventsource-parser';

/** Adapt byte chunks to StreamSplit's event-only contract.
 * Parser, decoder, and retained ID belong to one invocation (one stream).
 * @type {import('../consumers.js').Consumer}
 */
export function eventsourceParserConsumer(chunks) {
  const events = [];
  // Preserve the BOM here: the parser strips exactly one at the stream start.
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
  let lastEventId = '';
  const parser = createParser({
    // Includes ID-only blocks and empty IDs; invalid NUL IDs are ignored upstream.
    onId(id) { lastEventId = id; },
    onEvent(event) {
      events.push({ type: event.event || 'message', data: event.data, lastEventId });
    },
  });
  for (const chunk of chunks) parser.feed(decoder.decode(chunk, { stream: true }));
  parser.feed(decoder.decode());
  // EOF does not imply a blank line. Discard any incomplete event.
  parser.reset();
  return events;
}
