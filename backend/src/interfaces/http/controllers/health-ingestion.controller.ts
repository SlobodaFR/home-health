import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { IngestHealthDataUseCase } from '../../../application/ingestion/ingest-health-data.use-case';
import { isJsonObject } from '../../../application/ingestion/json-object';
import { ApiKeyUser } from '../decorators/api-key-user.decorator';
import { Public } from '../decorators/public.decorator';
import { AutoExportPayloadDto } from '../dto/ingest-health-data.dto';
import { ApiKeyGuard } from '../guards/api-key.guard';

@ApiTags('ingestion')
@Public()
@UseGuards(ApiKeyGuard)
@Controller('health')
export class HealthIngestionController {
  constructor(private readonly ingestHealthData: IngestHealthDataUseCase) {}

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
  async ingest(
    @ApiKeyUser() userId: string,
    @Body() _dto: AutoExportPayloadDto,
    @Req() request: Request,
    @Headers('automation-id') automationId?: string,
    @Headers('automation-name') automationName?: string,
    @Headers('session-id') sessionId?: string,
  ): Promise<{ received: string[] }> {
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

    return { received: dataTypes };
  }
}
