import type { NextFunction, Request, Response } from 'express';
import { SESSION_COOKIE } from '../config/session';
import type { Rol } from '../entities';
import type { AuthService } from '../services/AuthService';
import { AppError } from '../utils/errors';

export class AuthGuard {
  constructor(private readonly auth: AuthService) {}

  private extraerToken(req: Request): string | null {
    const cookieToken = (req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE];
    if (typeof cookieToken === 'string' && cookieToken.length > 0) return cookieToken;

    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7).trim();

    return null;
  }

  autenticar = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extraerToken(req);
      if (!token) throw AppError.unauthorized();

      const payload = this.auth.verificarToken(token);
      const sesion = await this.auth.obtenerSesion(payload.sub);
      if (!sesion) throw AppError.unauthorized('La cuenta no está activa.');

      req.user = sesion;
      next();
    } catch (error) {
      next(error);
    }
  };

  autorizar(...roles: Rol[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
      if (!req.user) {
        next(AppError.unauthorized());
        return;
      }
      if (!roles.includes(req.user.rol)) {
        next(AppError.forbidden());
        return;
      }
      next();
    };
  }
}
