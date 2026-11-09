import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * ============================================================================
 * [FEAT-5.2] NESTJS ROLES GUARD (RBAC KHUSUS PRODUKSI & MANAJER)
 * ============================================================================
 * Jembatan Logika Laravel:
 * Class `ProductionRolesGuard` yang mengimplementasikan `CanActivate` ini
 * sepadan dengan Laravel Gate / Policy (`Gate::define('calculate-oee', ...)`).
 * Hanya mengizinkan `PRODUCTION_OPERATOR` dan `PLANT_MANAGER` untuk menginput
 * data produksi mesin & upload foto bukti reject.
 * ============================================================================
 */
@Injectable()
export class ProductionRolesGuard implements CanActivate {
  private readonly allowedRoles = ['PRODUCTION_OPERATOR', 'PLANT_MANAGER'];
  private readonly jwtSecret =
    process.env.JWT_SECRET || 'smartfactory-super-secret-key-2026';

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    let userRole = req.headers['x-user-role'];

    const authHeader: string | undefined = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const claims = this.verifyJwt(token);
      if (!claims) {
        throw new UnauthorizedException(
          'Token JWT tidak valid atau telah kedaluwarsa (401 Unauthorized)!',
        );
      }
      userRole = claims.role;
    }

    if (!userRole || !this.allowedRoles.includes(userRole)) {
      throw new ForbiddenException(
        `Akses Ditolak (403 Forbidden)! Jabatan Anda (${userRole || 'GUEST'}) dilarang menginput laporan mesin OEE. Hanya untuk: ${this.allowedRoles.join(' / ')}.`,
      );
    }

    return true;
  }

  private verifyJwt(token: string): Record<string, any> | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts;
    const expectedSig = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${header}.${body}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    if (sig !== expectedSig) return null;

    try {
      return JSON.parse(Buffer.from(body, 'base64').toString('utf8'));
    } catch {
      return null;
    }
  }
}
