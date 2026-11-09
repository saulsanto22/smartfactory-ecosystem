import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { ProductionLog } from './entities/production-log.entity';

/**
 * ============================================================================
 * SERVICE LAYER: OEE CALCULATION, AUTO-WEBHOOK, & PDF STREAM
 * ============================================================================
 * Jembatan Logika Laravel:
 * - Decorator `@Injectable()` menandakan class ini bisa dimasukkan ke Controller
 *   lewat Dependency Injection (persis seperti `OeeService` di Service Container Laravel).
 * - `@InjectRepository(ProductionLog)` adalah cara TypeORM menyediakan fungsi
 *   Eloquent (`find`, `save`, `count`) ke dalam variabel `this.oeeRepo`.
 * ============================================================================
 */
@Injectable()
export class OeeService implements OnModuleInit {
  constructor(
    @InjectRepository(ProductionLog)
    private readonly oeeRepo: Repository<ProductionLog>,
  ) {}

  // --------------------------------------------------------------------------
  // 1. AUTO-SEEDER SAAT APLIKASI MENYALA (Sepadan dengan DatabaseSeeder.php)
  // --------------------------------------------------------------------------
  async onModuleInit() {
    try {
      const count = await this.oeeRepo.count();
      if (count > 0) return;

      const sampleLogs: Partial<ProductionLog>[] = [
        {
          machine_code: 'CNC-MILL-01',
          planned_time_minutes: 480,
          downtime_minutes: 15,
          ideal_cycle_time_seconds: 30,
          total_output: 890,
          defect_output: 12,
          availability_rate: 96.88,
          performance_rate: 95.7,
          quality_rate: 98.65,
          oee_score: 91.46,
          status: 'WORLD_CLASS',
          evidence_photos: [],
        },
        {
          machine_code: 'PRESS-HYD-02',
          planned_time_minutes: 480,
          downtime_minutes: 95,
          ideal_cycle_time_seconds: 20,
          total_output: 850,
          defect_output: 140,
          availability_rate: 80.21,
          performance_rate: 73.59,
          quality_rate: 83.53,
          oee_score: 49.31,
          status: 'CRITICAL',
          evidence_photos: [],
        },
      ];

      await this.oeeRepo.save(sampleLogs);
      console.log('🌱 [OEE Seeder] 2 data sampel mesin awal berhasil dimasukkan!');
    } catch (err) {
      console.warn('⚠️ [OEE Seeder] Melewati seeder awal:', err.message);
    }
  }

  // --------------------------------------------------------------------------
  // 2. [FEAT-3.2] AMBIL RIWAYAT SKOR OEE (Sepadan dengan `ProductionLog::orderBy('id', 'desc')->get()`)
  // --------------------------------------------------------------------------
  async findAll(): Promise<ProductionLog[]> {
    return this.oeeRepo.find({
      order: { id: 'DESC' },
    });
  }

