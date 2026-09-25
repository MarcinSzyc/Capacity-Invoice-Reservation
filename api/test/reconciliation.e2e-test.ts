import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {expectLedgerInvariants} from './support/ledger-invariants';
import {announceProgram, applySnapshot, readAvailability, USD} from './support/programs';
import {SettableClock} from './support/settable-clock';
import {createAppWith, httpServer} from './support/test-app';
import {bearer, TEST_CLIENT_ID, validToken} from './support/tokens';

const TEN_MILLION = 1_000_000_000n;
const SEVEN_MILLION = 700_000_000n;
const SEVEN_HUNDRED_THOUSAND = 70_000_000;
const ONE_MILLION = 100_000_000;
const ONE_POINT_NINE_TWO_FIVE_MILLION = 192_500_000;
const ONE_POINT_NINE_MILLION = 190_000_000;
const ONE_POINT_FOUR_MILLION = 140_000_000;
const NINE_HUNDRED_THOUSAND = 90_000_000;
const FIVE_HUNDRED_THOUSAND = 50_000_000;
const THREE_HUNDRED_THOUSAND = 30_000_000;
const MINUS_TWENTY_FIVE_THOUSAND = -2_500_000;
const AT_09_00 = new Date('2026-09-21T09:00:00.000Z');
const AT_12_00 = new Date('2026-09-21T12:00:00.000Z');
const AT_17_00 = new Date('2026-09-21T17:00:00.000Z');
const AT_17_59_45 = new Date('2026-09-21T17:59:45.000Z');
const AT_18_00 = new Date('2026-09-21T18:00:00.000Z');
const AT_18_00_30 = new Date('2026-09-21T18:00:30.000Z');
const AT_18_05 = new Date('2026-09-21T18:05:00.000Z');

interface MovementBody {
  readonly kind: string;
  readonly amount: number;
  readonly releaseId: string | null;
  readonly messageId: string | null;
  readonly clientId: string | null;
}

interface ReservationBody {
  readonly invoiceAmount: number;
  readonly held: number;
  readonly releasedInvoiceAmount: number;
  readonly status: string;
  readonly source: string;
  readonly movements: MovementBody[];
}

