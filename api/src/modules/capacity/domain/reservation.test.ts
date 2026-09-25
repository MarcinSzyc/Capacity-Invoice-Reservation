import {ReleaseExceedsHeldError, ReservationAlreadyReleasedError} from './errors';
import {Money} from './money';
import {Rate} from './rate';
import {Reservation} from './reservation';

const PROGRAM_ID = 'PRG-1';
const INVOICE_A = 'INV-A';
const USD = 'USD';
const EUR = 'EUR';
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
      rate: Rate.one(),
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
        rate: Rate.one(),
        clientId: CLIENT,
        createdAt: AT_10_00,
      });

    expect(open().reservationId).not.toBe(open().reservationId);
  });

  it('should read as closed once the whole invoice is released, when rehydrated from storage', () => {
    const reservation = Reservation.rehydrate({
      reservationId: '4d2f0c1e-0000-4000-8000-000000000001',
      programId: PROGRAM_ID,
      invoiceId: INVOICE_A,
      invoiceAmount: ONE_POINT_TWO_MILLION_USD,
      reservedAmount: ONE_POINT_TWO_MILLION_USD,
      held: Money.zero(USD),
      releasedInvoiceAmount: ONE_POINT_TWO_MILLION_USD,
      rate: Rate.one(),
      heldCorrection: 0n,
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
      rate: Rate.one(),
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
      releasedInvoiceAmount: 0n,
      rate: '1',
      status: 'active',
      source: 'client',
      createdAt: AT_10_00,
    });
  });

  it('should carry the rate it was converted at, and describe it canonically (A-02, A-10)', () => {
    const reservation = Reservation.open({
      programId: PROGRAM_ID,
      invoiceId: INVOICE_A,
      invoiceAmount: Money.of(275_000_000n, EUR),
      reservedAmount: Money.of(302_500_000n, USD),
      rate: Rate.parse('1.10'),
      clientId: CLIENT,
      createdAt: AT_10_00,
    });

    expect(reservation.rate.equals(Rate.parse('1.1'))).toBe(true);
    expect(reservation.rate.toString()).toBe('1.1');
    expect(reservation.describe()).toMatchObject({
      invoiceAmount: 275_000_000n,
      invoiceCurrency: EUR,
      reservedAmount: 302_500_000n,
      held: 302_500_000n,
      rate: '1.1',
    });
  });

  describe('release', () => {
    const EUR_INVOICE = Money.of(275_000_000n, EUR);
    const USD_RESERVED = Money.of(302_500_000n, USD);
    const crossCurrency = (): Reservation =>
      Reservation.open({
        programId: PROGRAM_ID,
        invoiceId: INVOICE_A,
        invoiceAmount: EUR_INVOICE,
        reservedAmount: USD_RESERVED,
        clientId: CLIENT,
        rate: Rate.parse('1.10'),
        createdAt: AT_10_00,
      });

    it('should start with nothing released and the whole invoice remaining', () => {
      const reservation = crossCurrency();

      expect(reservation.releasedInvoiceAmount).toEqual(Money.zero(EUR));
      expect(reservation.remainingInvoiceAmount).toEqual(EUR_INVOICE);
      expect(reservation.describe().releasedInvoiceAmount).toBe(0n);
    });

    it('should convert a partial release with the stored rate and derive held from what is left (ADR-0009)', () => {
      const reservation = crossCurrency();

      const outcome = reservation.release({amount: Money.of(100_000_000n, EUR)});

      // 175 000 000 EUR left at 1.10 is 192 500 000 USD, so held falls by 110 000 000.
      expect(outcome.heldAfter).toEqual(Money.of(192_500_000n, USD));
      expect(outcome.deltaHeld).toBe(-110_000_000n);
      expect(reservation.held).toEqual(Money.of(192_500_000n, USD));
      expect(reservation.releasedInvoiceAmount).toEqual(Money.of(100_000_000n, EUR));
      expect(reservation.remainingInvoiceAmount).toEqual(Money.of(175_000_000n, EUR));
      expect(reservation.status).toBe('active');
    });

    it('should treat an absent amount as everything left and close the reservation', () => {
      const reservation = crossCurrency();
      reservation.release({amount: Money.of(100_000_000n, EUR)});

      const outcome = reservation.release({amount: null});

      expect(outcome.heldAfter).toEqual(Money.zero(USD));
      expect(outcome.deltaHeld).toBe(-192_500_000n);
      expect(reservation.status).toBe('closed');
      expect(reservation.remainingInvoiceAmount).toEqual(Money.zero(EUR));
    });

    it('should close at exactly zero when the instalments do not divide evenly by the rate (AC-12)', () => {
      const reservation = Reservation.open({
        programId: PROGRAM_ID,
        invoiceId: INVOICE_A,
        invoiceAmount: Money.of(100_000_000n, EUR),
        reservedAmount: Money.of(113_000_000n, USD),
        rate: Rate.parse('1.13'),
        clientId: CLIENT,
        createdAt: AT_10_00,
      });

      // Rounding each instalment on its own (the declined Option 1) would leave held at 1.
      reservation.release({amount: Money.of(33_333_333n, EUR)});
      reservation.release({amount: Money.of(33_333_333n, EUR)});
      const last = reservation.release({amount: Money.of(33_333_334n, EUR)});

      expect(last.heldAfter).toEqual(Money.zero(USD));
      expect(reservation.held).toEqual(Money.zero(USD));
      expect(reservation.status).toBe('closed');
    });

    it('should refuse a release beyond what the invoice has left, in invoice currency (AC-13)', () => {
      const reservation = crossCurrency();

      expect(() => reservation.release({amount: Money.of(275_000_001n, EUR)})).toThrow(
        ReleaseExceedsHeldError,
      );
      expect(reservation.held).toEqual(USD_RESERVED);
      expect(reservation.releasedInvoiceAmount).toEqual(Money.zero(EUR));
    });

    it('should refuse any release once the whole invoice is released, before judging the amount (AC-15)', () => {
      const reservation = crossCurrency();
      reservation.release({amount: null});

      expect(() => reservation.release({amount: Money.of(1n, EUR)})).toThrow(
        ReservationAlreadyReleasedError,
      );
    });
  });

  describe('a remainder that rounds away', () => {
    // AC-15 amended 2026-09-24: closed means the invoice is released, not that held reached
    // zero. `held` is the remainder converted at the stored rate, so a remainder worth less
    // than half a minor unit rounds to zero while the invoice still owes.
    const tinyRate = (): Reservation => {
      const invoiceAmount = Money.of(1_000_000n, 'IDR');
      return Reservation.open({
        programId: PROGRAM_ID,
        invoiceId: INVOICE_A,
        invoiceAmount,
        reservedAmount: invoiceAmount.convert(Rate.parse('0.000065'), USD),
        rate: Rate.parse('0.000065'),
        clientId: CLIENT,
        createdAt: AT_10_00,
      });
    };

    it('should stay active while the invoice still owes, even once held has rounded to zero', () => {
      const reservation = tinyRate();

      reservation.release({
        amount: Money.of(999_000n, 'IDR'),
      });

      expect(reservation.held).toEqual(Money.zero(USD));
      expect(reservation.remainingInvoiceAmount).toEqual(Money.of(1_000n, 'IDR'));
      expect(reservation.status).toBe('active');
    });

    it('should let the remainder be released to the end and only then be closed', () => {
      const reservation = tinyRate();
      reservation.release({
        amount: Money.of(999_000n, 'IDR'),
      });

      const last = reservation.release({
        amount: null,
      });

      expect(last.heldAfter).toEqual(Money.zero(USD));
      expect(reservation.remainingInvoiceAmount).toEqual(Money.zero('IDR'));
      expect(reservation.releasedInvoiceAmount).toEqual(Money.of(1_000_000n, 'IDR'));
      expect(reservation.status).toBe('closed');
    });
  });

  describe('reconciliation', () => {
    const AT_18_00 = new Date('2026-09-21T18:00:00.000Z');
    const INVOICE_B = 'INV-B';
    const INVOICE_X = 'INV-X';
    const ONE_POINT_NINE_TWO_FIVE_MILLION_USD = Money.of(192_500_000n, USD);
    const ONE_POINT_NINE_MILLION_USD = Money.of(190_000_000n, USD);
    const NINE_HUNDRED_THOUSAND_USD = Money.of(90_000_000n, USD);
    const SEVEN_HUNDRED_THOUSAND_USD = Money.of(70_000_000n, USD);
    const THREE_HUNDRED_THOUSAND_USD = Money.of(30_000_000n, USD);

    const holdingInvoiceB = (): Reservation =>
      Reservation.open({
        programId: PROGRAM_ID,
        invoiceId: INVOICE_B,
        invoiceAmount: ONE_POINT_NINE_TWO_FIVE_MILLION_USD,
        reservedAmount: ONE_POINT_NINE_TWO_FIVE_MILLION_USD,
        rate: Rate.one(),
        clientId: CLIENT,
        createdAt: AT_10_00,
      });

    it('should be born from a snapshot holding what the treasury listed, in program currency at rate one, created at asOf (ADR-0011)', () => {
      const reservation = Reservation.fromSnapshot({
        programId: PROGRAM_ID,
        invoiceId: INVOICE_X,
        held: SEVEN_HUNDRED_THOUSAND_USD,
        asOf: AT_18_00,
      });

      expect(reservation.describe()).toMatchObject({
        invoiceId: INVOICE_X,
        invoiceAmount: 70_000_000n,
        invoiceCurrency: USD,
        reservedAmount: 70_000_000n,
        held: 70_000_000n,
        releasedInvoiceAmount: 0n,
        rate: '1',
        status: 'active',
        source: 'reconciliation',
        createdAt: AT_18_00,
      });
      expect(reservation.clientId).toBeNull();
      expect(reservation.heldCorrection).toBe(0n);
    });

    it('should correct held to the snapshot figure and keep the correction through a later release (ADR-0012, 1A)', () => {
      const reservation = holdingInvoiceB();

      const deltaHeld = reservation.correctTo(ONE_POINT_NINE_MILLION_USD);

      expect(deltaHeld).toBe(-2_500_000n);
      expect(reservation.held).toEqual(ONE_POINT_NINE_MILLION_USD);
      expect(reservation.heldCorrection).toBe(-2_500_000n);

      const outcome = reservation.release({amount: NINE_HUNDRED_THOUSAND_USD});

      // 1 925 000 less 900 000 leaves 1 025 000 of the invoice; the correction takes 25 000 off.
      expect(outcome.heldAfter).toEqual(Money.of(100_000_000n, USD));
      expect(outcome.deltaHeld).toBe(-90_000_000n);
    });

    it('should set the correction rather than add to it, so the same snapshot twice changes nothing', () => {
      const reservation = holdingInvoiceB();
      reservation.correctTo(ONE_POINT_NINE_MILLION_USD);

      expect(reservation.correctTo(ONE_POINT_NINE_MILLION_USD)).toBe(0n);
      expect(reservation.heldCorrection).toBe(-2_500_000n);
    });

    it('should hold zero once the whole invoice is released, whatever the correction', () => {
      const reservation = holdingInvoiceB();
      reservation.correctTo(Money.of(200_000_000n, USD));

      const outcome = reservation.release({amount: null});

      expect(outcome.heldAfter).toEqual(Money.zero(USD));
      expect(reservation.status).toBe('closed');
    });

    it('should close when released by adjustment, the whole invoice counted as released (AC-27)', () => {
      const reservation = holdingInvoiceB();

      const deltaHeld = reservation.releaseByAdjustment();

      expect(deltaHeld).toBe(-192_500_000n);
      expect(reservation.held).toEqual(Money.zero(USD));
      expect(reservation.releasedInvoiceAmount).toEqual(ONE_POINT_NINE_TWO_FIVE_MILLION_USD);
      expect(reservation.status).toBe('closed');
    });

    it('should reopen a closed reservation to the listed held, finding what the invoice has left at the stored rate (ADR-0012, 3A)', () => {
      const reservation = Reservation.open({
        programId: PROGRAM_ID,
        invoiceId: INVOICE_A,
        invoiceAmount: Money.of(100_000_000n, EUR),
        reservedAmount: Money.of(113_000_000n, USD),
        rate: Rate.parse('1.13'),
        clientId: CLIENT,
        createdAt: AT_10_00,
      });
      reservation.releaseByAdjustment();

      const deltaHeld = reservation.reopenTo(THREE_HUNDRED_THOUSAND_USD);

      expect(deltaHeld).toBe(30_000_000n);
      expect(reservation.status).toBe('active');
      expect(reservation.held).toEqual(THREE_HUNDRED_THOUSAND_USD);
      // 300 000.00 USD at 1.13 is 265 486.73 EUR; that is what the invoice has left again.
      expect(reservation.remainingInvoiceAmount).toEqual(Money.of(26_548_673n, EUR));
      // Forwards again, 26 548 673 EUR cents are 30 000 000.49 USD cents, so exactly the listed
      // held: the round trip needs no correction here.
      expect(reservation.heldCorrection).toBe(0n);
    });

    it('should make held exact on a reopen even when the round trip loses a minor unit', () => {
      const reservation = Reservation.open({
        programId: PROGRAM_ID,
        invoiceId: INVOICE_A,
        invoiceAmount: Money.of(1_000n, EUR),
        reservedAmount: Money.of(3_000n, USD),
        rate: Rate.parse('3'),
        clientId: CLIENT,
        createdAt: AT_10_00,
      });
      reservation.releaseByAdjustment();

      reservation.reopenTo(Money.of(100n, USD));

      // 100 USD cents at 3 are 33.33 EUR cents, so 33; forwards that is 99, one short.
      expect(reservation.remainingInvoiceAmount).toEqual(Money.of(33n, EUR));
      expect(reservation.heldCorrection).toBe(1n);
      expect(reservation.held).toEqual(Money.of(100n, USD));
    });

    it('should refuse to correct a closed reservation and to reopen an active one', () => {
      const active = holdingInvoiceB();
      const closed = holdingInvoiceB();
      closed.releaseByAdjustment();

      expect(() => active.reopenTo(THREE_HUNDRED_THOUSAND_USD)).toThrow(RangeError);
      expect(() => closed.correctTo(THREE_HUNDRED_THOUSAND_USD)).toThrow(RangeError);
    });
  });
});
