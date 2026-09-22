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
import {ReserveCapacity} from '../../application/reserve-capacity.use-case';
import {Rate} from '../../domain/rate';
import {AvailabilityDto, ProgramIdParams} from './availability.dto';
import {toAvailabilityDto} from './availability.mapper';
import {ReservationDto, ReserveRequestDto} from './reservation.dto';
import {toReservationDto} from './reservation.mapper';

@ApiTags('programs')
@ApiBearerAuth()
@ApiUnauthorizedResponse({description: 'No valid bearer token (AC-32, AC-33).'})
@Controller('programs')
export class ProgramsController {
  constructor(
    private readonly getAvailability: GetAvailability,
    private readonly reserveCapacity: ReserveCapacity,
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
}
