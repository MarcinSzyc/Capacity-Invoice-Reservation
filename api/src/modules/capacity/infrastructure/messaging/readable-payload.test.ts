import {readableString} from './readable-payload';

const LIMIT = 8;

describe('readableString', () => {
  it('should read a non-empty string that fits the bound', () => {
    expect(readableString({messageId: 'm-1'}, 'messageId', LIMIT)).toBe('m-1');
  });

  it('should treat a string longer than the bound as unreadable, so it never reaches a column that cannot hold it', () => {
    expect(readableString({messageId: 'x'.repeat(LIMIT + 1)}, 'messageId', LIMIT)).toBeNull();
    expect(readableString({messageId: 'x'.repeat(LIMIT)}, 'messageId', LIMIT)).toBe(
      'x'.repeat(LIMIT),
    );
  });

  it('should treat anything that is not a non-empty string as unreadable', () => {
    expect(readableString({messageId: ''}, 'messageId', LIMIT)).toBeNull();
    expect(readableString({messageId: 42}, 'messageId', LIMIT)).toBeNull();
    expect(readableString({}, 'messageId', LIMIT)).toBeNull();
    expect(readableString(null, 'messageId', LIMIT)).toBeNull();
    expect(readableString('m-1', 'messageId', LIMIT)).toBeNull();
    expect(readableString([], 'messageId', LIMIT)).toBeNull();
  });
});
