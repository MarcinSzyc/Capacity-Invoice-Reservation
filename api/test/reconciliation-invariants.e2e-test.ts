import {INestApplication} from '@nestjs/common';
import request from 'supertest';
import {KafkaService} from '../src/messaging/kafka.service';
import {DevTreasuryProducer} from '../src/modules/capacity/infrastructure/messaging/dev-treasury-producer';
import {PrismaLedgerRepository} from '../src/modules/capacity/infrastructure/persistence/prisma-ledger.repository';
import {PrismaProgramRepository} from '../src/modules/capacity/infrastructure/persistence/prisma-program.repository';
import {PrismaReservationRepository} from '../src/modules/capacity/infrastructure/persistence/prisma-reservation.repository';
import {PrismaService} from '../src/persistence/prisma.service';
import {expectLedgerInvariants} from './support/ledger-invariants';
import {announceProgram, applySnapshot, awaitMessage, uniqueId, USD} from './support/programs';
import {SettableClock} from './support/settable-clock';
import {createAppWith, errorBodyOf, httpServer} from './support/test-app';
import {bearer, validToken} from './support/tokens';

const TEN_MILLION = 1_000_000_000n;
const TWELVE_MILLION = 1_200_000_000n;
const ONE_MILLION = 100_000_000;
const ONE_POINT_NINE_TWO_FIVE_MILLION = 192_500_000;
const FIVE_HUNDRED_THOUSAND = 50_000_000;
const THREE_HUNDRED_THOUSAND = 30_000_000;
const AT_10_00 = new Date('2026-09-21T10:00:00.000Z');
const AT_11_00 = new Date('2026-09-21T11:00:00.000Z');
const AT_12_00 = new Date('2026-09-21T12:00:00.000Z');
const AT_13_00 = new Date('2026-09-21T13:00:00.000Z');
const AT_14_00 = new Date('2026-09-21T14:00:00.000Z');
const AT_18_00 = new Date('2026-09-21T18:00:00.000Z');
const AT_18_00_20 = new Date('2026-09-21T18:00:20.000Z');
const AT_18_00_30 = new Date('2026-09-21T18:00:30.000Z');
const AT_19_00 = new Date('2026-09-21T19:00:00.000Z');
const AT_20_00 = new Date('2026-09-21T20:00:00.000Z');

