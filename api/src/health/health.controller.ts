import {Controller, Get, HttpStatus, Res} from '@nestjs/common';
import {ApiOkResponse, ApiServiceUnavailableResponse, ApiTags} from '@nestjs/swagger';
import type {Response} from 'express';
import {Public} from '../common/auth/public.decorator';
import {LivenessDto, ReadinessDto} from './health.dto';
import {ReadinessService} from './readiness.service';

// A-16: health answers without a token and carries no business data.
@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get()
  @ApiOkResponse({type: LivenessDto, description: 'The process answers. No token needed (A-16).'})
  liveness(): LivenessDto {
    return {status: 'ok'};
  }

  @Get('ready')
  @ApiOkResponse({type: ReadinessDto, description: 'The database and the broker both answer.'})
  @ApiServiceUnavailableResponse({
    type: ReadinessDto,
    description: 'At least one dependency does not answer yet.',
  })
  async readinessCheck(@Res({passthrough: true}) response: Response): Promise<ReadinessDto> {
    const readiness = await this.readiness.check();
    response.status(readiness.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return readiness;
  }
}
