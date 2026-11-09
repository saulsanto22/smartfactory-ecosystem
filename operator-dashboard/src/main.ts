import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { AppComponent } from './app/app.component';

/**
 * ============================================================================
 * TITIK MASUK APLIKASI ANGULAR STANDALONE (main.ts)
 * ============================================================================
 * Jembatan Logika Laravel:
 * - `bootstrapApplication(AppComponent, ...)` adalah pembuka halaman utama.
 * - `provideHttpClient()` mendaftarkan HTTP Client secara global ke dalam
 *   Service Container Angular (sepadan dengan mendaftarkan `Http` Facade di
 *   `AppServiceProvider` Laravel).
 * ============================================================================
 */
bootstrapApplication(AppComponent, {
  providers: [provideHttpClient()],
}).catch((err) => console.error(err));
