# First increment verification

Verified locally on 2026-10-20 using Node.js v24.19.0. No package installation or network requests are required by these commands.

| Command | Result | Expected exit |
| --- | --- | --- |
| `node --test` | 28 tests passed, 0 failed | 0 |
| `node src/cli.js check` | 803 partitions, 0 failures, 15 fixtures | 0 |
| `node src/cli.js check --broken` | 803 partitions, 66 intentional failures | 1 |
| `node src/cli.js replay artifacts/broken-utf8.json --broken` | Expected-output and invariance checks both fail | 1 |
| `node src/cli.js replay artifacts/broken-utf8.json` | Both checks pass | 0 |

The broken consumer's failures are concentrated in UTF-8 (40) and BOM (26) fixtures. The first saved UTF-8 failure changes `你好 🌊 café` into `���好 🌊 café`, while its unsplit baseline remains correct.

Tests also verify deterministic and unique partitions, byte preservation, bounded single-cut enumeration, invalid cuts/options, consistently wrong but invariant consumers, async adapters, exceptions, malformed outputs, replay JSON round-tripping, malformed replay rejection, and protection against input mutation.

Not run: Node 22, browser tests, third-party parser integrations, lint/type checking with external tools, hosted CI, package publication. No external repository exists as a result of this local verification. The original code is MIT licensed.
