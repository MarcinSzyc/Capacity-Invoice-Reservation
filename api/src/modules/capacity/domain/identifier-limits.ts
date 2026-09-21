/**
 * How long an identifier may be, in one place. Storage columns mirror these widths
 * (`prisma/schema.prisma`), the DTOs validate against them and the consumer reads a rejected
 * message's ids only when they fit, so nothing that passed validation can fail an insert.
 */
export const MESSAGE_ID_MAX_LENGTH = 128;
export const PROGRAM_ID_MAX_LENGTH = 64;
export const MESSAGE_TYPE_MAX_LENGTH = 32;
