import {probeWithin} from './probe-within';

const TIMEOUT_MS = 50;
const LONGER_THAN_TIMEOUT_MS = 500;

const never = (): Promise<boolean> => new Promise(() => {});
const after = (ms: number, value: boolean): Promise<boolean> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

describe('probeWithin', () => {
  it('should pass through an answer that arrives in time', async () => {
    await expect(probeWithin(TIMEOUT_MS, () => Promise.resolve(true))).resolves.toBe(true);
    await expect(probeWithin(TIMEOUT_MS, () => Promise.resolve(false))).resolves.toBe(false);
  });

  it('should report a probe that never answers as unreachable', async () => {
    await expect(probeWithin(TIMEOUT_MS, never)).resolves.toBe(false);
  });

  it('should report a probe that answers too late as unreachable', async () => {
    await expect(probeWithin(TIMEOUT_MS, () => after(LONGER_THAN_TIMEOUT_MS, true))).resolves.toBe(
      false,
    );
  });

  it('should report a probe that throws as unreachable', async () => {
    await expect(probeWithin(TIMEOUT_MS, () => Promise.reject(new Error('down')))).resolves.toBe(
      false,
    );
  });

  it('should answer as soon as the probe does, without waiting out the timeout', async () => {
    const startedAt = Date.now();

    await probeWithin(LONGER_THAN_TIMEOUT_MS, () => Promise.resolve(true));

    expect(Date.now() - startedAt).toBeLessThan(LONGER_THAN_TIMEOUT_MS);
  });
});
