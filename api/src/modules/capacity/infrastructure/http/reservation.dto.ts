import {ApiProperty} from '@nestjs/swagger';
import {IsInt, IsString, Length, Matches, Max, Min, ValidateIf} from 'class-validator';
import {INVOICE_ID_MAX_LENGTH} from '../../domain/identifier-limits';
import {ReservationSource, ReservationStatus} from '../../domain/reservation';
import {IsCurrencyCode} from '../currency-code';

/** A-07, A-10: what a client sends to reserve. `rate` is required only across currencies (A-02). */
export class ReserveRequestDto {
  @ApiProperty({example: 'INV-A', description: "The client's identifier of the invoice."})
  @IsString()
  @Length(1, INVOICE_ID_MAX_LENGTH)
  invoiceId!: string;

  // ADR-0006: a JSON integer in minor units; anything above 2^53 is not exact and is refused.
  @ApiProperty({
    type: 'integer',
    example: 120_000_000,
    description: 'Invoice amount in minor units of invoiceCurrency: 120000000 is 1 200 000.00.',
  })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  invoiceAmount!: number;

  @ApiProperty({
    example: 'USD',
    description:
      'ISO 4217 code of the invoice. Uppercased on the way in, so `usd` reads back as `USD` (A-10).',
  })
  @IsCurrencyCode()
  invoiceCurrency!: string;

  // A JSON number is refused by `@IsString()`, so the published contract never says float
  // (INV-08, ADR-0006). Whether the value is legal at all needs the program's currency, which
  // a DTO cannot see, so AC-07's rule is the use case's (slice decision 1).
  @ApiProperty({
    type: String,
    required: false,
    example: '1.10',
    description:
      'Invoice currency to program currency, a decimal string of at most 8 fractional digits. Required when invoiceCurrency differs from the program currency, absent or 1 otherwise. Reads back canonical, so "1.10" reads "1.1" (A-02, A-10).',
  })
  // ValidateIf rather than IsOptional: IsOptional skips validation for `null` as well as for
  // `undefined`, so an explicit `"rate": null` would reach the use case unvalidated. Absent is
  // legal (A-02), null is a wrong value and gets the 400 AC-07 promises.
  @ValidateIf((dto: ReserveRequestDto) => dto.rate !== undefined)
  @IsString()
  @Matches(/^\d{1,12}(\.\d{1,8})?$/, {
    message: 'rate must be a decimal string with at most 8 fractional digits',
  })
  @Matches(/[1-9]/, {message: 'rate must be greater than zero'})
  rate?: string;
}

/** A-19: a reservation as the client reads it. Amounts are integer minor units (ADR-0006). */
export class ReservationDto {
  @ApiProperty({example: 'PRG-1'})
  programId!: string;

  @ApiProperty({example: 'INV-A'})
  invoiceId!: string;

  @ApiProperty({type: 'integer', example: 120_000_000, description: 'As sent, in invoiceCurrency.'})
  invoiceAmount!: number;

  @ApiProperty({example: 'USD'})
  invoiceCurrency!: string;

  @ApiProperty({
    type: 'integer',
    example: 120_000_000,
    description: 'What the reservation took from the limit at creation, in program currency.',
  })
  reservedAmount!: number;

  @ApiProperty({
    type: 'integer',
    example: 120_000_000,
    description: 'How much of reservedAmount still occupies the limit, in program currency.',
  })
  held!: number;

  @ApiProperty({
    type: String,
    example: '1.1',
    description:
      'Invoice currency to program currency, canonical decimal; 1 for a same-currency reservation (A-10).',
  })
  rate!: string;

  @ApiProperty({
    enum: ['active', 'closed'],
    example: 'active',
    description: 'active while held > 0.',
  })
  status!: ReservationStatus;

  @ApiProperty({
    enum: ['client', 'reconciliation'],
    example: 'client',
    description: 'Who created it: the client over HTTP, or a reconciliation snapshot.',
  })
  source!: ReservationSource;

  @ApiProperty({type: String, format: 'date-time', example: '2026-09-21T10:10:00.000Z'})
  createdAt!: string;
}
