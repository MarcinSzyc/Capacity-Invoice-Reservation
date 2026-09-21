import {ApiProperty} from '@nestjs/swagger';
import {IsString, Length} from 'class-validator';

export class ProgramIdParams {
  @ApiProperty({example: 'PRG-1', description: 'The treasury identifier of the program.'})
  @IsString()
  @Length(1, 64)
  programId!: string;
}

/** A-19: the read model of a program. Amounts are integer minor units (ADR-0006). */
export class AvailabilityDto {
  @ApiProperty({example: 'PRG-1'})
  programId!: string;

  @ApiProperty({example: 'USD', description: 'ISO 4217 code every amount below is in.'})
  currency!: string;

  @ApiProperty({
    example: 1_000_000_000,
    description: 'Credit limit in minor units: 1000000000 is 10 000 000.00 USD.',
  })
  limit!: number;

  @ApiProperty({example: 0, description: 'Sum of held of the active reservations, minor units.'})
  reserved!: number;

  @ApiProperty({example: 1_000_000_000, description: 'max(0, limit - reserved), minor units.'})
  available!: number;

  @ApiProperty({
    example: false,
    description: 'reserved > limit: only a treasury limit cut can make this true (A-06).',
  })
  overcommitted!: boolean;

  @ApiProperty({
    example: null,
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'asOf of the last reconciliation snapshot applied, null before the first.',
  })
  asOf!: string | null;
}
