import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * ============================================================================
 * ENTITY & SKEMA TABEL: PRODUCTION LOG (LAPORAN OEE MESIN)
 * ============================================================================
 * Jembatan Logika Laravel:
 * Di NestJS (TypeORM), class dengan decorator `@Entity('production_logs')` ini
 * adalah gabungan dari:
 * 1. Eloquent Model (`app/Models/ProductionLog.php`)
 * 2. Database Migration (`create_production_logs_table.php`)
 *
 * Saat opsi `synchronize: true` diaktifkan pada TypeORM, tabel `production_logs`
 * akan otomatis dibuat di MySQL sesuai daftar `@Column()` di bawah ini!
 * ============================================================================
 */
@Entity('production_logs')
export class ProductionLog {
  // Sepadan dengan `$table->id()` di Laravel Migration
  @PrimaryGeneratedColumn()
  id: number;

  // Kode Mesin Pabrik (contoh: "CNC-01", "PRESS-02", "INJECT-03")
  @Column({ type: 'varchar', length: 50 })
  machine_code: string;

  // Waktu rencana mesin bekerja dalam 1 shift (menit), misal: 480 menit (8 jam)
  @Column({ type: 'int' })
  planned_time_minutes: number;

  // Waktu mesin mati/mogok/rusak (menit), misal: 60 menit
  @Column({ type: 'int', default: 0 })
  downtime_minutes: number;

  // Waktu siklus ideal untuk memproduksi 1 unit barang (detik/unit), misal: 15 detik
  @Column({ type: 'float', default: 10 })
  ideal_cycle_time_seconds: number;

  // Total seluruh barang yang keluar dari mesin (termasuk yang bagus + yang cacat)
  @Column({ type: 'int' })
  total_output: number;

  // Jumlah barang cacat / penyok / gagal (Reject / Scrap)
  @Column({ type: 'int', default: 0 })
  defect_output: number;

  // --------------------------------------------------------------------------
  // HASIL PERHITUNGAN RUMUS OEE OTOMATIS (0% - 100%)
  // Rumus: OEE = Availability (%) x Performance (%) x Quality (%)
  // --------------------------------------------------------------------------
  @Column({ type: 'float' })
  availability_rate: number;

  @Column({ type: 'float' })
  performance_rate: number;

  @Column({ type: 'float' })
  quality_rate: number;

  @Column({ type: 'float' })
  oee_score: number;

  // Kategori Standar Industri:
  // - "WORLD_CLASS" (OEE >= 85% -> Hijau)
  // - "ACCEPTABLE"  (OEE 65% - 84.9% -> Kuning)
  // - "CRITICAL"    (OEE < 65% -> Merah & Tembak Alarm ke Express.js!)
  @Column({ type: 'varchar', length: 30, default: 'ACCEPTABLE' })
  status: string;

  // --------------------------------------------------------------------------
  // [STUDI KASUS MULTIPLE FILE UPLOAD]
  // Menyimpan array berisi daftar URL foto bukti kerusakan mesin / sampel barang cacat
  // Jembatan Laravel:
  // Tipe `simple-json` di TypeORM ini persis dengan `$casts = ['evidence_photos' => 'array']`
  // di Eloquent Laravel! Di MySQL disimpan sebagai teks JSON, tapi saat diambil
  // di TypeScript otomatis berbentuk Array `string[]`.
  // --------------------------------------------------------------------------
  @Column({ type: 'simple-json', nullable: true })
  evidence_photos: string[];

  // Sepadan dengan `$table->timestamp('created_at')->useCurrent()` di Laravel
  @CreateDateColumn()
  created_at: Date;
}
