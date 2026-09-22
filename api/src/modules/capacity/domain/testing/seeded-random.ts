/**
 * A tiny seeded generator (mulberry32) for property style tests: the same seed replays the same
 * sequence, so a failing case can be reproduced from the seed the test prints.
 */
export class SeededRandom {
  private state: number;

  constructor(readonly seed: number) {
    this.state = seed >>> 0;
  }

  /** A float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** An integer in [0, max]. */
  int(max: number): number {
    return Math.floor(this.next() * (max + 1));
  }

  /** A bigint in [0, max]. */
  bigint(max: bigint): bigint {
    return BigInt(Math.floor(this.next() * Number(max + 1n)));
  }
}
