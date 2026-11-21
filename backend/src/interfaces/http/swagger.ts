import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * API documentation on /docs and /openapi.json, outside production only: it maps the whole
 * attack surface. (home-remote-mcps calls the REST routes directly, it does not read the
 * OpenAPI document.)
 */
export function setupSwagger(
  app: INestApplication,
  nodeEnv: string | undefined,
  publicBaseUrl = 'http://localhost:3000',
): void {
  if (nodeEnv === 'production') {
    return;
  }
  const config = new DocumentBuilder()
    .setTitle('home-health')
    .setDescription(
      'Ingestion et exposition des donnees Apple Health (Health Auto Export) pour home-remote-mcps',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addServer(publicBaseUrl)
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config), {
    jsonDocumentUrl: '/openapi.json',
  });
}
