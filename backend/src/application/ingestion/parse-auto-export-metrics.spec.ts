import { parseAutoExportMetrics } from './parse-auto-export-metrics';

describe('parseAutoExportMetrics', () => {
  it('extracts one row per data point, using startDate when date is absent', () => {
    const metrics = parseAutoExportMetrics('user-1', [
      {
        name: 'heart_rate',
        units: 'count/min',
        data: [
          { date: '2026-01-01 08:00:00', Min: 55, Max: 90, Avg: 70 },
          {
            startDate: '2026-01-02 08:00:00',
            endDate: '2026-01-02 08:05:00',
            qty: 72,
          },
        ],
      },
    ]);

    expect(metrics).toHaveLength(2);
    expect(metrics[0]).toMatchObject({
      userId: 'user-1',
      name: 'heart_rate',
      units: 'count/min',
      date: '2026-01-01 08:00:00',
      source: '',
    });
    expect(metrics[1].date).toBe('2026-01-02 08:00:00');
  });

  it('defaults source to an empty string when Auto Export omits it', () => {
    const metrics = parseAutoExportMetrics('user-1', [
      {
        name: 'step_count',
        units: 'count',
        data: [{ date: '2026-01-01', qty: 1000, source: 'iPhone' }],
      },
    ]);

    expect(metrics[0].source).toBe('iPhone');
  });

  it('skips data points without a usable date and metric groups without a name', () => {
    const metrics = parseAutoExportMetrics('user-1', [
      { name: 'step_count', units: 'count', data: [{ qty: 1000 }] },
      { units: 'count', data: [{ date: '2026-01-01', qty: 1 }] },
      'not-an-object',
    ]);

    expect(metrics).toHaveLength(0);
  });
});
