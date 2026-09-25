import {randomUUID} from 'node:crypto';
import {Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post} from '@nestjs/common';
import {ApiAcceptedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags} from '@nestjs/swagger';
import {mintToken} from '../../../../common/auth/mint-token';
import {Public} from '../../../../common/auth/public.decorator';
import {APP_CONFIG, AppConfig} from '../../../../config/config.module';
import {CAPACITY_UPDATE_TYPE} from '../../application/apply-capacity-update.use-case';
import {ListProgramMovements} from '../../application/list-program-movements.query';
import {DevTreasuryProducer} from '../messaging/dev-treasury-producer';
import {ProgramIdParams} from './availability.dto';
import {
  DevTokenDto,
  DevTreasuryMessageDto,
  ProgramMovementsDto,
  PublishedTreasuryMessageDto,
} from './dev.dto';
import {toProgramMovementsDto} from './dev.mapper';

export const DEMO_CLIENT_ID = 'demo-web';
const EIGHT_HOURS_S = 8 * 3_600;

/**
 * The dev endpoints the demo page relies on (glossary: Dev endpoint, AC-38). Registered only
 * outside the production profile, by `AppModule.forProfile`, and answering without a token (A-16).
 */
@ApiTags('dev')
@Public()
@Controller('dev')
export class DevController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly listProgramMovements: ListProgramMovements,
    private readonly producer: DevTreasuryProducer,
  ) {}

  @Get('token')
  @ApiOkResponse({type: DevTokenDto, description: 'A token the business routes accept.'})
  async token(): Promise<DevTokenDto> {
    const token = await mintToken({
      ...this.config.jwt,
      subject: DEMO_CLIENT_ID,
      ttlSeconds: EIGHT_HOURS_S,
    });
    return {token};
  }

  @Get('programs/:programId/movements')
  @ApiOkResponse({type: ProgramMovementsDto, description: 'The live ledger of one program.'})
  @ApiNotFoundResponse({description: 'PROGRAM_NOT_FOUND: the treasury never announced it.'})
  async movements(@Param() {programId}: ProgramIdParams): Promise<ProgramMovementsDto> {
    return toProgramMovementsDto(await this.listProgramMovements.execute(programId));
  }

  @Post('treasury')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    type: PublishedTreasuryMessageDto,
    description: 'On the topic; the consumer decides what it does, asynchronously.',
  })
  async treasury(@Body() body: DevTreasuryMessageDto): Promise<PublishedTreasuryMessageDto> {
    const messageId = body.messageId ?? randomUUID();
    const {programId, currency} = body;
    const creditLimit = BigInt(body.creditLimit);
    const published = {
      type: body.type,
      messageId,
      programId,
      currency,
      creditLimit: body.creditLimit,
    };
    if (body.type === CAPACITY_UPDATE_TYPE) {
      const eventTime = instant(body.eventTime);
      await this.producer.publishCapacityUpdate({
        messageId,
        programId,
        currency,
        creditLimit,
        eventTime,
      });
      return {...published, eventTime: eventTime.toISOString(), asOf: null, activeReservations: []};
    }
    const asOf = instant(body.asOf);
    const activeReservations = body.activeReservations ?? [];
    await this.producer.publishSnapshot({
      messageId,
      programId,
      currency,
      creditLimit,
      asOf,
      activeReservations: activeReservations.map(({invoiceId, heldAmount}) => ({
        invoiceId,
        heldAmount: BigInt(heldAmount),
      })),
    });
    return {...published, eventTime: null, asOf: asOf.toISOString(), activeReservations};
  }
}

/** Absent means now, the moment a real treasury would stamp on a message it sends. */
const instant = (value: string | undefined): Date =>
  value === undefined ? new Date() : new Date(value);
