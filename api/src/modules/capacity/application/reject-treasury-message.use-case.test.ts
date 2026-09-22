import {RejectTreasuryMessage} from './reject-treasury-message.use-case';
import {inMemoryCapacity} from './testing/in-memory-capacity.fake';

const RECEIVED_AT = new Date('2026-09-21T10:06:00.000Z');
const MALFORMED = {messageId: 'm-bad', type: 'capacity_update', creditLimit: 'a lot'};

describe('RejectTreasuryMessage', () => {
  it('should dead-letter first, then record a malformed message as rejected with its payload and error', async () => {
    const capacity = inMemoryCapacity();
    const useCase = new RejectTreasuryMessage(capacity);
    const order: string[] = [];
    const publishDeadLetter = (): Promise<void> => {
      order.push(
        `published, recorded: ${String(capacity.repositories.treasuryMessages.byId.has('m-bad'))}`,
      );
      return Promise.resolve();
    };

    const result = await useCase.execute(
      {
        messageId: 'm-bad',
        programId: null,
        type: 'capacity_update',
        payload: MALFORMED,
        error: 'creditLimit must be an integer',
        receivedAt: RECEIVED_AT,
      },
      publishDeadLetter,
    );

    expect(result).toBe('rejected');
    expect(order).toEqual(['published, recorded: false']);
    expect(capacity.repositories.treasuryMessages.byId.get('m-bad')).toEqual({
      messageId: 'm-bad',
      programId: null,
      type: 'capacity_update',
      payload: MALFORMED,
      outcome: 'rejected',
      error: 'creditLimit must be an integer',
      receivedAt: RECEIVED_AT,
      duplicateCount: 0,
    });
  });

  it('should publish the dead letter outside any unit of work, so a slow broker cannot time a transaction out', async () => {
    const capacity = inMemoryCapacity();
    const useCase = new RejectTreasuryMessage(capacity);
    const inTransactionWhilePublishing: boolean[] = [];
    const publishDeadLetter = (): Promise<void> => {
      inTransactionWhilePublishing.push(capacity.inTransaction);
      return Promise.resolve();
    };

    const result = await useCase.execute(
      {
        messageId: 'm-bad',
        programId: null,
        type: null,
        payload: MALFORMED,
        error: 'creditLimit must be an integer',
        receivedAt: RECEIVED_AT,
      },
      publishDeadLetter,
    );

    expect(result).toBe('rejected');
    expect(inTransactionWhilePublishing).toEqual([false]);
    expect(capacity.repositories.treasuryMessages.byId.get('m-bad')?.outcome).toBe('rejected');
  });

  it('should count a repeated rejected messageId as a duplicate and publish nothing', async () => {
    const capacity = inMemoryCapacity();
    const useCase = new RejectTreasuryMessage(capacity);
    const rejection = {
      messageId: 'm-bad',
      programId: null,
      type: null,
      payload: MALFORMED,
      error: 'type must be capacity_update',
      receivedAt: RECEIVED_AT,
    };
    let published = 0;
    const publishDeadLetter = (): Promise<void> => {
      published += 1;
      return Promise.resolve();
    };
    await useCase.execute(rejection, publishDeadLetter);

    const result = await useCase.execute(rejection, publishDeadLetter);

    expect(result).toBe('duplicate');
    expect(published).toBe(1);
    expect(capacity.repositories.treasuryMessages.byId.size).toBe(1);
    expect(capacity.repositories.treasuryMessages.byId.get('m-bad')?.duplicateCount).toBe(1);
  });

  it('should leave no record when the dead letter cannot be published, so the message is seen again', async () => {
    const capacity = inMemoryCapacity();
    const useCase = new RejectTreasuryMessage(capacity);

    await expect(
      useCase.execute(
        {
          messageId: 'm-bad',
          programId: null,
          type: null,
          payload: MALFORMED,
          error: 'x',
          receivedAt: RECEIVED_AT,
        },
        () => Promise.reject(new Error('broker is away')),
      ),
    ).rejects.toThrow('broker is away');

    expect(capacity.repositories.treasuryMessages.byId.has('m-bad')).toBe(false);
  });
});
