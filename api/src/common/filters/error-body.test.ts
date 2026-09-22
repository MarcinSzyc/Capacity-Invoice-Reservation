import {DomainError, DomainErrorKind} from '../errors/domain-error';
import {toErrorBody} from './error-body';

const AT_10_10 = new Date('2026-09-21T10:10:00.000Z');

class ShortageError extends DomainError {
  readonly code = 'CAPACITY_EXCEEDED';
  readonly kind: DomainErrorKind = 'unprocessable';
  override readonly details = {
    available: 50_000_000n,
    reservation: {held: 1n, createdAt: AT_10_10, tags: [2n, 'x']},
  };

  constructor() {
    super('not enough');
  }
}

describe('toErrorBody', () => {
  it("should put a domain error's details next to its code, rendering bigint as a JSON integer and Date as ISO 8601", () => {
    expect(toErrorBody(new ShortageError())).toEqual({
      statusCode: 422,
      code: 'CAPACITY_EXCEEDED',
      message: 'not enough',
      available: 50_000_000,
      reservation: {held: 1, createdAt: '2026-09-21T10:10:00.000Z', tags: [2, 'x']},
    });
  });

  it('should refuse an amount that does not fit a JSON integer, naming the field (ADR-0006)', () => {
    class HugeError extends DomainError {
      readonly code = 'HUGE';
      readonly kind: DomainErrorKind = 'conflict';
      override readonly details = {available: BigInt(Number.MAX_SAFE_INTEGER) + 1n};

      constructor() {
        super('huge');
      }
    }

    expect(() => toErrorBody(new HugeError())).toThrow(/^available /);
  });
});
