package controllers

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"warehouse-service/config"
	"warehouse-service/models"

	"github.com/gin-gonic/gin"
)

/**
 * ============================================================================
 * 1. [FEAT-2.1] LIHAT DAFTAR STOK BARANG (GET /api/materials)
 * ============================================================================
 * Jembatan Logika Laravel:
 * Fungsi ini persis dengan `public function index(Request $c)` di MaterialController.php:
 *   $materials = Material::orderBy('id', 'desc')->get();
 *   return response()->json(['success' => true, 'data' => $materials], 200);
 *
 * Cara Paling Gampang Paham Tanda `&` (Pointer) di Sini:
 * 1. `var materials []models.Material` -> Kita siapkan "Kardus Kosong" bernama `materials`.
 * 2. `config.DB.Order("id desc").Find(&materials)` -> Tanda `&` artinya kita berikan
 *    Kardus Kosong ASLI itu ke GORM supaya GORM memasukkan barang-barang dari MySQL
 *    ke dalam kardus itu!
 * ============================================================================
 */
func GetMaterials(c *gin.Context) {
	// 1. Siapkan kardus (array/slice) kosong untuk menampung hasil query MySQL
	var materials []models.Material

	// 2. Query ke MySQL dan masukkan hasilnya ke dalam kardus `&materials`
	config.DB.Order("id desc").Find(&materials)

	// 3. Kembalikan response JSON (sepadan dengan `response()->json([...], 200)`)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"total":   len(materials),
		"data":    materials,
	})
}

/**
 * ============================================================================
 * 2. [FEAT-2.2] TAMBAH BARANG BARU + SINGLE FILE UPLOAD (POST /api/materials)
 * ============================================================================
 * Studi Kasus Nyata Pabrik:
 * Saat staf gudang mendaftarkan bahan baku baru, mereka mengirim form
 * `multipart/form-data` yang berisi:
 * - Data teks: `sku`, `name`, `stock`, `min_stock`, `unit`
 * - File (Opsional): `image` (1 file foto fisik barang atau scan Surat Jalan)
 *
 * Jembatan Logika Laravel (Perbandingan Langsung!):
 * - Di Laravel:
 *     $sku = $request->input('sku');
 *     if ($request->hasFile('image')) {
 *         $path = $request->file('image')->store('uploads', 'public');
 *     }
 * - Di Golang (Gin):
 *     sku := c.PostForm("sku")
 *     file, err := c.FormFile("image")
 *     c.SaveUploadedFile(file, "./uploads/" + fileName)
 * ============================================================================
 */
func CreateMaterial(c *gin.Context) {
	// 1. Ambil input teks dari form-data (sepadan dengan `$request->input(...)` di Laravel)
	sku := strings.TrimSpace(strings.ToUpper(c.PostForm("sku")))
	name := strings.TrimSpace(c.PostForm("name"))
	unit := strings.TrimSpace(c.PostForm("unit"))

	// Karena semua input form HTML datang sebagai String, untuk angka (`stock` & `min_stock`)
	// kita ubah dari String ke Integer memakai `strconv.Atoi` (mirip `(int) $request->stock` di PHP)
	stock, _ := strconv.Atoi(c.PostForm("stock"))
	minStock, errMin := strconv.Atoi(c.PostForm("min_stock"))
	if errMin != nil || minStock <= 0 {
		minStock = 10 // Nilai default jika tidak diisi
	}

	// Validasi wajib isi (sepadan dengan `$request->validate(...)` di Laravel)
	if sku == "" || name == "" || unit == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Field sku, name, dan unit wajib diisi!",
		})
		return
	}

	// ------------------------------------------------------------------------
	// PROSES SINGLE FILE UPLOAD (Jika user melampirkan file di field "image")
	// ------------------------------------------------------------------------
	imagePath := ""
	file, errFile := c.FormFile("image")

	// Di Go: `errFile == nil` artinya TIDAK ADA ERROR (berarti file berhasil ditemukan!)
	// Ini sepadan dengan `if ($request->hasFile('image'))` di Laravel.
	if errFile == nil {
		// a. Validasi Ukuran File (Maksimal 5 MB = 5 * 1024 * 1024 bytes)
		maxSize := int64(5 * 1024 * 1024)
		if file.Size > maxSize {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Ukuran file terlalu besar! Maksimal 5 MB.",
			})
			return
		}

		// b. Validasi Ekstensi File (Hanya boleh gambar atau PDF Surat Jalan)
		ext := strings.ToLower(filepath.Ext(file.Filename))
		allowedExts := map[string]bool{
			".jpg":  true,
			".jpeg": true,
			".png":  true,
			".webp": true,
			".pdf":  true,
		}
		if !allowedExts[ext] {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": "Format file tidak didukung! Gunakan .jpg, .png, .webp, atau .pdf",
			})
			return
		}

		// c. Buat nama file unik dengan timestamp agar tidak bentrok
		// Contoh hasil: "1731145000_PLT-001.jpg"
		uniqueFileName := fmt.Sprintf("%d_%s%s", time.Now().Unix(), sku, ext)
		saveDestination := filepath.Join("uploads", uniqueFileName)

		// d. Simpan file ke folder "./uploads/" (Sepadan dengan `$file->storeAs('uploads', ...)` di Laravel)
		if errSave := c.SaveUploadedFile(file, saveDestination); errSave != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "Gagal menyimpan file ke server.",
			})
			return
		}

		imagePath = "/uploads/" + uniqueFileName
	}

	// 2. Tentukan status awal otomatis ("CRITICAL" jika stok di bawah batas minimum)
	status := "SAFE"
	if stock < minStock {
		status = "CRITICAL"
	}

	// 3. Buat objek Material & simpan ke MySQL (Sepadan dengan `Material::create([...])` di Laravel)
	newMaterial := models.Material{
		SKU:       sku,
		Name:      name,
		Stock:     stock,
		MinStock:  minStock,
		Unit:      unit,
		ImagePath: imagePath,
		Status:    status,
	}

	if result := config.DB.Create(&newMaterial); result.Error != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Gagal menyimpan barang (Pastikan kode SKU belum pernah dipakai): " + result.Error.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Bahan baku berhasil didaftarkan ke gudang!",
		"data":    newMaterial,
	})
}

