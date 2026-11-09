import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';

/**
 * ============================================================================
 * TITIK MASUK SERVER NESTJS (Port 8082)
 * ============================================================================
 * Jembatan Logika Laravel:
 * Fungsi `bootstrap()` ini sepadan dengan `public/index.php` + `bootstrap/app.php`
 * di Laravel.
 * ============================================================================
 */
async function bootstrap() {
  // Pastikan folder "./uploads" tersedia untuk menampung Multiple File Upload foto bukti reject
  const uploadDir = join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Aktifkan CORS agar Frontend Angular (Port 4200) diizinkan menembak API ini
  app.enableCors();

  // Sajikan folder "./uploads" secara statis (Sepadan dengan `php artisan storage:link`)
  // Sehingga foto bukti kerusakan mesin bisa dibuka di "http://localhost:8082/uploads/namafile.jpg"
  app.useStaticAssets(uploadDir, {
    prefix: '/uploads/',
  });

  const port = process.env.PORT || 8082;
  await app.listen(port);
  console.log(`⚙️ [OEE Service] Mesin Hitung OEE NestJS menyala di http://localhost:${port}`);
}

bootstrap();
