import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  Length,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {CAPACITY_UPDATE_TYPE} from '../../application/apply-capacity-update.use-case';
import {RECONCILIATION_SNAPSHOT_TYPE} from '../../application/apply-reconciliation-snapshot.use-case';
import {CapacityMovementDto} from './reservation.dto';

export const TREASURY_MESSAGE_TYPES = [CAPACITY_UPDATE_TYPE, RECONCILIATION_SNAPSHOT_TYPE] as const;
export type TreasuryMessageType = (typeof TREASURY_MESSAGE_TYPES)[number];

// Local decision 3 of S-07: only what building the message needs. Whether the treasury may send
// it is the consumer's call, and seeing that call is what the treasury panel is for.
const LOOSE_TEXT_MAX_LENGTH = 1_000;

export class DevTokenDto {
  @ApiProperty({description: 'A bearer token for client demo-web, valid 8 hours.'})
  token!: string;
}

/** A ledger row with the balances it left behind, as the live ledger shows it. */
export class DevMovementDto extends CapacityMovementDto {
  @ApiProperty({type: 'integer', example: 1_000_000_000, description: 'Minor units.'})
  limitAfter!: number;

  @ApiProperty({type: 'integer', example: 120_000_000, description: 'Minor units.'})
  reservedAfter!: number;

  @ApiProperty({type: 'integer', example: 880_000_000, description: 'Minor units.'})
  availableAfter!: number;
}

export class ProgramMovementsDto {
  @ApiProperty({example: 'PRG-1'})
  programId!: string;

  @ApiProperty({example: 'USD', description: 'ISO 4217 code every amount below is in.'})
  currency!: string;

  @ApiProperty({type: [DevMovementDto], description: 'The latest 100 rows, newest first.'})
  movements!: DevMovementDto[];
}

export class DevListedReservationDto {
  @ApiProperty({example: 'INV-A'})
  @IsString()
  @Length(1, LOOSE_TEXT_MAX_LENGTH)
  invoiceId!: string;

  @ApiProperty({type: 'integer', example: 70_000_000, description: 'Program minor units.'})
  @IsInt()
  @Min(-Number.MAX_SAFE_INTEGER)
  @Max(Number.MAX_SAFE_INTEGER)
  heldAmount!: number;
}

/** What the treasury panel asks the dev producer to publish (glossary: Dev endpoint). */
export class DevTreasuryMessageDto {
  @ApiProperty({enum: TREASURY_MESSAGE_TYPES, example: CAPACITY_UPDATE_TYPE})
  @IsIn(TREASURY_MESSAGE_TYPES)
  type!: TreasuryMessageType;

  @ApiProperty({example: 'PRG-1'})
  @IsString()
  @Length(1, LOOSE_TEXT_MAX_LENGTH)
  programId!: string;

  @ApiProperty({example: 'USD'})
  @IsString()
  @Length(1, LOOSE_TEXT_MAX_LENGTH)
  currency!: string;

  @ApiProperty({type: 'integer', example: 1_000_000_000, description: 'Minor units.'})
  @IsInt()
  @Min(-Number.MAX_SAFE_INTEGER)
  @Max(Number.MAX_SAFE_INTEGER)
  creditLimit!: number;

  @ApiProperty({required: false, description: 'Absent: a fresh one. Repeat one to duplicate.'})
  @ValidateIf((dto: DevTreasuryMessageDto) => dto.messageId !== undefined)
  @IsString()
  @Length(1, LOOSE_TEXT_MAX_LENGTH)
  messageId?: string;

  @ApiProperty({required: false, format: 'date-time', description: 'Capacity update. Absent: now.'})
  @ValidateIf((dto: DevTreasuryMessageDto) => dto.eventTime !== undefined)
  @IsISO8601({strict: true})
  eventTime?: string;

  @ApiProperty({required: false, format: 'date-time', description: 'Snapshot. Absent: now.'})
  @ValidateIf((dto: DevTreasuryMessageDto) => dto.asOf !== undefined)
  @IsISO8601({strict: true})
  asOf?: string;

  @ApiProperty({type: [DevListedReservationDto], required: false, description: 'Snapshot only.'})
  @ValidateIf((dto: DevTreasuryMessageDto) => dto.activeReservations !== undefined)
  @IsArray()
  @ValidateNested({each: true})
  @Type(() => DevListedReservationDto)
  activeReservations?: DevListedReservationDto[];
}

/** The message as it went onto the topic, `messageId` and time filled in. */
export class PublishedTreasuryMessageDto {
  @ApiProperty({enum: TREASURY_MESSAGE_TYPES})
  type!: TreasuryMessageType;

  @ApiProperty()
  messageId!: string;

  @ApiProperty()
  programId!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty({type: 'integer'})
  creditLimit!: number;

  @ApiProperty({type: String, nullable: true, format: 'date-time', description: 'Update only.'})
  eventTime!: string | null;

  @ApiProperty({type: String, nullable: true, format: 'date-time', description: 'Snapshot only.'})
  asOf!: string | null;

  @ApiProperty({type: [DevListedReservationDto]})
  activeReservations!: DevListedReservationDto[];
}
