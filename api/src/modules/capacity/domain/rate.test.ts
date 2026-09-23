import {Rate} from './rate';

describe('Rate', () => {
  it('should read a decimal string exactly and render it canonically (ADR-0006, A-10)', () => {
    expect(Rate.parse('1.10').toString()).toBe('1.1');
    expect(Rate.parse('1.00').toString()).toBe('1');
    expect(Rate.parse('1').toString()).toBe('1');
    expect(Rate.parse('0.00670000').toString()).toBe('0.0067');
    expect(Rate.parse('0.30712').toString()).toBe('0.30712');
    expect(Rate.parse('3.2560').toString()).toBe('3.256');
  });

  it('should treat every spelling of one as one, numerically (ADR-0006)', () => {
    for (const text of ['1', '1.0', '1.00', '1.00000000']) {
      expect(Rate.parse(text).isOne()).toBe(true);
    }
    expect(Rate.one().isOne()).toBe(true);
    expect(Rate.one().toString()).toBe('1');
    expect(Rate.parse('1.1').isOne()).toBe(false);
    expect(Rate.parse('0.9').isOne()).toBe(false);
  });

  it('should compare two rates numerically, whatever scale they were written with', () => {
    expect(Rate.parse('1.10').equals(Rate.parse('1.1'))).toBe(true);
    expect(Rate.parse('1.10').equals(Rate.parse('1.100000'))).toBe(true);
    expect(Rate.parse('1.10').equals(Rate.parse('1.11'))).toBe(false);
  });

  it('should refuse anything that is not a positive decimal of at most eight places', () => {
    const refused = [
      '1.123456789',
      '0',
      '0.0',
      '0.00000000',
      '-1',
      '-0.5',
      'abc',
      '',
      '1.',
      '.5',
      '1e3',
      ' 1.1',
      '1.1 ',
      '1234567890123',
    ];
    for (const text of refused) {
      expect(() => Rate.parse(text)).toThrow(RangeError);
    }
  });
});