  // --------------------------------------------------------------------------
  // 3. [FEAT-3.1] HITUNG RUMUS OEE & SIMPAN KE MYSQL
  // Rumus Standar Pabrik:
  //   - Operating Time = Planned Time - Downtime
  //   - Availability   = (Operating Time / Planned Time) * 100
  //   - Performance    = ((Total Output * (Ideal Cycle Time / 60)) / Operating Time) * 100
  //   - Quality        = ((Total Output - Defect Output) / Total Output) * 100
  //   - OEE Score      = (Availability/100) * (Performance/100) * (Quality/100) * 100
  // --------------------------------------------------------------------------
  async calculateAndSave(
    body: Record<string, any>,
    photoUrls: string[],
  ): Promise<ProductionLog> {
    const machineCode = String(body.machine_code || '').trim().toUpperCase();
    const plannedTime = Number(body.planned_time_minutes || 0);
    const downtime = Number(body.downtime_minutes || 0);
    const idealCycleSeconds = Number(body.ideal_cycle_time_seconds || 10);
    const totalOutput = Number(body.total_output || 0);
    const defectOutput = Number(body.defect_output || 0);

    // Validasi Bisnis Pabrik (Sepadan dengan FormRequest Validation di Laravel)
    if (!machineCode || plannedTime <= 0 || totalOutput <= 0) {
      throw new BadRequestException(
        'machine_code, planned_time_minutes (> 0), dan total_output (> 0) wajib diisi!',
      );
    }
    if (downtime >= plannedTime) {
      throw new BadRequestException(
        'Waktu macet (downtime_minutes) tidak boleh melebihi atau sama dengan waktu rencana kerja!',
      );
    }
    if (defectOutput > totalOutput) {
      throw new BadRequestException(
        'Jumlah barang cacat (defect_output) tidak mungkin melebihi total_output!',
      );
    }

    // 1. Hitung Availability Rate (%)
    const operatingTime = plannedTime - downtime;
    const availability = Number(((operatingTime / plannedTime) * 100).toFixed(2));

    // 2. Hitung Performance Rate (%) — dibatasi maksimal 100%
    const idealRunTimeMinutes = (totalOutput * idealCycleSeconds) / 60;
    const rawPerformance = (idealRunTimeMinutes / operatingTime) * 100;
    const performance = Number(Math.min(100, rawPerformance).toFixed(2));

    // 3. Hitung Quality Rate (%)
    const goodOutput = totalOutput - defectOutput;
    const quality = Number(((goodOutput / totalOutput) * 100).toFixed(2));

    // 4. Hitung Skor Akhir OEE (%)
    const oeeScore = Number(
      ((availability / 100) * (performance / 100) * (quality / 100) * 100).toFixed(2),
    );

    // 5. Tentukan Kategori Standar Industri Pabrik
    let status = 'ACCEPTABLE';
    if (oeeScore >= 85) {
      status = 'WORLD_CLASS';
    } else if (oeeScore < 65) {
      status = 'CRITICAL';
    }

    // 6. Simpan ke MySQL (Sepadan dengan `ProductionLog::create([...])` di Laravel)
    const newLog = this.oeeRepo.create({
      machine_code: machineCode,
      planned_time_minutes: plannedTime,
      downtime_minutes: downtime,
      ideal_cycle_time_seconds: idealCycleSeconds,
      total_output: totalOutput,
      defect_output: defectOutput,
      availability_rate: availability,
      performance_rate: performance,
      quality_rate: quality,
      oee_score: oeeScore,
      status,
      evidence_photos: photoUrls,
    });

    const savedLog = await this.oeeRepo.save(newLog);

    // 7. [FEAT-3.3] AUTO-WEBHOOK KE EXPRESS.JS (Port 8083)
    // Jika Skor OEE < 65% atau Mesin Mogok > 30 menit, tembak alarm di latar belakang!
    if (oeeScore < 65 || downtime > 30) {
      this.triggerLowOeeIncident(savedLog);
    }

    return savedLog;
  }

  // --------------------------------------------------------------------------
  // 4. [FEAT-3.3] FUNGSI PENEMBAK ALARM OTOMATIS KE EXPRESS.JS (Port 8083)
  // Jembatan Laravel: Sepadan dengan `Http::post('http://localhost:8083/api/incidents', ...)`
  // --------------------------------------------------------------------------
  private async triggerLowOeeIncident(log: ProductionLog): Promise<void> {
    const gatewayUrl =
      process.env.INCIDENT_GATEWAY_URL || 'http://localhost:8083/api/incidents';

    const payload = {
      source: 'PRODUCTION',
      severity: log.oee_score < 65 ? 'CRITICAL' : 'WARNING',
      message: `Efisiensi Mesin ${log.machine_code} di bawah standar! Skor OEE: ${log.oee_score}% (Downtime: ${log.downtime_minutes} mnt, Reject: ${log.defect_output} unit).`,
    };

    try {
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log(
        `🚨 [Webhook Produksi] Alarm mesin '${log.machine_code}' ditembakkan ke Express.js (Status: ${response.status})`,
      );
    } catch (err) {
      console.warn(
        `⚠️ [Webhook Produksi] Gagal menghubungi Incident Gateway (${gatewayUrl}):`,
        err.message,
      );
    }
  }

