import {SNAPSHOT_RESERVATIONS_MAX} from '../../domain/identifier-limits';
import {parseReconciliationSnapshot} from './reconciliation-snapshot-message.dto';

const RECEIVED_AT = new Date('2026-09-21T18:10:00.000Z');
const VALID = {
  messageId: 'm-snapshot',
  type: 'reconciliation_snapshot',
  programId: 'PRG-1',
  currency: 'USD',
  creditLimit: 700_000_000,
  asOf: '2026-09-21T18:00:00.000Z',
  activeReservations: [
    {invoiceId: 'INV-X', heldAmount: 70_000_000},
    {invoiceId: 'INV-B', heldAmount: 0},
  ],
};

describe('parseReconciliationSnapshot', () => {
  it('should map a valid snapshot to a typed command with bigint minor units and an instant', async () => {
    const parsed = await parseReconciliationSnapshot(VALID, RECEIVED_AT);

    expect(parsed).toEqual({
      ok: true,
      command: {
        messageId: 'm-snapshot',
        programId: 'PRG-1',
        currency: 'USD',
        creditLimit: 700_000_000n,
        asOf: new Date('2026-09-21T18:00:00.000Z'),
        activeReservations: [
          {invoiceId: 'INV-X', heldAmount: 70_000_000n},
          {invoiceId: 'INV-B', heldAmount: 0n},
        ],
        payload: VALID,
        receivedAt: RECEIVED_AT,
      },
    });
  });

  it('should accept an empty list, a snapshot saying nothing is held', async () => {
    const parsed = await parseReconciliationSnapshot(
      {...VALID, activeReservations: []},
      RECEIVED_AT,
    );

    expect(parsed.ok).toBe(true);
  });

  it('should refuse an asOf without a zone, because the host zone must never decide staleness (A-11)', async () => {
    const parsed = await parseReconciliationSnapshot(
      {...VALID, asOf: '2026-09-21T18:00:00'},
      RECEIVED_AT,
    );

    expect(parsed).toEqual({ok: false, error: expect.stringContaining('asOf') as string});
  });

  it('should refuse one invoice listed twice, since both amounts cannot be true', async () => {
    const parsed = await parseReconciliationSnapshot(
      {
        ...VALID,
        activeReservations: [
          {invoiceId: 'INV-X', heldAmount: 1},
          {invoiceId: 'INV-X', heldAmount: 2},
        ],
      },
      RECEIVED_AT,
    );

    expect(parsed).toEqual({
      ok: false,
      error: expect.stringContaining('activeReservations') as string,
    });
  });

  it('should refuse a list longer than one snapshot may carry', async () => {
    const tooMany = Array.from({length: SNAPSHOT_RESERVATIONS_MAX + 1}, (_, index) => ({
      invoiceId: `INV-${index}`,
      heldAmount: 1,
    }));

    const parsed = await parseReconciliationSnapshot(
      {...VALID, activeReservations: tooMany},
      RECEIVED_AT,
    );

    expect(parsed).toEqual({
      ok: false,
      error: expect.stringContaining('activeReservations') as string,
    });
  });

  it('should refuse a held amount that is negative, fractional or beyond a JSON integer', async () => {
    for (const heldAmount of [-1, 1.5, Number.MAX_SAFE_INTEGER + 2, '70']) {
      const parsed = await parseReconciliationSnapshot(
        {...VALID, activeReservations: [{invoiceId: 'INV-X', heldAmount}]},
        RECEIVED_AT,
      );

      expect(parsed).toEqual({ok: false, error: expect.stringContaining('heldAmount') as string});
    }
  });

  it('should refuse fields the contract does not define, at the top and in an entry', async () => {
    const extraTop = await parseReconciliationSnapshot({...VALID, note: 'hi'}, RECEIVED_AT);
    const extraEntry = await parseReconciliationSnapshot(
      {...VALID, activeReservations: [{invoiceId: 'INV-X', heldAmount: 1, rate: '1.1'}]},
      RECEIVED_AT,
    );

    expect(extraTop.ok).toBe(false);
    expect(extraEntry.ok).toBe(false);
  });

  it('should refuse a message that is not a snapshot or not an object', async () => {
    const wrongType = await parseReconciliationSnapshot(
      {...VALID, type: 'capacity_update'},
      RECEIVED_AT,
    );
    const notAnObject = await parseReconciliationSnapshot('snapshot', RECEIVED_AT);

    expect(wrongType.ok).toBe(false);
    expect(notAnObject.ok).toBe(false);
  });
});
