import { StatusController } from './status.controller';

describe('StatusController', () => {
  it('reports ok', () => {
    const controller = new StatusController();
    expect(controller.check()).toEqual({ status: 'ok' });
  });
});
