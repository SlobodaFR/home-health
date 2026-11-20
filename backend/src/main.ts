import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { AppModule } from './app.module';
import { setupSwagger } from './interfaces/http/swagger';

// Auto Export payloads can carry GPS routes for long workouts - the default
// body-parser limit (100kb) is far too small. Configurable so a real device
// export that exceeds it can be diagnosed and raised without a code change.
const MAX_PAYLOAD_SIZE = process.env.MAX_PAYLOAD_SIZE
  ? Number(process.env.MAX_PAYLOAD_SIZE)
  : 50 * 1024 * 1024;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // Consistent with the rest of the home-* apps: everything lives under
  // /api/**, except health/status (liveness probes expect a stable,
  // unversioned path) and openapi.json (mounted directly by SwaggerModule,
  // outside production only, unaffected by this prefix either way).
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health/status', method: RequestMethod.GET }],
  });
  app.use(json({ limit: MAX_PAYLOAD_SIZE }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? true,
    credentials: true,
  });

  setupSwagger(app, process.env.NODE_ENV, process.env.PUBLIC_BASE_URL);

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

void bootstrap();
