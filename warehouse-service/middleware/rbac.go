package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

/**
 * ============================================================================
 * [FEAT-5.2] MIDDLEWARE PENGECEK ROLE JABATAN DI GOLANG (GIN RBAC)
 * ============================================================================
 * Jembatan Logika Laravel:
 * Middleware ini persis dengan `app/Http/Middleware/EnsureUserHasRole.php` di Laravel!
 * Hanya mengizinkan jabatan `WAREHOUSE_STAFF` dan `PLANT_MANAGER` untuk mengubah
 * data stok gudang (Tambah Barang & Mutasi IN/OUT).
 * ============================================================================
 */
func RequireRoles(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole := c.GetHeader("X-User-Role")

		// Jika ada header Authorization: Bearer <jwt_token>, verifikasi tanda tangan HMAC-SHA256
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			token := strings.TrimPrefix(authHeader, "Bearer ")
			if roleFromJwt, ok := verifyJwtAndGetRole(token); ok {
				userRole = roleFromJwt
			} else {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"success": false,
					"message": "Token JWT tidak valid atau telah kedaluwarsa (401 Unauthorized)!",
				})
				return
			}
		}

		// Cek apakah userRole termasuk di dalam daftar allowedRoles
		isAllowed := false
		for _, allowed := range allowedRoles {
			if userRole == allowed {
				isAllowed = true
				break
			}
		}

		if !isAllowed {
			if userRole == "" {
				userRole = "GUEST"
			}
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": fmt.Sprintf(
					"Akses Ditolak (403 Forbidden)! Jabatan Anda (%s) dilarang mengubah stok Gudang. Hanya untuk: %s.",
					userRole, strings.Join(allowedRoles, " / "),
				),
			})
			return
		}

		// Sepadan dengan `return $next($request);` di Middleware Laravel
		c.Next()
	}
}

func verifyJwtAndGetRole(token string) (string, bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", false
	}

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "smartfactory-super-secret-key-2026"
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(parts[0] + "." + parts[1]))
	expectedSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(parts[2]), []byte(expectedSig)) {
		return "", false
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", false
	}

	var claims map[string]interface{}
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return "", false
	}

	role, _ := claims["role"].(string)
	return role, role != ""
}
