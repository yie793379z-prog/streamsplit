import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { LIMITS } from './limits.js';

/** Read only regular files, with a hard byte cap even if the file grows after
 * stat. Nonblocking open avoids waiting for a writer on a FIFO on POSIX.
 */
export async function readReplayFile(path) {
  const file = await open(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new TypeError('replay input must be a regular file');
    const tooLarge = () => new RangeError(`replay file exceeds ${LIMITS.maxReplayFileBytes}-byte limit`);
    if (stat.size > LIMITS.maxReplayFileBytes) throw tooLarge();
    const buffer = Buffer.alloc(LIMITS.maxReplayFileBytes + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await file.read(buffer, size, buffer.length - size, null);
      if (bytesRead === 0) break;
      size += bytesRead;
      if (size > LIMITS.maxReplayFileBytes) throw tooLarge();
    }
    return JSON.parse(buffer.toString('utf8', 0, size));
  } finally {
    await file.close();
  }
}
