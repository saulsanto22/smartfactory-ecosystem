import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export type FactoryRole =
  | 'PLANT_MANAGER'
  | 'WAREHOUSE_STAFF'
  | 'PRODUCTION_OPERATOR'
  | 'MAINTENANCE_TECH';

export interface RoleOption {
  role: FactoryRole;
  label: string;
  userName: string;
  badgeColor: string;
  description: string;
}

/**
 * ============================================================================
 * ANGULAR SERVICE: PENGHUBUNG KE 3 BACKEND MICROSERVICES (ApiService)
 * ============================================================================
 * Jembatan Logika Laravel:
 * - `@Injectable({ providedIn: 'root' })` membuat class ini menjadi Singleton
 *   di dalam Service Container Angular (persis seperti `$this->app->singleton(ApiService::class)`
 *   di `AppServiceProvider.php` Laravel!).
 * - `constructor(private http: HttpClient)` adalah Dependency Injection otomatis.
 * ============================================================================
 */
@Injectable({
  providedIn: 'root',
})
export class ApiService {
  readonly warehouseUrl = 'http://localhost:8081/api';
  readonly warehouseBase = 'http://localhost:8081';

  readonly oeeUrl = 'http://localhost:8082/api';
  readonly oeeBase = 'http://localhost:8082';

  readonly incidentUrl = 'http://localhost:8083/api';

  // Daftar 4 Jabatan Pabrik (Untuk Simulasi RBAC di Sprint 5)
  readonly roles: RoleOption[] = [
    {
      role: 'PLANT_MANAGER',
      label: 'Manajer Pabrik (Super Admin)',
      userName: 'Ir. Hendra (Plant Manager)',
      badgeColor: 'bg-purple-600 text-white',
      description: 'Akses penuh ke Gudang (Go), Mesin OEE (NestJS), dan Resolve Alarm (Express).',
    },
    {
      role: 'WAREHOUSE_STAFF',
      label: 'Staf Gudang (Logistik)',
      userName: 'Budi (Warehouse Staff)',
      badgeColor: 'bg-emerald-600 text-white',
      description: 'Hanya boleh Tambah Barang, Upload Surat Jalan, & Mutasi Stok Gudang (Golang :8081).',
    },
    {
      role: 'PRODUCTION_OPERATOR',
      label: 'Operator Mesin (Produksi)',
      userName: 'Andi (Machine Operator)',
      badgeColor: 'bg-amber-600 text-white',
      description: 'Hanya boleh Input Kerja Mesin & Multi-Upload Bukti Reject OEE (NestJS :8082).',
    },
    {
      role: 'MAINTENANCE_TECH',
      label: 'Teknisi Maintenance',
      userName: 'Tono (Maintenance Tech)',
      badgeColor: 'bg-sky-600 text-white',
      description: 'Hanya boleh menekan tombol Resolve / Matikan Sirine Alarm (Express :8083).',
    },
  ];

  currentRole: RoleOption = this.roles[0];
  jwtToken = '';

  constructor(private http: HttpClient) {}

  // Menyusun Header HTTP beserta Token JWT (RBAC)
  private getAuthHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'X-User-Role': this.currentRole.role,
      'X-User-Name': this.currentRole.userName,
    });
    if (this.jwtToken) {
      headers = headers.set('Authorization', `Bearer ${this.jwtToken}`);
    }
    return headers;
  }

  // --------------------------------------------------------------------------
  // 0. AUTH / GENERATE JWT TOKEN UNTUK ROLE SWITCHER (Express :8083)
  // --------------------------------------------------------------------------
  requestRoleToken(roleOption: RoleOption): Observable<any> {
    this.currentRole = roleOption;
    return this.http.post(`${this.incidentUrl}/auth/token`, {
      name: roleOption.userName,
      role: roleOption.role,
    });
  }

  // --------------------------------------------------------------------------
  // 1. MODUL PUSAT ALARM / INCIDENT GATEWAY (Express.js - Port 8083)
  // --------------------------------------------------------------------------
  getIncidents(): Observable<any> {
    return this.http.get(`${this.incidentUrl}/incidents`);
  }

  resolveIncident(id: number, resolvedBy: string): Observable<any> {
    return this.http.patch(
      `${this.incidentUrl}/incidents/${id}/resolve`,
      { resolved_by: resolvedBy },
      { headers: this.getAuthHeaders() },
    );
  }

  // --------------------------------------------------------------------------
  // 2. MODUL GUDANG & INVENTORY (Golang - Port 8081)
  // --------------------------------------------------------------------------
  getMaterials(): Observable<any> {
    return this.http.get(`${this.warehouseUrl}/materials`);
  }

  // Single File Upload menggunakan objek `FormData` bawaan browser
  createMaterial(formData: FormData): Observable<any> {
    return this.http.post(`${this.warehouseUrl}/materials`, formData, {
      headers: this.getAuthHeaders(),
    });
  }

  mutateMaterial(payload: {
    sku: string;
    type: 'IN' | 'OUT';
    quantity: number;
  }): Observable<any> {
    return this.http.post(`${this.warehouseUrl}/materials/mutate`, payload, {
      headers: this.getAuthHeaders(),
    });
  }

  getWarehousePdfUrl(): string {
    return `${this.warehouseUrl}/materials/export/pdf`;
  }

  // --------------------------------------------------------------------------
  // 3. MODUL EFISIENSI MESIN & OEE ENGINE (NestJS - Port 8082)
  // --------------------------------------------------------------------------
  getOeeLogs(): Observable<any> {
    return this.http.get(`${this.oeeUrl}/oee`);
  }

  // Multiple File Upload (`photos[]`) menggunakan objek `FormData`
  calculateOee(formData: FormData): Observable<any> {
    return this.http.post(`${this.oeeUrl}/oee/calculate`, formData, {
      headers: this.getAuthHeaders(),
    });
  }

  getOeePdfUrl(): string {
    return `${this.oeeUrl}/oee/export/pdf`;
  }
}
