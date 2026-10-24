/** Fixed input/work limits for the small, offline regression harness.
 * These are not a sandbox or limits on arbitrary consumer code/output.
 */
export const LIMITS = Object.freeze({
  maxBytes: 16 * 1024,
  maxRandomCases: 256,
  maxPartitions: 512,
  maxExpectedEvents: 256,
  maxExpectedTextBytes: 64 * 1024,
  maxNameBytes: 256,
  maxReplayFileBytes: 1024 * 1024,
  maxReductionAttempts: 256,
});
