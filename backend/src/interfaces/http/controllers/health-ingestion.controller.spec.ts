import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { IngestHealthDataUseCase } from '../../../application/ingestion/ingest-health-data.use-case';
import { pseudonymize } from '../../../domain/shared/pseudonymize';
import { HealthIngestionController } from './health-ingestion.controller';

const SECRET = 's'.repeat(48);
const API_KEY = 'hk_0123456789abcdef0123456789abcdef';

describe('HealthIngestionController logging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the user as a pseudonym only: no user id, no API key', async () => {
    const lines: string[] = [];
    vi.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      lines.push(String(message));
    });
    const controller = new HealthIngestionController(
      {
        execute: vi
          .fn<IngestHealthDataUseCase['execute']>()
          .mockResolvedValue({ dataTypes: ['metrics'] }),
      } as unknown as IngestHealthDataUseCase,
      new ConfigService({ PSEUDONYM_SECRET: SECRET }),
    );

    const response = await controller.ingest(
      'user-id-1234',
      {} as never,
      {
        body: { data: {} },
        params: { apiKey: API_KEY },
        originalUrl: `/api/health/${API_KEY}`,
      } as unknown as Request,
    );

    expect(response).toEqual({ received: ['metrics'] });
    const output = lines.join('\n');
    expect(output).toContain(pseudonymize('user-id-1234', SECRET));
    expect(output).not.toContain('user-id-1234');
    // The request carries the key (params, URL): none of it may reach the log line.
    expect(output).not.toContain(API_KEY);
    expect(output.length).toBeGreaterThan(0);
  });
});
