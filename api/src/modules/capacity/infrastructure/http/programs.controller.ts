import {Controller, Get, Param} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {GetAvailability} from '../../application/get-availability.query';
import {AvailabilityDto, ProgramIdParams} from './availability.dto';
import {toAvailabilityDto} from './availability.mapper';

@ApiTags('programs')
@ApiBearerAuth()
@Controller('programs')
export class ProgramsController {
  constructor(private readonly getAvailability: GetAvailability) {}

  @Get(':programId/availability')
  @ApiOkResponse({type: AvailabilityDto, description: 'The program as the ledger knows it now.'})
  @ApiNotFoundResponse({description: 'PROGRAM_NOT_FOUND: the treasury never announced it.'})
  @ApiUnauthorizedResponse({description: 'No valid bearer token (AC-32, AC-33).'})
  async availability(@Param() {programId}: ProgramIdParams): Promise<AvailabilityDto> {
    return toAvailabilityDto(await this.getAvailability.execute(programId));
  }
}
