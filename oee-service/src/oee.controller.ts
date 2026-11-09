import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Response } from 'express';
import { OeeService } from './oee.service';

/**
 * ============================================================================
 * CONTROLLER LAYER: OEE ENDPOINTS & MULTIPLE FILE UPLOAD
 * ============================================================================
 * Jembatan Logika Laravel:
 * - `@Controller('api')` sepadan dengan prefix route `/api` di `routes/api.php`.
 * - `constructor(private readonly oeeService: OeeService)` adalah Constructor
 *   Dependency Injection, persis dengan:
 *   `public function __construct(protected OeeService $oeeService) {}` di Laravel!
 *
 * STUDI KASUS MULTIPLE FILE UPLOAD DI NESTJS (`FilesInterceptor`):
 * - Di Laravel: Kita melakukan `foreach ($request->file('photos') as $photo)`.
 * - Di NestJS: Kita menempelkan Decorator `@UseInterceptors(FilesInterceptor('photos', 5, ...))`
 *   di atas fungsi Controller, lalu daftar file yang ter-upload langsung masuk
 *   ke variabel `@UploadedFiles() files: Array<Express.Multer.File>`.
 * ============================================================================
 */
@Controller('api')
export class OeeController {
  constructor(private readonly oeeService: OeeService) {}

  // 1. Endpoint Cek Kesehatan Server
  @Get('health')
  getHealth() {
    return {
      service: 'oee-service',
      status: 'UP',
    };
  }

  // 2. [FEAT-3.2] Lihat Riwayat Skor OEE Mesin (GET /api/oee)
  @Get('oee')
  async getAllOeeLogs() {
    const logs = await this.oeeService.findAll();
    return {
      success: true,
      total: logs.length,
      data: logs,
    };
  }

  // 3. [FEAT-3.1] Hitung OEE + Multiple File Upload (POST /api/oee/calculate)
  // Menerima maksimal 5 file foto sekaligus pada field "photos"
  @Post('oee/calculate')
  @UseInterceptors(
    FilesInterceptor('photos', 5, {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, callback) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
          const cleanExt = extname(file.originalname).toLowerCase();
          callback(null, `oee-${uniqueSuffix}${cleanExt}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // Maksimal 5 MB per file
      },
      fileFilter: (_req, file, callback) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
          return callback(
            new BadRequestException(
              'Hanya file foto (.jpg, .jpeg, .png, .webp) yang diperbolehkan untuk bukti kerusakan!',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async calculateOee(
    @Body() body: Record<string, any>,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    // Ubah daftar file yang berhasil di-upload menjadi array URL string
    // Contoh: ["/uploads/oee-1731145001.jpg", "/uploads/oee-1731145002.png"]
    const photoUrls = (files || []).map((file) => `/uploads/${file.filename}`);

    const result = await this.oeeService.calculateAndSave(body, photoUrls);

    return {
      success: true,
      message: `Perhitungan OEE Mesin ${result.machine_code} berhasil disimpan (Skor: ${result.oee_score}%)!`,
      data: result,
    };
  }

  // 4. [FEAT-3.4] Cetak PDF Rapor Audit OEE (GET /api/oee/export/pdf)
  @Get('oee/export/pdf')
  async exportOeePdf(@Res() res: Response) {
    return this.oeeService.generateOeeReportPdf(res);
  }
}
