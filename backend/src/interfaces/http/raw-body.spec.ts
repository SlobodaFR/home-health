import type { ServerResponse } from 'http';
import { captureWebhookRawBody, RawBodyRequest } from './raw-body';

describe('captureWebhookRawBody', () => {
  const capture = (url: string, body: string): RawBodyRequest => {
    const req = { url } as RawBodyRequest;
    captureWebhookRawBody(req, {} as ServerResponse, Buffer.from(body));
    return req;
  };

  it.each([
    '/api/auth/disconnect',
    '/api/auth/disconnect?secret=abc',
    '/api/auth/disconnect/',
    '/API/Auth/Disconnect',
  ])('keeps the exact bytes for %s', (url) => {
    expect(capture(url, '{ "userId" : "é" }').rawBody?.toString('utf8')).toBe(
      '{ "userId" : "é" }',
    );
  });

  it.each([
    '/api/health/key/ingest',
    '/api/auth/login',
    '/api/auth/disconnectx',
  ])('keeps nothing for %s', (url) => {
    expect(capture(url, '{}').rawBody).toBeUndefined();
  });

  it('keeps a copy, not the parser buffer', () => {
    const source = Buffer.from('{"userId":"u1"}');
    const req = { url: '/api/auth/disconnect' } as RawBodyRequest;
    captureWebhookRawBody(req, {} as ServerResponse, source);
    source.fill(0);
    expect(req.rawBody?.toString()).toBe('{"userId":"u1"}');
  });
});
