import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { SESSION_COOKIE } from '../config/session';
import type { AuthService } from '../services/AuthService';
import { emailSchema, passwordSchema, telefonoSchema, texto } from '../utils/sanitize';
import { AppError } from '../utils/errors';
import { BaseController } from './BaseController';

const registroSchema = z.object({
  nombre: texto(3, 80),
  email: emailSchema,
  telefono: telefonoSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es obligatoria.').max(128),
});

const SIETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export class AuthController extends BaseController {
  constructor(private readonly auth: AuthService) {
    super();
  }

  private establecerCookie(res: Response, token: string): void {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.isProduction,
      maxAge: SIETE_DIAS_MS,
      path: '/',
    });
  }

  registrar = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      const data = registroSchema.parse(req.body);
      const { usuario, token } = await this.auth.registrar(data);
      this.establecerCookie(res, token);
      res.status(201).json({ usuario });
    });

  iniciarSesion = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      const data = loginSchema.parse(req.body);
      const { usuario, token } = await this.auth.iniciarSesion(data);
      this.establecerCookie(res, token);
      res.json({ usuario });
    });

  cerrarSesion = (_req: Request, res: Response): void => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ mensaje: 'Sesión cerrada.' });
  };

  perfil = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.run(next, async () => {
      if (!req.user) throw AppError.unauthorized();
      const usuario = await this.auth.perfil(req.user.id);
      res.json({ usuario });
    });
}
