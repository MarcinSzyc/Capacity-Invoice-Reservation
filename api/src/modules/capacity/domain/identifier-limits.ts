/**
 * How long an identifier may be, in one place. Storage columns mirror these widths
 * (`prisma/schema.prisma`), the DTOs validate against them and the consumer reads a rejected
 * message's ids only when they fit, so nothing that passed validation can fail an insert.
 */
export const MESSAGE_ID_MAX_LENGTH = 128;
export const PROGRAM_ID_MAX_LENGTH = 64;
export const MESSAGE_TYPE_MAX_LENGTH = 32;
export const INVOICE_ID_MAX_LENGTH = 128;

/** The width `capacity_movements.release_id` has, the same as the other client ids. */
export const RELEASE_ID_MAX_LENGTH = 128;

/**
 * How many reservations one snapshot may list, so applying it is one bounded transaction. A
 * larger one is rejected and dead-lettered (S-06 local decision 5); README says so.
 */
export const SNAPSHOT_RESERVATIONS_MAX = 10_000;
