import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { GetWorkoutUseCase } from '../../../application/health-data/get-workout.use-case';
import { ListHealthMetricsUseCase } from '../../../application/health-data/list-health-metrics.use-case';
import { ListMinimalHealthRecordsUseCase } from '../../../application/health-data/list-minimal-health-records.use-case';
import { ListWorkoutsUseCase } from '../../../application/health-data/list-workouts.use-case';
import { ApiKeyUser } from '../decorators/api-key-user.decorator';
import { Public } from '../decorators/public.decorator';
import { DateRangeQueryDto } from '../dto/date-range-query.dto';
import { ListHealthMetricsQueryDto } from '../dto/list-health-metrics-query.dto';
import { ApiKeyGuard } from '../guards/api-key.guard';
import {
  HealthMetricDto,
  toHealthMetricDto,
} from '../presenters/health-metric.presenter';
import {
  MinimalHealthRecordDto,
  toMinimalHealthRecordDto,
} from '../presenters/minimal-health-record.presenter';
import { toWorkoutDto, WorkoutDto } from '../presenters/workout.presenter';

const UNDOCUMENTED_TYPE_NOTE =
  ' Payload format is not publicly documented by Auto Export, see DESIGN.md §12.';

@ApiTags('health-data')
@Public()
@UseGuards(ApiKeyGuard)
@ApiParam({ name: 'apiKey', description: 'API key issued via POST /api-keys.' })
@ApiNotFoundResponse({ description: 'Unknown or revoked API key.' })
@Controller('health/:apiKey')
export class HealthReadController {
  constructor(
    private readonly listHealthMetrics: ListHealthMetricsUseCase,
    private readonly listWorkouts: ListWorkoutsUseCase,
    private readonly getWorkout: GetWorkoutUseCase,
    private readonly listMinimalHealthRecords: ListMinimalHealthRecordsUseCase,
  ) {}

  @Get('metrics')
  @ApiOperation({
    summary:
      'List health metrics (step count, heart rate, ...), most recent first.',
  })
  @ApiOkResponse({ type: HealthMetricDto, isArray: true })
  async metrics(
    @ApiKeyUser() userId: string,
    @Query() query: ListHealthMetricsQueryDto,
  ): Promise<HealthMetricDto[]> {
    const metrics = await this.listHealthMetrics.execute(userId, query);
    return metrics.map(toHealthMetricDto);
  }

  @Get('metrics/:name')
  @ApiOperation({
    summary:
      'List data points for a single metric name (e.g. step_count), most recent first.',
  })
  @ApiOkResponse({ type: HealthMetricDto, isArray: true })
  async metricsByName(
    @ApiKeyUser() userId: string,
    @Param('name') name: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<HealthMetricDto[]> {
    const metrics = await this.listHealthMetrics.execute(userId, {
      from: query.from,
      to: query.to,
      limit: query.limit,
      name,
    });
    return metrics.map(toHealthMetricDto);
  }

  @Get('workouts')
  @ApiOperation({ summary: 'List workouts, most recent first.' })
  @ApiOkResponse({ type: WorkoutDto, isArray: true })
  async workouts(
    @ApiKeyUser() userId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<WorkoutDto[]> {
    const workouts = await this.listWorkouts.execute(userId, query);
    return workouts.map(toWorkoutDto);
  }

  @Get('workouts/:id')
  @ApiOperation({ summary: 'Get a single workout by id.' })
  @ApiOkResponse({ type: WorkoutDto })
  @ApiNotFoundResponse({
    description: 'Unknown API key, or no workout with this id for this user.',
  })
  async workout(
    @ApiKeyUser() userId: string,
    @Param('id') id: string,
  ): Promise<WorkoutDto> {
    const workout = await this.getWorkout.execute(userId, id);
    return toWorkoutDto(workout);
  }

  @Get('symptoms')
  @ApiOperation({
    summary:
      'List logged symptoms, most recent first.' + UNDOCUMENTED_TYPE_NOTE,
  })
  @ApiOkResponse({ type: MinimalHealthRecordDto, isArray: true })
  symptoms(
    @ApiKeyUser() userId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<MinimalHealthRecordDto[]> {
    return this.listByKind('symptoms', userId, query);
  }

  @Get('ecg')
  @ApiOperation({
    summary: 'List ECG readings, most recent first.' + UNDOCUMENTED_TYPE_NOTE,
  })
  @ApiOkResponse({ type: MinimalHealthRecordDto, isArray: true })
  ecg(
    @ApiKeyUser() userId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<MinimalHealthRecordDto[]> {
    return this.listByKind('ecg', userId, query);
  }

  @Get('heart-rate-notifications')
  @ApiOperation({
    summary:
      'List heart rate notifications (high/low/irregular alerts), most recent first.' +
      UNDOCUMENTED_TYPE_NOTE,
  })
  @ApiOkResponse({ type: MinimalHealthRecordDto, isArray: true })
  heartRateNotifications(
    @ApiKeyUser() userId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<MinimalHealthRecordDto[]> {
    return this.listByKind('heartRateNotifications', userId, query);
  }

  @Get('state-of-mind')
  @ApiOperation({
    summary:
      'List state of mind entries, most recent first.' + UNDOCUMENTED_TYPE_NOTE,
  })
  @ApiOkResponse({ type: MinimalHealthRecordDto, isArray: true })
  stateOfMind(
    @ApiKeyUser() userId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<MinimalHealthRecordDto[]> {
    return this.listByKind('stateOfMind', userId, query);
  }

  @Get('cycle-tracking')
  @ApiOperation({
    summary:
      'List cycle tracking entries, most recent first.' +
      UNDOCUMENTED_TYPE_NOTE,
  })
  @ApiOkResponse({ type: MinimalHealthRecordDto, isArray: true })
  cycleTracking(
    @ApiKeyUser() userId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<MinimalHealthRecordDto[]> {
    return this.listByKind('cycleTracking', userId, query);
  }

  @Get('medications')
  @ApiOperation({
    summary:
      'List logged medications, most recent first.' + UNDOCUMENTED_TYPE_NOTE,
  })
  @ApiOkResponse({ type: MinimalHealthRecordDto, isArray: true })
  medications(
    @ApiKeyUser() userId: string,
    @Query() query: DateRangeQueryDto,
  ): Promise<MinimalHealthRecordDto[]> {
    return this.listByKind('medications', userId, query);
  }

  private async listByKind(
    kind: Parameters<ListMinimalHealthRecordsUseCase['execute']>[0],
    userId: string,
    query: DateRangeQueryDto,
  ): Promise<MinimalHealthRecordDto[]> {
    const records = await this.listMinimalHealthRecords.execute(
      kind,
      userId,
      query,
    );
    return records.map(toMinimalHealthRecordDto);
  }
}