/**
 * ============================================================================
 * 3. [FEAT-2.3] MUTASI BARANG MASUK / KELUAR (POST /api/materials/mutate)
 * ============================================================================
 * Filosofi Bisnis Pabrik:
 * Endpoint ini mensimulasikan tembakan alat Barcode Scanner di pintu gudang:
 * - Tipe "IN"  -> Barang datang dari supplier (Stok bertambah).
 * - Tipe "OUT" -> Barang diambil ke lini mesin produksi (Stok berkurang).
 *
 * Jembatan Logika Laravel:
 * 1. `c.ShouldBindJSON(&req)` -> Sepadan dengan `FormRequest` di Laravel!
 *    Gin membaca JSON body sekaligus menjalankan validasi `binding:"required,oneof=IN OUT"`
 *    yang sudah kita tulis di `models.MutationRequest`.
 * 2. `config.DB.Where("sku = ?", req.SKU).First(&material)` -> Sepadan dengan
 *    `Material::where('sku', $req->sku)->first()` di Eloquent Laravel.
 *    (Tanda `?` adalah Prepared Statement anti SQL Injection, persis seperti PDO di Laravel).
 * ============================================================================
 */
func MutateMaterial(c *gin.Context) {
	// 1. Siapkan wadah request & jalankan validasi JSON otomatis
	var req models.MutationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Format data mutasi tidak valid (Pastikan sku terisi, type bernilai IN/OUT, dan quantity > 0).",
			"error":   err.Error(),
		})
		return
	}

	// Normalisasi huruf besar pada SKU
	req.SKU = strings.TrimSpace(strings.ToUpper(req.SKU))

	// 2. Cari barang berdasarkan SKU di MySQL
	// Sepadan dengan: `$material = Material::where('sku', $req->sku)->first();`
	var material models.Material
	if err := config.DB.Where("sku = ?", req.SKU).First(&material).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": fmt.Sprintf("Barang dengan kode SKU '%s' tidak ditemukan di gudang!", req.SKU),
		})
		return
	}

	// 3. Hitung mutasi stok sesuai tipe transaksi ("IN" atau "OUT")
	if req.Type == "OUT" {
		// Proteksi Bisnis Pabrik: Stok fisik tidak mungkin minus!
		if material.Stock < req.Quantity {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": fmt.Sprintf(
					"Stok '%s' tidak mencukupi! Sisa stok: %d %s, jumlah diminta: %d %s.",
					material.Name, material.Stock, material.Unit, req.Quantity, material.Unit,
				),
			})
			return
		}
		material.Stock -= req.Quantity
	} else {
		// Transaksi "IN" (Barang Masuk)
		material.Stock += req.Quantity
	}

	// 4. Evaluasi ulang apakah stok sekarang berada di bawah ambang batas aman (MinStock)
	if material.Stock < material.MinStock {
		material.Status = "CRITICAL"
	} else {
		material.Status = "SAFE"
	}

	// 5. Simpan perubahan ke MySQL (Sepadan dengan `$material->save()` di Eloquent Laravel!)
	if err := config.DB.Save(&material).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Gagal menyimpan perubahan stok ke database.",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Mutasi %s sebanyak %d %s untuk '%s' berhasil dicatat!", req.Type, req.Quantity, material.Unit, material.Name),
		"data":    material,
	})
}

