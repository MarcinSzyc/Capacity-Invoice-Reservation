const DEFAULT_EXPONENT = 2;

/**
 * How many decimal places a currency's minor unit has (glossary, A-10). ISO 4217 gives most
 * codes two, a handful none and a handful three or four; only the exceptions are listed, so a
 * code that is not here has two, which is both the ISO default and what the codes without a
 * minor unit at all (XAU, XTS, XXX) are counted in here. Source: the ISO 4217 list published by
 * SIX, read on 2026-09-22.
 */
const EXPONENT_BY_CURRENCY: Readonly<Record<string, number>> = {
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  UYI: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  CLF: 4,
  UYW: 4,
};

export const minorUnitExponent = (currency: string): number =>
  EXPONENT_BY_CURRENCY[currency] ?? DEFAULT_EXPONENT;
