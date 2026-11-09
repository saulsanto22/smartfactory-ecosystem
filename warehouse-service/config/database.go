package config

import (
	"fmt"
	"log"
	"os"
	"warehouse-service/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

/**
 * ============================================================================
 * KONFIGURASI KONEKSI DATABASE MYSQL (GORM)
 * ============================================================================
 * Jembatan Logika Laravel:
 * File ini adalah gabungan dari:
 * 1. `config/database.php` (pengaturan host, port, user, password MySQL)
 * 2. `php artisan migrate` (`DB.AutoMigrate`)
 * 3. `php artisan db:seed` (`seedInitialMaterials`)
 *
 * KONSEP PENTING GOLANG: POINTER (`*` dan `&`)
 * Perhatikan tipe `var DB *gorm.DB` (ada tanda bintang `*`):
 * - Di PHP: Saat kita oper objek atau memakai `&$db` (Pass by Reference), kita
 *   mengoper ALAMAT MEMORI yang sama, bukan meng-copy objeknya berkali-kali.
 * - Di Golang: Secara default, Go SELALU meng-copy variabel jika tidak diberi
 *   tanda Pointer!
 *   - Tanda `*` (Pointer Type): Menyatakan variabel ini menyimpan alamat memori
 *     koneksi database yang sama (1 Connection Pool dipakai ramai-ramai).
 *   - Tanda `&` (Address-Of): Mengambil alamat memori variabel (persis seperti
 *     `&$material` di PHP).
 * ============================================================================
 */
var DB *gorm.DB

// Fungsi helper untuk membaca Environment Variable dengan nilai default
// (Persis seperti fungsi `env('DB_HOST', '127.0.0.1')` di Laravel!)
func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists && value != "" {
		return value
	}
	return fallback
}

func ConnectDatabase() {
	// Default diarahkan ke container MySQL kita di localhost:3307 (jika jalan di host)
	// Nanti di dalam Docker Compose, DB_HOST akan otomatis diisi "mysql-db" dan DB_PORT "3306"
	dbHost := getEnv("DB_HOST", "127.0.0.1")
	dbPort := getEnv("DB_PORT", "3307")
	dbUser := getEnv("DB_USER", "factory_user")
	dbPass := getEnv("DB_PASSWORD", "factory_password")
	dbName := getEnv("DB_NAME", "smartfactory_db")

	// Format DSN (Data Source Name) MySQL di Golang
	// parseTime=True wajib ada agar kolom DATETIME MySQL otomatis jadi `time.Time` di Go
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		dbUser, dbPass, dbHost, dbPort, dbName,
	)

	database, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("❌ [Warehouse DB] Gagal terhubung ke MySQL (%s:%s): %v", dbHost, dbPort, err)
	}

	// 1. AUTO MIGRATE (Sepadan dengan `php artisan migrate`)
	// Perhatikan tanda `&models.Material{}` -> kita kirim alamat memori struct-nya
	err = database.AutoMigrate(&models.Material{})
	if err != nil {
		log.Fatalf("❌ [Warehouse DB] Gagal menjalankan AutoMigrate: %v", err)
	}

	DB = database
	log.Println("✅ [Warehouse DB] Terhubung ke MySQL & Tabel `materials` siap!")

	// 2. JALANKAN SEEDER AWAL (Sepadan dengan `php artisan db:seed`)
	seedInitialMaterials()
}

func seedInitialMaterials() {
	var count int64
	// Sepadan dengan `Material::count()` di Eloquent Laravel.
	// Kenapa pakai `&count`? Agar GORM bisa mengisi hasil angkanya langsung ke alamat memori variabel `count`.
	DB.Model(&models.Material{}).Count(&count)

	if count > 0 {
		return // Jika tabel sudah ada isinya, lewati seeder
	}

	initialItems := []models.Material{
		{
			SKU:      "PLT-001",
			Name:     "Plat Baja Karbon 2mm",
			Stock:    50,
			MinStock: 20,
			Unit:     "Lembar",
			Status:   "SAFE",
		},
		{
			SKU:      "RES-002",
			Name:     "Bijih Plastik PET Grade-A",
			Stock:    15,
			MinStock: 30,
			Unit:     "Kg",
			Status:   "CRITICAL",
		},
		{
			SKU:      "BOX-003",
			Name:     "Kardus Kemasan Master",
			Stock:    200,
			MinStock: 50,
			Unit:     "Pcs",
			Status:   "SAFE",
		},
	}

	// Sepadan dengan `Material::insert($initialItems)` di Laravel
	DB.Create(&initialItems)
	log.Println("🌱 [Warehouse Seeder] 3 data bahan baku awal berhasil dimasukkan!")
}
