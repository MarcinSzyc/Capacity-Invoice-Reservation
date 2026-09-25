import {readableString, storablePayload, storableText} from './readable-payload';

const LIMIT = 8;
const NUL = '\u0000';

const nestedTo = (depth: number): unknown => {
  let value: unknown = 'leaf';
  for (let level = 0; level < depth; level += 1) value = [value];
  return value;
};

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

  it('should not read an id that contains NUL', () => {
    expect(readableString({messageId: `m-1${NUL}`}, 'messageId', LIMIT)).toBeNull();
  });
});

describe('storablePayload', () => {
  it('should keep a payload that is plainly storable and drop one nested too deep or carrying NUL', () => {
    const message = {messageId: 'm-1', activeReservations: [{invoiceId: 'INV-A', heldAmount: 1}]};

    expect(storablePayload(message)).toBe(message);
    expect(storablePayload({extra: nestedTo(30)})).not.toBeNull();
    expect(storablePayload({extra: nestedTo(33)})).toBeNull();
    expect(storablePayload({extra: nestedTo(2_850)})).toBeNull();
    expect(storablePayload({note: `a${NUL}b`})).toBeNull();
    expect(storablePayload({[`n${NUL}`]: 1})).toBeNull();
    expect(storablePayload({list: [1, [`x${NUL}`]]})).toBeNull();
  });
});

describe('storableText', () => {
  it('should remove NUL from an error text', () => {
    expect(storableText(`Unexpected ${NUL} in JSON`)).toBe('Unexpected  in JSON');
  });
});
