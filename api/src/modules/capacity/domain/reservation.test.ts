import {Money} from './money';
import {Reservation} from './reservation';

const PROGRAM_ID = 'PRG-1';
const INVOICE_A = 'INV-A';
const USD = 'USD';
const CLIENT = 'client-e2e';
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');
const ONE_POINT_TWO_MILLION_USD = Money.of(120_000_000n, USD);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('Reservation', () => {
  it('should open active, holding the whole reserved amount, sourced from the client that asked', () => {
    const reservation = Reservation.open({
      programId: PROGRAM_ID,
      invoiceId: INVOICE_A,
      invoiceAmount: ONE_POINT_TWO_MILLION_USD,
      reservedAmount: ONE_POINT_TWO_MILLION_USD,
      clientId: CLIENT,
      createdAt: AT_10_00,
    });

    expect(reservation.reservationId).toMatch(UUID);
    expect(reservation.programId).toBe(PROGRAM_ID);
    expect(reservation.invoiceId).toBe(INVOICE_A);
    expect(reservation.invoiceAmount).toEqual(ONE_POINT_TWO_MILLION_USD);
    expect(reservation.reservedAmount).toEqual(ONE_POINT_TWO_MILLION_USD);
    expect(reservation.held).toEqual(ONE_POINT_TWO_MILLION_USD);
    expect(reservation.status).toBe('active');
    expect(reservation.source).toBe('client');
    expect(reservation.clientId).toBe(CLIENT);
    expect(reservation.createdAt).toEqual(AT_10_00);
  });

  it('should give every opened reservation its own id', () => {
    const open = (): Reservation =>
      Reservation.open({
        programId: PROGRAM_ID,
        invoiceId: INVOICE_A,
        invoiceAmount: ONE_POINT_TWO_MILLION_USD,
        reservedAmount: ONE_POINT_TWO_MILLION_USD,
        clientId: CLIENT,
        createdAt: AT_10_00,
      });

    expect(open().reservationId).not.toBe(open().reservationId);
  });

  it('should read as closed once nothing is held, when rehydrated from storage (glossary)', () => {
    const reservation = Reservation.rehydrate({
      reservationId: '4d2f0c1e-0000-4000-8000-000000000001',
      programId: PROGRAM_ID,
      invoiceId: INVOICE_A,
      invoiceAmount: ONE_POINT_TWO_MILLION_USD,
      reservedAmount: ONE_POINT_TWO_MILLION_USD,
      held: Money.zero(USD),
      source: 'reconciliation',
      clientId: null,
      createdAt: AT_10_00,
    });

    expect(reservation.status).toBe('closed');
    expect(reservation.source).toBe('reconciliation');
    expect(reservation.clientId).toBeNull();
  });

  it('should describe itself in plain words with minor units, the derived status and no internal id', () => {
    const reservation = Reservation.open({
      programId: PROGRAM_ID,
      invoiceId: INVOICE_A,
      invoiceAmount: ONE_POINT_TWO_MILLION_USD,
      reservedAmount: ONE_POINT_TWO_MILLION_USD,
      clientId: CLIENT,
      createdAt: AT_10_00,
    });

    expect(reservation.describe()).toEqual({
      programId: PROGRAM_ID,
      invoiceId: INVOICE_A,
      invoiceAmount: 120_000_000n,
      invoiceCurrency: USD,
      reservedAmount: 120_000_000n,
      held: 120_000_000n,
      status: 'active',
      source: 'client',
      createdAt: AT_10_00,
    });
  });
});
