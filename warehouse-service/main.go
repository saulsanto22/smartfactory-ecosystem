package main

import (
	"fmt"
	"net/http"
	"os"
	"warehouse-service/config"
	"warehouse-service/controllers"

	"github.com/gin-gonic/gin"
)

/**
 * ============================================================================
 * MODUL 1: WAREHOUSE & INVENTORY SERVICE (Golang + Gin + GORM - Port 8081)
 * ============================================================================
 * Jembatan Logika Laravel:
 * Fungsi `main()` di bawah ini adalah penggabungan dari:
 * - `public/index.php` (Titik awal aplikasi menyala)
 * - `routes/api.php` (Pendaftaran route HTTP)
 * ============================================================================
 */
func main() {
	// 1. Buka koneksi ke MySQL, jalankan AutoMigrate & Seeder
	config.ConnectDatabase()

	// 2. Pastikan folder "./uploads" tersedia untuk menyimpan foto barang / surat jalan
	// (Sepadan dengan `Storage::makeDirectory('public/uploads')` di Laravel)
	_ = os.MkdirAll("./uploads", os.ModePerm)

	// 3. Inisialisasi Router Gin (sudah termasuk Logger & Recovery Middleware)
	r := gin.Default()

	// 4. Middleware CORS sederhana agar Frontend Angular (Port 4200) diizinkan akses
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// 5. Sajikan folder "./uploads" sebagai file statis (sepadan dengan `php artisan storage:link`)
	// Jadi file di "./uploads/foto.jpg" bisa dibuka lewat "http://localhost:8081/uploads/foto.jpg"
	r.Static("/uploads", "./uploads")

	// 6. Route Cek Kesehatan Server (Healthcheck)
	r.GET("/api/health", func(c *gin.Context) {
		// `gin.H` adalah singkatan dari `map[string]interface{}` (Array Asosiatif seperti `['status' => 'UP']` di PHP)
		c.JSON(http.StatusOK, gin.H{
			"service": "warehouse-service",
			"status":  "UP",
		})
	})

	// 7. Route Modul Gudang (Sepadan dengan `routes/api.php` di Laravel)
	r.GET("/api/materials", controllers.GetMaterials)
	r.POST("/api/materials", controllers.CreateMaterial)
	r.POST("/api/materials/mutate", controllers.MutateMaterial)

	// 7. Jalankan Server di Port 8081
	port := "8081"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = envPort
	}

	fmt.Printf("📦 [Warehouse Service] Server Gudang Golang menyala di http://localhost:%s\n", port)
	_ = r.Run(":" + port)
}
