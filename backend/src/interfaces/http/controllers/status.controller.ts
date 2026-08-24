import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../decorators/public.decorator';

@ApiTags('status')
@Controller('health/status')
export class StatusController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness check, no authentication required.' })
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
