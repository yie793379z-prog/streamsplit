import { createParser as createBefore } from 'eventsource-parser-before';
import { createParser as createAfter } from 'eventsource-parser-after';

// Only the parser factory differs. Each call gets fresh parser/decoder/ID state.
function adapt(createParser) {
  return chunks => {
    const events = [];
    // Let the parser remove the leading BOM, exactly as in the current adapter.
    const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
    let lastEventId = '';
    const parser = createParser({
      onId(id) { lastEventId = id; },
      onEvent(event) {
        events.push({ type: event.event || 'message', data: event.data, lastEventId });
      },
    });
    // Empty decoded strings matter: do not filter them or repair the old parser.
    for (const chunk of chunks) parser.feed(decoder.decode(chunk, { stream: true }));
    parser.feed(decoder.decode());
    parser.reset();
    return events;
  };
}

export const beforeConsumer = adapt(createBefore);
export const afterConsumer = adapt(createAfter);
