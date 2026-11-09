import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, RoleOption } from './api.service';

/**
 * ============================================================================
 * MAIN COMPONENT: SMARTFACTORY OPERATOR DASHBOARD (Angular Standalone + Tailwind)
 * ============================================================================
 * Jembatan Logika Laravel:
 * - Di Laravel + Blade, kita melempar variabel dari Controller ke `view('dashboard', compact(...))`.
 * - Di Angular Standalone Component:
 *   1. Variabel di dalam class `AppComponent` (`incidents`, `materials`, `oeeLogs`)
 *      otomatis terhubung ke HTML template (Two-Way Data Binding `[(ngModel)]`).
 *   2. Seluruh tampilan menggunakan class utilitas Tailwind CSS tanpa CSS manual.
 * ============================================================================
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <!-- ================================================================== -->
      <!-- TOP NAVBAR & RBAC ROLE SWITCHER                                    -->
      <!-- ================================================================== -->
      <header class="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30">
        <div class="max-w-7xl mx-auto px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-600/30">
              SF
            </div>
            <div>
              <h1 class="text-lg font-bold tracking-wide text-white flex items-center gap-2">
                SMARTFACTORY CONTROL ROOM
                <span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  MES &amp; ANDON v1.0
                </span>
              </h1>
              <p class="text-xs text-slate-400">
                Polyglot Microservices: Golang (:8081) • NestJS (:8082) • Express.js (:8083)
              </p>
            </div>
          </div>

          <!-- Role Switcher (Simulasi 4 Jabatan RBAC) -->
          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5">
              <span class="text-xs text-slate-400 font-medium">Simulasi Jabatan (RBAC):</span>
              <select
                [ngModel]="api.currentRole.role"
                (ngModelChange)="onRoleChange($event)"
                class="bg-slate-900 text-xs font-semibold text-white border border-slate-700 rounded px-2.5 py-1 focus:outline-none focus:border-indigo-500"
              >
                <option *ngFor="let r of api.roles" [value]="r.role">
                  {{ r.label }}
                </option>
              </select>
              <span class="text-[11px] px-2 py-0.5 rounded font-semibold" [ngClass]="api.currentRole.badgeColor">
                {{ api.currentRole.role }}
              </span>
            </div>

            <button
              (click)="refreshAllData()"
              class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
            >
              <span>🔄 Refresh Data</span>
            </button>
          </div>
        </div>

        <!-- Info bar hak akses jabatan aktif -->
        <div class="bg-slate-950/80 border-t border-slate-800/80 px-4 py-1.5">
          <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <div>
              👤 Login Aktif: <strong class="text-slate-200">{{ api.currentRole.userName }}</strong> —
              <span class="text-slate-400">{{ api.currentRole.description }}</span>
            </div>
            <div *ngIf="feedbackMessage" class="px-3 py-0.5 rounded font-medium"
                 [ngClass]="feedbackType === 'error' ? 'bg-red-950/90 text-red-300 border border-red-800' : 'bg-emerald-950/90 text-emerald-300 border border-emerald-800'">
              {{ feedbackMessage }}
            </div>
          </div>
        </div>
      </header>

      <!-- ================================================================== -->
      <!-- MAIN CONTENT CONTAINER                                             -->
      <!-- ================================================================== -->
      <main class="max-w-7xl w-full mx-auto px-4 py-6 space-y-6 flex-1">

        <!-- ================================================================ -->
        <!-- KOTAK 1 (ATAS): PAPAN SIRINE INSIDEN AKTIF (Express.js :8083)    -->
        <!-- ================================================================ -->
        <section class="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl">
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div class="flex items-center gap-2.5">
              <span class="relative flex h-3 w-3" *ngIf="activeIncidentsCount > 0">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <h2 class="text-base font-bold text-white tracking-wide">
                🚨 PAPAN SIRINE ALARM &amp; INSIDEN PABRIK (Express.js Gateway — Port 8083)
              </h2>
            </div>
            <span class="text-xs px-2.5 py-1 rounded-full font-semibold"
                  [ngClass]="activeIncidentsCount > 0 ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'">
              {{ activeIncidentsCount }} Alarm Aktif Menyala
            </span>
          </div>

          <div *ngIf="incidents.length === 0" class="text-center py-6 text-sm text-slate-500">
            Belum ada data insiden dari server Express.js (:8083).
          </div>

          <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
            <div
              *ngFor="let inc of incidents"
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border transition"
              [ngClass]="inc.is_resolved
                ? 'bg-slate-950/50 border-slate-800/80 text-slate-500'
                : (inc.severity === 'CRITICAL'
                    ? 'bg-red-950/40 border-red-800/80 text-red-100'
                    : 'bg-amber-950/40 border-amber-800/80 text-amber-100')"
            >
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2 text-xs">
                  <span class="font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200">
                    #{{ inc.id }} • {{ inc.source }}
                  </span>
                  <span class="font-bold px-2 py-0.5 rounded"
                        [ngClass]="inc.is_resolved ? 'bg-slate-800 text-slate-400' : 'bg-red-600 text-white'">
                    {{ inc.is_resolved ? 'RESOLVED' : inc.severity }}
                  </span>
                  <span class="text-slate-400">{{ inc.created_at | date:'dd/MM/yyyy HH:mm:ss' }}</span>
                </div>
                <p class="text-sm font-medium">{{ inc.message }}</p>
                <p *ngIf="inc.is_resolved" class="text-xs text-emerald-400">
                  ✅ Diselesaikan oleh: {{ inc.resolved_by }} ({{ inc.resolved_at | date:'HH:mm:ss' }})
                </p>
              </div>

              <div *ngIf="!inc.is_resolved" class="shrink-0">
                <button
                  (click)="handleResolveIncident(inc.id)"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition"
                >
                  ✔ Tandai Selesai (Resolve)
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- ================================================================ -->
        <!-- GRID 2 KOLOM: GUDANG GOLANG (KIRI) & MESIN OEE NESTJS (KANAN)    -->
        <!-- ================================================================ -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <!-- ============================================================== -->
          <!-- KOTAK 2 (KIRI): PANEL GUDANG & INVENTORY (Golang :8081)        -->
          <!-- ============================================================== -->
          <section class="rounded-xl border border-slate-800 bg-slate-900/70 p-5 flex flex-col justify-between space-y-5 shadow-xl">
            <div class="space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h2 class="text-base font-bold text-white flex items-center gap-2">
                    📦 MODUL GUDANG &amp; INVENTORY
                    <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      Golang :8081
                    </span>
                  </h2>
                  <p class="text-xs text-slate-400">Mutasi Barcode Cepat, Single File Upload &amp; Cetak PDF (gofpdf)</p>
                </div>

                <!-- Tombol Cetak PDF Gudang -->
                <a
                  [href]="api.getWarehousePdfUrl()"
                  target="_blank"
                  class="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white shadow transition flex items-center gap-1.5"
                >
                  📄 Cetak PDF Gudang
                </a>
              </div>

              <!-- Tabel Stok Bahan Baku -->
              <div class="overflow-x-auto rounded-lg border border-slate-800">
                <table class="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr class="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <th class="py-2.5 px-3">SKU &amp; Nama Barang</th>
                      <th class="py-2.5 px-3 text-center">Stok</th>
                      <th class="py-2.5 px-3 text-center">Min</th>
                      <th class="py-2.5 px-3 text-center">Bukti</th>
                      <th class="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-800/70">
                    <tr *ngFor="let item of materials" class="hover:bg-slate-800/40">
                      <td class="py-2.5 px-3">
                        <div class="font-mono font-bold text-cyan-400">{{ item.sku }}</div>
                        <div class="text-slate-200 font-medium">{{ item.name }}</div>
                      </td>
                      <td class="py-2.5 px-3 text-center font-bold text-sm"
                          [ngClass]="item.status === 'CRITICAL' ? 'text-red-400' : 'text-white'">
                        {{ item.stock }} <span class="text-[11px] font-normal text-slate-400">{{ item.unit }}</span>
                      </td>
                      <td class="py-2.5 px-3 text-center text-slate-400">
                        {{ item.min_stock }} {{ item.unit }}
                      </td>
                      <td class="py-2.5 px-3 text-center">
                        <a *ngIf="item.image_path"
                           [href]="api.warehouseBase + item.image_path"
                           target="_blank"
                           class="text-cyan-400 hover:underline font-medium">
                          📎 Lihat File
                        </a>
                        <span *ngIf="!item.image_path" class="text-slate-600">-</span>
                      </td>
                      <td class="py-2.5 px-3 text-center">
                        <span class="px-2 py-0.5 rounded-full text-[11px] font-bold"
                              [ngClass]="item.status === 'CRITICAL'
                                ? 'bg-red-950 text-red-300 border border-red-800 animate-pulse'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'">
                          {{ item.status }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- FORM 1: Simulasi Scan Barcode Mutasi IN / OUT -->
              <div class="rounded-lg bg-slate-950/90 border border-slate-800 p-3.5 space-y-3">
                <h3 class="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  🔫 Form 1: Simulasi Scan Barcode Mutasi Stok (IN / OUT)
                </h3>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label class="block text-[11px] text-slate-400 mb-1">Pilih Barang (SKU)</label>
                    <select [(ngModel)]="mutationForm.sku"
                            class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white">
                      <option value="" disabled>-- Pilih SKU --</option>
                      <option *ngFor="let m of materials" [value]="m.sku">
                        {{ m.sku }} ({{ m.name }})
                      </option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[11px] text-slate-400 mb-1">Jenis Transaksi</label>
                    <select [(ngModel)]="mutationForm.type"
                            class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white">
                      <option value="OUT">OUT (Keluar ke Produksi)</option>
                      <option value="IN">IN (Masuk dari Supplier)</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-[11px] text-slate-400 mb-1">Jumlah Kuantitas</label>
                    <input type="number" [(ngModel)]="mutationForm.quantity" min="1"
                           class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white" />
                  </div>
                </div>
                <button
                  (click)="handleMutateStock()"
                  class="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white shadow transition"
                >
                  ⚡ Eksekusi Mutasi Stok (Otomatis Tembak Alarm Jika Stok &lt; Min)
                </button>
              </div>

              <!-- FORM 2: Tambah Barang Baru + Single File Upload -->
              <div class="rounded-lg bg-slate-950/90 border border-slate-800 p-3.5 space-y-3">
                <h3 class="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  ➕ Form 2: Registrasi Barang Baru + Single File Upload (Foto / Surat Jalan)
                </h3>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <input type="text" [(ngModel)]="newMaterialForm.sku" placeholder="Kode SKU (mis: ALU-004)"
                         class="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white" />
                  <input type="text" [(ngModel)]="newMaterialForm.name" placeholder="Nama Bahan Baku"
                         class="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white col-span-1 sm:col-span-2" />
                  <input type="number" [(ngModel)]="newMaterialForm.stock" placeholder="Stok Awal"
                         class="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white" />
                  <input type="number" [(ngModel)]="newMaterialForm.min_stock" placeholder="Min. Stok Aman"
                         class="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white" />
                  <input type="text" [(ngModel)]="newMaterialForm.unit" placeholder="Satuan (Kg/Pcs/Roll)"
                         class="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white" />
                </div>
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <input type="file" (change)="onSingleFileSelected($event)" accept=".jpg,.jpeg,.png,.webp,.pdf"
                         class="text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-cyan-300 hover:file:bg-slate-700" />
                  <button
                    (click)="handleCreateMaterial()"
                    class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow transition shrink-0"
                  >
                    💾 Simpan &amp; Upload File
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- ============================================================== -->
          <!-- KOTAK 3 (KANAN): PANEL MESIN & OEE ENGINE (NestJS :8082)       -->
          <!-- ============================================================== -->
          <section class="rounded-xl border border-slate-800 bg-slate-900/70 p-5 flex flex-col justify-between space-y-5 shadow-xl">
            <div class="space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h2 class="text-base font-bold text-white flex items-center gap-2">
                    ⚙️ MODUL EFISIENSI MESIN (OEE ENGINE)
                    <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                      NestJS :8082
                    </span>
                  </h2>
                  <p class="text-xs text-slate-400">Kalkulasi OEE Real-Time, Multi-File Upload &amp; Cetak PDF (PDFKit)</p>
                </div>

                <!-- Tombol Cetak PDF OEE -->
                <a
                  [href]="api.getOeePdfUrl()"
                  target="_blank"
                  class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white shadow transition flex items-center gap-1.5"
                >
                  📄 Cetak PDF Rapor OEE
                </a>
              </div>

              <!-- Daftar Kartu Rapor Mesin OEE -->
              <div class="space-y-3 max-h-64 overflow-y-auto pr-1">
                <div
                  *ngFor="let log of oeeLogs"
                  class="p-3.5 rounded-lg border bg-slate-950/80 space-y-2"
                  [ngClass]="log.status === 'CRITICAL'
                    ? 'border-red-800/80'
                    : (log.status === 'WORLD_CLASS' ? 'border-emerald-800/80' : 'border-amber-800/80')"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <span class="font-mono font-bold text-sm text-white">{{ log.machine_code }}</span>
                      <span class="ml-2 text-[11px] text-slate-400">
                        Downtime: {{ log.downtime_minutes }}/{{ log.planned_time_minutes }} mnt •
                        Reject: {{ log.defect_output }}/{{ log.total_output }} unit
                      </span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-lg font-black"
                            [ngClass]="log.status === 'CRITICAL'
                              ? 'text-red-400'
                              : (log.status === 'WORLD_CLASS' ? 'text-emerald-400' : 'text-amber-400')">
                        {{ log.oee_score }}%
                      </span>
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold"
                            [ngClass]="log.status === 'CRITICAL'
                              ? 'bg-red-950 text-red-300 border border-red-800'
                              : (log.status === 'WORLD_CLASS'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800')">
                        {{ log.status }}
                      </span>
                    </div>
                  </div>

                  <!-- 3 Komponen OEE (Availability x Performance x Quality) -->
                  <div class="grid grid-cols-3 gap-2 text-center text-[11px] pt-1">
                    <div class="bg-slate-900 rounded p-1.5 border border-slate-800">
                      <div class="text-slate-400">Availability</div>
                      <div class="font-bold text-slate-200">{{ log.availability_rate }}%</div>
                    </div>
                    <div class="bg-slate-900 rounded p-1.5 border border-slate-800">
                      <div class="text-slate-400">Performance</div>
                      <div class="font-bold text-slate-200">{{ log.performance_rate }}%</div>
                    </div>
                    <div class="bg-slate-900 rounded p-1.5 border border-slate-800">
                      <div class="text-slate-400">Quality</div>
                      <div class="font-bold text-slate-200">{{ log.quality_rate }}%</div>
                    </div>
                  </div>

                  <!-- Tampilan Bukti Foto Multi-Upload (Jika Ada) -->
                  <div *ngIf="log.evidence_photos && log.evidence_photos.length > 0" class="flex flex-wrap items-center gap-2 pt-1">
                    <span class="text-[11px] text-slate-400">📸 Bukti Foto Reject/Downtime:</span>
                    <a
                      *ngFor="let photo of log.evidence_photos; let idx = index"
                      [href]="api.oeeBase + photo"
                      target="_blank"
                      class="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700"
                    >
                      Foto #{{ idx + 1 }}
                    </a>
                  </div>
                </div>
              </div>

              <!-- FORM INPUT LAPORAN MESIN & MULTI-FILE UPLOAD -->
              <div class="rounded-lg bg-slate-950/90 border border-slate-800 p-3.5 space-y-3">
                <h3 class="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  🧮 Form Hitung OEE Mesin + Multiple File Upload (Maks 5 Foto Bukti)
                </h3>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <label class="block text-[11px] text-slate-400 mb-1">Kode Mesin</label>
                    <input type="text" [(ngModel)]="oeeForm.machine_code" placeholder="INJECT-03"
                           class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white" />
                  </div>
                  <div>
                    <label class="block text-[11px] text-slate-400 mb-1">Waktu Rencana (Menit)</label>
                    <input type="number" [(ngModel)]="oeeForm.planned_time_minutes"
                           class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white" />
                  </div>
                  <div>
                    <label class="block text-[11px] text-slate-400 mb-1">Waktu Macet/Downtime (Mnt)</label>
                    <input type="number" [(ngModel)]="oeeForm.downtime_minutes"
                           class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white" />
                  </div>
                  <div>
                    <label class="block text-[11px] text-slate-400 mb-1">Siklus Ideal (Detik/Unit)</label>
                    <input type="number" [(ngModel)]="oeeForm.ideal_cycle_time_seconds"
                           class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white" />
                  </div>
                  <div>
                    <label class="block text-[11px] text-slate-400 mb-1">Total Output (Unit)</label>
                    <input type="number" [(ngModel)]="oeeForm.total_output"
                           class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white" />
                  </div>
                  <div>
                    <label class="block text-[11px] text-slate-400 mb-1">Barang Cacat/Reject (Unit)</label>
                    <input type="number" [(ngModel)]="oeeForm.defect_output"
                           class="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white" />
                  </div>
                </div>

                <div class="space-y-2 pt-1">
                  <label class="block text-[11px] text-slate-400">
                    📸 Upload Banyak Foto Bukti Sekaligus (Pilih 1–5 file gambar):
                  </label>
                  <input
                    type="file"
                    multiple
                    (change)="onMultiFilesSelected($event)"
                    accept=".jpg,.jpeg,.png,.webp"
                    class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-amber-300 hover:file:bg-slate-700"
                  />
                  <div *ngIf="selectedMultipleFiles.length > 0" class="text-[11px] text-amber-300">
                    Terpilih {{ selectedMultipleFiles.length }} file: {{ getSelectedFileNames() }}
                  </div>
                </div>

                <button
                  (click)="handleCalculateOee()"
                  class="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white shadow transition"
                >
                  🚀 Hitung Skor OEE &amp; Upload Bukti (Otomatis Tembak Alarm Jika OEE &lt; 65%)
                </button>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  `,
})
export class AppComponent implements OnInit {
  incidents: any[] = [];
  materials: any[] = [];
  oeeLogs: any[] = [];

  feedbackMessage = '';
  feedbackType: 'success' | 'error' = 'success';

  // State Form Mutasi Gudang
  mutationForm: { sku: string; type: 'IN' | 'OUT'; quantity: number } = {
    sku: 'PLT-001',
    type: 'OUT',
    quantity: 35,
  };

  // State Form Tambah Barang Baru + Single File
  newMaterialForm = {
    sku: '',
    name: '',
    stock: 100,
    min_stock: 25,
    unit: 'Pcs',
  };
  selectedSingleFile: File | null = null;

  // State Form Input OEE + Multiple Files
  oeeForm = {
    machine_code: 'INJECT-MOLD-03',
    planned_time_minutes: 480,
    downtime_minutes: 90,
    ideal_cycle_time_seconds: 20,
    total_output: 900,
    defect_output: 180,
  };
  selectedMultipleFiles: File[] = [];

  constructor(public api: ApiService) {}

  ngOnInit(): void {
    // Saat pertama kali dibuka, minta token untuk role default (PLANT_MANAGER) & muat semua data
    this.switchRole(this.api.roles[0]);
    this.refreshAllData();
  }

  get activeIncidentsCount(): number {
    return this.incidents.filter((i) => !i.is_resolved).length;
  }

  private showFeedback(msg: string, type: 'success' | 'error' = 'success') {
    this.feedbackMessage = msg;
    this.feedbackType = type;
    setTimeout(() => {
      this.feedbackMessage = '';
    }, 6000);
  }

  refreshAllData(): void {
    this.api.getIncidents().subscribe({
      next: (res) => (this.incidents = res.data || []),
      error: () => {},
    });

    this.api.getMaterials().subscribe({
      next: (res) => {
        this.materials = res.data || [];
        if (this.materials.length > 0 && !this.mutationForm.sku) {
          this.mutationForm.sku = this.materials[0].sku;
        }
      },
      error: () => {},
    });

    this.api.getOeeLogs().subscribe({
      next: (res) => (this.oeeLogs = res.data || []),
      error: () => {},
    });
  }

  // --------------------------------------------------------------------------
  // HANDLER GANTI JABATAN (RBAC ROLE SWITCHER)
  // --------------------------------------------------------------------------
  onRoleChange(roleCode: string): void {
    const found = this.api.roles.find((r) => r.role === roleCode);
    if (found) {
      this.switchRole(found);
    }
  }

  private switchRole(roleOption: RoleOption): void {
    this.api.requestRoleToken(roleOption).subscribe({
      next: (res) => {
        this.api.jwtToken = res.token || '';
        this.showFeedback(`Berhasil beralih jabatan ke: ${roleOption.label}`, 'success');
      },
      error: () => {
        this.showFeedback(`Mode jabatan lokal aktif: ${roleOption.label}`, 'success');
      },
    });
  }

  // --------------------------------------------------------------------------
  // HANDLER 1: RESOLVE ALARM (Express.js :8083)
  // --------------------------------------------------------------------------
  handleResolveIncident(id: number): void {
    this.api.resolveIncident(id, this.api.currentRole.userName).subscribe({
      next: (res) => {
        this.showFeedback(res.message || 'Alarm berhasil diselesaikan!', 'success');
        this.refreshAllData();
      },
      error: (err) => {
        this.showFeedback(
          err.error?.message || 'Akses ditolak (403 Forbidden): Jabatan Anda tidak berhak mematikan alarm!',
          'error',
        );
      },
    });
  }

  // --------------------------------------------------------------------------
  // HANDLER 2: MUTASI STOK & SINGLE UPLOAD GUDANG (Golang :8081)
  // --------------------------------------------------------------------------
  handleMutateStock(): void {
    this.api.mutateMaterial(this.mutationForm).subscribe({
      next: (res) => {
        this.showFeedback(res.message, 'success');
        // Beri jeda 300ms agar Goroutine selesai menembak webhook ke Express.js
        setTimeout(() => this.refreshAllData(), 300);
      },
      error: (err) => {
        this.showFeedback(
          err.error?.message || 'Gagal melakukan mutasi stok gudang!',
          'error',
        );
      },
    });
  }

  onSingleFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedSingleFile = input.files[0];
    }
  }

  handleCreateMaterial(): void {
    const formData = new FormData();
    formData.append('sku', this.newMaterialForm.sku);
    formData.append('name', this.newMaterialForm.name);
    formData.append('stock', String(this.newMaterialForm.stock));
    formData.append('min_stock', String(this.newMaterialForm.min_stock));
    formData.append('unit', this.newMaterialForm.unit);

    if (this.selectedSingleFile) {
      formData.append('image', this.selectedSingleFile);
    }

    this.api.createMaterial(formData).subscribe({
      next: (res) => {
        this.showFeedback(res.message, 'success');
        this.newMaterialForm = { sku: '', name: '', stock: 100, min_stock: 25, unit: 'Pcs' };
        this.selectedSingleFile = null;
        this.refreshAllData();
      },
      error: (err) => {
        this.showFeedback(
          err.error?.message || 'Gagal menambah bahan baku baru!',
          'error',
        );
      },
    });
  }

  // --------------------------------------------------------------------------
  // HANDLER 3: HITUNG OEE & MULTIPLE FILE UPLOAD (NestJS :8082)
  // --------------------------------------------------------------------------
  onMultiFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.selectedMultipleFiles = Array.from(input.files).slice(0, 5);
    }
  }

  getSelectedFileNames(): string {
    return this.selectedMultipleFiles.map((f) => f.name).join(', ');
  }

  handleCalculateOee(): void {
    const formData = new FormData();
    formData.append('machine_code', this.oeeForm.machine_code);
    formData.append('planned_time_minutes', String(this.oeeForm.planned_time_minutes));
    formData.append('downtime_minutes', String(this.oeeForm.downtime_minutes));
    formData.append('ideal_cycle_time_seconds', String(this.oeeForm.ideal_cycle_time_seconds));
    formData.append('total_output', String(this.oeeForm.total_output));
    formData.append('defect_output', String(this.oeeForm.defect_output));

    // Masukkan semua file yang dipilih ke dalam field "photos" (Multiple File Upload)
    this.selectedMultipleFiles.forEach((file) => {
      formData.append('photos', file);
    });

    this.api.calculateOee(formData).subscribe({
      next: (res) => {
        this.showFeedback(res.message, 'success');
        this.selectedMultipleFiles = [];
        setTimeout(() => this.refreshAllData(), 300);
      },
      error: (err) => {
        this.showFeedback(
          err.error?.message || 'Gagal menghitung OEE mesin!',
          'error',
        );
      },
    });
  }
}
