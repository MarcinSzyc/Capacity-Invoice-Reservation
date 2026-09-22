import {minorUnitExponent} from './currency-exponents';

describe('minorUnitExponent', () => {
  it('should answer what ISO 4217 gives each currency, not two decimals for everything (A-10)', () => {
    expect(minorUnitExponent('USD')).toBe(2);
    expect(minorUnitExponent('EUR')).toBe(2);
    expect(minorUnitExponent('JPY')).toBe(0);
    expect(minorUnitExponent('KRW')).toBe(0);
    expect(minorUnitExponent('KWD')).toBe(3);
    expect(minorUnitExponent('BHD')).toBe(3);
    expect(minorUnitExponent('CLF')).toBe(4);
  });

  it('should answer two for a code the exceptions do not name, which is the ISO default (A-10)', () => {
    expect(minorUnitExponent('GBP')).toBe(2);
    expect(minorUnitExponent('XXX')).toBe(2);
    expect(minorUnitExponent('XAU')).toBe(2);
  });
});
