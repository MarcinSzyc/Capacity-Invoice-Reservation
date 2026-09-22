import {ApiProperty} from '@nestjs/swagger';
import {IsInt, IsISO4217CurrencyCode, IsString, Length, Matches, Max, Min} from 'class-validator';
import {INVOICE_ID_MAX_LENGTH} from '../../domain/identifier-limits';
import {ReservationSource, ReservationStatus} from '../../domain/reservation';

/** A-07, A-10: what a client sends to reserve. `rate` arrives with S-04; until then it is refused. */
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

  // The library validator uppercases before it checks, so `usd` would pass it (AC-08).
  @ApiProperty({example: 'USD', description: 'ISO 4217 code of the invoice, upper case.'})
  @Matches(/^[A-Z]{3}$/, {message: 'invoiceCurrency must be an upper case ISO 4217 code'})
  @IsISO4217CurrencyCode()
  invoiceCurrency!: string;
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
