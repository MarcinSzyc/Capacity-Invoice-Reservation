import {plainToInstance, Type} from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsInt,
  IsISO8601,
  IsObject,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  validate,
  ValidateNested,
  ValidationError,
} from 'class-validator';
import {
  RECONCILIATION_SNAPSHOT_TYPE,
  ReconciliationSnapshotCommand,
} from '../../application/apply-reconciliation-snapshot.use-case';
import {
  INVOICE_ID_MAX_LENGTH,
  MESSAGE_ID_MAX_LENGTH,
  PROGRAM_ID_MAX_LENGTH,
  SNAPSHOT_RESERVATIONS_MAX,
} from '../../domain/identifier-limits';
import {IsCurrencyCode} from '../currency-code';
import {StorableText} from './storable-text';

/**
 * ADR-0006: every amount is an exact JSON integer. Each entry is held to it by its validator; the
 * total is held to it here, since it becomes the program's `reserved`, which availability returns
 * as one JSON number (review round 1 of S-06).
 */
const MAX_EXACT_JSON_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

/** One entry of the list: an invoice the treasury holds capacity for, in program currency. */
export class ListedReservationMessageDto {
  @IsString()
  @Length(1, INVOICE_ID_MAX_LENGTH)
  @StorableText()
  invoiceId!: string;

  /** Zero is legal: an active reservation may hold nothing (AC-15, amended). */
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  heldAmount!: number;
}

/**
 * The reconciliation snapshot as the treasury sends it (A-11): the program's full state as of
 * `asOf`. Validated like any untrusted input; unknown fields are refused because we own the
 * contract, and an invoice listed twice is refused because both amounts cannot be true.
 */
export class ReconciliationSnapshotMessageDto {
  @IsString()
  @Length(1, MESSAGE_ID_MAX_LENGTH)
  @StorableText()
  messageId!: string;

  @Equals(RECONCILIATION_SNAPSHOT_TYPE)
  type!: typeof RECONCILIATION_SNAPSHOT_TYPE;

  @IsString()
  @Length(1, PROGRAM_ID_MAX_LENGTH)
  @StorableText()
  programId!: string;

  @IsCurrencyCode()
  currency!: string;

  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  creditLimit!: number;

  /** An instant, so a zone is required, as for a capacity update's `eventTime`. */
  @IsISO8601({strict: true})
  @Matches(/(Z|[+-]\d{2}:\d{2})$/, {message: 'asOf must carry a UTC designator or an offset'})
  asOf!: string;

  @IsArray()
  // Without this an entry that is an array, a string or null has no fields to fail, passes
  // validation and reaches the mapping as nothing (review round 1 of S-06).
  @IsObject({each: true, message: 'activeReservations must list objects'})
  @ArrayMaxSize(SNAPSHOT_RESERVATIONS_MAX)
  @ArrayUnique((entry: ListedReservationMessageDto) => entry.invoiceId, {
    message: 'activeReservations must not list one invoiceId twice',
  })
  @ValidateNested({each: true})
  @Type(() => ListedReservationMessageDto)
  activeReservations!: ListedReservationMessageDto[];
}

export type ParsedReconciliationSnapshot =
  | {readonly ok: true; readonly command: ReconciliationSnapshotCommand}
  | {readonly ok: false; readonly error: string};

export const parseReconciliationSnapshot = async (
  payload: unknown,
  receivedAt: Date,
): Promise<ParsedReconciliationSnapshot> => {
  const dto = plainToInstance(ReconciliationSnapshotMessageDto, payload);
  const problems = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });
  if (problems.length > 0) {
    const error = messagesOf(problems).join('; ');
    return {ok: false, error: error === '' ? 'message is not an object' : error};
  }

  const listedTotal = dto.activeReservations.reduce((sum, e) => sum + BigInt(e.heldAmount), 0n);
  if (listedTotal > MAX_EXACT_JSON_INTEGER) {
    return {
      ok: false,
      error: `activeReservations add up to ${listedTotal}, more than the ${MAX_EXACT_JSON_INTEGER} minor units one amount may carry`,
    };
  }

  return {
    ok: true,
    command: {
      messageId: dto.messageId,
      programId: dto.programId,
      currency: dto.currency,
      creditLimit: BigInt(dto.creditLimit),
      asOf: new Date(dto.asOf),
      activeReservations: dto.activeReservations.map((entry) => ({
        invoiceId: entry.invoiceId,
        heldAmount: BigInt(entry.heldAmount),
      })),
      payload,
      receivedAt,
    },
  };
};

/** A nested entry's problems sit in `children`, not on the list's own error. */
const messagesOf = (problems: readonly ValidationError[]): string[] =>
  problems.flatMap((problem) => [
    ...Object.values(problem.constraints ?? {}),
    ...messagesOf(problem.children ?? []),
  ]);
