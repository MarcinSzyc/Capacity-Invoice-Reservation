import {Money} from '../../domain/money';
import {Program} from '../../domain/program';
import {toAvailabilityDto} from './availability.mapper';

const USD = 'USD';
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');
const BEYOND_JSON_INTEGER = BigInt(Number.MAX_SAFE_INTEGER) + 1n;

const programWith = (limit: bigint, reserved: bigint): Program =>
  Program.rehydrate({
    programId: 'PRG-1',
    currency: USD,
    limit: Money.of(limit, USD),
    reserved: Money.of(reserved, USD),
    limitEventTime: AT_10_00,
    asOf: null,
  });

describe('toAvailabilityDto', () => {
  it('should map the balances to JSON integers with the currency and no reconciliation yet', () => {
    expect(toAvailabilityDto(programWith(1_000_000_000n, 120_000_000n))).toEqual({
      programId: 'PRG-1',
      currency: USD,
      limit: 1_000_000_000,
      reserved: 120_000_000,
      available: 880_000_000,
      overcommitted: false,
      asOf: null,
    });
  });

  it('should name the field, not the currency, when an amount does not fit a JSON integer (ADR-0006)', () => {
    expect(() => toAvailabilityDto(programWith(BEYOND_JSON_INTEGER, 0n))).toThrow(/^limit /);
  });
});
