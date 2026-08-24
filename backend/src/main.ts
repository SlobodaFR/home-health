import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { AppModule } from './app.module';

// Auto Export payloads can carry GPS routes for long workouts - the default
// body-parser limit (100kb) is far too small. Configurable so a real device
// export that exceeds it can be diagnosed and raised without a code change.
const MAX_PAYLOAD_SIZE = process.env.MAX_PAYLOAD_SIZE
  ? Number(process.env.MAX_PAYLOAD_SIZE)
  : 50 * 1024 * 1024;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: MAX_PAYLOAD_SIZE }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('home-health')
    .setDescription(
      'Ingestion et exposition des donnees Apple Health (Health Auto Export) pour home-remote-mcps',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addServer(process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: '/openapi.json',
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

void bootstrap();
