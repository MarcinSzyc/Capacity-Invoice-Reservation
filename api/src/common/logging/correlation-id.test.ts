import {currentCorrelationId, runWithCorrelationId, withoutCorrelationId} from './correlation-id';

const CORRELATION_ID = 'message-m-1';

describe('correlation id context', () => {
  it('should make the id visible to everything that runs inside it', () => {
    runWithCorrelationId(CORRELATION_ID, () => {
      expect(currentCorrelationId()).toBe(CORRELATION_ID);
    });
    expect(currentCorrelationId()).toBeUndefined();
  });

  it('should let library log lines step outside the context, so they carry no id rather than a wrong one', () => {
    runWithCorrelationId(CORRELATION_ID, () => {
      withoutCorrelationId(() => {
        expect(currentCorrelationId()).toBeUndefined();
      });
      expect(currentCorrelationId()).toBe(CORRELATION_ID);
    });
  });
});
