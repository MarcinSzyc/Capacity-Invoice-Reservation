import {parseCapacityUpdate} from './capacity-update-message.dto';

const RECEIVED_AT = new Date('2026-09-21T10:06:00.000Z');
const VALID = {
  messageId: 'm-1',
  type: 'capacity_update',
  programId: 'PRG-1',
  currency: 'EUR',
  creditLimit: 500_000_000,
  eventTime: '2026-09-21T10:00:00.000Z',
};

describe('parseCapacityUpdate', () => {
  it('should map a valid message to a typed command with bigint minor units and an instant', async () => {
    const parsed = await parseCapacityUpdate(VALID, RECEIVED_AT);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.command).toMatchObject({
      messageId: 'm-1',
      programId: 'PRG-1',
      currency: 'EUR',
      creditLimit: 500_000_000n,
      eventTime: new Date('2026-09-21T10:00:00.000Z'),
      receivedAt: RECEIVED_AT,
    });
  });

  it('should accept an eventTime with an explicit offset and read it as that instant (A-11)', async () => {
    const parsed = await parseCapacityUpdate(
      {...VALID, eventTime: '2026-09-21T12:00:00+02:00'},
      RECEIVED_AT,
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.command.eventTime).toEqual(new Date('2026-09-21T10:00:00.000Z'));
  });

  it('should refuse an eventTime without a zone, because the host zone must never decide staleness (AC-24)', async () => {
    for (const eventTime of ['2026-09-21T10:00:00', '2026-09-21T10:00:00.000', '2026-09-21']) {
      const parsed = await parseCapacityUpdate({...VALID, eventTime}, RECEIVED_AT);

      expect(parsed).toEqual({ok: false, error: expect.stringContaining('eventTime') as string});
    }
  });

  it('should uppercase a currency code and still refuse one that is not ISO 4217 (A-10)', async () => {
    const normalised = await parseCapacityUpdate({...VALID, currency: 'usd'}, RECEIVED_AT);

    expect(normalised.ok).toBe(true);
    if (!normalised.ok) return;
    expect(normalised.command.currency).toBe('USD');

    for (const currency of ['XYZ', 'US', 'EURO']) {
      const parsed = await parseCapacityUpdate({...VALID, currency}, RECEIVED_AT);

      expect(parsed).toEqual({ok: false, error: expect.stringContaining('currency') as string});
    }
  });

  it('should name the field when a value is of the wrong shape', async () => {
    const parsed = await parseCapacityUpdate({...VALID, creditLimit: 'a lot'}, RECEIVED_AT);

    expect(parsed).toEqual({ok: false, error: expect.stringContaining('creditLimit') as string});
  });

  it('should refuse a field the contract does not define', async () => {
    const parsed = await parseCapacityUpdate({...VALID, extra: true}, RECEIVED_AT);

    expect(parsed).toEqual({ok: false, error: expect.stringContaining('extra') as string});
  });

  it('should refuse identifiers that contain NUL', async () => {
    for (const field of ['messageId', 'programId']) {
      const parsed = await parseCapacityUpdate({...VALID, [field]: 'id\u0000'}, RECEIVED_AT);

      expect(parsed).toMatchObject({ok: false, error: expect.stringContaining(field) as string});
    }
  });
});
