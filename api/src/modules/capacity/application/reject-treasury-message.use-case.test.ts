import {RejectTreasuryMessage} from './reject-treasury-message.use-case';
import {inMemoryCapacity} from './testing/in-memory-capacity.fake';

const RECEIVED_AT = new Date('2026-09-21T10:06:00.000Z');
const MALFORMED = {messageId: 'm-bad', type: 'capacity_update', creditLimit: 'a lot'};

describe('RejectTreasuryMessage', () => {
  it('should record a malformed message as rejected with its payload and error', async () => {
    const capacity = inMemoryCapacity();
    const useCase = new RejectTreasuryMessage(capacity);

    await useCase.execute({
      messageId: 'm-bad',
      programId: null,
      type: 'capacity_update',
      payload: MALFORMED,
      error: 'creditLimit must be an integer',
      receivedAt: RECEIVED_AT,
    });

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

  it('should count a repeated rejected messageId as a duplicate instead of a second row', async () => {
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
    await useCase.execute(rejection);

    await useCase.execute(rejection);

    expect(capacity.repositories.treasuryMessages.byId.size).toBe(1);
    expect(capacity.repositories.treasuryMessages.byId.get('m-bad')?.duplicateCount).toBe(1);
  });
});
