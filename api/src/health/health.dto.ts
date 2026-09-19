import {ApiProperty} from '@nestjs/swagger';

export type ProbeState = 'up' | 'down';

export class LivenessDto {
  @ApiProperty({example: 'ok', description: 'The process is running and able to answer.'})
  status!: 'ok';
}

export class ReadinessChecksDto {
  @ApiProperty({enum: ['up', 'down'], description: 'Whether the database answers a query.'})
  database!: ProbeState;

  @ApiProperty({enum: ['up', 'down'], description: 'Whether the Kafka broker answers.'})
  broker!: ProbeState;
}

export class ReadinessDto {
  @ApiProperty({
    enum: ['ok', 'degraded'],
    description: 'ok when every dependency answers, degraded otherwise.',
  })
  status!: 'ok' | 'degraded';

  @ApiProperty({type: ReadinessChecksDto})
  checks!: ReadinessChecksDto;
}
