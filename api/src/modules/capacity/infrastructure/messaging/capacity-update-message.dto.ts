import {plainToInstance} from 'class-transformer';
import {
  Equals,
  IsInt,
  IsISO4217CurrencyCode,
  IsISO8601,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  validate,
} from 'class-validator';
import {
  CAPACITY_UPDATE_TYPE,
  CapacityUpdateCommand,
} from '../../application/apply-capacity-update.use-case';

/**
 * The capacity update as the treasury sends it (A-11): amounts are integer minor units, times
 * ISO 8601 UTC. Validated like any other untrusted input (CLAUDE.md §2): unknown fields are
 * refused because we own the contract and a field we did not define is a message we did not
 * expect.
 */
export class CapacityUpdateMessageDto {
  @IsString()
  @Length(1, 128)
  messageId!: string;

  @Equals(CAPACITY_UPDATE_TYPE)
  type!: typeof CAPACITY_UPDATE_TYPE;

  @IsString()
  @Length(1, 64)
  programId!: string;

  @IsISO4217CurrencyCode()
  currency!: string;

  /** JSON integer (ADR-0006); anything above 2^53 is not exact in JSON and is refused. */
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  creditLimit!: number;

  /** A-11: an instant, so a zone is required; the host's zone must never decide staleness. */
  @IsISO8601({strict: true})
  @Matches(/(Z|[+-]\d{2}:\d{2})$/, {message: 'eventTime must carry a UTC designator or an offset'})
  eventTime!: string;
}

export type ParsedCapacityUpdate =
  | {readonly ok: true; readonly command: CapacityUpdateCommand}
  | {readonly ok: false; readonly error: string};

export const parseCapacityUpdate = async (
  payload: unknown,
  receivedAt: Date,
): Promise<ParsedCapacityUpdate> => {
  const dto = plainToInstance(CapacityUpdateMessageDto, payload);
  const problems = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });
  if (problems.length > 0) {
    const error = problems
      .flatMap((problem) => Object.values(problem.constraints ?? {}))
      .join('; ');
    return {ok: false, error: error === '' ? 'message is not an object' : error};
  }

  return {
    ok: true,
    command: {
      messageId: dto.messageId,
      programId: dto.programId,
      currency: dto.currency,
      creditLimit: BigInt(dto.creditLimit),
      eventTime: new Date(dto.eventTime),
      payload,
      receivedAt,
    },
  };
};
