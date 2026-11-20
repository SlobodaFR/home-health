import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { IngestHealthDataUseCase } from '../../../application/ingestion/ingest-health-data.use-case';
import { pseudonymize } from '../../../domain/shared/pseudonymize';
import { isJsonObject } from '../../../application/ingestion/json-object';
import { ApiKeyUser } from '../decorators/api-key-user.decorator';
import { Public } from '../decorators/public.decorator';
import { AutoExportPayloadDto } from '../dto/ingest-health-data.dto';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ingestionThrottle } from '../throttling';
import { IngestResponseDto } from '../presenters/ingest-response.dto';

@ApiTags('ingestion')
@Public()
@UseGuards(ApiKeyGuard)
@Controller('health')
export class HealthIngestionController {
  private readonly logger = new Logger(HealthIngestionController.name);

  constructor(
    private readonly ingestHealthData: IngestHealthDataUseCase,
    private readonly config: ConfigService,
  ) {}

  // Device pushes: larger budget than interactive routes (see throttling.ts).
  @Throttle(ingestionThrottle)
  @Post(':apiKey')
  @ApiParam({
    name: 'apiKey',
    description: 'Health Auto Export automation key (see POST /api-keys).',
  })
  @ApiOperation({
    summary:
      'Ingestion endpoint for the Health Auto Export REST API automation.',
    description:
      'Paste this URL, with your API key, as the "URL" field of a Health Auto Export REST API ' +
      'automation. Accepts the standard Auto Export payload shape: { "data": { "metrics"?: [...], ' +
      '"workouts"?: [...], ... } }. Idempotent - safe to retry or receive the same batch twice.',
  })
  @ApiCreatedResponse({ type: IngestResponseDto })
  @ApiNotFoundResponse({ description: 'Unknown or revoked API key.' })
  async ingest(
    @ApiKeyUser() userId: string,
    @Body() _dto: AutoExportPayloadDto,
    @Req() request: Request,
    @Headers('automation-id') automationId?: string,
    @Headers('automation-name') automationName?: string,
    @Headers('session-id') sessionId?: string,
  ): Promise<IngestResponseDto> {
    // Read the raw, untransformed body for extraction: the DTO above only
    // gates malformed envelopes (400s), it must not be the source of the
    // data we store - class-validator's whitelist would silently drop any
    // key it doesn't know about, and DESIGN.md §12 explicitly wants unknown
    // data types captured rather than discarded.
    const body: unknown = request.body;
    const data = isJsonObject(body) && isJsonObject(body.data) ? body.data : {};

    const { dataTypes } = await this.ingestHealthData.execute({
      userId,
      automationId: automationId ?? null,
      automationName: automationName ?? null,
      sessionId: sessionId ?? null,
      data,
    });

    // The user is only ever logged as a pseudonym (never the id, never the API key).
    const user = pseudonymize(
      userId,
      this.config.getOrThrow('PSEUDONYM_SECRET'),
    );
    this.logger.log(
      `Ingested ${dataTypes.length.toString()} data type(s) for user ${user}`,
    );

    return { received: dataTypes };
  }
}
