  import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionLog } from './entities/production-log.entity';
import { OeeController } from './oee.controller';
import { OeeService } from './oee.service';

/**
 * ============================================================================
 * ROOT MODULE NESTJS (AppModule)
 * ============================================================================
 * Jembatan Logika Laravel:
 * File `app.module.ts` ini persis dengan gabungan dari:
 * - `app/Providers/AppServiceProvider.php` (Tempat mendaftarkan Service & Dependency Injection)
 * - `config/database.php` (Konfigurasi koneksi MySQL di `TypeOrmModule.forRoot(...)`)
 * ============================================================================
 */
@Module({
  imports: [
    // Konfigurasi Koneksi MySQL (Sama dengan database `smartfactory_db` yang dipakai Golang)
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3307', 10),
      username: process.env.DB_USER || 'factory_user',
      password: process.env.DB_PASSWORD || 'factory_password',
      database: process.env.DB_NAME || 'smartfactory_db',
      entities: [ProductionLog],
      // `synchronize: true` otomatis membuat/mengupdate tabel `production_logs` di MySQL
      // (Sama seperti `DB.AutoMigrate` yang tadi kita pakai di Golang GORM!)
      synchronize: true,
    }),

    // Mendaftarkan Repository `ProductionLog` agar bisa di-inject ke `OeeService`
    TypeOrmModule.forFeature([ProductionLog]),
  ],
  controllers: [OeeController],
  providers: [OeeService],
})
export class AppModule {}
