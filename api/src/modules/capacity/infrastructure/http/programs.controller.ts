import {Body, Controller, Get, HttpCode, HttpStatus, Param, Post} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import {ClientId} from '../../../../common/auth/client-id.decorator';
import {GetAvailability} from '../../application/get-availability.query';
import {GetReservation} from '../../application/get-reservation.query';
import {ReleaseCapacity} from '../../application/release-capacity.use-case';
import {ReserveCapacity} from '../../application/reserve-capacity.use-case';
import {Rate} from '../../domain/rate';
import {AvailabilityDto, ProgramIdParams} from './availability.dto';
import {toAvailabilityDto} from './availability.mapper';
import {
  ReleaseRequestDto,
  ReservationDto,
  ReservationParams,
  ReservationWithMovementsDto,
  ReserveRequestDto,
} from './reservation.dto';
import {toReservationDto, toReservationWithMovementsDto} from './reservation.mapper';

@ApiTags('programs')
@ApiBearerAuth()
@ApiUnauthorizedResponse({description: 'No valid bearer token (AC-32, AC-33).'})
@Controller('programs')
export class ProgramsController {
  constructor(
    private readonly getAvailability: GetAvailability,
    private readonly reserveCapacity: ReserveCapacity,
    private readonly releaseCapacity: ReleaseCapacity,
    private readonly getReservation: GetReservation,
  ) {}

  @Get(':programId/availability')
  @ApiOkResponse({type: AvailabilityDto, description: 'The program as the ledger knows it now.'})
  @ApiNotFoundResponse({description: 'PROGRAM_NOT_FOUND: the treasury never announced it.'})
  async availability(@Param() {programId}: ProgramIdParams): Promise<AvailabilityDto> {
    return toAvailabilityDto(await this.getAvailability.execute(programId));
  }

  @Post(':programId/reservations')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({type: ReservationDto, description: 'Capacity is held for the invoice.'})
  @ApiBadRequestResponse({
    description: 'VALIDATION_FAILED: details name each field (AC-07, AC-08).',
  })
  @ApiNotFoundResponse({description: 'PROGRAM_NOT_FOUND: the treasury never announced it (AC-04).'})
  @ApiConflictResponse({
    description: 'RESERVATION_ALREADY_EXISTS: the existing reservation is in the body (AC-05).',
  })
  @ApiUnprocessableEntityResponse({
    description: 'CAPACITY_EXCEEDED with available in minor units (AC-03, AC-09).',
  })
  async reserve(
    @Param() {programId}: ProgramIdParams,
    @Body() body: ReserveRequestDto,
    @ClientId() clientId: string,
  ): Promise<ReservationDto> {
    const reservation = await this.reserveCapacity.execute({
      programId,
      invoiceId: body.invoiceId,
      invoiceAmount: BigInt(body.invoiceAmount),
      invoiceCurrency: body.invoiceCurrency,
      rate: body.rate === undefined ? null : Rate.parse(body.rate),
      clientId,
    });
    return toReservationDto(reservation);
  }

  @Post(':programId/reservations/:invoiceId/releases')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({type: ReservationDto, description: 'Capacity is given back (AC-10, AC-11).'})
  @ApiBadRequestResponse({description: 'VALIDATION_FAILED: details name each field.'})
  @ApiNotFoundResponse({
    description:
      'RESERVATION_NOT_FOUND when the program holds no reservation for that invoice (AC-14); PROGRAM_NOT_FOUND when the treasury never announced the program, as on reserve (AC-04).',
  })
  @ApiConflictResponse({
    description:
      'RESERVATION_ALREADY_RELEASED (AC-15); RELEASE_ALREADY_PROCESSED with the original outcome (AC-16).',
  })
  @ApiUnprocessableEntityResponse({
    description: 'RELEASE_EXCEEDS_HELD with held and remainingInvoiceAmount (AC-13).',
  })
  async release(
    @Param() {programId, invoiceId}: ReservationParams,
    @Body() body: ReleaseRequestDto,
    @ClientId() clientId: string,
  ): Promise<ReservationDto> {
    const reservation = await this.releaseCapacity.execute({
      programId,
      invoiceId,
      releaseId: body.releaseId,
      amount: body.amount === undefined ? null : BigInt(body.amount),
      reason: body.reason ?? 'repaid',
      clientId,
    });
    return toReservationDto(reservation);
  }

  @Get(':programId/reservations/:invoiceId')
  @ApiOkResponse({
    type: ReservationWithMovementsDto,
    description: 'The reservation and the movements that explain it (AC-19).',
  })
  @ApiNotFoundResponse({
    description:
      'RESERVATION_NOT_FOUND when the program holds no reservation for that invoice; PROGRAM_NOT_FOUND when the treasury never announced the program, the same pair the release route answers.',
  })
  async readReservation(
    @Param() {programId, invoiceId}: ReservationParams,
  ): Promise<ReservationWithMovementsDto> {
    const {reservation, movements} = await this.getReservation.execute(programId, invoiceId);
    return toReservationWithMovementsDto(reservation, movements);
  }
}