  // --------------------------------------------------------------------------
  // 5. [FEAT-3.4] GENERATE PDF RAPOR AUDIT OEE (PDFKit Stream)
  // Jembatan Logika Laravel (`dompdf` vs Node.js `PDFKit Stream`):
  // Di NestJS, kita menggunakan `doc.pipe(res)` yang mengalirkan (streaming)
  // potongan byte PDF langsung ke browser saat dokumen sedang digambar!
  // --------------------------------------------------------------------------
  async generateOeeReportPdf(res: Response): Promise<void> {
    const logs = await this.findAll();

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const fileName = `laporan-audit-oee-${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    // Alirkan output PDF langsung ke HTTP Response Express/NestJS
    doc.pipe(res);

    // A. KOP SURAT PABRIK
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text('SMARTFACTORY ECOSYSTEM - PRODUCTION & OEE DIVISION', { align: 'center' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Rapor Audit Efisiensi Mesin Pabrik (Overall Equipment Effectiveness)', {
        align: 'center',
      });
    doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, { align: 'center' });
    doc.moveDown(1.5);

    // B. HEADER TABEL
    const tableTop = doc.y;
    const colX = [40, 70, 165, 240, 315, 385, 455];

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('No', colX[0], tableTop);
    doc.text('Kode Mesin', colX[1], tableTop);
    doc.text('Availability', colX[2], tableTop);
    doc.text('Performance', colX[3], tableTop);
    doc.text('Quality', colX[4], tableTop);
    doc.text('Skor OEE', colX[5], tableTop);
    doc.text('Status', colX[6], tableTop);

    doc
      .moveTo(40, tableTop + 14)
      .lineTo(555, tableTop + 14)
      .stroke();

    // C. ISI BARIS TABEL
    let currentY = tableTop + 22;
    doc.font('Helvetica').fontSize(9);

    logs.forEach((item, index) => {
      if (currentY > 740) {
        doc.addPage();
        currentY = 50;
      }

      doc.fillColor('#000000');
      doc.text(String(index + 1), colX[0], currentY);
      doc.text(item.machine_code, colX[1], currentY);
      doc.text(`${item.availability_rate}%`, colX[2], currentY);
      doc.text(`${item.performance_rate}%`, colX[3], currentY);
      doc.text(`${item.quality_rate}%`, colX[4], currentY);

      doc.font('Helvetica-Bold').text(`${item.oee_score}%`, colX[5], currentY);

      // Warna Status (Merah untuk CRITICAL, Hijau untuk WORLD_CLASS)
      if (item.status === 'CRITICAL') {
        doc.fillColor('#B91C1C');
      } else if (item.status === 'WORLD_CLASS') {
        doc.fillColor('#15803D');
      } else {
        doc.fillColor('#B45309');
      }
      doc.text(item.status, colX[6], currentY);
      doc.font('Helvetica').fillColor('#000000');

      currentY += 20;
    });

    // D. KOLOM OTORISASI MANAJER PRODUKSI
    doc.moveDown(3);
    doc.font('Helvetica').fontSize(10).text('Disetujui Oleh,', 380, currentY + 30, {
      width: 170,
      align: 'center',
    });
    doc.text('Kepala Divisi Produksi & Maintenance', 380, currentY + 45, {
      width: 170,
      align: 'center',
    });
    doc
      .font('Helvetica-Bold')
      .text('( Manajer Operasional Pabrik )', 380, currentY + 95, {
        width: 170,
        align: 'center',
      });

    doc.end();
  }
}