describe('Reconciliation invariants', () => {
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

  const reserveAt = (
    at: Date,
    programId: string,
    invoiceId: string,
    invoiceAmount: number,
  ): request.Test => {
    clock.set(at);
    return request(httpServer(app))
      .post(`/programs/${programId}/reservations`)
      .set('Authorization', bearer(token))
      .send({invoiceId, invoiceAmount, invoiceCurrency: USD});
  };

  const releaseAt = (
    at: Date,
    programId: string,
    invoiceId: string,
    body: Record<string, unknown>,
  ): request.Test => {
    clock.set(at);
    return request(httpServer(app))
      .post(`/programs/${programId}/reservations/${invoiceId}/releases`)
      .set('Authorization', bearer(token))
      .send(body);
  };

  const heldAndStatus = async (
    programId: string,
    invoiceId: string,
  ): Promise<{held: number; status: string}> => {
    const response = await request(httpServer(app))
      .get(`/programs/${programId}/reservations/${invoiceId}`)
      .set('Authorization', bearer(token))
      .expect(200);
    const body = response.body as {held: number; status: string};
    return {held: body.held, status: body.status};
  };

  it('[INV-06] should never alter a reservation by a snapshot whose asOf precedes its creation', async () => {
    const programId = await announceProgram(app, {currency: USD, creditLimit: TEN_MILLION});
    await reserveAt(AT_18_00_30, programId, 'INV-C', ONE_MILLION).expect(201);
    const untouched = {held: ONE_MILLION, status: 'active'};

    // Arrives after the reservation but describes a moment before it: omitted, then listed.
    await applySnapshot(app, {programId, creditLimit: TEN_MILLION, asOf: AT_18_00});
    expect(await heldAndStatus(programId, 'INV-C')).toEqual(untouched);
    await applySnapshot(app, {
      programId,
      creditLimit: TEN_MILLION,
      asOf: AT_18_00_20,
      activeReservations: [{invoiceId: 'INV-C', heldAmount: BigInt(THREE_HUNDRED_THOUSAND)}],
    });
    expect(await heldAndStatus(programId, 'INV-C')).toEqual(untouched);

    // Describes a moment after it: now the treasury's word counts, listed and then omitted.
    await applySnapshot(app, {
      programId,
      creditLimit: TEN_MILLION,
      asOf: AT_19_00,
      activeReservations: [{invoiceId: 'INV-C', heldAmount: BigInt(THREE_HUNDRED_THOUSAND)}],
    });
    expect(await heldAndStatus(programId, 'INV-C')).toEqual({
      held: THREE_HUNDRED_THOUSAND,
      status: 'active',
    });
    await applySnapshot(app, {programId, creditLimit: TEN_MILLION, asOf: AT_20_00});
    expect(await heldAndStatus(programId, 'INV-C')).toEqual({held: 0, status: 'closed'});
  });

  it('[INV-05] should leave every balance and ledger row unchanged when every message and request of a scenario is replayed', async () => {
    const programId = uniqueId('PRG');
    const producer = new DevTreasuryProducer(app.get(KafkaService));
    const prisma = app.get(PrismaService);
    const update = {
      messageId: uniqueId('m-upd'),
      programId,
      currency: USD,
      creditLimit: TEN_MILLION,
      eventTime: AT_10_00,
    };
    const snapshot = {
      messageId: uniqueId('m-snap'),
      programId,
      currency: USD,
      creditLimit: TEN_MILLION,
      asOf: AT_13_00,
      activeReservations: [
        {invoiceId: 'INV-B', heldAmount: 140_000_000n},
        {invoiceId: 'INV-X', heldAmount: BigInt(THREE_HUNDRED_THOUSAND)},
      ],
    };
    const limitChange = {
      ...update,
      messageId: uniqueId('m-upd'),
      creditLimit: TWELVE_MILLION,
      eventTime: AT_14_00,
    };

    const messages = async (): Promise<void> => {
      await producer.publishCapacityUpdate(update);
      await awaitMessage(app, update.messageId, () => true);
    };
    const requests = async (): Promise<number[]> => [
      (await reserveAt(AT_11_00, programId, 'INV-A', ONE_MILLION)).status,
      (await reserveAt(AT_11_00, programId, 'INV-B', ONE_POINT_NINE_TWO_FIVE_MILLION)).status,
      (
        await releaseAt(AT_12_00, programId, 'INV-B', {
          releaseId: 'R-1',
          amount: FIVE_HUNDRED_THOUSAND,
        })
      ).status,
    ];
    const laterMessages = async (): Promise<void> => {
      await producer.publishSnapshot(snapshot);
      await awaitMessage(app, snapshot.messageId, () => true);
      await producer.publishCapacityUpdate(limitChange);
      await awaitMessage(app, limitChange.messageId, () => true);
    };
    const state = async (): Promise<unknown> => ({
      program: await new PrismaProgramRepository(prisma).findById(programId),
      reservations: await new PrismaReservationRepository(prisma).findByInvoices(programId, [
        'INV-A',
        'INV-B',
        'INV-X',
      ]),
      ledger: await new PrismaLedgerRepository(prisma).findByProgram(programId),
    });

    await messages();
    expect(await requests()).toEqual([201, 201, 200]);
    await laterMessages();
    const before = await state();
    expect((before as {ledger: unknown[]}).ledger).toHaveLength(9);

    await producer.publishCapacityUpdate(update);
    const replayed = await requests();
    await producer.publishSnapshot(snapshot);
    await producer.publishCapacityUpdate(limitChange);
    for (const messageId of [update.messageId, snapshot.messageId, limitChange.messageId]) {
      await awaitMessage(app, messageId, (stored) => stored.duplicateCount === 1);
    }

    expect(replayed).toEqual([409, 409, 409]);
    expect(await state()).toEqual(before);
    const release = await releaseAt(AT_12_00, programId, 'INV-B', {releaseId: 'R-1'});
    expect(errorBodyOf(release).code).toBe('RELEASE_ALREADY_PROCESSED');
  });
});
