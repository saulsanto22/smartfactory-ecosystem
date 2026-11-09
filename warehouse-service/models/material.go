package models

import "time"

/**
 * ============================================================================
 * MODEL & SKEMA DATABASE: MATERIAL (GUDANG)
 * ============================================================================
 * Jembatan Logika Laravel (PENTING!):
 * Di Laravel, untuk membuat tabel `materials`, Anda harus membuat 2 file:
 *   1. Migration (`Schema::create('materials', ...)`) -> mengatur kolom MySQL.
 *   2. Eloquent Model (`class Material extends Model`) -> mengatur `$fillable` & JSON.
 *
 * Di Golang (dengan ORM bernama GORM), KEDUANYA DIGABUNG menjadi 1 `struct`!
 * Cukup tulis `type Material struct` di bawah ini, lalu panggil `db.AutoMigrate(&Material{})`,
 * maka GORM otomatis membuatkan tabel `materials` di MySQL untuk Anda.
 * ============================================================================
 */
type Material struct {
	// Huruf depan field WAJIB Kapital (ID, SKU, Name) agar bersifat `public`
	// (di Go disebut Exported). Jika huruf kecil (`name`), maka bersifat `private`
	// dan tidak bisa dibaca oleh GORM maupun pengubah JSON!

	ID uint `json:"id" gorm:"primaryKey;autoIncrement"`

	// gorm:"uniqueIndex;size:50;not null" -> sama seperti $table->string('sku', 50)->unique() di Laravel Migration
	// json:"sku" -> nama key saat diubah menjadi response JSON ke Frontend Angular
	SKU string `json:"sku" gorm:"uniqueIndex;size:50;not null"`

	Name string `json:"name" gorm:"size:150;not null"`

	// Stok saat ini di gudang
	Stock int `json:"stock" gorm:"not null;default:0"`

	// Ambang batas aman minimum (Safety Stock).
	// Jika Stock < MinStock, maka alarm otomatis ditembak ke Express.js (Port 8083)
	MinStock int `json:"min_stock" gorm:"not null;default:10"`

	// Satuan barang: "Kg", "Pcs", "Lembar", "Roll"
	Unit string `json:"unit" gorm:"size:30;not null"`

	// [STUDI KASUS SINGLE FILE UPLOAD]
	// Menyimpan path/URL foto fisik barang atau scan Surat Jalan (Delivery Order)
	// Contoh isi: "/uploads/1731123000-plat-besi.jpg" (boleh kosong jika belum ada foto)
	ImagePath string `json:"image_path" gorm:"size:255"`

	// Status otomatis untuk memudahkan Frontend ("SAFE" atau "CRITICAL")
	Status string `json:"status" gorm:"size:20;default:'SAFE'"`

	// Sepadan dengan $table->timestamps() (created_at & updated_at) di Laravel
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

/**
 * ============================================================================
 * DTO / REQUEST PAYLOAD UNTUK MUTASI STOK (SCAN BARCODE IN / OUT)
 * ============================================================================
 * Jembatan Logika Laravel:
 * Ini sepadan dengan class `FormRequest` di Laravel (`php artisan make:request MutateMaterialRequest`).
 * Tag `binding:"required"` adalah validator bawaan Gin Framework:
 * - `binding:"required,oneof=IN OUT"` -> sama dengan `'type' => 'required|in:IN,OUT'` di Laravel
 * - `binding:"required,gt=0"`         -> sama dengan `'quantity' => 'required| integer|min:1'` di Laravel
 * ============================================================================
 */
type MutationRequest struct {
	SKU      string `json:"sku" binding:"required"`
	Type     string `json:"type" binding:"required,oneof=IN OUT"`
	Quantity int    `json:"quantity" binding:"required,gt=0"`
}