describe('Reconciliation snapshots', () => {
  const clock = new SettableClock();
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await createAppWith({clock});
    token = await validToken();
  });

  afterEach(async () => {
    await expectLedgerInvariants(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const program = (): Promise<string> =>
    announceProgram(app, {currency: USD, creditLimit: TEN_MILLION});

  const reserveAt = async (
    at: Date,
    programId: string,
    invoiceId: string,
    invoiceAmount: number,
  ): Promise<void> => {
    clock.set(at);
    await request(httpServer(app))
      .post(`/programs/${programId}/reservations`)
      .set('Authorization', bearer(token))
      .send({invoiceId, invoiceAmount, invoiceCurrency: USD})
      .expect(201);
  };

  const releaseAt = async (
    at: Date,
    programId: string,
    invoiceId: string,
    amount: number,
  ): Promise<void> => {
    clock.set(at);
    await request(httpServer(app))
      .post(`/programs/${programId}/reservations/${invoiceId}/releases`)
      .set('Authorization', bearer(token))
      .send({releaseId: `R-${at.toISOString()}`, amount})
      .expect(200);
  };

  const readReservation = async (
    programId: string,
    invoiceId: string,
  ): Promise<ReservationBody> => {
    const response = await request(httpServer(app))
      .get(`/programs/${programId}/reservations/${invoiceId}`)
      .set('Authorization', bearer(token))
      .expect(200);
    return response.body as ReservationBody;
  };

  const kinds = (body: ReservationBody): string[] => body.movements.map((m) => m.kind);

  it('[AC-26] should add an unknown reservation from the snapshot with source reconciliation and an adjustment movement', async () => {
    const programId = await program();

    const snapshot = await applySnapshot(app, {
      programId,
      creditLimit: TEN_MILLION,
      asOf: AT_18_00,
      activeReservations: [{invoiceId: 'INV-X', heldAmount: BigInt(SEVEN_HUNDRED_THOUSAND)}],
    });

    expect(snapshot.outcome).toBe('applied');
    const invoiceX = await readReservation(programId, 'INV-X');
    expect(invoiceX).toMatchObject({
      source: 'reconciliation',
      held: SEVEN_HUNDRED_THOUSAND,
      invoiceAmount: SEVEN_HUNDRED_THOUSAND,
      status: 'active',
    });
    expect(invoiceX.movements).toEqual([
      expect.objectContaining({
        kind: 'adjustment',
        amount: SEVEN_HUNDRED_THOUSAND,
        messageId: snapshot.messageId,
        clientId: null,
      }),
    ]);
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({
      reserved: SEVEN_HUNDRED_THOUSAND,
      available: Number(TEN_MILLION) - SEVEN_HUNDRED_THOUSAND,
    });
  });

  it('[AC-27] should release by adjustment a reservation created before asOf that the snapshot omits', async () => {
    const programId = await program();
    await reserveAt(AT_09_00, programId, 'INV-A', ONE_MILLION);

    await applySnapshot(app, {programId, creditLimit: TEN_MILLION, asOf: AT_18_00});

    const invoiceA = await readReservation(programId, 'INV-A');
    expect(invoiceA).toMatchObject({
      held: 0,
      releasedInvoiceAmount: ONE_MILLION,
      invoiceAmount: ONE_MILLION,
      status: 'closed',
    });
    expect(kinds(invoiceA)).toEqual(['reserve', 'adjustment']);
    expect(invoiceA.movements[1]?.amount).toBe(-ONE_MILLION);
    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({reserved: 0, available: Number(TEN_MILLION)});
  });

  it('[AC-28] should keep a reservation created after asOf that the snapshot omits', async () => {
    const programId = await program();
    await reserveAt(AT_18_00_30, programId, 'INV-C', ONE_MILLION);

    await applySnapshot(app, {programId, creditLimit: TEN_MILLION, asOf: AT_18_00});

    const invoiceC = await readReservation(programId, 'INV-C');
    expect(invoiceC).toMatchObject({held: ONE_MILLION, status: 'active'});
    expect(kinds(invoiceC)).toEqual(['reserve']);
  });

  it('[AC-29] should correct held to the snapshot value with an adjustment for the difference', async () => {
    const programId = await program();
    await reserveAt(AT_09_00, programId, 'INV-B', ONE_POINT_NINE_TWO_FIVE_MILLION);

    await applySnapshot(app, {
      programId,
      creditLimit: TEN_MILLION,
      asOf: AT_18_00,
      activeReservations: [{invoiceId: 'INV-B', heldAmount: BigInt(ONE_POINT_NINE_MILLION)}],
    });

    const corrected = await readReservation(programId, 'INV-B');
    expect(corrected.held).toBe(ONE_POINT_NINE_MILLION);
    expect(kinds(corrected)).toEqual(['reserve', 'adjustment']);
    expect(corrected.movements[1]?.amount).toBe(MINUS_TWENTY_FIVE_THOUSAND);

    // ADR-0012, 1A: the correction survives a later release instead of being derived away.
    await releaseAt(AT_18_05, programId, 'INV-B', NINE_HUNDRED_THOUSAND);
    expect((await readReservation(programId, 'INV-B')).held).toBe(ONE_MILLION);
  });

  it('[AC-31] should set limit and currency from the snapshot and expose its asOf in availability', async () => {
    const programId = await program();

    await applySnapshot(app, {programId, creditLimit: SEVEN_MILLION, asOf: AT_18_00});

    const availability = await readAvailability(app, programId, token).expect(200);
    expect(availability.body).toMatchObject({
      currency: USD,
      limit: Number(SEVEN_MILLION),
      asOf: AT_18_00.toISOString(),
    });
  });

  it('[AC-42] should keep a reservation created within the keep window before asOf that the snapshot omits', async () => {
    const programId = await program();
    await reserveAt(AT_17_59_45, programId, 'INV-D', ONE_MILLION);

    await applySnapshot(app, {programId, creditLimit: TEN_MILLION, asOf: AT_18_00});

    const invoiceD = await readReservation(programId, 'INV-D');
    expect(invoiceD).toMatchObject({held: ONE_MILLION, status: 'active'});
    expect(kinds(invoiceD)).toEqual(['reserve']);
  });

  it('[AC-43] should keep a release made after asOf when a snapshot corrects held', async () => {
    const programId = await program();
    await reserveAt(AT_17_00, programId, 'INV-B', ONE_POINT_NINE_TWO_FIVE_MILLION);
    await releaseAt(AT_18_05, programId, 'INV-B', FIVE_HUNDRED_THOUSAND);

    await applySnapshot(app, {
      programId,
      creditLimit: TEN_MILLION,
      asOf: AT_18_00,
      activeReservations: [{invoiceId: 'INV-B', heldAmount: BigInt(ONE_POINT_NINE_MILLION)}],
    });

    const invoiceB = await readReservation(programId, 'INV-B');
    expect(invoiceB.held).toBe(ONE_POINT_FOUR_MILLION);
    expect(kinds(invoiceB)).toEqual(['reserve', 'release', 'adjustment']);
    expect(invoiceB.movements[1]).toMatchObject({kind: 'release', clientId: TEST_CLIENT_ID});
    expect(invoiceB.movements[2]?.amount).toBe(MINUS_TWENTY_FIVE_THOUSAND);
  });

  it('[AC-44] should reopen a reservation closed by an earlier snapshot when a later snapshot lists it', async () => {
    const programId = await program();
    await reserveAt(AT_09_00, programId, 'INV-F', ONE_MILLION);
    await applySnapshot(app, {programId, creditLimit: TEN_MILLION, asOf: AT_12_00});
    expect((await readReservation(programId, 'INV-F')).status).toBe('closed');

    const second = await applySnapshot(app, {
      programId,
      creditLimit: TEN_MILLION,
      asOf: AT_18_00,
      activeReservations: [{invoiceId: 'INV-F', heldAmount: BigInt(THREE_HUNDRED_THOUSAND)}],
    });

    const invoiceF = await readReservation(programId, 'INV-F');
    expect(invoiceF).toMatchObject({status: 'active', held: THREE_HUNDRED_THOUSAND});
    expect(invoiceF.movements.at(-1)).toMatchObject({
      kind: 'adjustment',
      amount: THREE_HUNDRED_THOUSAND,
      messageId: second.messageId,
    });
  });
});
