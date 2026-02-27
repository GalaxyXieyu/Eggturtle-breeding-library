import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'node:path';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  if (process.env.NODE_ENV === 'development') {
    const devOrigins = (process.env.WEB_DEV_ORIGIN ?? 'http://localhost:30010,http://localhost:30020')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    app.enableCors({
      origin: devOrigins.length === 1 ? devOrigins[0] : devOrigins
    });
  }

  if (process.env.UPLOAD_PUBLIC_ENABLED === 'true') {
    const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? '.data/uploads');
    const uploadPublicBaseUrl = process.env.UPLOAD_PUBLIC_BASE_URL ?? '/uploads';
    app.useStaticAssets(uploadDir, {
      prefix: uploadPublicBaseUrl
    });
  }

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 30011);
}

void bootstrap();
